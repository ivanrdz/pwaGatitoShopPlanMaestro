import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Bandeja de reportes: PDFs que llegan solos (por ejemplo, n8n desde tu correo) a Supabase Storage,
 * en bandeja/<tu id de usuario>/. La app los lee con el mismo lector y los borra al guardarlos.
 */
export const CUBETA_BANDEJA = 'bandeja';

export interface ArchivoBandeja {
  /** Ruta dentro de la cubeta: <usuario>/<archivo>. */
  ruta: string;
  /** Nombre para mostrar (sin el prefijo de fecha que agrega n8n). */
  nombre: string;
  creado: string;
}

export interface Bandeja {
  listar(): Promise<ArchivoBandeja[]>;
  descargar(archivo: ArchivoBandeja): Promise<File>;
  borrar(rutas: string[]): Promise<void>;
}

/** Quita el prefijo "20261108-093000-" que agrega el flujo de n8n para no repetir nombres. */
export const nombreVisible = (archivo: string) => archivo.replace(/^\d{8}-\d{6}-/, '');

export function crearBandeja(sb: SupabaseClient, usuarioId: string): Bandeja {
  const cubeta = () => sb.storage.from(CUBETA_BANDEJA);
  return {
    async listar() {
      const { data, error } = await cubeta().list(usuarioId, {
        limit: 100,
        sortBy: { column: 'created_at', order: 'asc' },
      });
      if (error) throw new Error(`No pude revisar tu bandeja: ${error.message}`);
      return (data ?? [])
        .filter((o) => o.name.toLowerCase().endsWith('.pdf'))
        .map((o) => ({ ruta: `${usuarioId}/${o.name}`, nombre: nombreVisible(o.name), creado: o.created_at ?? '' }));
    },
    async descargar(archivo) {
      const { data, error } = await cubeta().download(archivo.ruta);
      if (error || !data) throw new Error(`No pude descargar ${archivo.nombre}: ${error?.message ?? 'sin datos'}`);
      return new File([data], archivo.nombre, { type: 'application/pdf' });
    },
    async borrar(rutas) {
      if (rutas.length === 0) return;
      const { error } = await cubeta().remove(rutas);
      if (error) throw new Error(`No pude limpiar tu bandeja: ${error.message}`);
    },
  };
}
