import type { Libro, Pago } from './finance';
import type { Datos } from './types';
import { diaMes } from './format';

export type ClaveSobre = 'banco' | 'inventario' | 'publicidad' | 'fijos' | 'sueldo' | 'ahorro';

export const SOBRES: Array<{ clave: ClaveSobre; nombre: string }> = [
  { clave: 'banco', nombre: 'Banco' },
  { clave: 'inventario', nombre: 'Reponer inventario' },
  { clave: 'publicidad', nombre: 'Publicidad' },
  { clave: 'fijos', nombre: 'Gastos fijos' },
  { clave: 'sueldo', nombre: 'Tu sueldo' },
  { clave: 'ahorro', nombre: 'Ahorro' },
];

export interface Columna {
  etiqueta: string;
  detalle: string;
  valores: Partial<Record<string, number>>;
}

export interface Punto {
  etiqueta: string;
  detalle: string;
  valor: number;
}

const valorSobre = (p: Pago, c: ClaveSobre) =>
  c === 'inventario' ? p.fondoInventario : (p[c as Exclude<ClaveSobre, 'inventario'>] as number);

/** Junta los pagos del jueves y del lunes de cada semana. */
export function repartoPorSemana(pagos: Pago[], ultimas = 12): Columna[] {
  const mapa = new Map<string, Columna>();
  for (const p of pagos) {
    const col = mapa.get(p.semana) ?? {
      etiqueta: diaMes(p.semana),
      detalle: `Semana del ${diaMes(p.semana)}`,
      valores: {},
    };
    for (const { clave } of SOBRES) col.valores[clave] = (col.valores[clave] ?? 0) + valorSobre(p, clave);
    col.valores.efectivo = (col.valores.efectivo ?? 0) + p.efectivo;
    col.valores.pedidos = (col.valores.pedidos ?? 0) + p.pedidos;
    mapa.set(p.semana, col);
  }
  return [...mapa.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, c]) => c)
    .slice(-ultimas);
}

export function piezasPorSemana(pagos: Pago[], ids: string[], ultimas = 12): Columna[] {
  const mapa = new Map<string, Columna>();
  for (const p of pagos) {
    const col = mapa.get(p.semana) ?? { etiqueta: diaMes(p.semana), detalle: `Semana del ${diaMes(p.semana)}`, valores: {} };
    for (const id of ids) col.valores[id] = (col.valores[id] ?? 0) + (p.piezas[id] ?? 0);
    mapa.set(p.semana, col);
  }
  return [...mapa.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, c]) => c)
    .slice(-ultimas);
}

/** Cómo creció la reserva de Gatito pago a pago (solo desde el arranque). */
export function reservaEnElTiempo(datos: Datos, libro: Libro): Punto[] {
  const { ajustes, compras } = datos;
  const propias = compras
    .filter((c) => c.financiadoPor === 'gatito' && c.fecha >= ajustes.inventarioDesde)
    .map((c) => ({ fecha: c.fecha, monto: c.items.reduce((s, i) => s + i.costo, 0) + c.guia }));
  let saldo = ajustes.saldoInicialReserva;
  const puntos: Punto[] = [];
  for (const p of libro.pagos.filter((x) => !x.previo)) {
    const gastado = propias.filter((c) => c.fecha <= p.fecha);
    for (const c of gastado) {
      saldo -= c.monto;
      propias.splice(propias.indexOf(c), 1);
    }
    saldo += p.ahorro + p.fondoInventario;
    puntos.push({ etiqueta: diaMes(p.fecha), detalle: `Después del pago del ${diaMes(p.fecha)}`, valor: saldo });
  }
  for (const c of propias) {
    saldo -= c.monto;
    puntos.push({ etiqueta: diaMes(c.fecha), detalle: `Compra con la reserva, ${diaMes(c.fecha)}`, valor: saldo });
  }
  return puntos;
}

export function deudaEnElTiempo(libro: Libro): Punto[] {
  return libro.movimientosBanco.map((m) => ({
    etiqueta: diaMes(m.fecha),
    detalle: `${m.concepto}, ${diaMes(m.fecha)}`,
    valor: m.saldo,
  }));
}

/* ---------- Indicadores (KPI) por semana ---------- */

export interface KpiSemana {
  semana: string;
  /** Reporte del que salen los números. */
  reporteId: string;
  /** Envíos que salieron a ruta (todos los estatus menos repetidos). */
  intentos: number;
  etiqueta: string;
  completa: boolean;
  dias: number;
  ventas: number;
  pedidos: number;
  efectivo: number;
  ticket: number;
  piezasPorPedido: number;
  entrega: number;
  cancelacion: number;
  reemplazos: number;
  publicidad: number;
  reposicion: number;
  fijos: number;
  costoPorPedido: number;
  roas: number;
  logisticaPct: number;
  utilidad: number;
  margen: number;
}

const div = (a: number, b: number) => (b ? a / b : 0);

