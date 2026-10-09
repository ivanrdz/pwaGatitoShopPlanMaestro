import type { Datos, Producto, Reporte } from './types';
import { hoyIso, sumarDias } from './format';

export type TipoPago = 'jueves' | 'lunes' | 'semana';

export interface Pago {
  id: string;
  reporteId: string;
  semana: string;
  tipo: TipoPago;
  /** Día en que recibes el dinero. */
  fecha: string;
  /** Primer día que cubre (para el inventario). */
  desde: string;
  dias: number;
  efectivo: number;
  pedidos: number;
  piezas: Record<string, number>;
  /** Lo que costaron las piezas de caja que se vendieron. */
  reposicion: number;
  banco: number;
  fondoInventario: number;
  publicidad: number;
  fijos: number;
  sueldo: number;
  ahorro: number;
  deudaDespues: number;
  /** Es de antes del arranque: se muestra, pero no mueve saldos. */
  previo: boolean;
}

export interface MovimientoBanco {
  fecha: string;
  concepto: string;
  monto: number;
  saldo: number;
}

export interface EstadoProducto {
  producto: Producto;
  stock: number;
  promedioSemanal: number;
  diasRestantes: number | null;
  bajo: boolean;
  /** false mientras no captures inventario inicial ni registres compras. */
  capturado: boolean;
  /** Piezas a las que conviene pedir: venta diaria × (días de entrega + colchón), o tu mínimo manual. */
  puntoPedido: number;
  /** Último día para pedir sin quedarte sin piezas. null si no hay ventas para estimar. */
  pedirAntesDe: string | null;
  diasParaPedir: number | null;
}

export interface Alerta {
  id: string;
  tono: 'atencion' | 'info';
  texto: string;
  ir?: string;
}

export interface Semana {
  semana: string;
  etiqueta: string;
  tieneParcial: boolean;
  tieneCompleto: boolean;
  pedidos: number;
  efectivo: number;
  ventas: number;
  efectividad: number;
  publicidadPorPedido: number;
}

export interface Libro {
  pagos: Pago[];
  semanas: Semana[];
  movimientosBanco: MovimientoBanco[];
  deudaBanco: number;
  prestadoTotal: number;
  devueltoTotal: number;
  premioCobrado: number;
  sobrePublicidad: number;
  reserva: number;
  meta: number;
  inventario: EstadoProducto[];
  alertas: Alerta[];
}

const restar = (a: Record<string, number>, b: Record<string, number>) => {
  const out: Record<string, number> = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    out[k] = Math.max(0, (a[k] ?? 0) - (b[k] ?? 0));
  }
  return out;
};

const totalCompra = (c: Datos['compras'][number]) => c.items.reduce((s, i) => s + i.costo, 0) + c.guia;

/** Convierte los reportes en pagos: jueves (lunes a miércoles) y lunes (jueves a sábado). */
export function pagosDeReportes(reportes: Reporte[]) {
  const porSemana = new Map<string, { parcial?: Reporte; completo?: Reporte }>();
  for (const r of reportes) {
    const s = porSemana.get(r.semana) ?? {};
    s[r.tipo] = r;
    porSemana.set(r.semana, s);
  }
  const salida: Array<Omit<Pago, 'reposicion' | 'banco' | 'fondoInventario' | 'publicidad' | 'fijos' | 'sueldo' | 'ahorro' | 'deudaDespues' | 'previo'> & { reporte: Reporte }> = [];
  for (const [semana, { parcial, completo }] of [...porSemana].sort(([a], [b]) => a.localeCompare(b))) {
    if (parcial) {
      salida.push({
        id: `${semana}-jueves`,
        reporteId: parcial.id,
        reporte: parcial,
        semana,
        tipo: 'jueves',
        fecha: sumarDias(semana, 3),
        desde: semana,
        dias: 3,
        efectivo: parcial.efectivo,
        pedidos: parcial.pedidosEntregados,
        piezas: { ...parcial.piezas },
      });
    }
    if (completo) {
      salida.push({
        id: `${semana}-${parcial ? 'lunes' : 'semana'}`,
        reporteId: completo.id,
        reporte: completo,
        semana,
        tipo: parcial ? 'lunes' : 'semana',
        fecha: sumarDias(semana, 7),
        desde: parcial ? sumarDias(semana, 3) : semana,
        dias: parcial ? 4 : 7,
        efectivo: completo.efectivo - (parcial?.efectivo ?? 0),
        pedidos: completo.pedidosEntregados - (parcial?.pedidosEntregados ?? 0),
        piezas: parcial ? restar(completo.piezas, parcial.piezas) : { ...completo.piezas },
      });
    }
  }
  return salida;
}

