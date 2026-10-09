import { describe, expect, it } from 'vitest';
import { calcularLibro } from '../finance';
import { kpisPorSemana } from '../series';
import { ajustesIniciales, productosIniciales } from '../defaults';
import type { Datos, Reporte } from '../types';
import { ESTATUS } from '../types';

const estatus = () => Object.fromEntries(ESTATUS.map((e) => [e, { monto: 0, pedidos: 0 }])) as Reporte['estatus'];

function reporte(tipo: Reporte['tipo'], efectivo: number, piezas: Record<string, number>, pedidos: number): Reporte {
  return {
    id: `2026-09-28-${tipo}`,
    semana: '2026-09-28',
    etiqueta: '28SEP-03OCT',
    tipo,
    ventas: efectivo,
    pedidosEntregados: pedidos,
    logistica: 0,
    costoProducto: 0,
    efectivo,
    estatus: estatus(),
    dias: [],
    piezas,
    noReconocidos: [],
    reemplazos: 0,
    reemplazosPorProducto: {},
    tienda: 'GATITOSHOP',
    nombreArchivo: 'x.pdf',
    cargadoEn: '2026-10-01T00:00:00Z',
    snapshot: { gastoDiarioPublicidad: 600, sueldoMensual: 18000, fijosMensual: 1140, premioBanco: 0.15 },
  };
}

function datos(extra: Partial<Datos> = {}): Datos {
  return {
    ajustes: { ...ajustesIniciales(), inventarioDesde: '2026-09-01' },
    productos: productosIniciales().map((p) => (p.id === 'bocina' ? { ...p, stockInicial: 100 } : p)),
    reportes: [],
    compras: [],
    cobros: [],
    ...extra,
  };
}

describe('calcularLibro', () => {
  it('separa el pago del jueves y el del lunes', () => {
    const libro = calcularLibro(
      datos({
        reportes: [reporte('parcial', 8000, { bocina: 10 }, 50), reporte('completo', 15000, { bocina: 25 }, 99)],
      }),
    );
    expect(libro.pagos.map((p) => [p.tipo, p.efectivo, p.piezas.bocina, p.dias])).toEqual([
      ['jueves', 8000, 10, 3],
      ['lunes', 7000, 15, 4],
    ]);
  });

  it('regresa al banco costo + premio y nunca más de lo que se debe', () => {
    const libro = calcularLibro(
      datos({
        compras: [
          { id: 'c1', fecha: '2026-09-01', financiadoPor: 'banco', items: [{ productoId: 'bocina', piezas: 100, costo: 1000 }], guia: 0, premio: 0.15 },
        ],
        reportes: [reporte('completo', 20000, { bocina: 25 }, 99)],
      }),
    );
    const [pago] = libro.pagos;
    expect(pago.banco).toBeCloseTo(1150);
    expect(libro.deudaBanco).toBeCloseTo(0);
    const costoBocina = productosIniciales().find((p) => p.id === 'bocina')!.costoUnitario;
    expect(pago.fondoInventario).toBeCloseTo(25 * costoBocina - 1000);
  });

  it('cuadra: la suma de los sobres es el efectivo', () => {
    const libro = calcularLibro(datos({ reportes: [reporte('completo', 15000, { bocina: 25, foco: 10 }, 99)] }));
    const p = libro.pagos[0];
    expect(p.banco + p.fondoInventario + p.publicidad + p.fijos + p.sueldo + p.ahorro).toBeCloseTo(p.efectivo);
    expect(p.publicidad).toBe(600 * 7);
  });

  it('descuenta el inventario y el sobre de publicidad', () => {
    const libro = calcularLibro(
      datos({
        reportes: [reporte('completo', 15000, { bocina: 25 }, 99)],
        cobros: [{ id: 'f1', fecha: '2026-10-02', monto: 4000 }],
      }),
    );
    expect(libro.inventario.find((e) => e.producto.id === 'bocina')?.stock).toBe(75);
    expect(libro.sobrePublicidad).toBe(4200 - 4000);
  });

  it('los pagos de antes del arranque no mueven saldos', () => {
    const base = datos({ reportes: [reporte('completo', 15000, { bocina: 25 }, 99)] });
    const libro = calcularLibro({ ...base, ajustes: { ...base.ajustes, inventarioDesde: '2026-10-10', saldoInicialReserva: 500 } });
    expect(libro.pagos[0].previo).toBe(true);
    expect(libro.sobrePublicidad).toBe(0);
    expect(libro.reserva).toBe(500);
  });
});

describe('kpisPorSemana', () => {
  it('usa el reporte completo y calcula costo por pedido y ROAS', () => {
    const base = datos({
      reportes: [reporte('parcial', 8000, { bocina: 10 }, 50), reporte('completo', 15000, { bocina: 25 }, 100)],
    });
    const [k] = kpisPorSemana(base);
    expect(k.completa).toBe(true);
    expect(k.costoPorPedido).toBe(42);
    expect(k.roas).toBeCloseTo(15000 / 4200);
  });
});
