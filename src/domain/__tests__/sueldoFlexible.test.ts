import { describe, expect, it } from 'vitest';
import { calcularLibro } from '@/domain/finance';
import { ajustesIniciales, productosIniciales } from '@/domain/defaults';
import { ESTATUS, type Datos, type Reporte } from '@/domain/types';

const SNAP = { gastoDiarioPublicidad: 660, sueldoMensual: 18000, fijosMensual: 1140, premioBanco: 0.15 };

/** Reporte sin piezas de caja: así el reparto es solo publicidad, fijos y sueldo. */
function reporte(semana: string, tipo: Reporte['tipo'], efectivo: number): Reporte {
  return {
    id: `${semana}-${tipo}`,
    semana,
    etiqueta: '',
    tipo,
    ventas: efectivo,
    pedidosEntregados: 10,
    logistica: 0,
    costoProducto: 0,
    efectivo,
    estatus: Object.fromEntries(ESTATUS.map((e) => [e, { monto: 0, pedidos: 0 }])) as Reporte['estatus'],
    dias: [],
    piezas: {},
    noReconocidos: [],
    reemplazos: 0,
    reemplazosPorProducto: {},
    tienda: 'GATITOSHOP',
    nombreArchivo: '',
    cargadoEn: '',
    snapshot: SNAP,
  };
}

const datos = (reportes: Reporte[]): Datos => ({
  ajustes: { ...ajustesIniciales(), inventarioDesde: '2026-10-01', sueldoMensual: 18000 },
  productos: productosIniciales(),
  reportes,
  compras: [],
  cobros: [],
});

// Jueves: 3 días → publicidad 1,980, fijos 114, sueldo 1,800 (total 3,894).
// Lunes: 4 días → publicidad 2,640, fijos 152, sueldo 2,400 (total 5,192).
describe('sueldo flexible', () => {
  it('si alcanza, te pagas tu sueldo completo y lo demás va al ahorro', () => {
    const [jueves] = calcularLibro(datos([reporte('2026-10-05', 'parcial', 6000)])).pagos;
    expect(jueves.sueldo).toBeCloseTo(1800);
    expect(jueves.sueldoMeta).toBeCloseTo(1800);
    expect(jueves.ahorro).toBeCloseTo(6000 - 1980 - 114 - 1800);
  });

  it('si no alcanza, el sueldo es lo que sobra y no aparece un faltante falso (caso real del 12 de octubre)', () => {
    // Semana completa 11,722 − jueves 7,406 = 4,316 el lunes.
    const libro = calcularLibro(
      datos([reporte('2026-10-05', 'parcial', 7406), reporte('2026-10-05', 'completo', 11722)]),
    );
    const lunes = libro.pagos[1];
    expect(lunes.efectivo).toBeCloseTo(4316);
    expect(lunes.sueldo).toBeCloseTo(4316 - 2640 - 152); // 1,524
    expect(lunes.sueldoMeta).toBeCloseTo(2400);
    expect(lunes.ahorro).toBeCloseTo(0);
    expect(libro.alertas.map((a) => a.id)).not.toContain('ahorro-negativo');
  });

  it('lo pendiente se repone con el siguiente pago del mes antes de ir al ahorro', () => {
    const libro = calcularLibro(
      datos([
        reporte('2026-10-05', 'parcial', 7406),
        reporte('2026-10-05', 'completo', 11722), // lunes 12: queda pendiente 876
        reporte('2026-10-12', 'parcial', 8000), // jueves 15
      ]),
    );
    const [, lunes, jueves] = libro.pagos;
    const pendiente = lunes.sueldoMeta - lunes.sueldo;
    expect(pendiente).toBeCloseTo(876);
    expect(jueves.sueldoMeta).toBeCloseTo(1800 + 876);
    expect(jueves.sueldo).toBeCloseTo(1800 + 876);
    expect(jueves.ahorro).toBeCloseTo(8000 - 1980 - 114 - 2676);
    expect(libro.sueldoMes).toEqual({
      mes: '2026-10',
      pagado: expect.closeTo(1800 + 1524 + 2676, 2),
      meta: 18000,
      pendiente: 0,
    });
  });

  it('el pendiente no pasa al mes siguiente', () => {
    const libro = calcularLibro(
      datos([
        reporte('2026-10-26', 'parcial', 2000), // jueves 29 oct: alcanza para 0 de sueldo… y queda pendiente
        reporte('2026-10-26', 'completo', 2000 + 9000), // lunes 2 nov
      ]),
    );
    const [jueves, lunes] = libro.pagos;
    expect(jueves.sueldo).toBe(0);
    expect(lunes.fecha.startsWith('2026-11')).toBe(true);
    expect(lunes.sueldoMeta).toBeCloseTo(2400);
  });

  it('solo hay faltante cuando no alcanza ni para los gastos del negocio', () => {
    const libro = calcularLibro(datos([reporte('2026-10-05', 'parcial', 1500)]));
    const [jueves] = libro.pagos;
    expect(jueves.sueldo).toBe(0);
    expect(jueves.ahorro).toBeCloseTo(1500 - 1980 - 114);
    expect(libro.alertas.map((a) => a.id)).toContain('ahorro-negativo');
  });

  it('los pagos de antes del arranque no acumulan pendiente', () => {
    const d = datos([reporte('2026-09-21', 'parcial', 1000), reporte('2026-10-05', 'parcial', 6000)]);
    const [previo, jueves] = calcularLibro(d).pagos;
    expect(previo.previo).toBe(true);
    expect(jueves.sueldoMeta).toBeCloseTo(1800);
  });
});
