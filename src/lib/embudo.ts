import type { Datos, Estatus } from './types';
import { kpisPorSemana } from './series';

/**
 * Embudo de envíos: de cada envío que sale a ruta, cuántos se entregan y cuánto deja.
 * Sirve para responder "si hago N envíos, ¿cuánto gano?" y "¿cuántos envíos necesito para ganar $X?".
 */

export const MOTIVOS: Array<{ clave: Exclude<Estatus, 'OK' | 'REPETIDO'>; nombre: string }> = [
  { clave: 'REAGENDO', nombre: 'Reagendó' },
  { clave: 'CANCELO', nombre: 'Canceló' },
  { clave: 'SIN SERVICIO', nombre: 'Sin servicio' },
  { clave: 'SIN STOCK', nombre: 'Sin stock' },
  { clave: 'FUERA DE COBERTURA', nombre: 'Fuera de cobertura' },
];

export interface FilaEmbudo {
  semana: string;
  etiqueta: string;
  completa: boolean;
  dias: number;
  envios: number;
  entregados: number;
  efectivo: number;
  utilidad: number;
}

export interface Embudo {
  semanas: FilaEmbudo[];
  dias: number;
  envios: number;
  entregados: number;
  noEntregados: Record<string, number>;
  efectivo: number;
  /** Producto de caja + premio del banco (si hay deuda). */
  costoProducto: number;
  /** Publicidad + gastos fijos. */
  gastos: number;
  publicidad: number;
  utilidad: number;
  entrega: number;
  efectivoPorEnvio: number;
  utilidadPorEnvio: number;
  utilidadPorEntrega: number;
  efectivoPorEntrega: number;
  costoPorEntrega: number;
  gastoPorEnvio: number;
  publicidadPorEnvio: number;
  enviosPorSemana: number;
  utilidadPorSemana: number;
}

const div = (a: number, b: number) => (b ? a / b : 0);

/**
 * Junta las últimas semanas (el reporte completo si existe, si no el corte del jueves).
 * `conPremio`: resta el premio del banco sobre el producto de caja, como pasa mientras hay deuda.
 */
export function calcularEmbudo(datos: Datos, opciones: { ultimas?: number; conPremio?: boolean } = {}): Embudo | null {
  const { ultimas, conPremio = true } = opciones;
  const todas = kpisPorSemana(datos).filter((k) => k.intentos > 0);
  const kpis = ultimas ? todas.slice(-ultimas) : todas;
  if (kpis.length === 0) return null;

  const porId = new Map(datos.reportes.map((r) => [r.id, r]));
  const noEntregados: Record<string, number> = Object.fromEntries(MOTIVOS.map((m) => [m.clave, 0]));
  let dias = 0;
  let envios = 0;
  let entregados = 0;
  let efectivo = 0;
  let costoProducto = 0;
  let gastos = 0;
  let publicidad = 0;
  const semanas: FilaEmbudo[] = [];

  for (const k of kpis) {
    const r = porId.get(k.reporteId);
    for (const m of MOTIVOS) noEntregados[m.clave] += r?.estatus[m.clave]?.pedidos ?? 0;
    const premio = conPremio ? k.reposicion * (r?.snapshot.premioBanco ?? 0) : 0;
    const costo = k.reposicion + premio;
    const utilidad = k.efectivo - costo - k.publicidad - k.fijos;
    dias += k.dias;
    envios += k.intentos;
    entregados += k.pedidos;
    efectivo += k.efectivo;
    costoProducto += costo;
    gastos += k.publicidad + k.fijos;
    publicidad += k.publicidad;
    semanas.push({
      semana: k.semana,
      etiqueta: k.etiqueta,
      completa: k.completa,
      dias: k.dias,
      envios: k.intentos,
      entregados: k.pedidos,
      efectivo: k.efectivo,
      utilidad,
    });
  }

  const utilidad = efectivo - costoProducto - gastos;
  return {
    semanas,
    dias,
    envios,
    entregados,
    noEntregados,
    efectivo,
    costoProducto,
    gastos,
    publicidad,
    utilidad,
    entrega: div(entregados, envios),
    efectivoPorEnvio: div(efectivo, envios),
    utilidadPorEnvio: div(utilidad, envios),
    utilidadPorEntrega: div(utilidad, entregados),
    efectivoPorEntrega: div(efectivo, entregados),
    costoPorEntrega: div(costoProducto, entregados),
    gastoPorEnvio: div(gastos, envios),
    publicidadPorEnvio: div(publicidad, envios),
    enviosPorSemana: div(envios, dias) * 7,
    utilidadPorSemana: div(utilidad, dias) * 7,
  };
}

/**
 * Utilidad por envío si al escalar los anuncios se encarecen.
 * `encarecimiento` 0.25 = cada envío cuesta 25% más de publicidad que hoy.
 */
export const utilidadPorEnvioEscalada = (e: Embudo, encarecimiento = 0) =>
  e.utilidadPorEnvio - e.publicidadPorEnvio * encarecimiento;

export interface Proyeccion {
  envios: number;
  entregas: number;
  efectivo: number;
  utilidad: number;
}

/** Si hago N envíos, ¿cuánto gano? */
export function proyectarEnvios(e: Embudo, envios: number, encarecimiento = 0): Proyeccion {
  return {
    envios,
    entregas: envios * e.entrega,
    efectivo: envios * e.efectivoPorEnvio,
    utilidad: envios * utilidadPorEnvioEscalada(e, encarecimiento),
  };
}

/** Quiero ganar $X, ¿cuántos envíos necesito? null si hoy cada envío no deja utilidad. */
export function enviosParaMeta(e: Embudo, meta: number, encarecimiento = 0): Proyeccion | null {
  const porEnvio = utilidadPorEnvioEscalada(e, encarecimiento);
  if (porEnvio <= 0) return null;
  const envios = Math.ceil(meta / porEnvio);
  return proyectarEnvios(e, envios, encarecimiento);
}

/**
 * Mismos envíos y misma publicidad; solo cambia el % que se entrega.
 * Cada entrega extra trae su efectivo y su costo de producto; publicidad y fijos no cambian.
 */
export function escenarioEntrega(e: Embudo, envios: number, entrega: number, encarecimiento = 0): Proyeccion {
  const entregas = envios * entrega;
  const gastoPorEnvio = e.gastoPorEnvio + e.publicidadPorEnvio * encarecimiento;
  return {
    envios,
    entregas,
    efectivo: entregas * e.efectivoPorEntrega,
    utilidad: entregas * (e.efectivoPorEntrega - e.costoPorEntrega) - envios * gastoPorEnvio,
  };
}
