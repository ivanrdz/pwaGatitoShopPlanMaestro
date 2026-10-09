import type { Ajustes, CobroPublicidad, Compra, Datos, Producto, Reporte, Tienda } from '@/domain/types';
import { ajustesIniciales, completarProducto, productosIniciales } from '@/domain/defaults';

export type Coleccion = 'productos' | 'reportes' | 'compras' | 'cobros';
export const COLECCIONES: Coleccion[] = ['productos', 'reportes', 'compras', 'cobros'];

export type ValorDe<C extends Coleccion> = C extends 'productos'
  ? Producto
  : C extends 'reportes'
    ? Reporte
    : C extends 'compras'
      ? Compra
      : CobroPublicidad;

/**
 * Dónde viven los datos. Las pantallas solo hablan con esta interfaz;
 * hay una versión para este dispositivo (IndexedDB) y otra para la nube (Supabase).
 */
export interface Repositorio {
  readonly tipo: 'local' | 'nube';
  listarTiendas(): Promise<Tienda[]>;
  crearTienda(t: Tienda, nombreEnReporte: string): Promise<void>;
  renombrarTienda(id: string, nombre: string): Promise<void>;
  eliminarTienda(id: string): Promise<void>;
  cargarDatos(tiendaId: string): Promise<Datos>;
  guardar<C extends Coleccion>(tiendaId: string, c: C, valores: ValorDe<C> | ValorDe<C>[]): Promise<void>;
  borrar(tiendaId: string, c: Coleccion, id: string): Promise<void>;
  guardarAjustes(tiendaId: string, a: Ajustes): Promise<void>;
  /** Reemplaza todo con un respaldo. */
  reemplazarTodo(tiendaId: string, d: Datos): Promise<void>;
  borrarTodo(tiendaId: string): Promise<void>;
}

export const TIENDA_PRINCIPAL: Tienda = { id: 'principal', nombre: 'Gatito Shop' };

/** Ajustes de una tienda nueva: sin gastos fijos y con el nombre que trae su reporte. */
export const ajustesTiendaNueva = (nombreEnReporte: string): Ajustes => ({
  ...ajustesIniciales(),
  nombreEnReporte: nombreEnReporte.trim().toUpperCase(),
  gastosFijos: [],
});

/**
 * Completa lo que venga guardado con los valores por defecto y ordena los productos.
 * `sembrar` indica si hay que guardar ajustes y productos iniciales (primera vez de la tienda principal).
 */
export function normalizarDatos(
  tiendaId: string,
  guardado: Omit<Datos, 'ajustes'> & { ajustes: Ajustes | null },
): { datos: Datos; sembrar: { ajustes?: Ajustes; productos?: Producto[] } } {
  const sembrar: { ajustes?: Ajustes; productos?: Producto[] } = {};
  let productos = guardado.productos.map(completarProducto);
  let ajustes = guardado.ajustes;
  if (!ajustes) {
    ajustes = ajustesIniciales();
    sembrar.ajustes = ajustes;
    if (productos.length === 0 && tiendaId === TIENDA_PRINCIPAL.id) {
      productos = productosIniciales();
      sembrar.productos = productos;
    }
  }
  // Los productos de Gatito reciben los patrones nuevos de cada versión (sin perder los que agregaste tú).
  const base = new Map(productosIniciales().map((p) => [p.id, p]));
  productos = productos.map((p) => {
    const d = base.get(p.id);
    return d ? { ...p, patrones: [...new Set([...p.patrones, ...d.patrones])] } : p;
  });
  const orden = new Map(productosIniciales().map((p, i) => [p.id, i]));
  productos.sort((a, b) => (orden.get(a.id) ?? 99) - (orden.get(b.id) ?? 99));
  return {
    datos: {
      ajustes: { ...ajustesIniciales(), ...ajustes },
      productos,
      reportes: guardado.reportes,
      compras: guardado.compras,
      cobros: guardado.cobros,
    },
    sembrar,
  };
}
