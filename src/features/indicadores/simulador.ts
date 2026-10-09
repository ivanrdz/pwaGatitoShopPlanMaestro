import type { Libro } from '@/domain/finance';
import type { Datos } from '@/domain/types';
import { kpisPorSemana } from '@/domain/series';

/** Cómo opera el negocio hoy, promediando las últimas semanas completas. */
export interface Base {
  semanas: number;
  pedidosSemana: number;
  costoPorPedido: number;
  ventasPorPedido: number;
  efectivoPorPedido: number;
  reposicionPorPedido: number;
  entrega: number;
  publicidadDiaria: number;
  sueldoMensual: number;
  fijosMensual: number;
  premio: number;
  conDeuda: boolean;
  reserva: number;
  meta: number;
}

export interface Escenario {
  publicidadDiaria: number;
  sueldoMensual: number;
  fijosMensual: number;
  /** Porcentaje de intentos que se entregan, de 0 a 1. */
  entrega: number;
}

export interface Resultado {
  pedidosSemana: number;
  ventasMes: number;
  publicidadMes: number;
  utilidadMes: number;
  premioMes: number;
  sueldoMes: number;
  ahorroMes: number;
  semanasMeta: number | null;
}

const SEMANAS_MES = 30 / 7;

export function baseSimulacion(datos: Datos, libro: Libro, ultimas = 4): Base | null {
  const semanas = kpisPorSemana(datos)
    .filter((k) => k.completa && k.pedidos > 0)
    .slice(-ultimas);
  if (semanas.length === 0) return null;
  const suma = (f: (k: (typeof semanas)[number]) => number) => semanas.reduce((s, k) => s + f(k), 0);
  const pedidos = suma((k) => k.pedidos);
  const publicidad = suma((k) => k.publicidad);
  return {
    semanas: semanas.length,
    pedidosSemana: pedidos / semanas.length,
    costoPorPedido: publicidad / pedidos,
    ventasPorPedido: suma((k) => k.ventas) / pedidos,
    efectivoPorPedido: suma((k) => k.efectivo) / pedidos,
    reposicionPorPedido: suma((k) => k.reposicion) / pedidos,
    entrega: suma((k) => k.entrega * k.pedidos) / pedidos,
    publicidadDiaria: datos.ajustes.gastoDiarioPublicidad,
    sueldoMensual: datos.ajustes.sueldoMensual,
    fijosMensual: datos.ajustes.gastosFijos.reduce((s, g) => s + g.monto, 0),
    premio: datos.ajustes.premioBanco,
    conDeuda: libro.deudaBanco > 0,
    reserva: libro.reserva,
    meta: libro.meta,
  };
}

/**
 * Supone que cada peso en anuncios trae pedidos al mismo costo de hoy, y que
 * entregar un porcentaje mayor convierte más intentos en pedidos con la misma publicidad.
 */
export function simular(base: Base, e: Escenario): Resultado {
  const publicidadSemana = e.publicidadDiaria * 7;
  const pedidosSemana = (publicidadSemana / base.costoPorPedido) * (base.entrega > 0 ? e.entrega / base.entrega : 1);
  const margenPedido = base.efectivoPorPedido - base.reposicionPorPedido;
  const utilidadSemana = pedidosSemana * margenPedido - publicidadSemana - (e.fijosMensual * 7) / 30;
  const premioSemana = base.conDeuda ? pedidosSemana * base.reposicionPorPedido * base.premio : 0;
  const ahorroSemana = utilidadSemana - premioSemana - (e.sueldoMensual * 7) / 30;
  const falta = base.meta - base.reserva;
  return {
    pedidosSemana,
    ventasMes: pedidosSemana * base.ventasPorPedido * SEMANAS_MES,
    publicidadMes: publicidadSemana * SEMANAS_MES,
    utilidadMes: utilidadSemana * SEMANAS_MES,
    premioMes: premioSemana * SEMANAS_MES,
    sueldoMes: e.sueldoMensual,
    ahorroMes: ahorroSemana * SEMANAS_MES,
    semanasMeta: falta <= 0 ? 0 : ahorroSemana > 0 ? Math.ceil(falta / ahorroSemana) : null,
  };
}

export const escenarioActual = (b: Base): Escenario => ({
  publicidadDiaria: b.publicidadDiaria,
  sueldoMensual: b.sueldoMensual,
  fijosMensual: b.fijosMensual,
  entrega: b.entrega,
});
