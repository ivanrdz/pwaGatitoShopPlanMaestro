import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dialogo } from './Dialogo';

describe('<Dialogo />', () => {
  it('muestra el contenido solo cuando está abierto y se nombra con su título', () => {
    const { rerender } = render(
      <Dialogo abierto={false} titulo="Registrar compra" alCerrar={() => undefined}>
        <p>Contenido</p>
      </Dialogo>,
    );
    expect(screen.queryByText('Contenido')).not.toBeInTheDocument();
    rerender(
      <Dialogo abierto titulo="Registrar compra" alCerrar={() => undefined}>
        <p>Contenido</p>
      </Dialogo>,
    );
    expect(screen.getByRole('dialog', { name: 'Registrar compra' })).toBeInTheDocument();
    expect(screen.getByText('Contenido')).toBeInTheDocument();
  });

  it('el botón Cerrar avisa al padre', async () => {
    const alCerrar = vi.fn();
    render(
      <Dialogo abierto titulo="Hola" alCerrar={alCerrar}>
        <p>x</p>
      </Dialogo>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(alCerrar).toHaveBeenCalled();
  });
});