export function calcularLibro(datos: Datos, hoy: string = hoyIso()): Libro {
  const { ajustes, productos, reportes, compras, cobros } = datos;
  const productoPorId = new Map(productos.map((p) => [p.id, p]));
  const base = pagosDeReportes(reportes);
  const arranque = ajustes.inventarioDesde;
  const comprasVigentes = compras.filter((c) => c.fecha >= arranque);

  type Evento =
    | { fecha: string; orden: 0; compra: Datos['compras'][number] }
    | { fecha: string; orden: 1; pago: (typeof base)[number] };
  const eventos: Evento[] = [
    ...comprasVigentes.map((c) => ({ fecha: c.fecha, orden: 0 as const, compra: c })),
    ...base.map((p) => ({ fecha: p.fecha, orden: 1 as const, pago: p })),
  ].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.orden - b.orden);

  let deuda = ajustes.deudaInicialBanco;
  let prestadoTotal = 0;
  let devueltoTotal = 0;
  let premioCobrado = 0;
  let comprasPropias = 0;
  const pagos: Pago[] = [];
  const movimientosBanco: MovimientoBanco[] = [];
  if (deuda > 0) movimientosBanco.push({ fecha: arranque, concepto: 'Deuda al arrancar', monto: deuda, saldo: deuda });

  for (const ev of eventos) {
    if ('compra' in ev) {
      const total = totalCompra(ev.compra);
      if (ev.compra.financiadoPor === 'banco') {
        const conPremio = total * (1 + ev.compra.premio);
        deuda += conPremio;
        prestadoTotal += total;
        movimientosBanco.push({ fecha: ev.fecha, concepto: 'Préstamo para inventario', monto: conPremio, saldo: deuda });
      } else {
        comprasPropias += total;
      }
      continue;
    }
    const p = ev.pago;
    const previo = p.fecha < arranque;
    const snap = p.reporte.snapshot;
    const reposicion = Object.entries(p.piezas).reduce((s, [id, n]) => {
      const prod = productoPorId.get(id);
      return prod?.porCaja ? s + n * prod.costoUnitario : s;
    }, 0);
    const debe = reposicion * (1 + snap.premioBanco);
    const banco = previo ? 0 : Math.min(deuda, debe);
    const cubierto = banco / (1 + snap.premioBanco);
    deuda -= banco;
    devueltoTotal += banco;
    premioCobrado += banco - cubierto;
    const fondoInventario = reposicion - cubierto;
    const publicidad = snap.gastoDiarioPublicidad * p.dias;
    const fijos = (snap.fijosMensual * p.dias) / 30;
    const sueldo = (snap.sueldoMensual * p.dias) / 30;
    const ahorro = p.efectivo - banco - fondoInventario - publicidad - fijos - sueldo;
    if (banco > 0) {
      movimientosBanco.push({ fecha: p.fecha, concepto: `Pago del ${p.tipo === 'jueves' ? 'jueves' : 'lunes'}`, monto: -banco, saldo: deuda });
    }
    const { reporte: _omit, ...resto } = p;
    void _omit;
    pagos.push({ ...resto, reposicion, banco, fondoInventario, publicidad, fijos, sueldo, ahorro, deudaDespues: deuda, previo });
  }

  const vigentes = pagos.filter((p) => !p.previo);
  const apartadoPublicidad = vigentes.reduce((s, p) => s + p.publicidad, 0);
  const cobrado = cobros.filter((c) => c.fecha >= arranque).reduce((s, c) => s + c.monto, 0);
  const sobrePublicidad = ajustes.saldoInicialPublicidad + apartadoPublicidad - cobrado;
  const reserva =
    ajustes.saldoInicialReserva + vigentes.reduce((s, p) => s + p.ahorro + p.fondoInventario, 0) - comprasPropias;

  // Inventario de productos por caja.
  const desde = arranque;
  const ultimas = pagos.filter((p) => p.fecha >= sumarDias(pagos.at(-1)?.fecha ?? desde, -28));
  const diasMuestra = Math.max(1, ultimas.reduce((s, p) => s + p.dias, 0));
  const inventario: EstadoProducto[] = productos
    .filter((p) => p.activo && p.porCaja)
    .map((producto) => {
      const entradas = comprasVigentes
        .reduce((s, c) => s + c.items.filter((i) => i.productoId === producto.id).reduce((a, i) => a + i.piezas, 0), 0);
      const salidas = pagos.filter((p) => p.desde >= desde).reduce((s, p) => s + (p.piezas[producto.id] ?? 0), 0);
      const stock = producto.stockInicial + entradas - salidas;
      const porDia = ultimas.reduce((s, p) => s + (p.piezas[producto.id] ?? 0), 0) / diasMuestra;
      const capturado = producto.stockInicial > 0 || entradas > 0;
      const espera = (producto.diasEntrega ?? 7) + (ajustes.diasColchon ?? 0);
      const puntoPedido = Math.max(producto.puntoReorden, Math.ceil(porDia * espera));
      const diasParaPedir = porDia > 0 ? Math.floor((stock - puntoPedido) / porDia) : null;
      return {
        producto,
        stock,
        promedioSemanal: porDia * 7,
        diasRestantes: porDia > 0 ? Math.max(0, Math.floor(stock / porDia)) : null,
        capturado,
        bajo: capturado && stock <= puntoPedido,
        puntoPedido,
        diasParaPedir,
        pedirAntesDe: diasParaPedir === null ? null : sumarDias(hoy, Math.max(0, diasParaPedir)),
      };
    });

  const meta =
    productos.filter((p) => p.activo && p.porCaja).reduce((s, p) => s + p.precioCaja + ajustes.guiaCompra, 0) +
    ajustes.colchonPublicidad;

  // Resumen por semana.
  const semanasMap = new Map<string, Semana>();
  for (const r of [...reportes].sort((a, b) => a.semana.localeCompare(b.semana))) {
    const actual = semanasMap.get(r.semana);
    const usar = r.tipo === 'completo' || !actual?.tieneCompleto;
    const intentos =
      r.estatus.OK.pedidos + r.estatus.CANCELO.pedidos + r.estatus['SIN SERVICIO'].pedidos +
      r.estatus['SIN STOCK'].pedidos + r.estatus['FUERA DE COBERTURA'].pedidos + r.estatus.REAGENDO.pedidos;
    const diasCubiertos = r.tipo === 'completo' ? 7 : 3;
    const s: Semana = usar
      ? {
          semana: r.semana,
          etiqueta: r.etiqueta,
          tieneParcial: (actual?.tieneParcial ?? false) || r.tipo === 'parcial',
          tieneCompleto: (actual?.tieneCompleto ?? false) || r.tipo === 'completo',
          pedidos: r.pedidosEntregados,
          efectivo: r.efectivo,
          ventas: r.ventas,
          efectividad: intentos ? r.pedidosEntregados / intentos : 0,
          publicidadPorPedido: r.pedidosEntregados
            ? (r.snapshot.gastoDiarioPublicidad * diasCubiertos) / r.pedidosEntregados
            : 0,
        }
      : { ...actual!, tieneParcial: actual!.tieneParcial || r.tipo === 'parcial' };
    semanasMap.set(r.semana, s);
  }
  const semanas = [...semanasMap.values()].sort((a, b) => b.semana.localeCompare(a.semana));

  // Alertas.
  const alertas: Alerta[] = [];
  for (const e of inventario) {
    if (!e.capturado) continue;
    const nombre = e.producto.nombre.toLowerCase();
    const dias = e.producto.diasEntrega ?? 7;
    if (e.bajo) {
      alertas.push({
        id: `stock-${e.producto.id}`,
        tono: 'atencion',
        texto:
          e.diasRestantes !== null
            ? `Pide ${nombre} hoy: te alcanza para ${e.diasRestantes} días y tu proveedor tarda ${dias}.`
            : `Quedan ${Math.max(0, Math.round(e.stock))} piezas de ${nombre}. Pide la siguiente caja.`,
        ir: 'inventario',
      });
    } else if (e.diasParaPedir !== null && e.diasParaPedir <= 3) {
      alertas.push({
        id: `stock-${e.producto.id}`,
        tono: 'info',
        texto: `En ${e.diasParaPedir} día${e.diasParaPedir === 1 ? '' : 's'} toca pedir ${nombre}.`,
        ir: 'inventario',
      });
    }
  }
  if (vigentes.length > 0 && sobrePublicidad < 0) {
    alertas.push({
      id: 'publicidad',
      tono: 'atencion',
      texto: `Facebook te ha cobrado más de lo apartado. Faltan ${Math.round(-sobrePublicidad)} pesos en el sobre de publicidad.`,
    });
  }
  const ultimo = vigentes.at(-1);
  if (ultimo && ultimo.ahorro < 0) {
    alertas.push({
      id: 'ahorro-negativo',
      tono: 'atencion',
      texto: 'El último pago no alcanzó para todo. La diferencia sale de la reserva de Gatito.',
    });
  }
  const ultimaSemana = reportes.reduce((m, r) => (r.semana > m ? r.semana : m), '');
  const desconocidos = reportes
    .filter((r) => r.semana === ultimaSemana)
    .flatMap((r) => r.noReconocidos.map((n) => n.texto.toLowerCase()));
  if (desconocidos.length > 0) {
    alertas.push({
      id: 'no-reconocidos',
      tono: 'info',
      texto: `El último reporte trae productos que no reconozco: ${[...new Set(desconocidos)].join(', ')}. Si ya no los vendes, ignóralo; si son tuyos, agrégalos en Ajustes.`,
      ir: 'ajustes',
    });
  }

  return {
    pagos,
    semanas,
    movimientosBanco,
    deudaBanco: deuda,
    prestadoTotal,
    devueltoTotal,
    premioCobrado,
    sobrePublicidad,
    reserva,
    meta,
    inventario,
    alertas,
  };
}
