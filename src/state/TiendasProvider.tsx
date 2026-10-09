import { Fragment, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Tienda } from '@/domain/types';
import { TIENDA_PRINCIPAL } from '@/data/repositorio';
import { guardarTiendaActiva, leerTiendaActiva } from '@/data/preferencias';
import { nuevoId } from '@/shared/lib/format';
import { PantallaError } from '@/app/PantallaError';
import { useSesion } from './sesion';
import { TiendasCtx, type TiendasCtxValor } from './tiendas';

/** Cada tienda tiene sus propios reportes, productos, banco y ajustes. Al cambiar, la app se vuelve a montar con sus datos. */
export function TiendasProvider({ children }: { children: ReactNode }) {
  const { repo } = useSesion();
  const [tiendas, setTiendas] = useState<Tienda[] | null>(null);
  const [activaId, setActivaId] = useState(() => leerTiendaActiva() ?? TIENDA_PRINCIPAL.id);
  const [error, setError] = useState<unknown>(null);

  const recargar = useCallback(async () => setTiendas(await repo.listarTiendas()), [repo]);

  useEffect(() => {
    recargar().catch(setError);
  }, [recargar]);

  const cambiar = useCallback((id: string) => {
    guardarTiendaActiva(id);
    setActivaId(id);
  }, []);

  const valor = useMemo<TiendasCtxValor | null>(() => {
    if (!tiendas) return null;
    return {
      tiendas,
      activa: tiendas.find((t) => t.id === activaId) ?? tiendas[0] ?? TIENDA_PRINCIPAL,
      cambiar,
      async crear(nombre, nombreEnReporte) {
        const t = { id: nuevoId(), nombre: nombre.trim() || 'Tienda nueva' };
        await repo.crearTienda(t, nombreEnReporte);
        await recargar();
        cambiar(t.id);
      },
      async renombrar(id, nombre) {
        await repo.renombrarTienda(id, nombre);
        await recargar();
      },
      async eliminar(id) {
        if (id === TIENDA_PRINCIPAL.id) return;
        await repo.eliminarTienda(id);
        await recargar();
        if (id === activaId) cambiar(TIENDA_PRINCIPAL.id);
      },
    };
  }, [tiendas, activaId, cambiar, recargar, repo]);

  if (error)
    return <PantallaError error={error} alReintentar={() => recargar().then(() => setError(null), setError)} />;
  if (!valor) return <div className="pantalla-centro tenue">Cargando…</div>;
  return (
    <TiendasCtx.Provider value={valor}>
      <Fragment key={valor.activa.id}>{children}</Fragment>
    </TiendasCtx.Provider>
  );
}
