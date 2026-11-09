import type { Pago } from '@/domain/finance';
import type { Producto } from '@/domain/types';
import { dinero, entero } from '@/shared/lib/format';

/** Cómo se reparte un pago en sobres, con su explicación. */
export interface Sobre {
  clave: 'banco' | 'inventario' | 'publicidad' | 'fijos' | 'sueldo' | 'ahorro';
  titulo: string;
  monto: number;
  detalle: string;
}

export function sobresDePago(pago: Pago, productos: Producto[]): Sobre[] {
  const piezasCaja = productos
    .filter((p) => p.porCaja && (pago.piezas[p.id] ?? 0) > 0)
    .map((p) => `${entero(pago.piezas[p.id])} ${p.nombre.toLowerCase()}`)
    .join(', ');
  const dias = `${pago.dias} día${pago.dias === 1 ? '' : 's'}`;
  const sobres: Sobre[] = [
    {
      clave: 'banco',
      titulo: 'Regresa al banco',
      monto: pago.banco,
      detalle: pago.banco > 0 ? `Costo + premio de lo vendido: ${piezasCaja}.` : 'No hay deuda pendiente con el banco.',
    },
    {
      clave: 'inventario',
      titulo: 'Guarda para reponer inventario',
      monto: pago.fondoInventario,
      detalle: 'Lo que costaron las piezas que ya no le debes al banco. Es para tu próxima caja.',
    },
    {
      clave: 'publicidad',
      titulo: 'Aparta para publicidad',
      monto: pago.publicidad,
      detalle: `${dias} de anuncios en Facebook.`,
    },
    { clave: 'fijos', titulo: 'Gastos fijos', monto: pago.fijos, detalle: `${dias} de tus suscripciones.` },
    { clave: 'sueldo', titulo: 'Tu sueldo', monto: pago.sueldo, detalle: detalleSueldo(pago, dias) },
    {
      clave: 'ahorro',
      titulo: pago.ahorro >= 0 ? 'Ahorro de Gatito' : 'Faltante',
      monto: pago.ahorro,
      detalle:
        pago.ahorro >= 0
          ? 'Lo que sobra va a la reserva para que Gatito no dependa del banco.'
          : 'Este pago no alcanzó ni para los gastos del negocio. La diferencia sale de la reserva.',
    },
  ];
  // El sueldo se muestra aunque sea $0, para que veas cuánto quedó pendiente.
  return sobres.filter((s) => s.clave === 'ahorro' || s.monto > 0.5 || (s.clave === 'sueldo' && pago.sueldoMeta > 0.5));
}

function detalleSueldo(pago: Pago, dias: string): string {
  const falta = pago.sueldoMeta - pago.sueldo;
  if (falta < 0.5) return `${dias} de tu sueldo mensual.`;
  return `Te tocaban ${dinero(pago.sueldoMeta)}; este pago alcanzó para ${dinero(pago.sueldo)}. Los ${dinero(falta)} que faltan se reponen con los siguientes pagos del mes, antes del ahorro.`;
}
