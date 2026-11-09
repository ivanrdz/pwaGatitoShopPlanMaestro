import { describe, expect, it } from 'vitest';
import { cobrosDeMenos, escribirPrecios, leerPrecios, precioDeLista } from '@/domain/descuentos';
import { productosIniciales } from '@/domain/defaults';

const productos = productosIniciales();
const precios = (id: string) => productos.find((p) => p.id === id)!.precios;

describe('precio de lista', () => {
  it('usa tu lista y combina para otras cantidades (la más barata)', () => {
    expect(precioDeLista(precios('encendedor'), 2)).toBe(229);
    expect(precioDeLista(precios('encendedor'), 3)).toBe(229 + 179);
    expect(precioDeLista(precios('encendedor'), 4)).toBe(428);
    expect(precioDeLista(precios('encendedor'), 6)).toBe(428 + 229);
    expect(precioDeLista(precios('bocina'), 4)).toBe(798);
  });

  it('null si la lista no permite armar esa cantidad', () => {
    expect(precioDeLista([{ piezas: 2, precio: 300 }], 3)).toBeNull();
    expect(precioDeLista([], 1)).toBeNull();
  });
});

describe('cobros de menos', () => {
  const pedido = (productoId: string, piezas: number, precio: number) => ({
    productoId,
    piezas,
    precio,
    fecha: '2026-09-17',
  });

  it('marca 2 encendedores a $199 (envío sin cobrar) y no los de $229 o $230', () => {
    const cobros = cobrosDeMenos(
      {
        pedidosUnProducto: [
          pedido('encendedor', 2, 199),
          pedido('encendedor', 2, 229),
          pedido('encendedor', 2, 230),
          pedido('encendedor', 4, 428),
          pedido('ventosa', 2, 279),
        ],
      },
      productos,
    );
    expect(cobros).toEqual([
      { productoId: 'encendedor', piezas: 2, cobrado: 199, lista: 229, diferencia: 30, fecha: '2026-09-17' },
      { productoId: 'ventosa', piezas: 2, cobrado: 279, lista: 299, diferencia: 20, fecha: '2026-09-17' },
    ]);
  });

  it('tolera $1 de redondeo y omite productos sin lista', () => {
    const sinLista = productos.map((p) => (p.id === 'foco' ? { ...p, precios: [] } : p));
    expect(cobrosDeMenos({ pedidosUnProducto: [pedido('bocina', 1, 228), pedido('foco', 1, 10)] }, sinLista)).toEqual(
      [],
    );
  });

  it('reportes de versiones anteriores no marcan nada', () => {
    expect(cobrosDeMenos({}, productos)).toEqual([]);
  });
});

describe('texto de precios', () => {
  it('entiende varias formas de escribirlo', () => {
    expect(leerPrecios('1 = 229, 2=399')).toEqual([
      { piezas: 1, precio: 229 },
      { piezas: 2, precio: 399 },
    ]);
    expect(leerPrecios('4 x $428, 1 pzas 179, basura')).toEqual([
      { piezas: 1, precio: 179 },
      { piezas: 4, precio: 428 },
    ]);
    expect(escribirPrecios(precios('encendedor'))).toBe('1 = 179, 2 = 229, 4 = 428');
  });
});
