import type { SupabaseClient } from '@supabase/supabase-js';
import type { Ajustes, Datos, Producto, Tienda } from '@/domain/types';
import {
  COLECCIONES,
  TIENDA_PRINCIPAL,
  ajustesTiendaNueva,
  normalizarDatos,
  type Coleccion,
  type Repositorio,
  type ValorDe,
} from './repositorio';

/** Error con un mensaje que se puede mostrar tal cual en pantalla. */
export class ErrorNube extends Error {
  constructor(accion: string, causa: { message: string } | null) {
    super(`No pude ${accion} en la nube${causa ? `: ${causa.message}` : '.'}`);
    this.name = 'ErrorNube';
  }
}

const revisar = <T>(accion: string, r: { data: T; error: { message: string } | null }): T => {
  if (r.error) throw new ErrorNube(accion, r.error);
  return r.data;
};

/** Columnas extra de cada tabla, además de `datos`, para ordenar y filtrar. */
function fila<C extends Coleccion>(tiendaId: string, c: C, v: ValorDe<C>) {
  const base = { tienda_id: tiendaId, id: v.id, datos: v };
  switch (c) {
    case 'reportes': {
      const r = v as ValorDe<'reportes'>;
      return { ...base, semana: r.semana, tipo: r.tipo };
    }
    case 'compras':
      return { ...base, fecha: (v as ValorDe<'compras'>).fecha };
    case 'cobros': {
      const x = v as ValorDe<'cobros'>;
      return { ...base, fecha: x.fecha, monto: x.monto };
    }
    default:
      return base;
  }
}

const LOTE = 500;

/** Datos en Supabase. Row Level Security garantiza que cada usuario solo ve lo suyo. */
export function crearRepositorioNube(sb: SupabaseClient): Repositorio {
  async function leer<C extends Coleccion>(tiendaId: string, c: C): Promise<ValorDe<C>[]> {
    const data = revisar(`leer ${c}`, await sb.from(c).select('datos').eq('tienda_id', tiendaId));
    return (data as Array<{ datos: ValorDe<C> }>).map((r) => r.datos);
  }

  const repo: Repositorio = {
    tipo: 'nube',

    async listarTiendas() {
      const data = revisar('leer tus tiendas', await sb.from('tiendas').select('id, nombre').order('creada_en'));
      const tiendas = data as Tienda[];
      if (tiendas.length) return tiendas;
      // Primera vez: crea la tienda principal.
      revisar('crear tu tienda', await sb.from('tiendas').upsert(TIENDA_PRINCIPAL));
      return [TIENDA_PRINCIPAL];
    },

    async crearTienda(t, nombreEnReporte) {
      revisar('crear la tienda', await sb.from('tiendas').insert(t));
      await repo.guardarAjustes(t.id, ajustesTiendaNueva(nombreEnReporte));
    },

    async renombrarTienda(id, nombre) {
      revisar('renombrar la tienda', await sb.from('tiendas').update({ nombre }).eq('id', id));
    },

    async eliminarTienda(id) {
      if (id === TIENDA_PRINCIPAL.id) return;
      // Las tablas de la tienda se borran en cascada.
      revisar('borrar la tienda', await sb.from('tiendas').delete().eq('id', id));
    },

    async cargarDatos(tiendaId) {
      const [aj, productos, reportes, compras, cobros] = await Promise.all([
        sb.from('ajustes').select('datos').eq('tienda_id', tiendaId).maybeSingle(),
        leer(tiendaId, 'productos'),
        leer(tiendaId, 'reportes'),
        leer(tiendaId, 'compras'),
        leer(tiendaId, 'cobros'),
      ]);
      const ajustes = (revisar('leer los ajustes', aj) as { datos: Ajustes } | null)?.datos ?? null;
      const { datos, sembrar } = normalizarDatos(tiendaId, {
        ajustes,
        productos: productos as Producto[],
        reportes,
        compras,
        cobros,
      });
      if (sembrar.ajustes) await repo.guardarAjustes(tiendaId, sembrar.ajustes);
      if (sembrar.productos) await repo.guardar(tiendaId, 'productos', sembrar.productos);
      return datos;
    },

    async guardar(tiendaId, c, valores) {
      const lista = Array.isArray(valores) ? valores : [valores];
      for (let i = 0; i < lista.length; i += LOTE) {
        const filas = lista.slice(i, i + LOTE).map((v) => fila(tiendaId, c, v));
        revisar(`guardar ${c}`, await sb.from(c).upsert(filas));
      }
    },

    async borrar(tiendaId, c, id) {
      revisar(`borrar en ${c}`, await sb.from(c).delete().eq('tienda_id', tiendaId).eq('id', id));
    },

    async guardarAjustes(tiendaId, a) {
      revisar('guardar los ajustes', await sb.from('ajustes').upsert({ tienda_id: tiendaId, datos: a }));
    },

    async reemplazarTodo(tiendaId, d: Datos) {
      await repo.borrarTodo(tiendaId);
      await repo.guardarAjustes(tiendaId, d.ajustes);
      for (const c of COLECCIONES) if (d[c].length) await repo.guardar(tiendaId, c, d[c] as ValorDe<typeof c>[]);
    },

    async borrarTodo(tiendaId) {
      for (const t of ['ajustes', ...COLECCIONES]) {
        revisar('borrar tus datos', await sb.from(t).delete().eq('tienda_id', tiendaId));
      }
    },
  };
  return repo;
}
