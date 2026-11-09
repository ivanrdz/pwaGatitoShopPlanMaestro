import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { crearBandeja, nombreVisible } from './bandeja';

function storageFalso(objetos: Array<{ name: string; created_at: string }>) {
  const remove = vi.fn(async (_rutas: string[]) => ({ data: [], error: null }));
  const list = vi.fn(async (_carpeta: string) => ({ data: objetos, error: null }));
  const download = vi.fn(async (_ruta: string) => ({ data: new Blob(['%PDF']), error: null }));
  const from = vi.fn(() => ({ list, download, remove }));
  return { cliente: { storage: { from } } as unknown as SupabaseClient, from, list, download, remove };
}

describe('bandeja de reportes', () => {
  it('lista solo PDFs de tu carpeta y quita el prefijo de fecha', async () => {
    const s = storageFalso([
      { name: '20261108-093000-10.10-GATITOSHOP.pdf', created_at: '2026-11-08T09:30:00Z' },
      { name: '.emptyFolderPlaceholder', created_at: '' },
    ]);
    const b = crearBandeja(s.cliente, 'usuario-1');
    const archivos = await b.listar();
    expect(s.from).toHaveBeenCalledWith('bandeja');
    expect(s.list.mock.calls[0][0]).toBe('usuario-1');
    expect(archivos).toEqual([
      {
        ruta: 'usuario-1/20261108-093000-10.10-GATITOSHOP.pdf',
        nombre: '10.10-GATITOSHOP.pdf',
        creado: '2026-11-08T09:30:00Z',
      },
    ]);
  });

  it('descarga como PDF y borra por ruta', async () => {
    const s = storageFalso([]);
    const b = crearBandeja(s.cliente, 'u');
    const f = await b.descargar({ ruta: 'u/x.pdf', nombre: 'x.pdf', creado: '' });
    expect(f.name).toBe('x.pdf');
    expect(f.type).toBe('application/pdf');
    await b.borrar(['u/x.pdf']);
    expect(s.remove).toHaveBeenCalledWith(['u/x.pdf']);
    await b.borrar([]);
    expect(s.remove).toHaveBeenCalledTimes(1);
  });

  it('nombre visible', () => {
    expect(nombreVisible('20261108-093000-10.10-GATITOSHOP.pdf')).toBe('10.10-GATITOSHOP.pdf');
    expect(nombreVisible('07.10-GATITOSHOP.pdf')).toBe('07.10-GATITOSHOP.pdf');
  });
});
