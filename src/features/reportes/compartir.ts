/** Caché donde el service worker deja el PDF que llega con "Compartir". */
export const CACHE_COMPARTIDO = 'gatito-compartido';
export const URL_COMPARTIDO = '/reporte-compartido';

/** Toma el PDF compartido (si hay) y lo borra del caché. */
export async function tomarArchivoCompartido(): Promise<File | null> {
  if (!('caches' in globalThis)) return null;
  const cache = await caches.open(CACHE_COMPARTIDO);
  const r = await cache.match(URL_COMPARTIDO);
  if (!r) return null;
  const nombre = decodeURIComponent(r.headers.get('x-nombre') ?? 'reporte.pdf');
  const archivo = new File([await r.blob()], nombre, { type: 'application/pdf' });
  await cache.delete(URL_COMPARTIDO);
  return archivo;
}
