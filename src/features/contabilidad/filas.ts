import type { MesContable } from '@/domain/contabilidad';

export interface Fila {
  etiqueta: string;
  valor: number;
  anterior?: number;
  nivel?: 'detalle' | 'subtotal' | 'total';
  /** Se muestra con signo menos (gasto o salida). */
  resta?: boolean;
  nota?: string;
}

export interface Estado {
  id: 'resultados' | 'balance' | 'flujo';
  titulo: string;
  descripcion: string;
  filas: Fila[];
}

/** Arma las tablas de los tres estados de un mes, con el mes anterior para comparar. */
export function estadosDelMes(
  m: MesContable,
  ant: MesContable | undefined,
  nombreProducto: (id: string) => string,
): Estado[] {
  const r = m.resultados;
  const ra = ant?.resultados;
  const estados: Estado[] = [
    {
      id: 'resultados',
      titulo: 'Estado de resultados',
      descripcion: 'Cuánto vendiste en el mes y cuánto ganaste después de todos los costos.',
      filas: [
        { etiqueta: 'Ventas entregadas', valor: r.ventas, anterior: ra?.ventas, nivel: 'subtotal' },
        { etiqueta: 'Costo del producto de caja', valor: r.costoCaja, anterior: ra?.costoCaja, resta: true },
        {
          etiqueta: 'Costo cobrado por el proveedor',
          valor: r.costoProveedor,
          anterior: ra?.costoProveedor,
          resta: true,
          nota: 'Foco, masajeador y empaque: ya viene restado en el corte.',
        },
        { etiqueta: 'Utilidad bruta', valor: r.utilidadBruta, anterior: ra?.utilidadBruta, nivel: 'subtotal' },
        { etiqueta: 'Logística (envíos)', valor: r.logistica, anterior: ra?.logistica, resta: true },
        {
          etiqueta: 'Publicidad',
          valor: r.publicidad,
          anterior: ra?.publicidad,
          resta: true,
          nota: r.publicidadEstimada
            ? 'Estimada con tu gasto diario: registra tus cobros de Facebook para el dato real.'
            : 'Cobros de Facebook registrados en el mes.',
        },
        { etiqueta: 'Gastos fijos', valor: r.fijos, anterior: ra?.fijos, resta: true },
        {
          etiqueta: 'Utilidad de operación',
          valor: r.utilidadOperacion,
          anterior: ra?.utilidadOperacion,
          nivel: 'subtotal',
        },
        {
          etiqueta: 'Premio del banco',
          valor: r.premioBanco,
          anterior: ra?.premioBanco,
          resta: true,
          nota: 'Por los préstamos para inventario de este mes.',
        },
        {
          etiqueta: 'Utilidad antes de tu sueldo',
          valor: r.utilidadAntesSueldo,
          anterior: ra?.utilidadAntesSueldo,
          nivel: 'subtotal',
        },
        { etiqueta: 'Tu sueldo', valor: r.sueldo, anterior: ra?.sueldo, resta: true },
        { etiqueta: 'Utilidad neta', valor: r.utilidadNeta, anterior: ra?.utilidadNeta, nivel: 'total' },
      ],
    },
  ];
  if (m.balance) {
    const b = m.balance;
    const ba = ant?.balance ?? undefined;
    estados.push({
      id: 'balance',
      titulo: 'Balance general',
      descripcion: `Lo que Gatito tiene y lo que debe al cierre del mes.`,
      filas: [
        { etiqueta: 'Reserva de Gatito', valor: b.reserva, anterior: ba?.reserva },
        { etiqueta: 'Sobre de publicidad', valor: b.sobrePublicidad, anterior: ba?.sobrePublicidad },
        ...b.inventarioPorProducto.map((x) => ({
          etiqueta: `Inventario: ${nombreProducto(x.productoId)} (${x.piezas} pzas)`,
          valor: x.valor,
          anterior: ba?.inventarioPorProducto.find((y) => y.productoId === x.productoId)?.valor,
        })),
        { etiqueta: 'Total de activos', valor: b.totalActivos, anterior: ba?.totalActivos, nivel: 'subtotal' },
        {
          etiqueta: 'Deuda con el banco',
          valor: b.deudaBanco,
          anterior: ba?.deudaBanco,
          nota: 'Con el premio incluido.',
        },
        { etiqueta: 'Total de pasivos', valor: b.totalPasivos, anterior: ba?.totalPasivos, nivel: 'subtotal' },
        { etiqueta: 'Capital (lo que vale Gatito)', valor: b.capital, anterior: ba?.capital, nivel: 'total' },
      ],
    });
  }
  if (m.flujo) {
    const f = m.flujo;
    const fa = ant?.flujo ?? undefined;
    estados.push({
      id: 'flujo',
      titulo: 'Flujo de efectivo',
      descripcion: 'El dinero que de verdad entró y salió de Gatito (reserva + sobre de publicidad).',
      filas: [
        {
          etiqueta: 'Efectivo al empezar el mes',
          valor: f.saldoInicial,
          anterior: fa?.saldoInicial,
          nivel: 'subtotal',
        },
        { etiqueta: 'Cobrado en los cortes', valor: f.cobrosCortes, anterior: fa?.cobrosCortes },
        { etiqueta: 'Pagos a Facebook', valor: f.pagosFacebook, anterior: fa?.pagosFacebook, resta: true },
        { etiqueta: 'Gastos fijos', valor: f.fijos, anterior: fa?.fijos, resta: true },
        { etiqueta: 'Tu sueldo', valor: f.sueldo, anterior: fa?.sueldo, resta: true },
        { etiqueta: 'Flujo de operación', valor: f.operacion, anterior: fa?.operacion, nivel: 'subtotal' },
        { etiqueta: 'Cajas pagadas con tu dinero', valor: f.comprasPropias, anterior: fa?.comprasPropias, resta: true },
        { etiqueta: 'Flujo de inversión', valor: f.inversion, anterior: fa?.inversion, nivel: 'subtotal' },
        {
          etiqueta: 'Pagos al banco',
          valor: f.pagosBanco,
          anterior: fa?.pagosBanco,
          resta: true,
          nota:
            f.comprasConBanco > 0
              ? `El banco pagó cajas por ${Math.round(f.comprasConBanco)} pesos directo al proveedor; no pasan por tu caja.`
              : undefined,
        },
        {
          etiqueta: 'Flujo de financiamiento',
          valor: f.financiamiento,
          anterior: fa?.financiamiento,
          nivel: 'subtotal',
        },
        { etiqueta: 'Cambio en el efectivo', valor: f.cambioNeto, anterior: fa?.cambioNeto, nivel: 'subtotal' },
        { etiqueta: 'Efectivo al cerrar el mes', valor: f.saldoFinal, anterior: fa?.saldoFinal, nivel: 'total' },
      ],
    });
  }
  return estados;
}

/** CSV de los estados del mes (para Excel o tu contador). */
export function estadosACsv(mes: string, estados: Estado[]): string {
  const celda = (t: string | number) => {
    const s = typeof t === 'number' ? t.toFixed(2) : t;
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lineas = [['Gatito Finanzas', `Mes ${mes}`].map(celda).join(',')];
  for (const e of estados) {
    lineas.push('', celda(e.titulo), ['Concepto', 'Este mes', 'Mes anterior'].map(celda).join(','));
    for (const f of e.filas) {
      const signo = f.resta ? -1 : 1;
      lineas.push(
        [f.etiqueta, signo * f.valor, f.anterior === undefined ? '' : signo * f.anterior].map(celda).join(','),
      );
    }
  }
  return '﻿' + lineas.join('\n') + '\n';
}
