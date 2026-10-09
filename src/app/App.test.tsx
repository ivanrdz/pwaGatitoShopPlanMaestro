import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { SesionProvider } from '@/state/SesionProvider';
import { TiendasProvider } from '@/state/TiendasProvider';
import { AppDataProvider } from '@/state/AppDataProvider';
import { rutas } from './router';

/** La app completa, en modo dispositivo, con IndexedDB simulado. */
function pintarApp(ruta = '/') {
  const router = createMemoryRouter(rutas, { initialEntries: [ruta] });
  render(
    <SesionProvider>
      <TiendasProvider>
        <AppDataProvider>
          <RouterProvider router={router} />
        </AppDataProvider>
      </TiendasProvider>
    </SesionProvider>,
  );
  return router;
}

describe('App', () => {
  it('abre Inicio y navega por el menú', async () => {
    const usuario = userEvent.setup();
    const router = pintarApp();
    const menu = await screen.findByRole('navigation', { name: 'Secciones' });
    expect(await screen.findByRole('link', { name: 'Inicio' })).toHaveAttribute('aria-current', 'page');

    await usuario.click(screen.getByRole('link', { name: 'Indicadores' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Indicadores' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/indicadores');
    expect(menu).toBeInTheDocument();
  });

  it('Ajustes muestra los productos de Gatito y dónde se guardan los datos', async () => {
    pintarApp('/ajustes');
    expect(await screen.findByRole('heading', { level: 2, name: 'Productos' })).toBeInTheDocument();
    expect(screen.getByText('Soporte bocina')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Dónde se guardan tus datos' })).toBeInTheDocument();
  });

  it('una dirección que no existe ofrece volver a Inicio', async () => {
    pintarApp('/no-existe');
    expect(await screen.findByText('Esta página no existe.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ir a Inicio' })).toHaveAttribute('href', '/');
  });
});
