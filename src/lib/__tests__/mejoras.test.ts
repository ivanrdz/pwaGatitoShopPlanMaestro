import { describe, expect, it } from 'vitest';
import { calcularLibro } from '../finance';
import { reemplazosPorProducto } from '../series';
import { baseSimulacion, escenarioActual, simular } from '../simulador';
import { parseReportText } from '../parseReport';
import { ajustesIniciales, productosIniciales } from '../defaults';
import { ESTATUS, type Datos, type Reporte } from '../types';
import { reporteCompleto } from './fixture';

const estatus = (ok: number) => {
  const e = Object.fromEntries(ESTATUS.map((x) => [x, { monto: 0, pedidos: 0 }])) as Reporte['estatus'];
  e.OK.pedidos = ok;
  e.CANCELO.pedidos = Math.round(ok / 2);
  return e;
};

function semana(
  lunes: string,
  piezas: Record<string, number>,
  pedidos: number,
  reemp: Record<string, number> = {},
): Reporte {
  return {
    id: `${lunes}-completo`,
    semana: lunes,
    etiqueta: '',
    tipo: 'completo',
    ventas: pedidos * 230,
    pedidosEntregados: pedidos,
    logistica: pedidos * 60,
    costoProducto: 0,
    efectivo: pedidos * 170,
    estatus: estatus(pedidos),
    dias: [],
    piezas,
    noReconocidos: [],
    reemplazos: Object.values(reemp).length ? 1 : 0,
    reemplazosPorProducto: reemp,
    tienda: 'GATITOSHOP',
    nombreArchivo: '',
    cargadoEn: '',
    snapshot: { gastoDiarioPublicidad: 700, sueldoMensual: 18000, fijosMensual: 1140, premioBanco: 0.15 },
  };
}

const datos = (reportes: Reporte[], extra: Partial<Datos> = {}): Datos => ({
  ajustes: { ...ajustesIniciales(), inventarioDesde: '2026-09-01', gastoDiarioPublicidad: 700 },
  productos: productosIniciales().map((p) =>
    p.id === 'encendedor' ? { ...p, stockInicial: 200, puntoReorden: 0 } : p,
  ),
  reportes,
  compras: [],
  cobros: [],
  ...extra,
});

describe('punto de reorden con días de entrega', () => {
  it('pide con anticipación según lo que tarda el proveedor', () => {
    // 70 encendedores por semana = 10 al día. Tarda 7 días + 3 de colchón → pedir al quedar 100.
    const libro = calcularLibro(datos([semana('2026-09-07', { encendedor: 70 }, 70)]), '2026-09-14');
    const e = libro.inventario.find((x) => x.producto.id === 'encendedor')!;
    expect(e.stock).toBe(130);
    expect(e.puntoPedido).toBe(100);
    expect(e.diasParaPedir).toBe(3);
    expect(e.pedirAntesDe).toBe('2026-09-17');
    expect(e.bajo).toBe(false);
  });
});

describe('reemplazos por producto', () => {
  it('suma piezas reemplazadas y su porcentaje', () => {
    const r = reemplazosPorProducto(
      datos([semana('2026-09-07', { foco: 22 }, 20, { foco: 2 }), semana('2026-09-14', { foco: 12 }, 10, { foco: 2 })]),
    );
    const foco = r.productos[0];
    expect(foco.productoId).toBe('foco');
    expect(foco.reemplazadas).toBe(4);
    expect(foco.vendidas).toBe(30);
    expect(foco.costoPiezas).toBe(4 * 54);
  });

  it('el lector separa los reemplazos por producto', () => {
    const r = parseReportText(reporteCompleto, productosIniciales());
    expect(r.reemplazosPorProducto).toEqual({ bocina: 1, foco: 1 });
    expect(r.tienda).toBe('GATITOSHOP');
  });
});

describe('simulador', () => {
  const d = datos([semana('2026-09-07', { bocina: 25 }, 98), semana('2026-09-14', { bocina: 25 }, 98)]);
  const base = baseSimulacion(d, calcularLibro(d))!;

  it('toma el costo por pedido real', () => {
    expect(base.costoPorPedido).toBeCloseTo(50);
  });

  it('más publicidad trae más pedidos al mismo costo', () => {
    const hoy = simular(base, escenarioActual(base));
    const mas = simular(base, { ...escenarioActual(base), publicidadDiaria: 1400 });
    expect(mas.pedidosSemana).toBeCloseTo(hoy.pedidosSemana * 2);
  });

  it('subir el sueldo baja el ahorro exactamente en la diferencia', () => {
    const hoy = simular(base, escenarioActual(base));
    const sueldo = simular(base, { ...escenarioActual(base), sueldoMensual: 22000 });
    expect(hoy.ahorroMes - sueldo.ahorroMes).toBeCloseTo(4000);
  });
});
