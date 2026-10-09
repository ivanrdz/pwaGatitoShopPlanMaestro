import { describe, expect, it } from 'vitest';
import { calcularLibro } from '../finance';
import { ajustesIniciales, productosIniciales } from '../defaults';
import type { Datos } from '../types';

/** La app arranca vacía: tú subes los cortes y capturas tu inventario. */
describe('arranque en cero', () => {
  const datos: Datos = {
    ajustes: ajustesIniciales(),
    productos: productosIniciales(),
    reportes: [],
    compras: [],
    cobros: [],
  };

  it('no trae inventario, mínimos, deuda ni reserva', () => {
    for (const p of datos.productos) {
      expect(p.stockInicial).toBe(0);
      expect(p.puntoReorden).toBe(0);
    }
    expect(datos.ajustes.deudaInicialBanco).toBe(0);
    expect(datos.ajustes.saldoInicialReserva).toBe(0);
    expect(datos.ajustes.saldoInicialPublicidad).toBe(0);
  });

  it('sin cortes no hay pagos, deuda ni piezas en existencia', () => {
    const libro = calcularLibro(datos);
    expect(libro.pagos).toEqual([]);
    expect(libro.deudaBanco).toBe(0);
    expect(libro.reserva).toBe(0);
    for (const e of libro.inventario) expect(e.stock).toBe(0);
  });
});
