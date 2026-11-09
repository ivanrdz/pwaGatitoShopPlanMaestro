import { describe, expect, it } from 'vitest';
import { zonaDePedido } from '@/domain/zonas';
import { calcularZonas, compararRepartidor } from '@/features/indicadores/calculoZonas';
import { ajustesIniciales, productosIniciales } from '@/domain/defaults';
import { ESTATUS, type Datos, type Reporte } from '@/domain/types';

describe('zona de un pedido', () => {
  it('Coahuila por la ciudad, aunque el envío diga otra cosa', () => {
    expect(zonaDePedido('Calle 1, Saltillo, Coah.', 69)).toBe('coahuila');
    expect(zonaDePedido('Col. Centro, Ramos Arizpe', null)).toBe('coahuila');
  });
  it('si se entregó, el envío decide entre área metropolitana ($59) y periferia ($69)', () => {
    expect(zonaDePedido('Col. X, García, N.L.', 59)).toBe('metro');
    expect(zonaDePedido('Col. X, sin ciudad', 69)).toBe('periferia');
  });
  it('si no se entregó, usa la ciudad; sin ciudad conocida, área metropolitana', () => {
    expect(zonaDePedido('Col. X, Cadereyta Jiménez', null)).toBe('periferia');
    expect(zonaDePedido('Col. X, Pesquería N.L.', null)).toBe('periferia');
    expect(zonaDePedido('Col. Mitras, Monterrey', null)).toBe('metro');
  });
});

function reporte(semana: string, zonas: Reporte['zonas']): Reporte {
  return {
    id: `${semana}-completo`,
    semana,
    etiqueta: '',
    tipo: 'completo',
    ventas: 0,
    pedidosEntregados: 0,
    logistica: 0,
    costoProducto: 0,
    efectivo: 0,
    estatus: Object.fromEntries(
      ESTATUS.map((e) => [e, { monto: 0, pedidos: e === 'OK' ? 10 : e === 'CANCELO' ? 10 : 0 }]),
    ) as Reporte['estatus'],
    dias: [],
    piezas: {},
    noReconocidos: [],
    reemplazos: 0,
    reemplazosPorProducto: {},
    tienda: 'GATITOSHOP',
    nombreArchivo: '',
    cargadoEn: '',
    snapshot: { gastoDiarioPublicidad: 600, sueldoMensual: 18000, fijosMensual: 1140, premioBanco: 0.15 },
    zonas,
  };
}

const zonasSemana: Reporte['zonas'] = {
  metro: { intentos: 140, entregados: 70, ventas: 17000, envio: 70 * 59 },
  periferia: { intentos: 20, entregados: 7, ventas: 1600, envio: 7 * 69 },
  coahuila: { intentos: 40, entregados: 20, ventas: 4800, envio: 20 * 69 },
};

const datos = (reportes: Reporte[]): Datos => ({
  ajustes: ajustesIniciales(),
  productos: productosIniciales(),
  reportes,
  compras: [],
  cobros: [],
});

describe('resumen por zona', () => {
  it('promedia por semana y calcula entrega y participación', () => {
    const z = calcularZonas(datos([reporte('2026-09-28', zonasSemana), reporte('2026-10-05', zonasSemana)]))!;
    const metro = z.zonas.find((x) => x.zona === 'metro')!;
    expect(z.semanas).toBe(2);
    expect(metro.entregadosPorSemana).toBeCloseTo(70);
    expect(metro.envioPorSemana).toBeCloseTo(4130);
    expect(metro.entrega).toBeCloseTo(0.5);
    expect(metro.participacion).toBeCloseTo(70 / 97);
  });

  it('cuenta las semanas subidas antes de separar por zona', () => {
    const z = calcularZonas(datos([reporte('2026-09-28', undefined), reporte('2026-10-05', zonasSemana)]))!;
    expect(z.semanas).toBe(1);
    expect(z.sinZonas).toBe(1);
  });

  it('repartidor de $3,500 en el área metropolitana', () => {
    const z = calcularZonas(datos([reporte('2026-10-05', zonasSemana)]))!;
    const r = compararRepartidor(z, { sueldoSemanal: 3500, otrosSemanal: 0, zonasCubiertas: ['metro'] });
    expect(r.envioQueDejasDePagar).toBeCloseTo(4130);
    expect(r.ahorro).toBeCloseTo(630);
    expect(r.entregasParaQueConvenga).toBe(Math.ceil(3500 / 59));
    const conPeriferia = compararRepartidor(z, {
      sueldoSemanal: 3500,
      otrosSemanal: 500,
      zonasCubiertas: ['metro', 'periferia'],
    });
    expect(conPeriferia.ahorro).toBeCloseTo(4130 + 483 - 4000);
  });
});
