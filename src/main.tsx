import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { registerSW } from 'virtual:pwa-register';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@/app/styles.css';
import { ErrorBoundary } from '@/app/ErrorBoundary';
import { router } from '@/app/router';
import { SesionProvider } from '@/state/SesionProvider';
import { TiendasProvider } from '@/state/TiendasProvider';
import { AppDataProvider } from '@/state/AppDataProvider';

const raiz = document.getElementById('root');
if (!raiz) throw new Error('Falta el elemento #root en index.html');

createRoot(raiz).render(
  <StrictMode>
    <ErrorBoundary>
      <SesionProvider>
        <TiendasProvider>
          <AppDataProvider>
            <RouterProvider router={router} />
          </AppDataProvider>
        </TiendasProvider>
      </SesionProvider>
    </ErrorBoundary>
  </StrictMode>,
);

if (import.meta.env.PROD) registerSW({ immediate: true });
