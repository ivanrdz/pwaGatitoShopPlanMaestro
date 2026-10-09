import { createContext, useContext } from 'react';
import type { Tienda } from '@/domain/types';

export interface TiendasCtxValor {
  tiendas: Tienda[];
  activa: Tienda;
  cambiar: (id: string) => void;
  crear: (nombre: string, nombreEnReporte: string) => Promise<void>;
  renombrar: (id: string, nombre: string) => Promise<void>;
  eliminar: (id: string) => Promise<void>;
}

export const TiendasCtx = createContext<TiendasCtxValor | null>(null);

export function useTiendas() {
  const c = useContext(TiendasCtx);
  if (!c) throw new Error('useTiendas debe usarse dentro de TiendasProvider');
  return c;
}
