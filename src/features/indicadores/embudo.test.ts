import { describe, expect, it } from 'vitest';
import { calcularEmbudo, enviosParaMeta, escenarioEntrega, proyectarEnvios } from '@/features/indicadores/embudo';
import { ajustesIniciales, productosIniciales } from '@/domain/defaults';
import { ESTATUS, type Datos, type Reporte } from '@/domain/types';

function rep(
  lunes: string,
  tipo: 'parcial' | 'completo',
  ok: number,
  otros: Partial<Record<string, number>>,
  efectivo: number,
  piezas: Record<string, number>,
): Reporte {
  const e = Object.fromEntries(ESTATUS.map((x) => [x, { monto: 0, pedidos: 0 }])) as Reporte['estatus'];
  e.OK.pedidos = ok;
  for (const [k, v] of Object.entries(otros)) e[k as keyof typeof e].pedidos = v ?? 0;
  return {
    id: `${lunes}-${tipo}`,
    semana: lunes,
    etiqueta: '',
    tipo,
    ventas: efectivo * 1.3,
    pedidosEntregados: ok,
    logistica: ok * 61,
    costoProducto: 0,
    efectivo,
    estatus: e,
    dias: [],
    piezas,
    noReconocidos: [],
    reemplazos: 0,
    reemplazosPorProducto: {},
    tienda: 'GATITOSHOP',
    nombreArchivo: '',
    cargadoEn: '',
    snapshot: { gastoDiarioPublicidad: 600, sueldoMensual: 18000, fijosMensual: 1140, premioBanco: 0.15 },
  };
}

const datos = (reportes: Reporte[]): Datos => ({
  ajustes: ajustesIniciales(),
  productos: productosIniciales(),
  reportes,
  compras: [],
  cobros: [],
});

describe('embudo de envíos', () => {
  const productos = productosIniciales();
  const ids = Object.fromEntries(productos.map((p) => [p.nombre.toLowerCase(), p.id]));
  const idEnc = productos.find((p) => /encend/i.test(p.nombre))!.id;
  // Corte real del 5-7 oct: 39 entregados de 69, $7,406.
  const jueves = rep(
    '2026-10-05',
    'parcial',
    39,
    { REAGENDO: 12, CANCELO: 11, 'SIN SERVICIO': 6, 'SIN STOCK': 1, REPETIDO: 4 },
    7406,
    { [idEnc]: 46 },
  );

  it('cuenta envíos sin repetidos y calcula el % de entrega', () => {
    const e = calcularEmbudo(datos([jueves]))!;
    expect(ids).toBeTruthy();
    expect(e.envios).toBe(69);
    expect(e.entregados).toBe(39);
    expect(e.entrega).toBeCloseTo(39 / 69);
    expect(e.noEntregados.CANCELO).toBe(11);
    expect(e.efectivoPorEnvio).toBeCloseTo(7406 / 69);
  });

  it('utilidad = efectivo − producto con premio − publicidad − fijos', () => {
    const e = calcularEmbudo(datos([jueves]))!;
    const costo = productos.find((p) => p.id === idEnc)!.costoUnitario * 46;
    const esperado = 7406 - costo * 1.15 - 600 * 3 - (1140 * 3) / 30;
    expect(e.utilidad).toBeCloseTo(esperado);
    const sinPremio = calcularEmbudo(datos([jueves]), { conPremio: false })!;
    expect(sinPremio.utilidad - e.utilidad).toBeCloseTo(costo * 0.15);
  });

  it('usa la semana completa en lugar del corte del jueves', () => {
    const completa = rep('2026-10-05', 'completo', 90, { CANCELO: 30 }, 16000, { [idEnc]: 100 });
    const e = calcularEmbudo(datos([jueves, completa]))!;
    expect(e.semanas).toHaveLength(1);
    expect(e.envios).toBe(120);
    expect(e.dias).toBe(7);
  });

  it('la calculadora y los escenarios cuadran entre sí', () => {
    const e = calcularEmbudo(datos([jueves]))!;
    const p = proyectarEnvios(e, 100);
    expect(p.utilidad).toBeCloseTo(e.utilidadPorEnvio * 100);
    // Al % de hoy, el escenario de entrega da lo mismo que la proyección.
    expect(escenarioEntrega(e, 100, e.entrega).utilidad).toBeCloseTo(p.utilidad);
    // Entregar más con los mismos envíos deja más.
    expect(escenarioEntrega(e, 100, 0.7).utilidad).toBeGreaterThan(p.utilidad);
    const m = enviosParaMeta(e, 10000)!;
    expect(m.utilidad).toBeGreaterThanOrEqual(10000);
    expect(proyectarEnvios(e, m.envios - 1).utilidad).toBeLessThan(10000);
    // Con anuncios más caros, escenario y proyección siguen cuadrando.
    expect(escenarioEntrega(e, 100, e.entrega, 0.3).utilidad).toBeCloseTo(proyectarEnvios(e, 100, 0.3).utilidad);
    // Si los anuncios se encarecen, se necesitan más envíos.
    expect(enviosParaMeta(e, 10000, 0.3)!.envios).toBeGreaterThan(m.envios);
  });

  it('devuelve null sin reportes o si los envíos no dejan utilidad', () => {
    expect(calcularEmbudo(datos([]))).toBeNull();
    const malo = rep('2026-10-05', 'completo', 5, { CANCELO: 50 }, 500, {});
    expect(enviosParaMeta(calcularEmbudo(datos([malo]))!, 10000)).toBeNull();
  });
});
