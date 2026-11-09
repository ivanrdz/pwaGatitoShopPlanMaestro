import { createContext, useContext } from 'react';

export interface Cargador {
  /** Abre el selector de archivos. */
  elegirArchivos: () => void;
  /**
   * Lee los PDFs y muestra el resumen para confirmar.
   * `alGuardar` recibe los nombres de los archivos que se guardaron (para limpiar la bandeja).
   */
  procesar: (archivos: File[], opciones?: { alGuardar?: (guardados: string[]) => Promise<void> }) => Promise<void>;
}

export const CargadorCtx = createContext<Cargador | null>(null);

export function useCargador() {
  const c = useContext(CargadorCtx);
  if (!c) throw new Error('useCargador debe usarse dentro de CargadorProvider');
  return c;
}
