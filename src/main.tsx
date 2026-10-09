import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import './styles.css';
import { AppDataProvider } from './state/AppData';
import { TiendasProvider } from './state/Tiendas';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TiendasProvider>
      <AppDataProvider>
        <App />
      </AppDataProvider>
    </TiendasProvider>
  </StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}
