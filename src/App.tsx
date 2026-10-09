import { useEffect } from 'react';
import { useHashRoute, type Ruta } from './hooks/useHashRoute';
import { CargadorProvider, useCargador } from './components/Cargador';
import { Inicio } from './pages/Inicio';
import { Reportes } from './pages/Reportes';
import { Inventario } from './pages/Inventario';
import { Banco } from './pages/Banco';
import { Ajustes } from './pages/Ajustes';
import { Indicadores } from './pages/Indicadores';
import { SelectorTienda, useTiendas } from './state/Tiendas';

const NAV: Array<{ ruta: Ruta; texto: string; icono: string }> = [
  { ruta: 'inicio', texto: 'Inicio', icono: 'M4 11l8-7 8 7v9a1 1 0 01-1 1h-5v-6h-4v6H5a1 1 0 01-1-1z' },
  { ruta: 'indicadores', texto: 'Indicadores', icono: 'M4 20V10M10 20V4M16 20v-7M22 20H2' },
  { ruta: 'reportes', texto: 'Reportes', icono: 'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6' },
  { ruta: 'inventario', texto: 'Inventario', icono: 'M3 7l9-4 9 4-9 4zM3 7v10l9 4 9-4V7M12 11v10' },
  { ruta: 'banco', texto: 'Banco', icono: 'M3 10l9-6 9 6M5 10v8M9 10v8M15 10v8M19 10v8M3 20h18' },
  { ruta: 'ajustes', texto: 'Ajustes', icono: 'M4 7h10M18 7h2M4 17h4M12 17h8M14 4v6M8 14v6' },
];

/** Si el reporte llegó con "Compartir" desde WhatsApp, lo toma del caché del service worker. */
function ArchivoCompartido() {
  const { procesar } = useCargador();
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has('compartido') || !('caches' in window)) return;
    history.replaceState(null, '', window.location.pathname + window.location.hash);
    (async () => {
      const cache = await caches.open('gatito-compartido');
      const r = await cache.match('/reporte-compartido');
      if (!r) return;
      const nombre = decodeURIComponent(r.headers.get('x-nombre') ?? 'reporte.pdf');
      const archivo = new File([await r.blob()], nombre, { type: 'application/pdf' });
      await cache.delete('/reporte-compartido');
      await procesar([archivo]);
    })().catch(() => undefined);
  }, [procesar]);
  return null;
}

export function App() {
  const { ruta, ir } = useHashRoute();
  const { activa, tiendas } = useTiendas();
  return (
    <CargadorProvider alGuardar={() => ir('inicio')}>
      <ArchivoCompartido />
      <div className="marco">
        <nav className="nav" aria-label="Secciones">
          <div className="marca" aria-hidden="true">
            <svg viewBox="0 0 32 32" width="28" height="28">
              <path d="M6 27V9l5 5h10l5-5v18z" fill="currentColor" />
              <circle cx="12.5" cy="19" r="1.6" fill="var(--papel)" />
              <circle cx="19.5" cy="19" r="1.6" fill="var(--papel)" />
            </svg>
            <span>{tiendas.length > 1 ? activa.nombre : 'Gatito'}</span>
          </div>
          <SelectorTienda className="selector-lateral" />
          <ul>
            {NAV.map((n) => (
              <li key={n.ruta}>
                <a
                  href={n.ruta === 'inicio' ? '#/' : `#/${n.ruta}`}
                  aria-current={ruta === n.ruta ? 'page' : undefined}
                >
                  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                    <path d={n.icono} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span>{n.texto}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <main className="contenido">
          <SelectorTienda className="selector-movil" />
          {ruta === 'inicio' && <Inicio ir={ir} />}
          {ruta === 'indicadores' && <Indicadores />}
          {ruta === 'reportes' && <Reportes />}
          {ruta === 'inventario' && <Inventario ir={ir} />}
          {ruta === 'banco' && <Banco />}
          {ruta === 'ajustes' && <Ajustes />}
        </main>
      </div>
    </CargadorProvider>
  );
}
