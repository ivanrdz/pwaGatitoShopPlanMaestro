import { createContext, useContext } from 'react';
import type { Repositorio } from '@/data/repositorio';

export interface Sesion {
  /** Dónde se guardan los datos ahora. */
  repo: Repositorio;
  /** Correo del usuario cuando los datos están en la nube. */
  correo: string | null;
  salir: () => Promise<void>;
}

export const SesionCtx = createContext<Sesion | null>(null);

export function useSesion() {
  const c = useContext(SesionCtx);
  if (!c) throw new Error('useSesion debe usarse dentro de SesionProvider');
  return c;
}
