/* Service worker de Gatito Finanzas.
 * - Navegación: red primero, con respaldo en caché (la app abre sin internet).
 * - Archivos estáticos: caché primero (los nombres de Vite llevan hash, así que nunca quedan viejos).
 * - Compartir: recibe el PDF que mandas desde WhatsApp u otra app (share_target del manifest).
 */
const VERSION = 'gatito-v1';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== VERSION && k !== 'gatito-compartido').map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.method === 'POST' && url.pathname === '/compartir') {
    event.respondWith(
      (async () => {
        const datos = await request.formData();
        const archivo = datos.get('reporte');
        if (archivo && typeof archivo !== 'string') {
          const cache = await caches.open('gatito-compartido');
          await cache.put(
            '/reporte-compartido',
            new Response(archivo, {
              headers: {
                'content-type': 'application/pdf',
                'x-nombre': encodeURIComponent(archivo.name || 'reporte.pdf'),
              },
            }),
          );
        }
        return Response.redirect('/?compartido=1#/reportes', 303);
      })(),
    );
    return;
  }

  if (request.method !== 'GET') return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copia = res.clone();
          caches.open(VERSION).then((c) => c.put('/index.html', copia));
          return res;
        })
        .catch(() => caches.match('/index.html')),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ||
        fetch(request).then((res) => {
          if (res.ok && res.type === 'basic') {
            const copia = res.clone();
            caches.open(VERSION).then((c) => c.put(request, copia));
          }
          return res;
        }),
    ),
  );
});
