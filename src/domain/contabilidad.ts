import type { Datos, Reporte } from './types';
import type { Libro, Pago } from './finance';

/**
 * Estados financieros mensuales de Gatito: estado de resultados, balance general y flujo de efectivo.
 * Cada pago cuenta en el mes en que lo recibes. El "efectivo de Gatito" es la reserva más el sobre de publicidad.
 */

export interface EstadoResultados {
  pedidos: number;
  ventas: number;
  /** Piezas de caja que salieron de tu inventario, a costo. */
  costoCaja: number;
  /** Lo que el proveedor cobró al vender (foco, masajeador, empaque); ya viene restado en el corte. */
  costoProveedor: number;
  costoVentas: number;
  utilidadBruta: number;
  logistica: number;
  publicidad: number;
  /** true si no registraste cobros de Facebook en el mes y se usó tu gasto diario. */
  publicidadEstimada: boolean;
  fijos: number;
  gastosOperacion: number;
  utilidadOperacion: number;
  /** Premio del banco por los préstamos del mes. */
  premioBanco: number;
  utilidadAntesSueldo: number;
  sueldo: number;
  utilidadNeta: number;
}

export interface BalanceGeneral {
  /** Último día del mes. */
  fecha: string;
  reserva: number;
  sobrePublicidad: number;
  efectivo: number;
  inventario: number;
  inventarioPorProducto: Array<{ productoId: string; piezas: number; valor: number }>;
  totalActivos: number;
  deudaBanco: number;
  totalPasivos: number;
  capital: number;
}

export interface FlujoEfectivo {
  saldoInicial: number;
  cobrosCortes: number;
  pagosFacebook: number;
  fijos: number;
  sueldo: number;
  operacion: number;
  comprasPropias: number;
  inversion: number;
  pagosBanco: number;
  financiamiento: number;
  cambioNeto: number;
  saldoFinal: number;
  /** Cajas que pagó el banco directo al proveedor: no pasan por tu caja. */
  comprasConBanco: number;
}

export interface MesContable {
  /** AAAA-MM */
  mes: string;
  resultados: EstadoResultados;
  /** null para meses antes de tu fecha de arranque: sin saldos no hay balance ni flujo. */
  balance: BalanceGeneral | null;
  flujo: FlujoEfectivo | null;
  /** Cómo cambió el capital: inicial + utilidad neta + ajustes = final. */
  capital: {
    inicial: number;
    utilidadNeta: number;
    /** Publicidad estimada que Facebook aún no cobra: el dinero sigue en el sobre. */
    publicidadSinCobrar: number;
    /** Costo de piezas vendidas antes de tu conteo inicial: ya no estaban en el inventario de arranque. */
    vendidoAntesDelConteo: number;
    /** Redondeos y cambios de costo por pieza. */
    otros: number;
    final: number;
  } | null;
}

