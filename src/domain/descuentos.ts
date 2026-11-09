import type { PrecioVenta, Producto, Reporte } from './types';

export interface CobroDeMenos {
  productoId: string;
  piezas: number;
  cobrado: number;
  lista: number;
  /** Lo que se dejó de cobrar (lista − cobrado). */
  diferencia: number;
  fecha: string;
}

/** Tolerancia para redondeos ($229 vs $230 no es un descuento). */
const TOLERANCIA = 1;

/**
 * Precio de lista para N piezas: la combinación más barata de tu lista
 * (3 encendedores = 2 + 1). null si la lista no permite armar esa cantidad.
 */
export function precioDeLista(precios: PrecioVenta[], piezas: number): number | null {
  const validos = precios.filter((p) => p.piezas > 0 && p.precio > 0);
  if (piezas <= 0 || validos.length === 0) return null;
  const mejor: Array<number | null> = [0];
  for (let n = 1; n <= piezas; n++) {
    let m: number | null = null;
    for (const p of validos) {
      const resto = n - p.piezas;
      if (resto < 0) continue;
      const base = mejor[resto];
      if (base === null || base === undefined) continue;
      const total = base + p.precio;
      if (m === null || total < m) m = total;
    }
    mejor[n] = m;
  }
  return mejor[piezas] ?? null;
}

/** Pedidos de un reporte cobrados por debajo de tu lista de precios. */
export function cobrosDeMenos(reporte: Pick<Reporte, 'pedidosUnProducto'>, productos: Producto[]): CobroDeMenos[] {
  const porId = new Map(productos.map((p) => [p.id, p]));
  const salida: CobroDeMenos[] = [];
  for (const pedido of reporte.pedidosUnProducto ?? []) {
    const producto = porId.get(pedido.productoId);
    if (!producto?.precios?.length) continue;
    const lista = precioDeLista(producto.precios, pedido.piezas);
    if (lista === null || pedido.precio >= lista - TOLERANCIA) continue;
    salida.push({
      productoId: pedido.productoId,
      piezas: pedido.piezas,
      cobrado: pedido.precio,
      lista,
      diferencia: lista - pedido.precio,
      fecha: pedido.fecha,
    });
  }
  return salida;
}

/** "1 = 229, 2 = 399" → lista de precios. Ignora lo que no se entienda. */
export function leerPrecios(texto: string): PrecioVenta[] {
  return texto
    .split(',')
    .map((parte) => /^\s*(\d+)\s*(?:=|x|×|pz[as]*)?\s*\$?\s*([\d.]+)\s*$/i.exec(parte))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => ({ piezas: Number(m[1]), precio: Number(m[2]) }))
    .filter((x) => x.piezas > 0 && x.precio > 0)
    .sort((a, b) => a.piezas - b.piezas);
}

export const escribirPrecios = (precios: PrecioVenta[]) => precios.map((x) => `${x.piezas} = ${x.precio}`).join(', ');
