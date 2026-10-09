import type { SupabaseClient } from '@supabase/supabase-js';

type Fila = Record<string, unknown>;
type Resultado = { data: unknown; error: { message: string } | null };

const LLAVES: Record<string, string[]> = {
  tiendas: ['id'],
  ajustes: ['tienda_id'],
};
const llaveDe = (tabla: string) => LLAVES[tabla] ?? ['tienda_id', 'id'];

/**
 * Supabase en memoria con la misma forma de la API que usa el repositorio:
 * from().select().eq().order().maybeSingle(), insert, upsert, update().eq(), delete().eq().
 * Simula el borrado en cascada al borrar una tienda.
 */
export function crearSupabaseFalso(opciones: { fallarEn?: string } = {}) {
  const tablas = new Map<string, Fila[]>();
  const filas = (t: string) => tablas.get(t) ?? tablas.set(t, []).get(t)!;

  function consulta(tabla: string) {
    const filtros: Array<[string, unknown]> = [];
    let accion: 'select' | 'update' | 'delete' = 'select';
    let columnas = '*';
    let cambios: Fila = {};
    let unica = false;

    const coincide = (f: Fila) => filtros.every(([k, v]) => f[k] === v);
    const proyectar = (f: Fila) =>
      columnas === '*' ? f : Object.fromEntries(columnas.split(',').map((c) => [c.trim(), f[c.trim()]]));

    const ejecutar = (): Resultado => {
      if (opciones.fallarEn === tabla) return { data: null, error: { message: `falla simulada en ${tabla}` } };
      const lista = filas(tabla);
      if (accion === 'delete') {
        const quedan = lista.filter((f) => !coincide(f));
        const borradas = lista.filter(coincide);
        tablas.set(tabla, quedan);
        if (tabla === 'tiendas')
          for (const b of borradas)
            for (const [t, fs] of tablas)
              if (t !== 'tiendas')
                tablas.set(
                  t,
                  fs.filter((f) => f.tienda_id !== b.id),
                );
        return { data: null, error: null };
      }
      if (accion === 'update') {
        for (const f of lista.filter(coincide)) Object.assign(f, cambios);
        return { data: null, error: null };
      }
      const data = lista.filter(coincide).map(proyectar);
      return { data: unica ? (data[0] ?? null) : data, error: null };
    };

    const q = {
      select(c = '*') {
        columnas = c;
        return q;
      },
      eq(k: string, v: unknown) {
        filtros.push([k, v]);
        return q;
      },
      order() {
        return q;
      },
      maybeSingle() {
        unica = true;
        return q;
      },
      update(c: Fila) {
        accion = 'update';
        cambios = c;
        return q;
      },
      delete() {
        accion = 'delete';
        return q;
      },
      then<T>(ok: (r: Resultado) => T, mal?: (e: unknown) => T) {
        return Promise.resolve(ejecutar()).then(ok, mal);
      },
    };
    return q;
  }

  const escribir = (tabla: string, valores: Fila | Fila[], reemplazar: boolean): Promise<Resultado> => {
    if (opciones.fallarEn === tabla)
      return Promise.resolve({ data: null, error: { message: `falla simulada en ${tabla}` } });
    const lista = filas(tabla);
    for (const v of Array.isArray(valores) ? valores : [valores]) {
      const llave = llaveDe(tabla);
      const i = lista.findIndex((f) => llave.every((k) => f[k] === v[k]));
      if (i >= 0 && !reemplazar) return Promise.resolve({ data: null, error: { message: 'duplicate key' } });
      if (i >= 0) lista[i] = { ...v };
      else lista.push({ ...v });
    }
    return Promise.resolve({ data: null, error: null });
  };

  const cliente = {
    from: (tabla: string) => ({
      ...consulta(tabla),
      select: (c?: string) => consulta(tabla).select(c),
      update: (c: Fila) => consulta(tabla).update(c),
      delete: () => consulta(tabla).delete(),
      insert: (v: Fila | Fila[]) => escribir(tabla, v, false),
      upsert: (v: Fila | Fila[]) => escribir(tabla, v, true),
    }),
  };

  return { cliente: cliente as unknown as SupabaseClient, tablas };
}
