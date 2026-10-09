import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Ajustes, CobroPublicidad, Compra, Datos, Producto, Reporte, ReporteParseado } from '../lib/types';
import * as db from '../lib/db';
import { calcularLibro, type Libro } from '../lib/finance';
import { nuevoId } from '../lib/format';

interface Acciones {
  guardarAjustes: (a: Ajustes) => Promise<void>;
  guardarProducto: (p: Producto) => Promise<void>;
  agregarReportes: (r: Array<{ parseado: ReporteParseado; nombreArchivo: string }>) => Promise<Reporte[]>;
  actualizarReporte: (r: Reporte) => Promise<void>;
  borrarReporte: (id: string) => Promise<void>;
  agregarCompra: (c: Omit<Compra, 'id' | 'premio'>) => Promise<void>;
  borrarCompra: (id: string) => Promise<void>;
  agregarCobro: (c: Omit<CobroPublicidad, 'id'>) => Promise<void>;
  borrarCobro: (id: string) => Promise<void>;
  importar: (d: Datos) => Promise<void>;
  borrarTodo: () => Promise<void>;
}

interface Contexto extends Acciones {
  datos: Datos;
  libro: Libro;
}

const Ctx = createContext<Contexto | null>(null);

export const idReporte = (semana: string, tipo: Reporte['tipo']) => `${semana}-${tipo}`;

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recargar = useCallback(async () => {
    setDatos(await db.cargarDatos());
  }, []);

  useEffect(() => {
    recargar().catch((e: unknown) =>
      setError(e instanceof Error ? e.message : 'No pude abrir el almacenamiento del navegador.'),
    );
    navigator.storage?.persist?.().catch(() => undefined);
  }, [recargar]);

  const acciones = useMemo<Acciones>(
    () => ({
      async guardarAjustes(a) {
        await db.guardarAjustes(a);
        await recargar();
      },
      async guardarProducto(p) {
        await db.guardar('productos', p);
        await recargar();
      },
      async agregarReportes(lista) {
        const actual = await db.cargarDatos();
        const fijosMensual = actual.ajustes.gastosFijos.reduce((s, g) => s + g.monto, 0);
        const nuevos: Reporte[] = lista.map(({ parseado, nombreArchivo }) => {
          const { avisos: _avisos, ...resto } = parseado;
          void _avisos;
          const id = idReporte(parseado.semana, parseado.tipo);
          const previo = actual.reportes.find((r) => r.id === id);
          return {
            ...resto,
            id,
            nombreArchivo,
            cargadoEn: new Date().toISOString(),
            // Si reemplazas un reporte, conserva los valores que ya habías ajustado para ese periodo.
            snapshot: previo?.snapshot ?? {
              gastoDiarioPublicidad: actual.ajustes.gastoDiarioPublicidad,
              sueldoMensual: actual.ajustes.sueldoMensual,
              fijosMensual,
              premioBanco: actual.ajustes.premioBanco,
            },
          };
        });
        await db.guardar('reportes', nuevos);
        await recargar();
        return nuevos;
      },
      async actualizarReporte(r) {
        await db.guardar('reportes', r);
        await recargar();
      },
      async borrarReporte(id) {
        await db.borrar('reportes', id);
        await recargar();
      },
      async agregarCompra(c) {
        const { ajustes } = await db.cargarDatos();
        await db.guardar('compras', { ...c, id: nuevoId(), premio: c.financiadoPor === 'banco' ? ajustes.premioBanco : 0 });
        await recargar();
      },
      async borrarCompra(id) {
        await db.borrar('compras', id);
        await recargar();
      },
      async agregarCobro(c) {
        await db.guardar('cobros', { ...c, id: nuevoId() });
        await recargar();
      },
      async borrarCobro(id) {
        await db.borrar('cobros', id);
        await recargar();
      },
      async importar(d) {
        await db.reemplazarTodo(d);
        await recargar();
      },
      async borrarTodo() {
        await db.borrarTodo();
        await recargar();
      },
    }),
    [recargar],
  );

  const libro = useMemo(() => (datos ? calcularLibro(datos) : null), [datos]);

  if (error) {
    return (
      <div className="pantalla-centro">
        <p>{error}</p>
        <p className="tenue">Revisa que el navegador no esté en modo incógnito y vuelve a abrir la app.</p>
      </div>
    );
  }
  if (!datos || !libro) {
    return <div className="pantalla-centro tenue">Cargando…</div>;
  }
  return <Ctx.Provider value={{ datos, libro, ...acciones }}>{children}</Ctx.Provider>;
}

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp debe usarse dentro de AppDataProvider');
  return ctx;
}
