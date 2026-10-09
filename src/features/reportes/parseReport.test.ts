import { describe, expect, it } from 'vitest';
import { clasificar, parseReportText, separarPiezas } from '@/features/reportes/parseReport';
import { productosIniciales } from '@/domain/defaults';
import { reporteCompleto, reporteParcial } from '@/test/fixture';

const productos = productosIniciales();

describe('clasificar', () => {
  it('distingue el foco bocina del soporte bocina', () => {
    expect(clasificar('FOCO BOCINA', productos)).toBe('foco');
    expect(clasificar('2 SOPORTE BOCINA BLUETHOOT', productos)).toBe('bocina');
    expect(clasificar('2 soport ebocina bluethoot', productos)).toBe('bocina');
  });
  it('reconoce los encendedores aunque vengan mal escritos', () => {
    for (const t of ['ENCENDEDORES ELECTRONICOS', 'ENCENDEODRES', 'ENCNEDEDORES', 'ENXENDEDORES', 'ENCENENDEDORES']) {
      expect(clasificar(t, productos)).toBe('encendedor');
    }
  });
  it('no confunde el enchinador con un encendedor', () => {
    expect(clasificar('ENCHINADOR ELECTRONICO', productos)).toBeNull();
  });
});

describe('parseReportText', () => {
  it('lee el resumen de la semana completa', () => {
    const r = parseReportText(reporteCompleto, productos);
    expect(r.etiqueta).toBe('28SEP-03OCT');
    expect(r.semana).toBe('2026-09-28');
    expect(r.tipo).toBe('completo');
    expect(r.pedidosEntregados).toBe(6);
    expect(r.efectivo).toBe(1276);
    expect(r.estatus.REAGENDO.pedidos).toBe(1);
    expect(r.avisos).toEqual([]);
  });

  it('cuenta piezas, respeta "SOLO PIDIO" y detecta reemplazos', () => {
    const r = parseReportText(reporteCompleto, productos);
    expect(r.piezas).toEqual({ ventosa: 2, foco: 2, encendedor: 4, bocina: 1 });
    expect(r.reemplazos).toBe(1);
    expect(r.noReconocidos).toEqual([{ texto: 'ENCHINADOR ELECTRONICO', piezas: 1 }]);
  });

  it('no guarda datos de clientes', () => {
    const r = parseReportText(reporteCompleto, productos);
    expect(JSON.stringify(r)).not.toMatch(/Cliente|8100000/);
  });

  it('identifica el corte del jueves', () => {
    const r = parseReportText(reporteParcial, productos);
    expect(r.tipo).toBe('parcial');
    expect(r.efectivo).toBe(825);
  });

  it('rechaza un PDF que no es un reporte', () => {
    expect(() => parseReportText('Factura número 123', productos)).toThrow();
  });
});

describe('variaciones reales del formato', () => {
  const productos = productosIniciales();

  it('encuentra la tabla aunque la primera celda del encabezado no diga TIENDA', () => {
    const r = parseReportText(reporteCompleto.replace('TIENDA FECHA PRODUCTO', 'Hh FECHA PRODUCTO'), productos);
    expect(r.avisos).toEqual([]);
    expect(r.pedidosEntregados).toBe(6);
    expect(Object.values(r.piezas).reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
  });

  it('no confunde un código postal con la cantidad de piezas', () => {
    const piezas = separarPiezas(
      'SOPORTE BOCINA BLUETHOOT Av. Siempre Viva 123, Centro, 64770 Monterrey, N.L.',
      productos,
    );
    expect(piezas).toEqual([{ productoId: 'bocina', cantidad: 1, texto: expect.any(String) }]);
  });

  it('reconoce el encendedor aunque venga mal escrito', () => {
    expect(clasificar('2 ENFENDEDORNELECTRONICO', productos)).toBe('encendedor');
    expect(clasificar('ENXENDEDOR', productos)).toBe('encendedor');
    expect(clasificar('ENCHINADOR ELECTRONICO', productos)).toBeNull();
  });
});
