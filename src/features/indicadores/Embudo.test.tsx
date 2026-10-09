import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppDataCtx } from '@/state/appData';
import { appDataPrueba, datosPrueba, semanaPrueba } from '@/test/datosPrueba';
import { Embudo } from './Embudo';

const pintar = (datos = datosPrueba()) =>
  render(
    <AppDataCtx.Provider value={appDataPrueba(datos)}>
      <Embudo />
    </AppDataCtx.Provider>,
  );

describe('<Embudo />', () => {
  it('muestra envíos, entregados y el porcentaje de entrega', () => {
    pintar();
    const embudo = screen.getByRole('region', { name: 'Tu embudo' });
    expect(within(embudo).getByText('Envíos a ruta').nextSibling).toHaveTextContent('100');
    expect(within(embudo).getByText(/Entregados/)).toHaveTextContent('(50%)');
    expect(within(embudo).getByText('Canceló')).toBeInTheDocument();
  });

  it('calcula cuántos envíos necesitas para una meta', async () => {
    const usuario = userEvent.setup();
    pintar();
    await usuario.click(screen.getByRole('tab', { name: 'Quiero ganar $X' }));
    expect(screen.getByText('Envíos que necesitas')).toBeInTheDocument();

    const meta = screen.getByLabelText('Utilidad que quiero por semana');
    await usuario.clear(meta);
    await usuario.type(meta, '0');
    expect(screen.getByText('Envíos que necesitas').nextSibling).toHaveTextContent('0 por semana');
  });

  it('cambiar los envíos actualiza la utilidad esperada', async () => {
    const usuario = userEvent.setup();
    pintar();
    const utilidad = () => screen.getByText('Utilidad esperada').nextSibling?.textContent;
    const antes = utilidad();
    const envios = screen.getByLabelText('Envíos que quiero hacer');
    await usuario.clear(envios);
    await usuario.type(envios, '200');
    expect(utilidad()).not.toBe(antes);
  });

  it('el periodo cambia cuántas semanas se cuentan', async () => {
    const usuario = userEvent.setup();
    const semanas = ['2026-08-03', '2026-08-10', '2026-08-17', '2026-08-24', '2026-08-31', '2026-09-07'];
    pintar(datosPrueba(semanas.map((s) => semanaPrueba(s))));
    expect(screen.getByText(/^6 semanas:/)).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: '4 semanas' }));
    expect(screen.getByText(/^4 semanas:/)).toBeInTheDocument();
  });

  it('sin reportes, invita a subirlos', () => {
    pintar(datosPrueba([]));
    expect(screen.getByText(/aparece cuando subas tus reportes/)).toBeInTheDocument();
  });
});