const ultimoDia = (mes: string) => {
  const [a, m] = mes.split('-').map(Number);
  const d = new Date(Date.UTC(a, m, 0));
  return d.toISOString().slice(0, 10);
};
const mesDe = (fecha: string) => fecha.slice(0, 7);
const mesAnterior = (mes: string) => {
  const [a, m] = mes.split('-').map(Number);
  return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, '0')}`;
};

/** Ventas, logística y costo del proveedor de un pago (el lunes = semana completa − corte del jueves). */
function cifrasDePago(p: Pago, porId: Map<string, Reporte>, parcialDe: Map<string, Reporte>) {
  const r = porId.get(p.reporteId);
  if (!r) return { ventas: 0, logistica: 0, costoProveedor: 0 };
  const menos = p.tipo === 'lunes' ? parcialDe.get(p.semana) : undefined;
  return {
    ventas: r.ventas - (menos?.ventas ?? 0),
    logistica: r.logistica - (menos?.logistica ?? 0),
    costoProveedor: r.costoProducto - (menos?.costoProducto ?? 0),
  };
}

export function contabilidadMensual(datos: Datos, libro: Libro): MesContable[] {
  const { ajustes, productos, reportes, compras, cobros } = datos;
  const arranque = ajustes.inventarioDesde;
  const porId = new Map(reportes.map((r) => [r.id, r]));
  const parcialDe = new Map(reportes.filter((r) => r.tipo === 'parcial').map((r) => [r.semana, r]));
  const costo = new Map(productos.map((p) => [p.id, p]));
  const comprasVigentes = compras.filter((c) => c.fecha >= arranque);
  const cobrosVigentes = cobros.filter((c) => c.fecha >= arranque);
  const vigentes = libro.pagos.filter((p) => !p.previo);
  const totalCompra = (c: Datos['compras'][number]) => c.items.reduce((s, i) => s + i.costo, 0) + c.guia;

  /** Saldos de Gatito al final del día `hasta`. */
  function saldos(hasta: string) {
    const pagos = vigentes.filter((p) => p.fecha <= hasta);
    const comprasHasta = comprasVigentes.filter((c) => c.fecha <= hasta);
    const reserva =
      ajustes.saldoInicialReserva +
      pagos.reduce((s, p) => s + p.ahorro + p.fondoInventario, 0) -
      comprasHasta.filter((c) => c.financiadoPor !== 'banco').reduce((s, c) => s + totalCompra(c), 0);
    const sobrePublicidad =
      ajustes.saldoInicialPublicidad +
      pagos.reduce((s, p) => s + p.publicidad, 0) -
      cobrosVigentes.filter((c) => c.fecha <= hasta).reduce((s, c) => s + c.monto, 0);
    const inventarioPorProducto = productos
      .filter((p) => p.porCaja)
      .map((p) => {
        const entradas = comprasHasta.reduce(
          (s, c) => s + c.items.filter((i) => i.productoId === p.id).reduce((a, i) => a + i.piezas, 0),
          0,
        );
        const salidas = libro.pagos
          .filter((x) => x.desde >= arranque && x.fecha <= hasta)
          .reduce((s, x) => s + (x.piezasStock[p.id] ?? 0), 0);
        const piezas = Math.max(0, p.stockInicial + entradas - salidas);
        return { productoId: p.id, piezas, valor: piezas * p.costoUnitario };
      })
      .filter((x) => x.piezas > 0);
    const movimientos = libro.movimientosBanco.filter((m) => m.fecha <= hasta);
    const deudaBanco = movimientos.length ? movimientos[movimientos.length - 1].saldo : ajustes.deudaInicialBanco;
    const inventario = inventarioPorProducto.reduce((s, x) => s + x.valor, 0);
    const efectivo = reserva + sobrePublicidad;
    return {
      reserva,
      sobrePublicidad,
      efectivo,
      inventario,
      inventarioPorProducto,
      deudaBanco,
      capital: efectivo + inventario - deudaBanco,
    };
  }

  const meses = [...new Set(libro.pagos.map((p) => mesDe(p.fecha)))].sort();
  const mesArranque = mesDe(arranque);

  return meses.map((mes) => {
    const conSaldos = mes >= mesArranque;
    // Desde el mes de arranque solo cuentan los pagos vigentes, para que cuadre con el balance.
    const delMes = libro.pagos.filter((p) => mesDe(p.fecha) === mes && (!conSaldos || !p.previo));
    let ventas = 0;
    let logistica = 0;
    let costoProveedor = 0;
    for (const p of delMes) {
      const c = cifrasDePago(p, porId, parcialDe);
      ventas += c.ventas;
      logistica += c.logistica;
      costoProveedor += c.costoProveedor;
    }
    const costoCaja = delMes.reduce(
      (s, p) =>
        s +
        Object.entries(p.piezasStock).reduce(
          (a, [id, n]) => (costo.get(id)?.porCaja ? a + n * (costo.get(id)?.costoUnitario ?? 0) : a),
          0,
        ),
      0,
    );
    const cobrosMes = cobrosVigentes.filter((c) => mesDe(c.fecha) === mes);
    const publicidadEstimada = cobrosMes.length === 0;
    const publicidad = publicidadEstimada
      ? delMes.reduce((s, p) => s + p.publicidad, 0)
      : cobrosMes.reduce((s, c) => s + c.monto, 0);
    const fijos = delMes.reduce((s, p) => s + p.fijos, 0);
    const comprasMes = comprasVigentes.filter((c) => mesDe(c.fecha) === mes);
    const premioBanco = comprasMes
      .filter((c) => c.financiadoPor === 'banco')
      .reduce((s, c) => s + totalCompra(c) * c.premio, 0);
    const sueldo = delMes.reduce((s, p) => s + p.sueldo, 0);
    const costoVentas = costoCaja + costoProveedor;
    const utilidadBruta = ventas - costoVentas;
    const gastosOperacion = logistica + publicidad + fijos;
    const utilidadOperacion = utilidadBruta - gastosOperacion;
    const utilidadAntesSueldo = utilidadOperacion - premioBanco;
    const resultados: EstadoResultados = {
      pedidos: delMes.reduce((s, p) => s + p.pedidos, 0),
      ventas,
      costoCaja,
      costoProveedor,
      costoVentas,
      utilidadBruta,
      logistica,
      publicidad,
      publicidadEstimada,
      fijos,
      gastosOperacion,
      utilidadOperacion,
      premioBanco,
      utilidadAntesSueldo,
      sueldo,
      utilidadNeta: utilidadAntesSueldo - sueldo,
    };
    if (!conSaldos) return { mes, resultados, balance: null, flujo: null, capital: null };

    const cierre = ultimoDia(mes);
    // Saldos al empezar el mes: el cierre del mes anterior, o tus saldos de arranque.
    const inicioDia = mes === mesArranque ? null : ultimoDia(mesAnterior(mes));
    const fin = saldos(cierre);
    const ini = inicioDia
      ? saldos(inicioDia)
      : (() => {
          const inventario = productos
            .filter((p) => p.porCaja)
            .reduce((s, p) => s + p.stockInicial * p.costoUnitario, 0);
          const efectivo = ajustes.saldoInicialReserva + ajustes.saldoInicialPublicidad;
          return { efectivo, capital: efectivo + inventario - ajustes.deudaInicialBanco };
        })();
    const vigentesMes = delMes;
    const cobrosCortes = vigentesMes.reduce((s, p) => s + p.efectivo, 0);
    const pagosFacebook = cobrosMes.reduce((s, c) => s + c.monto, 0);
    const fijosPagados = vigentesMes.reduce((s, p) => s + p.fijos, 0);
    const sueldoPagado = vigentesMes.reduce((s, p) => s + p.sueldo, 0);
    const operacion = cobrosCortes - pagosFacebook - fijosPagados - sueldoPagado;
    const comprasPropias = comprasMes
      .filter((c) => c.financiadoPor !== 'banco')
      .reduce((s, c) => s + totalCompra(c), 0);
    const pagosBanco = vigentesMes.reduce((s, p) => s + p.banco, 0);
    const flujo: FlujoEfectivo = {
      saldoInicial: ini.efectivo,
      cobrosCortes,
      pagosFacebook,
      fijos: fijosPagados,
      sueldo: sueldoPagado,
      operacion,
      comprasPropias,
      inversion: comprasPropias ? -comprasPropias : 0,
      pagosBanco,
      financiamiento: pagosBanco ? -pagosBanco : 0,
      cambioNeto: operacion - comprasPropias - pagosBanco,
      saldoFinal: fin.efectivo,
      comprasConBanco: comprasMes.filter((c) => c.financiadoPor === 'banco').reduce((s, c) => s + totalCompra(c), 0),
    };
    const balance: BalanceGeneral = {
      fecha: cierre,
      reserva: fin.reserva,
      sobrePublicidad: fin.sobrePublicidad,
      efectivo: fin.efectivo,
      inventario: fin.inventario,
      inventarioPorProducto: fin.inventarioPorProducto,
      totalActivos: fin.efectivo + fin.inventario,
      deudaBanco: fin.deudaBanco,
      totalPasivos: fin.deudaBanco,
      capital: fin.capital,
    };
    const publicidadSinCobrar = publicidadEstimada ? publicidad - pagosFacebook : 0;
    const vendidoAntesDelConteo = delMes
      .filter((p) => p.desde < arranque)
      .reduce(
        (s, p) =>
          s +
          Object.entries(p.piezasStock).reduce(
            (a, [id, n]) => (costo.get(id)?.porCaja ? a + n * (costo.get(id)?.costoUnitario ?? 0) : a),
            0,
          ),
        0,
      );
    return {
      mes,
      resultados,
      balance,
      flujo,
      capital: {
        inicial: ini.capital,
        utilidadNeta: resultados.utilidadNeta,
        publicidadSinCobrar,
        vendidoAntesDelConteo,
        otros: fin.capital - ini.capital - resultados.utilidadNeta - publicidadSinCobrar - vendidoAntesDelConteo,
        final: fin.capital,
      },
    };
  });
}
