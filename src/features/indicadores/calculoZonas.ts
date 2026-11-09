import type { Datos } from '@/domain/types';
import { kpisPorSemana } from '@/domain/series';
import { ZONAS, totalesVacios, type TotalesZona, type Zona } from '@/domain/zonas';

export interface ResumenZona extends TotalesZona {
  zona: Zona;
  entrega: number;
  /** Promedios por semana de 7 días. */
  entregadosPorSemana: number;
  envioPorSemana: number;
  envioPorEntrega: number;
  ticket: number;
  /** Parte de las entregas totales. */
  participacion: number;
}

export interface Zonas {
  zonas: ResumenZona[];
  semanas: number;
  dias: number;
  /** Semanas del periodo que se subieron antes de esta función (sin zonas). */
  sinZonas: number;
}

const div = (a: number, b: number) => (b ? a / b : 0);

/** Junta las últimas semanas (el reporte completo si existe) y resume por zona. */
export function calcularZonas(datos: Datos, ultimas?: number): Zonas | null {
  const todas = kpisPorSemana(datos).filter((k) => k.intentos > 0);
  const kpis = ultimas ? todas.slice(-ultimas) : todas;
  if (kpis.length === 0) return null;
  const porId = new Map(datos.reportes.map((r) => [r.id, r]));
  const suma = totalesVacios();
  let dias = 0;
  let semanas = 0;
  let sinZonas = 0;
  for (const k of kpis) {
    const z = porId.get(k.reporteId)?.zonas;
    if (!z) {
      sinZonas += 1;
      continue;
    }
    semanas += 1;
    dias += k.dias;
    for (const { id } of ZONAS) {
      suma[id].intentos += z[id].intentos;
      suma[id].entregados += z[id].entregados;
      suma[id].ventas += z[id].ventas;
      suma[id].envio += z[id].envio;
    }
  }
  if (semanas === 0) return { zonas: [], semanas: 0, dias: 0, sinZonas };
  const entregasTotales = ZONAS.reduce((s, { id }) => s + suma[id].entregados, 0);
  return {
    semanas,
    dias,
    sinZonas,
    zonas: ZONAS.map(({ id }) => {
      const t = suma[id];
      return {
        zona: id,
        ...t,
        entrega: div(t.entregados, t.intentos),
        entregadosPorSemana: div(t.entregados, dias) * 7,
        envioPorSemana: div(t.envio, dias) * 7,
        envioPorEntrega: div(t.envio, t.entregados),
        ticket: div(t.ventas, t.entregados),
        participacion: div(t.entregados, entregasTotales),
      };
    }),
  };
}

export interface Repartidor {
  /** Lo que le pagarías por semana. */
  sueldoSemanal: number;
  /** Gasolina u otros gastos por semana que pagarías tú. */
  otrosSemanal: number;
  zonasCubiertas: Zona[];
}

export interface ResultadoRepartidor {
  /** Lo que hoy pagas de envío en las zonas que él cubriría. */
  envioQueDejasDePagar: number;
  costo: number;
  ahorro: number;
  entregasPorSemana: number;
  /** Entregas por semana a partir de las cuales conviene, al costo por entrega actual. */
  entregasParaQueConvenga: number | null;
}

/** ¿Conviene un repartidor de sueldo fijo en lugar de pagar por envío? */
export function compararRepartidor(z: Zonas, r: Repartidor): ResultadoRepartidor {
  const cubiertas = z.zonas.filter((x) => r.zonasCubiertas.includes(x.zona));
  const envio = cubiertas.reduce((s, x) => s + x.envioPorSemana, 0);
  const entregas = cubiertas.reduce((s, x) => s + x.entregadosPorSemana, 0);
  const costo = r.sueldoSemanal + r.otrosSemanal;
  const porEntrega = div(envio, entregas);
  return {
    envioQueDejasDePagar: envio,
    costo,
    ahorro: envio - costo,
    entregasPorSemana: entregas,
    entregasParaQueConvenga: porEntrega > 0 ? Math.ceil(costo / porEntrega) : null,
  };
}
