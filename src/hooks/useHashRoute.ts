import { useCallback, useEffect, useState } from 'react';

export type Ruta = 'inicio' | 'indicadores' | 'reportes' | 'inventario' | 'banco' | 'ajustes';
const RUTAS: Ruta[] = ['inicio', 'indicadores', 'reportes', 'inventario', 'banco', 'ajustes'];

const leer = (): Ruta => {
  const r = window.location.hash.replace(/^#\/?/, '').split('?')[0] as Ruta;
  return RUTAS.includes(r) ? r : 'inicio';
};

/** Enrutado por hash: funciona en cualquier hosting estático sin reglas de reescritura. */
export function useHashRoute() {
  const [ruta, setRuta] = useState<Ruta>(leer);
  useEffect(() => {
    const alCambiar = () => {
      setRuta(leer());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', alCambiar);
    return () => window.removeEventListener('hashchange', alCambiar);
  }, []);
  const ir = useCallback((r: Ruta) => {
    window.location.hash = r === 'inicio' ? '/' : `/${r}`;
  }, []);
  return { ruta, ir };
}
