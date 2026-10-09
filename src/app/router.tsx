import { createBrowserRouter } from 'react-router';
import { Layout } from './Layout';
import { ErrorDeRuta } from './ErrorDeRuta';

/** Cada pantalla se descarga solo cuando la abres (lazy loading). */
export const router = createBrowserRouter([
  {
    path: '/',
    Component: Layout,
    ErrorBoundary: ErrorDeRuta,
    children: [
      { index: true, lazy: async () => ({ Component: (await import('@/features/inicio/InicioPage')).InicioPage }) },
      {
        path: 'indicadores',
        lazy: async () => ({ Component: (await import('@/features/indicadores/IndicadoresPage')).IndicadoresPage }),
      },
      {
        path: 'reportes',
        lazy: async () => ({ Component: (await import('@/features/reportes/ReportesPage')).ReportesPage }),
      },
      {
        path: 'inventario',
        lazy: async () => ({ Component: (await import('@/features/inventario/InventarioPage')).InventarioPage }),
      },
      { path: 'banco', lazy: async () => ({ Component: (await import('@/features/banco/BancoPage')).BancoPage }) },
      {
        path: 'ajustes',
        lazy: async () => ({ Component: (await import('@/features/ajustes/AjustesPage')).AjustesPage }),
      },
      { path: '*', lazy: async () => ({ Component: (await import('./NoEncontrado')).NoEncontrado }) },
    ],
  },
]);
