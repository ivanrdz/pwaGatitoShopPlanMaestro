import { cobrosDeMenos } from '@/domain/descuentos';
import type { Producto, Reporte } from '@/domain/types';
import { dinero, entero, fechaCorta } from '@/shared/lib/format';

type ConPedidos = Pick<Reporte, 'pedidosUnProducto'>;

/** Aviso corto al revisar un reporte antes de guardarlo. */
export function AvisoCobros({ parseado, productos }: { parseado: ConPedidos; productos: Producto[] }) {
  const cobros = cobrosDeMenos(parseado, productos);
  if (cobros.length === 0) return null;
  const total = cobros.reduce((s, c) => s + c.diferencia, 0);
  return (
    <p className="aviso aviso-chico">
      {cobros.length === 1 ? '1 pedido se cobró' : `${cobros.length} pedidos se cobraron`} por debajo de tu lista de
      precios: {dinero(total)} de menos. Al guardarlo los ves en el detalle del reporte.
    </p>
  );
}

/** Detalle de pedidos cobrados de menos dentro de un reporte. */
export function ListaCobros({ reporte, productos }: { reporte: ConPedidos; productos: Producto[] }) {
  const cobros = cobrosDeMenos(reporte, productos);
  if (!reporte.pedidosUnProducto) {
    return (
      <>
        <h3 className="subtitulo">Cobrados de menos</h3>
        <p className="tenue">
          Este reporte se subió antes de revisar precios. Vuelve a subirlo para ver si hubo cobros por debajo de tu
          lista.
        </p>
      </>
    );
  }
  if (cobros.length === 0) return null;
  const nombre = (id: string) => productos.find((p) => p.id === id)?.nombre.toLowerCase() ?? id;
  const total = cobros.reduce((s, c) => s + c.diferencia, 0);
  return (
    <>
      <h3 className="subtitulo">Cobrados de menos</h3>
      <p className="tenue">
        Pedidos de un solo producto cobrados por debajo de tu lista de precios (Ajustes → Productos). Revisa si fue un
        descuento tuyo, el repartidor o un envío sin cobrar.
      </p>
      <ul className="lista-simple">
        {cobros.map((c, i) => (
          <li key={`${c.fecha}-${i}`}>
            <span>
              {entero(c.piezas)} {nombre(c.productoId)} · {fechaCorta(c.fecha)}
              <span className="tenue">
                {' '}
                · cobrado {dinero(c.cobrado)}, lista {dinero(c.lista)}
              </span>
            </span>
            <span className="num negativo">−{dinero(c.diferencia)}</span>
          </li>
        ))}
        <li>
          <strong>Total de menos</strong>
          <strong className="num negativo">−{dinero(total)}</strong>
        </li>
      </ul>
    </>
  );
}