/** Un renglón por semana con el mejor reporte disponible (el completo si existe). */
export function kpisPorSemana(datos: Datos): KpiSemana[] {
  const porSemana = new Map<string, Datos['reportes'][number]>();
  for (const r of datos.reportes) {
    const actual = porSemana.get(r.semana);
    if (!actual || (actual.tipo === 'parcial' && r.tipo === 'completo')) porSemana.set(r.semana, r);
  }
  const costo = new Map(datos.productos.filter((p) => p.porCaja).map((p) => [p.id, p.costoUnitario]));
  return [...porSemana.values()]
    .sort((a, b) => a.semana.localeCompare(b.semana))
    .map((r) => {
      const dias = r.tipo === 'completo' ? 7 : 3;
      const e = r.estatus;
      const intentos =
        e.OK.pedidos + e.REAGENDO.pedidos + e.CANCELO.pedidos + e['SIN SERVICIO'].pedidos + e['SIN STOCK'].pedidos + e['FUERA DE COBERTURA'].pedidos;
      const piezas = Object.values(r.piezas).reduce((s, n) => s + n, 0);
      const reposicion = Object.entries(r.piezas).reduce((s, [id, n]) => s + n * (costo.get(id) ?? 0), 0);
      const publicidad = r.snapshot.gastoDiarioPublicidad * dias;
      const fijos = (r.snapshot.fijosMensual * dias) / 30;
      const utilidad = r.efectivo - reposicion - publicidad - fijos;
      return {
        semana: r.semana,
        reporteId: r.id,
        intentos,
        etiqueta: diaMes(r.semana),
        completa: r.tipo === 'completo',
        dias,
        ventas: r.ventas,
        pedidos: r.pedidosEntregados,
        efectivo: r.efectivo,
        ticket: div(r.ventas, r.pedidosEntregados),
        piezasPorPedido: div(piezas, r.pedidosEntregados),
        entrega: div(e.OK.pedidos, intentos),
        cancelacion: div(e.CANCELO.pedidos, intentos),
        reemplazos: r.reemplazos,
        publicidad,
        reposicion,
        fijos,
        costoPorPedido: div(publicidad, r.pedidosEntregados),
        roas: div(r.ventas, publicidad),
        logisticaPct: div(r.logistica, r.ventas),
        utilidad,
        margen: div(utilidad, r.ventas),
      };
    });
}

/** Semanas que faltan para que la reserva llegue a la meta, al ritmo de las últimas 4 semanas. */
export function semanasParaMeta(libro: Libro): number | null {
  if (libro.reserva >= libro.meta) return 0;
  const vigentes = libro.pagos.filter((p) => !p.previo);
  if (vigentes.length === 0) return null;
  const ultimas = vigentes.slice(-8);
  const dias = ultimas.reduce((s, p) => s + p.dias, 0);
  const ahorro = ultimas.reduce((s, p) => s + p.ahorro + p.fondoInventario, 0);
  const porSemana = div(ahorro, dias) * 7;
  if (porSemana <= 0) return null;
  return Math.ceil((libro.meta - libro.reserva) / porSemana);
}

/** El mejor reporte de cada semana (el completo si existe). */
function mejoresReportes(datos: Datos) {
  const porSemana = new Map<string, Datos['reportes'][number]>();
  for (const r of datos.reportes) {
    const actual = porSemana.get(r.semana);
    if (!actual || (actual.tipo === 'parcial' && r.tipo === 'completo')) porSemana.set(r.semana, r);
  }
  return [...porSemana.values()].sort((a, b) => a.semana.localeCompare(b.semana));
}

export interface ReemplazoProducto {
  productoId: string;
  nombre: string;
  vendidas: number;
  reemplazadas: number;
  porcentaje: number;
  costoPiezas: number;
  semanas: Array<{ semana: string; piezas: number }>;
}

export interface ResumenReemplazos {
  productos: ReemplazoProducto[];
  envios: number;
  costoEnvios: number;
  desde: string | null;
  hasta: string | null;
  /** Reportes guardados antes de que la app contara reemplazos por producto. */
  sinDetalle: number;
}

export function reemplazosPorProducto(datos: Datos): ResumenReemplazos {
  const reportes = mejoresReportes(datos);
  const productos = datos.productos.filter((p) => p.activo);
  let envios = 0;
  let costoEnvios = 0;
  let sinDetalle = 0;
  const filas = new Map<string, ReemplazoProducto>(
    productos.map((p) => [p.id, { productoId: p.id, nombre: p.nombre, vendidas: 0, reemplazadas: 0, porcentaje: 0, costoPiezas: 0, semanas: [] }]),
  );
  for (const r of reportes) {
    if (!r.reemplazosPorProducto) sinDetalle += 1;
    envios += r.reemplazos;
    costoEnvios += r.reemplazos * div(r.logistica, r.pedidosEntregados);
    for (const p of productos) {
      const fila = filas.get(p.id)!;
      const rep = r.reemplazosPorProducto?.[p.id] ?? 0;
      fila.vendidas += (r.piezas[p.id] ?? 0) - rep;
      fila.reemplazadas += rep;
      fila.costoPiezas += rep * p.costoUnitario;
      fila.semanas.push({ semana: r.semana, piezas: rep });
    }
  }
  for (const f of filas.values()) f.porcentaje = div(f.reemplazadas, f.vendidas);
  return {
    productos: [...filas.values()].sort((a, b) => b.reemplazadas - a.reemplazadas || b.porcentaje - a.porcentaje),
    envios,
    costoEnvios,
    desde: reportes[0]?.semana ?? null,
    hasta: reportes.at(-1)?.semana ?? null,
    sinDetalle,
  };
}
