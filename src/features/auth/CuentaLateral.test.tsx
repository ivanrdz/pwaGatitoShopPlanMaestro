import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { repositorioLocal } from '@/data/indexeddb';
import { SesionCtx, type Sesion } from '@/state/sesion';
import { CuentaLateral } from './CuentaLateral';

const pintar = (sesion: Partial<Sesion>) =>
  render(
    <SesionCtx.Provider value={{ repo: repositorioLocal, correo: null, salir: async () => undefined, ...sesion }}>
      <CuentaLateral />
    </SesionCtx.Provider>,
  );

describe('<CuentaLateral />', () => {
  it('muestra tu correo y cierra sesión', async () => {
    const salir = vi.fn(async () => undefined);
    pintar({ correo: 'ivan@ejemplo.com', salir });
    expect(screen.getByText('ivan@ejemplo.com')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(salir).toHaveBeenCalledOnce();
  });

  it('no aparece cuando los datos están en el dispositivo', () => {
    pintar({ correo: null });
    expect(screen.queryByRole('button', { name: 'Cerrar sesión' })).not.toBeInTheDocument();
  });
});
