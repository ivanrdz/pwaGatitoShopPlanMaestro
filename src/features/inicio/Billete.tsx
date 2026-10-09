import type { Pago } from '@/domain/finance';
import type { Producto } from '@/domain/types';
import { dinero } from '@/shared/lib/format';
import { sobresDePago } from './sobres';

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
