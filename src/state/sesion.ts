import { createContext, useContext } from 'react';
import type { Repositorio } from '@/data/repositorio';
import type { Bandeja } from '@/data/bandeja';

export interface Sesion {
  /** Dónde se guardan los datos ahora. */
  repo: Repositorio;
  /** Correo del usuario cuando los datos están en la nube. */
  correo: string | null;
  /** Tu id de usuario en la nube (para el flujo de n8n). */
  usuarioId?: string | null;
  /** Bandeja de reportes automáticos; solo con datos en la nube. */
  bandeja?: Bandeja | null;
  salir: () => Promise<void>;
}

export const SesionCtx = createContext<Sesion | null>(null);

export function useSesion() {
  const c = useContext(SesionCtx);
  if (!c) throw new Error('useSesion debe usarse dentro de SesionProvider');
  return c;
}
