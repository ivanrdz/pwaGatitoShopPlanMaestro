import { createContext, useContext } from 'react';
import type { Ajustes, CobroPublicidad, Compra, Datos, Producto, Reporte, ReporteParseado } from '@/domain/types';
import type { Libro } from '@/domain/finance';

export interface Acciones {
  guardarAjustes: (a: Ajustes) => Promise<void>;
  guardarProducto: (p: Producto) => Promise<void>;
  agregarReportes: (r: Array<{ parseado: ReporteParseado; nombreArchivo: string }>) => Promise<Reporte[]>;
  actualizarReporte: (r: Reporte) => Promise<void>;
  borrarReporte: (id: string) => Promise<void>;
  agregarCompra: (c: Omit<Compra, 'id' | 'premio'>) => Promise<void>;
  borrarCompra: (id: string) => Promise<void>;
  agregarCobro: (c: Omit<CobroPublicidad, 'id'>) => Promise<void>;
  borrarCobro: (id: string) => Promise<void>;
  importar: (d: Datos) => Promise<void>;
  borrarTodo: () => Promise<void>;
}

export interface AppData extends Acciones {
  datos: Datos;
  libro: Libro;
}

export const AppDataCtx = createContext<AppData | null>(null);

export function useApp() {
  const ctx = useContext(AppDataCtx);
  if (!ctx) throw new Error('useApp debe usarse dentro de AppDataProvider');
  return ctx;
}

export const idReporte = (semana: string, tipo: Reporte['tipo']) => `${semana}-${tipo}`;
