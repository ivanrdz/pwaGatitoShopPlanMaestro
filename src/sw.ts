/// <reference lib="webworker" />
/**
 * Service worker de Gatito Finanzas (Workbox, inyectado por vite-plugin-pwa).
 * - Precarga todos los archivos del build: la app abre sin internet.
 * - Navegación: cualquier ruta sirve index.html (React Router decide qué pantalla mostrar).
 * - Compartir: recibe el PDF que mandas desde WhatsApp u otra app (share_target del manifest).
 */
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { clientsClaim } from 'workbox-core';
import { CACHE_COMPARTIDO, URL_COMPARTIDO } from './features/reportes/compartir';

declare const self: ServiceWorkerGlobalScope;

self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')));

registerRoute(
  ({ url, request }) => request.method === 'POST' && url.pathname === '/compartir',
  async ({ request }) => {
    const datos = await request.formData();
    const archivo = datos.get('reporte');
    if (archivo && typeof archivo !== 'string') {
      const cache = await caches.open(CACHE_COMPARTIDO);
      await cache.put(
        URL_COMPARTIDO,
        new Response(archivo, {
          headers: {
            'content-type': 'application/pdf',
            'x-nombre': encodeURIComponent(archivo.name || 'reporte.pdf'),
          },
        }),
      );
    }
    return Response.redirect('/reportes?compartido=1', 303);
  },
  'POST',
);
