import type { Ajustes, Datos, Tienda } from '@/domain/types';
import {
  COLECCIONES,
  TIENDA_PRINCIPAL,
  ajustesTiendaNueva,
  normalizarDatos,
  type Coleccion,
  type Repositorio,
  type ValorDe,
} from './repositorio';

/**
 * Datos en este dispositivo. Cada tienda vive en su propia base de IndexedDB;
 * la lista de tiendas va en localStorage.
 */
const VERSION = 1;
const CLAVE_TIENDAS = 'gatito-tiendas';
const STORES = ['kv', ...COLECCIONES];

const nombreBase = (id: string) => (id === TIENDA_PRINCIPAL.id ? 'gatito-finanzas' : `gatito-finanzas-${id}`);

const conexiones = new Map<string, Promise<IDBDatabase>>();

function abrir(id: string): Promise<IDBDatabase> {
  const previa = conexiones.get(id);
  if (previa) return previa;
  const conexion = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(nombreBase(id), VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      for (const s of COLECCIONES) {
        if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  conexiones.set(id, conexion);
  return conexion;
}

/** Cierra las conexiones abiertas (al cambiar de usuario o en pruebas). */
export async function cerrarConexiones() {
  for (const c of conexiones.values()) (await c).close();
  conexiones.clear();
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

function leerTiendas(): Tienda[] {
  try {
    const t = JSON.parse(localStorage.getItem(CLAVE_TIENDAS) ?? '[]') as Tienda[];
    return t.length ? t : [TIENDA_PRINCIPAL];
  } catch {
    return [TIENDA_PRINCIPAL];
  }
}

const escribirTiendas = (t: Tienda[]) => localStorage.setItem(CLAVE_TIENDAS, JSON.stringify(t));

async function todos<C extends Coleccion>(tiendaId: string, c: C): Promise<ValorDe<C>[]> {
  const db = await abrir(tiendaId);
  return promesa(db.transaction(c).objectStore(c).getAll()) as Promise<ValorDe<C>[]>;
}

export const repositorioLocal: Repositorio = {
  tipo: 'local',

  async listarTiendas() {
    return leerTiendas();
  },

  async crearTienda(t, nombreEnReporte) {
    await repositorioLocal.guardarAjustes(t.id, ajustesTiendaNueva(nombreEnReporte));
    escribirTiendas([...leerTiendas(), t]);
  },

  async renombrarTienda(id, nombre) {
    escribirTiendas(leerTiendas().map((t) => (t.id === id ? { ...t, nombre } : t)));
  },

  async eliminarTienda(id) {
    if (id === TIENDA_PRINCIPAL.id) return;
    const db = await abrir(id);
    db.close();
    conexiones.delete(id);
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase(nombreBase(id));
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      req.onblocked = () => resolve();
    });
    escribirTiendas(leerTiendas().filter((t) => t.id !== id));
  },

  async cargarDatos(tiendaId) {
    const db = await abrir(tiendaId);
    const ajustes =
      ((await promesa(db.transaction('kv').objectStore('kv').get('ajustes'))) as Ajustes | undefined) ?? null;
    const [productos, reportes, compras, cobros] = await Promise.all([
      todos(tiendaId, 'productos'),
      todos(tiendaId, 'reportes'),
      todos(tiendaId, 'compras'),
      todos(tiendaId, 'cobros'),
    ]);
    const { datos, sembrar } = normalizarDatos(tiendaId, { ajustes, productos, reportes, compras, cobros });
    if (sembrar.ajustes) await repositorioLocal.guardarAjustes(tiendaId, sembrar.ajustes);
    if (sembrar.productos) await repositorioLocal.guardar(tiendaId, 'productos', sembrar.productos);
    return datos;
  },

  async guardar(tiendaId, c, valores) {
    const db = await abrir(tiendaId);
    const tx = db.transaction(c, 'readwrite');
    const store = tx.objectStore(c);
    for (const v of Array.isArray(valores) ? valores : [valores]) store.put(v);
    await terminar(tx);
  },

  async borrar(tiendaId, c, id) {
    const db = await abrir(tiendaId);
    const tx = db.transaction(c, 'readwrite');
    tx.objectStore(c).delete(id);
    await terminar(tx);
  },

  async guardarAjustes(tiendaId, a) {
    const db = await abrir(tiendaId);
    const tx = db.transaction('kv', 'readwrite');
    tx.objectStore('kv').put(a, 'ajustes');
    await terminar(tx);
  },

  async reemplazarTodo(tiendaId, d: Datos) {
    const db = await abrir(tiendaId);
    const tx = db.transaction(STORES, 'readwrite');
    for (const s of STORES) tx.objectStore(s).clear();
    tx.objectStore('kv').put(d.ajustes, 'ajustes');
    for (const c of COLECCIONES) for (const v of d[c]) tx.objectStore(c).put(v);
    await terminar(tx);
  },

  async borrarTodo(tiendaId) {
    const db = await abrir(tiendaId);
    const tx = db.transaction(STORES, 'readwrite');
    for (const s of STORES) tx.objectStore(s).clear();
    await terminar(tx);
  },
};
