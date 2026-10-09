import type { Ajustes, CobroPublicidad, Compra, Datos, Producto, Reporte, Tienda } from './types';
import { ajustesIniciales, completarProducto, productosIniciales } from './defaults';

const VERSION = 1;

/* ---------- Tiendas: cada una vive en su propia base de datos ---------- */

export const TIENDA_PRINCIPAL: Tienda = { id: 'principal', nombre: 'Gatito Shop' };
const CLAVE_TIENDAS = 'gatito-tiendas';
const CLAVE_ACTIVA = 'gatito-tienda-activa';

const nombreBase = (id: string) => (id === TIENDA_PRINCIPAL.id ? 'gatito-finanzas' : `gatito-finanzas-${id}`);

export function listarTiendas(): Tienda[] {
  try {
    const t = JSON.parse(localStorage.getItem(CLAVE_TIENDAS) ?? '[]') as Tienda[];
    return t.length ? t : [TIENDA_PRINCIPAL];
  } catch {
    return [TIENDA_PRINCIPAL];
  }
}

export function guardarTiendas(t: Tienda[]) {
  localStorage.setItem(CLAVE_TIENDAS, JSON.stringify(t));
}

export function tiendaActiva(): string {
  const id = localStorage.getItem(CLAVE_ACTIVA);
  return id && listarTiendas().some((t) => t.id === id) ? id : TIENDA_PRINCIPAL.id;
}

let actual = tiendaActiva();

export function usarTienda(id: string) {
  actual = id;
  localStorage.setItem(CLAVE_ACTIVA, id);
}

/** Crea la base de una tienda nueva, sin productos y con el nombre que trae su reporte. */
export async function crearTienda(t: Tienda, nombreEnReporte: string) {
  const db = await abrir(t.id);
  const tx = db.transaction('kv', 'readwrite');
  tx.objectStore('kv').put({ ...ajustesIniciales(), nombreEnReporte: nombreEnReporte.toUpperCase(), gastosFijos: [] }, 'ajustes');
  await terminar(tx);
}

export async function eliminarTienda(id: string) {
  const db = await abrir(id);
  db.close();
  conexiones.delete(id);
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(nombreBase(id));
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}

type Coleccion = 'productos' | 'reportes' | 'compras' | 'cobros';
type ValorDe<C extends Coleccion> = C extends 'productos'
  ? Producto
  : C extends 'reportes'
    ? Reporte
    : C extends 'compras'
      ? Compra
      : CobroPublicidad;

const conexiones = new Map<string, Promise<IDBDatabase>>();

function abrir(id: string = actual): Promise<IDBDatabase> {
  const previa = conexiones.get(id);
  if (previa) return previa;
  const conexion = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(nombreBase(id), VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      for (const s of ['productos', 'reportes', 'compras', 'cobros'] as const) {
        if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  conexiones.set(id, conexion);
  return conexion;
}

const promesa = <T>(req: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const terminar = (tx: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });

async function todos<C extends Coleccion>(c: C): Promise<ValorDe<C>[]> {
  const db = await abrir();
  return promesa(db.transaction(c).objectStore(c).getAll()) as Promise<ValorDe<C>[]>;
}

export async function guardar<C extends Coleccion>(c: C, valores: ValorDe<C> | ValorDe<C>[]) {
  const db = await abrir();
  const tx = db.transaction(c, 'readwrite');
  const store = tx.objectStore(c);
  for (const v of Array.isArray(valores) ? valores : [valores]) store.put(v);
  await terminar(tx);
}

export async function borrar(c: Coleccion, id: string) {
  const db = await abrir();
  const tx = db.transaction(c, 'readwrite');
  tx.objectStore(c).delete(id);
  await terminar(tx);
}

export async function guardarAjustes(a: Ajustes) {
  const db = await abrir();
  const tx = db.transaction('kv', 'readwrite');
  tx.objectStore('kv').put(a, 'ajustes');
  await terminar(tx);
}

/** Carga todo. La primera vez de la tienda principal llena los productos y ajustes de Gatito Shop. */
export async function cargarDatos(): Promise<Datos> {
  const db = await abrir();
  let ajustes = (await promesa(db.transaction('kv').objectStore('kv').get('ajustes'))) as Ajustes | undefined;
  let productos = (await todos('productos')).map(completarProducto);
  if (!ajustes) {
    ajustes = ajustesIniciales();
    await guardarAjustes(ajustes);
    if (productos.length === 0) {
      productos = productosIniciales();
      await guardar('productos', productos);
    }
  }
  const orden = new Map(productosIniciales().map((p, i) => [p.id, i]));
  productos.sort((a, b) => (orden.get(a.id) ?? 99) - (orden.get(b.id) ?? 99));
  const [reportes, compras, cobros] = await Promise.all([todos('reportes'), todos('compras'), todos('cobros')]);
  return { ajustes: { ...ajustesIniciales(), ...ajustes }, productos, reportes, compras, cobros };
}

/** Reemplaza todo con un respaldo. */
export async function reemplazarTodo(d: Datos) {
  const db = await abrir();
  const stores = ['kv', 'productos', 'reportes', 'compras', 'cobros'];
  const tx = db.transaction(stores, 'readwrite');
  for (const s of stores) tx.objectStore(s).clear();
  tx.objectStore('kv').put(d.ajustes, 'ajustes');
  for (const p of d.productos) tx.objectStore('productos').put(p);
  for (const r of d.reportes) tx.objectStore('reportes').put(r);
  for (const c of d.compras) tx.objectStore('compras').put(c);
  for (const c of d.cobros) tx.objectStore('cobros').put(c);
  await terminar(tx);
}

export async function borrarTodo() {
  const db = await abrir();
  const stores = ['kv', 'productos', 'reportes', 'compras', 'cobros'];
  const tx = db.transaction(stores, 'readwrite');
  for (const s of stores) tx.objectStore(s).clear();
  await terminar(tx);
}

export function esRespaldoValido(x: unknown): x is Datos {
  if (!x || typeof x !== 'object') return false;
  const d = x as Record<string, unknown>;
  return (
    typeof d.ajustes === 'object' &&
    Array.isArray(d.productos) &&
    Array.isArray(d.reportes) &&
    Array.isArray(d.compras) &&
    Array.isArray(d.cobros)
  );
}
