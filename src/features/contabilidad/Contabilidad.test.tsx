import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppDataCtx } from '@/state/appData';
import { appDataPrueba, datosPrueba, semanaPrueba } from '@/test/datosPrueba';
import { estadosACsv, type Estado } from './filas';
import { ContabilidadPage } from './ContabilidadPage';

describe('CSV de estados', () => {
  it('gastos con signo menos, mes anterior opcional y BOM para Excel', () => {
    const estados: Estado[] = [
      {
        id: 'resultados',
        titulo: 'Estado de resultados',
        descripcion: '',
        filas: [
          { etiqueta: 'Ventas, entregadas', valor: 1000, anterior: 900 },
          { etiqueta: 'Logística', valor: 300, resta: true },
        ],
      },
    ];
    const csv = estadosACsv('2026-10', estados);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('"Ventas, entregadas",1000.00,900.00');
    expect(csv).toContain('Logística,-300.00,');
  });
});

describe('<ContabilidadPage />', () => {
  it('muestra los tres estados del último mes y deja ir al anterior', async () => {
    const datos = datosPrueba([semanaPrueba('2026-09-21'), semanaPrueba('2026-10-05')]);
    datos.ajustes.inventarioDesde = '2026-09-01';
    render(
      <AppDataCtx.Provider value={appDataPrueba(datos)}>
        <ContabilidadPage />
      </AppDataCtx.Provider>,
    );
    expect(screen.getByRole('heading', { name: 'Estado de resultados' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Balance general' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Flujo de efectivo' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Mes' })).toHaveDisplayValue('octubre 2026');
    await userEvent.click(screen.getByRole('button', { name: 'Mes anterior' }));
    expect(screen.getByRole('combobox', { name: 'Mes' })).toHaveDisplayValue('septiembre 2026');
  });

  it('antes del arranque solo hay estado de resultados', () => {
    const datos = datosPrueba([semanaPrueba('2026-09-21')]);
    datos.ajustes.inventarioDesde = '2026-12-01';
    render(
      <AppDataCtx.Provider value={appDataPrueba(datos)}>
        <ContabilidadPage />
      </AppDataCtx.Provider>,
    );
    expect(screen.getByRole('heading', { name: 'Estado de resultados' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Balance general' })).not.toBeInTheDocument();
    expect(screen.getByText(/antes de tu fecha de arranque/)).toBeInTheDocument();
  });
});
