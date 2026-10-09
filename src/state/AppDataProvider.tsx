import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Datos, Reporte } from '@/domain/types';
import { calcularLibro } from '@/domain/finance';
import { nuevoId } from '@/shared/lib/format';
import { PantallaError } from '@/app/PantallaError';
import { useSesion } from './sesion';
import { useTiendas } from './tiendas';
import { AppDataCtx, idReporte, type Acciones } from './appData';

/** Carga los datos de la tienda activa y expone las acciones para modificarlos. */
export function AppDataProvider({ children }: { children: ReactNode }) {
  const { repo } = useSesion();
  const { activa } = useTiendas();
  const tienda = activa.id;
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState<unknown>(null);

  const recargar = useCallback(async () => setDatos(await repo.cargarDatos(tienda)), [repo, tienda]);

  useEffect(() => {
    recargar().catch(setError);
    if (repo.tipo === 'local') navigator.storage?.persist?.().catch(() => undefined);
  }, [recargar, repo]);

  const acciones = useMemo<Acciones>(() => {
    /** Ejecuta un cambio y vuelve a leer, para que la pantalla siempre muestre lo guardado. */
    const y = async (cambio: Promise<void>) => {
      await cambio;
      await recargar();
    };
    return {
      guardarAjustes: (a) => y(repo.guardarAjustes(tienda, a)),
      guardarProducto: (p) => y(repo.guardar(tienda, 'productos', p)),
      async agregarReportes(lista) {
        const actual = await repo.cargarDatos(tienda);
        const fijosMensual = actual.ajustes.gastosFijos.reduce((s, g) => s + g.monto, 0);
        const nuevos: Reporte[] = lista.map(({ parseado, nombreArchivo }) => {
          const { avisos: _avisos, ...resto } = parseado;
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
        await y(repo.guardar(tienda, 'reportes', nuevos));
        return nuevos;
      },
      actualizarReporte: (r) => y(repo.guardar(tienda, 'reportes', r)),
      borrarReporte: (id) => y(repo.borrar(tienda, 'reportes', id)),
      async agregarCompra(c) {
        const { ajustes } = await repo.cargarDatos(tienda);
        await y(
          repo.guardar(tienda, 'compras', {
            ...c,
            id: nuevoId(),
            premio: c.financiadoPor === 'banco' ? ajustes.premioBanco : 0,
          }),
        );
      },
      borrarCompra: (id) => y(repo.borrar(tienda, 'compras', id)),
      agregarCobro: (c) => y(repo.guardar(tienda, 'cobros', { ...c, id: nuevoId() })),
      borrarCobro: (id) => y(repo.borrar(tienda, 'cobros', id)),
      importar: (d) => y(repo.reemplazarTodo(tienda, d)),
      borrarTodo: () => y(repo.borrarTodo(tienda)),
    };
  }, [recargar, repo, tienda]);

  const libro = useMemo(() => (datos ? calcularLibro(datos) : null), [datos]);

  if (error)
    return <PantallaError error={error} alReintentar={() => recargar().then(() => setError(null), setError)} />;
  if (!datos || !libro) return <div className="pantalla-centro tenue">Cargando…</div>;
  return <AppDataCtx.Provider value={{ datos, libro, ...acciones }}>{children}</AppDataCtx.Provider>;
}
