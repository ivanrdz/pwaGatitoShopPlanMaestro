import { useCallback } from 'react';
import { useNavigate } from 'react-router';

export type Ruta = 'inicio' | 'indicadores' | 'reportes' | 'inventario' | 'banco' | 'ajustes';

export const rutaA = (r: Ruta) => (r === 'inicio' ? '/' : `/${r}`);

/** Navega a una sección por su nombre. */
export function useIr() {
  const navigate = useNavigate();
  return useCallback((r: Ruta) => navigate(rutaA(r)), [navigate]);
}
