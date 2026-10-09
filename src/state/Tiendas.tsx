import { createContext, Fragment, useCallback, useContext, useState, type ReactNode } from 'react';
import * as db from '../lib/db';
import type { Tienda } from '../lib/types';
import { nuevoId } from '../lib/format';

interface Ctx {
  tiendas: Tienda[];
  activa: Tienda;
  cambiar: (id: string) => void;
  crear: (nombre: string, nombreEnReporte: string) => Promise<void>;
  renombrar: (id: string, nombre: string) => void;
  eliminar: (id: string) => Promise<void>;
}

const TiendasCtx = createContext<Ctx | null>(null);

/** Cada tienda tiene sus propios reportes, productos, banco y ajustes. Al cambiar, la app se vuelve a montar con sus datos. */
export function TiendasProvider({ children }: { children: ReactNode }) {
  const [tiendas, setTiendas] = useState<Tienda[]>(db.listarTiendas);
  const [activaId, setActivaId] = useState(db.tiendaActiva);
  const activa = tiendas.find((t) => t.id === activaId) ?? tiendas[0];

  const cambiar = useCallback((id: string) => {
    db.usarTienda(id);
    setActivaId(id);
    window.location.hash = '/';
  }, []);

  const guardar = (lista: Tienda[]) => {
    db.guardarTiendas(lista);
    setTiendas(lista);
  };

  const crear = async (nombre: string, nombreEnReporte: string) => {
    const t = { id: nuevoId(), nombre: nombre.trim() || 'Tienda nueva' };
    await db.crearTienda(t, nombreEnReporte.trim());
    guardar([...tiendas, t]);
    cambiar(t.id);
  };

  const renombrar = (id: string, nombre: string) => guardar(tiendas.map((t) => (t.id === id ? { ...t, nombre } : t)));

  const eliminar = async (id: string) => {
    if (id === db.TIENDA_PRINCIPAL.id) return;
    await db.eliminarTienda(id);
    guardar(tiendas.filter((t) => t.id !== id));
    if (id === activaId) cambiar(db.TIENDA_PRINCIPAL.id);
  };

  return (
    <TiendasCtx.Provider value={{ tiendas, activa, cambiar, crear, renombrar, eliminar }}>
      <Fragment key={activa.id}>{children}</Fragment>
    </TiendasCtx.Provider>
  );
}

export function useTiendas() {
  const c = useContext(TiendasCtx);
  if (!c) throw new Error('useTiendas debe usarse dentro de TiendasProvider');
  return c;
}

/** Selector de tienda. Solo aparece cuando tienes más de una. */
export function SelectorTienda({ className = '' }: { className?: string }) {
  const { tiendas, activa, cambiar } = useTiendas();
  if (tiendas.length < 2) return null;
  return (
    <label className={`selector-tienda ${className}`}>
      <span>Tienda</span>
      <select value={activa.id} onChange={(e) => cambiar(e.target.value)}>
        {tiendas.map((t) => (
          <option key={t.id} value={t.id}>
            {t.nombre}
          </option>
        ))}
      </select>
    </label>
  );
}
