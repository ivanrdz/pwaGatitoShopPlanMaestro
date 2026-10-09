import type { Datos } from '@/domain/types';

/** Revisa que un archivo de respaldo tenga la forma correcta antes de importarlo. */
export function esRespaldoValido(x: unknown): x is Datos {
  if (!x || typeof x !== 'object') return false;
  const d = x as Record<string, unknown>;
  return (
    typeof d.ajustes === 'object' &&
    d.ajustes !== null &&
    Array.isArray(d.productos) &&
    Array.isArray(d.reportes) &&
    Array.isArray(d.compras) &&
    Array.isArray(d.cobros)
  );
}
