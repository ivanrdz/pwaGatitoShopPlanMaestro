import { createContext, useContext } from 'react';

export interface Cargador {
  /** Abre el selector de archivos. */
  elegirArchivos: () => void;
  /** Lee los PDFs y muestra el resumen para confirmar. */
  procesar: (archivos: File[]) => Promise<void>;
}

export const CargadorCtx = createContext<Cargador | null>(null);

export function useCargador() {
  const c = useContext(CargadorCtx);
  if (!c) throw new Error('useCargador debe usarse dentro de CargadorProvider');
  return c;
}
