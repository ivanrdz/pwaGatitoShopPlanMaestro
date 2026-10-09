import { readdirSync, statSync } from 'node:fs';
import { join, parse } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Archivos de src/, recursivo. */
function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const ruta = join(dir, n);
    return statSync(ruta).isDirectory() ? archivos(ruta) : [ruta];
  });
}

describe('nombres de archivo', () => {
  it('no hay dos módulos que solo difieran en mayúsculas (Windows y macOS los confunden)', () => {
    const vistos = new Map<string, string>();
    const choques: string[] = [];
    for (const ruta of archivos('src')) {
      const { dir, name } = parse(ruta);
      const modulo = name.replace(/\.test$/, '');
      const clave = join(dir, modulo).toLowerCase();
      const previo = vistos.get(clave);
      if (previo && previo !== join(dir, modulo)) choques.push(`${previo} ↔ ${ruta}`);
      else vistos.set(clave, join(dir, modulo));
    }
    expect(choques).toEqual([]);
  });
});
