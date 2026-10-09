import type { Repositorio } from './repositorio';

export interface ResultadoSubida {
  tiendas: number;
  reportes: number;
}

/**
 * Copia todas las tiendas de este dispositivo a la nube.
 * Si una tienda ya existe en la nube, sus datos se reemplazan por los del dispositivo.
 */
export async function subirANube(
  local: Repositorio,
  nube: Repositorio,
  alAvanzar?: (texto: string) => void,
): Promise<ResultadoSubida> {
  const locales = await local.listarTiendas();
  const enNube = new Set((await nube.listarTiendas()).map((t) => t.id));
  let reportes = 0;
  for (const t of locales) {
    alAvanzar?.(`Subiendo ${t.nombre}…`);
    const datos = await local.cargarDatos(t.id);
    if (!enNube.has(t.id)) await nube.crearTienda(t, datos.ajustes.nombreEnReporte);
    else await nube.renombrarTienda(t.id, t.nombre);
    await nube.reemplazarTodo(t.id, datos);
    reportes += datos.reportes.length;
  }
  return { tiendas: locales.length, reportes };
}
