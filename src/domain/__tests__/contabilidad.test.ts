import { describe, expect, it } from 'vitest';
import { calcularLibro } from '@/domain/finance';
import { contabilidadMensual } from '@/domain/contabilidad';
import { ajustesIniciales, productosIniciales } from '@/domain/defaults';
import { ESTATUS, type Datos, type Reporte } from '@/domain/types';

function reporte(
  semana: string,
  tipo: Reporte['tipo'],
  c: { ventas: number; logistica: number; costoProducto: number; bocina: number; pedidos: number },
): Reporte {
  return {
    id: `${semana}-${tipo}`,
    semana,
    etiqueta: '',
    tipo,
    ventas: c.ventas,
    pedidosEntregados: c.pedidos,
    logistica: c.logistica,
    costoProducto: c.costoProducto,
    efectivo: c.ventas - c.logistica - c.costoProducto,
    estatus: Object.fromEntries(ESTATUS.map((e) => [e, { monto: 0, pedidos: 0 }])) as Reporte['estatus'],
    dias: [],
    piezas: { bocina: c.bocina },
    noReconocidos: [],
    reemplazos: 0,
    reemplazosPorProducto: {},
    tienda: 'GATITOSHOP',
    nombreArchivo: '',
    cargadoEn: '',
    snapshot: { gastoDiarioPublicidad: 600, sueldoMensual: 18000, fijosMensual: 1140, premioBanco: 0.15 },
  };
}

function escenario(extra: Partial<Datos> = {}): Datos {
  return {
    ajustes: {
      ...ajustesIniciales(),
      inventarioDesde: '2026-10-01',
      saldoInicialReserva: 1000,
      saldoInicialPublicidad: 500,
      deudaInicialBanco: 0,
    },
    // Costo por pieza = (5,500 + 255) / 100 = 57.55, igual que una caja con su guía.
    productos: productosIniciales().map((p) => (p.id === 'bocina' ? { ...p, stockInicial: 50 } : p)),
    reportes: [
      // Septiembre (antes del arranque): solo estado de resultados.
      reporte('2026-09-21', 'completo', { ventas: 9000, logistica: 3000, costoProducto: 200, bocina: 30, pedidos: 40 }),
      // Octubre: jueves 8 y lunes 12.
      reporte('2026-10-05', 'parcial', { ventas: 6000, logistica: 2000, costoProducto: 100, bocina: 20, pedidos: 25 }),
      reporte('2026-10-05', 'completo', {
        ventas: 14000,
        logistica: 4600,
        costoProducto: 250,
        bocina: 45,
        pedidos: 58,
      }),
    ],
    compras: [
      {
        id: 'c1',
        fecha: '2026-10-06',
        financiadoPor: 'banco',
        items: [{ productoId: 'bocina', piezas: 100, costo: 5500 }],
        guia: 255,
        premio: 0.15,
      },
    ],
    cobros: [{ id: 'f1', fecha: '2026-10-10', monto: 4000 }],
    ...extra,
  };
}

describe('contabilidad mensual', () => {
  const datos = escenario();
  const meses = contabilidadMensual(datos, calcularLibro(datos, '2026-10-31'));
  const sep = meses.find((m) => m.mes === '2026-09')!;
  const oct = meses.find((m) => m.mes === '2026-10')!;

  it('antes del arranque solo hay estado de resultados', () => {
    expect(sep.resultados.ventas).toBe(9000);
    expect(sep.balance).toBeNull();
    expect(sep.flujo).toBeNull();
  });

  it('estado de resultados de octubre', () => {
    const r = oct.resultados;
    expect(r.ventas).toBe(14000);
    expect(r.logistica).toBe(4600);
    expect(r.costoProveedor).toBe(250);
    expect(r.costoCaja).toBeCloseTo(45 * 57.55);
    expect(r.publicidad).toBe(4000);
    expect(r.publicidadEstimada).toBe(false);
    expect(r.premioBanco).toBeCloseTo(5755 * 0.15);
    expect(r.utilidadBruta).toBeCloseTo(r.ventas - r.costoCaja - r.costoProveedor);
    expect(r.utilidadNeta).toBeCloseTo(r.utilidadAntesSueldo - r.sueldo);
  });

  it('el balance cuadra: activos = pasivos + capital', () => {
    const b = oct.balance!;
    expect(b.fecha).toBe('2026-10-31');
    expect(b.totalActivos).toBeCloseTo(b.totalPasivos + b.capital);
    expect(b.inventarioPorProducto).toEqual([
      { productoId: 'bocina', piezas: 50 + 100 - 45, valor: expect.closeTo(105 * 57.55, 2) },
    ]);
    expect(b.deudaBanco).toBeCloseTo(5755 * 1.15 - oct.flujo!.pagosBanco);
  });

  it('el flujo de efectivo llega exacto al efectivo del balance', () => {
    const f = oct.flujo!;
    expect(f.saldoInicial).toBe(1500);
    expect(f.saldoInicial + f.cambioNeto).toBeCloseTo(f.saldoFinal);
    expect(f.saldoFinal).toBeCloseTo(oct.balance!.efectivo);
    expect(f.comprasConBanco).toBe(5755);
  });

  it('el capital crece exactamente lo que dice la utilidad neta', () => {
    const c = oct.capital!;
    expect(c.inicial).toBeCloseTo(1500 + 50 * 57.55);
    expect(c.otros).toBeCloseTo(0, 6);
    expect(c.final).toBeCloseTo(c.inicial + c.utilidadNeta);
  });

  it('sin cobros de Facebook registrados, la publicidad se estima y la diferencia se ve en "otros"', () => {
    const d = escenario({ cobros: [] });
    const m = contabilidadMensual(d, calcularLibro(d, '2026-10-31')).find((x) => x.mes === '2026-10')!;
    expect(m.resultados.publicidadEstimada).toBe(true);
    expect(m.resultados.publicidad).toBeCloseTo(600 * 7);
    expect(m.capital!.publicidadSinCobrar).toBeCloseTo(600 * 7, 6);
    expect(m.capital!.otros).toBeCloseTo(0, 6);
  });

  it('las piezas vendidas antes del conteo inicial se explican aparte', () => {
    // Arranque el sábado 10: el pago del lunes 12 cubre jueves a sábado, antes del conteo.
    const d = escenario({ ajustes: { ...escenario().ajustes, inventarioDesde: '2026-10-10' } });
    const m = contabilidadMensual(d, calcularLibro(d, '2026-10-31')).find((x) => x.mes === '2026-10')!;
    expect(m.capital!.vendidoAntesDelConteo).toBeCloseTo(25 * 57.55);
    expect(m.capital!.otros).toBeCloseTo(0, 6);
  });
});
