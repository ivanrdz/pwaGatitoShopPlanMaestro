import type { Pago } from '../lib/finance';
import type { Producto } from '../lib/types';
import { dinero, entero } from '../lib/format';

interface Sobre {
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
    { clave: 'sueldo', titulo: 'Tu sueldo', monto: pago.sueldo, detalle: `${dias} de tu sueldo mensual.` },
    {
      clave: 'ahorro',
      titulo: pago.ahorro >= 0 ? 'Ahorro de Gatito' : 'Faltante',
      monto: pago.ahorro,
      detalle:
        pago.ahorro >= 0
          ? 'Lo que sobra va a la reserva para que Gatito no dependa del banco.'
          : 'Este pago no alcanzó. La diferencia sale de la reserva.',
    },
  ];
  return sobres.filter((s) => s.clave === 'ahorro' || s.monto > 0.5);
}

/** La barra: el pago completo partido en sobres, del mismo ancho que el dinero. */
export function Billete({ pago, productos }: { pago: Pago; productos: Producto[] }) {
  const sobres = sobresDePago(pago, productos);
  const positivos = sobres.filter((s) => s.monto > 0);
  const total = positivos.reduce((s, x) => s + x.monto, 0) || 1;
  return (
    <div className="billete">
      <div
        className="billete-barra"
        role="img"
        aria-label={sobres.map((s) => `${s.titulo}: ${dinero(s.monto)}`).join('. ')}
      >
        {positivos.map((s) => (
          <span key={s.clave} className={`billete-tramo sobre-${s.clave}`} style={{ flexGrow: s.monto / total }} />
        ))}
      </div>
      <ul className="sobres">
        {sobres.map((s) => (
          <li key={s.clave} className={`sobre ${s.monto < 0 ? 'sobre-negativo' : ''}`}>
            <span className={`sobre-marca sobre-${s.clave}`} aria-hidden="true" />
            <div className="sobre-texto">
              <span className="sobre-titulo">{s.titulo}</span>
              <span className="sobre-detalle">{s.detalle}</span>
            </div>
            <span className="sobre-monto">{dinero(s.monto)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
