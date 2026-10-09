import { beforeEach, describe, expect, it, vi } from 'vitest';
import { productosIniciales } from '@/domain/defaults';
import { ESTATUS, type Reporte } from '@/domain/types';
import { crearSupabaseFalso } from '@/test/fakeSupabase';
import { cerrarConexiones, repositorioLocal } from './indexeddb';
import { TIENDA_PRINCIPAL, type Repositorio } from './repositorio';
import { crearRepositorioNube, ErrorNube } from './supabase';
import { subirANube } from './subirANube';

const reporte = (semana: string): Reporte => ({
  id: `${semana}-completo`,
  semana,
  etiqueta: '',
  tipo: 'completo',
  ventas: 1000,
  pedidosEntregados: 5,
  logistica: 300,
  costoProducto: 0,
  efectivo: 700,
  estatus: Object.fromEntries(ESTATUS.map((e) => [e, { monto: 0, pedidos: 0 }])) as Reporte['estatus'],
  dias: [],
  piezas: {},
  noReconocidos: [],
  reemplazos: 0,
  reemplazosPorProducto: {},
  tienda: 'GATITOSHOP',
  nombreArchivo: 'r.pdf',
  cargadoEn: '',
  snapshot: { gastoDiarioPublicidad: 600, sueldoMensual: 18000, fijosMensual: 1140, premioBanco: 0.15 },
});

/** El mismo contrato debe cumplirse en el dispositivo y en la nube. */
function contrato(nombre: string, crear: () => Repositorio | Promise<Repositorio>) {
  describe(`Repositorio ${nombre}`, () => {
    let repo: Repositorio;
    beforeEach(async () => {
      repo = await crear();
    });

    it('la primera vez llena la tienda principal con los productos de Gatito', async () => {
      const tiendas = await repo.listarTiendas();
      expect(tiendas.map((t) => t.id)).toContain(TIENDA_PRINCIPAL.id);
      const d = await repo.cargarDatos(TIENDA_PRINCIPAL.id);
      expect(d.productos.map((p) => p.id)).toEqual(productosIniciales().map((p) => p.id));
      expect(d.reportes).toEqual([]);
    });

    it('guarda, reemplaza y borra reportes', async () => {
      await repo.cargarDatos(TIENDA_PRINCIPAL.id);
      await repo.guardar(TIENDA_PRINCIPAL.id, 'reportes', [reporte('2026-09-28'), reporte('2026-10-05')]);
      await repo.guardar(TIENDA_PRINCIPAL.id, 'reportes', { ...reporte('2026-10-05'), efectivo: 999 });
      let d = await repo.cargarDatos(TIENDA_PRINCIPAL.id);
      expect(d.reportes).toHaveLength(2);
      expect(d.reportes.find((r) => r.semana === '2026-10-05')?.efectivo).toBe(999);
      await repo.borrar(TIENDA_PRINCIPAL.id, 'reportes', '2026-09-28-completo');
      d = await repo.cargarDatos(TIENDA_PRINCIPAL.id);
      expect(d.reportes.map((r) => r.id)).toEqual(['2026-10-05-completo']);
    });

    it('las tiendas no mezclan sus datos', async () => {
      await repo.listarTiendas();
      await repo.crearTienda({ id: 'luna', nombre: 'Renta la Luna' }, 'rentalaluna');
      await repo.guardar('luna', 'reportes', reporte('2026-10-05'));
      const luna = await repo.cargarDatos('luna');
      const principal = await repo.cargarDatos(TIENDA_PRINCIPAL.id);
      expect(luna.ajustes.nombreEnReporte).toBe('RENTALALUNA');
      expect(luna.productos).toEqual([]);
      expect(luna.reportes).toHaveLength(1);
      expect(principal.reportes).toHaveLength(0);
      await repo.renombrarTienda('luna', 'La Luna');
      expect((await repo.listarTiendas()).find((t) => t.id === 'luna')?.nombre).toBe('La Luna');
      await repo.eliminarTienda('luna');
      expect((await repo.listarTiendas()).map((t) => t.id)).not.toContain('luna');
    });

    it('nunca borra la tienda principal', async () => {
      await repo.listarTiendas();
      await repo.eliminarTienda(TIENDA_PRINCIPAL.id);
      expect((await repo.listarTiendas()).map((t) => t.id)).toContain(TIENDA_PRINCIPAL.id);
    });

    it('reemplazarTodo deja exactamente el respaldo', async () => {
      const d = await repo.cargarDatos(TIENDA_PRINCIPAL.id);
      await repo.guardar(TIENDA_PRINCIPAL.id, 'reportes', reporte('2026-09-28'));
      await repo.reemplazarTodo(TIENDA_PRINCIPAL.id, { ...d, reportes: [reporte('2026-10-05')] });
      const despues = await repo.cargarDatos(TIENDA_PRINCIPAL.id);
      expect(despues.reportes.map((r) => r.semana)).toEqual(['2026-10-05']);
    });
  });
}

/** Cada prueba empieza con un IndexedDB vacío. */
async function localLimpio() {
  await cerrarConexiones();
  vi.stubGlobal('indexedDB', new IDBFactory());
  return repositorioLocal;
}

contrato('local (IndexedDB)', localLimpio);
contrato('nube (Supabase)', () => crearRepositorioNube(crearSupabaseFalso().cliente));

describe('Supabase', () => {
  it('guarda columnas para filtrar además del objeto completo', async () => {
    const { cliente, tablas } = crearSupabaseFalso();
    const repo = crearRepositorioNube(cliente);
    await repo.listarTiendas();
    await repo.guardar('principal', 'reportes', reporte('2026-10-05'));
    await repo.guardar('principal', 'cobros', { id: 'c1', fecha: '2026-10-09', monto: 4000 });
    expect(tablas.get('reportes')?.[0]).toMatchObject({
      tienda_id: 'principal',
      semana: '2026-10-05',
      tipo: 'completo',
    });
    expect(tablas.get('cobros')?.[0]).toMatchObject({ fecha: '2026-10-09', monto: 4000 });
  });

  it('convierte los errores en mensajes legibles', async () => {
    const repo = crearRepositorioNube(crearSupabaseFalso({ fallarEn: 'tiendas' }).cliente);
    await expect(repo.listarTiendas()).rejects.toBeInstanceOf(ErrorNube);
    await expect(repo.listarTiendas()).rejects.toThrow(/No pude leer tus tiendas en la nube/);
  });

  it('sube todas las tiendas del dispositivo a la nube', async () => {
    await localLimpio();
    await repositorioLocal.cargarDatos(TIENDA_PRINCIPAL.id);
    await repositorioLocal.guardar(TIENDA_PRINCIPAL.id, 'reportes', [reporte('2026-09-28'), reporte('2026-10-05')]);
    await repositorioLocal.crearTienda({ id: 'luna', nombre: 'Renta la Luna' }, 'RENTALALUNA');
    await repositorioLocal.guardar('luna', 'reportes', reporte('2026-10-05'));

    const nube = crearRepositorioNube(crearSupabaseFalso().cliente);
    const avances: string[] = [];
    const r = await subirANube(repositorioLocal, nube, (t) => avances.push(t));

    expect(r).toEqual({ tiendas: 2, reportes: 3 });
    expect(avances).toEqual(['Subiendo Gatito Shop…', 'Subiendo Renta la Luna…']);
    expect((await nube.listarTiendas()).map((t) => t.id).sort()).toEqual(['luna', 'principal']);
    expect((await nube.cargarDatos('principal')).reportes).toHaveLength(2);
    expect((await nube.cargarDatos('luna')).ajustes.nombreEnReporte).toBe('RENTALALUNA');
  });
});

describe('patrones de productos', () => {
  it('los productos guardados reciben los patrones nuevos sin perder los tuyos', async () => {
    const repo = await localLimpio();
    const d = await repo.cargarDatos(TIENDA_PRINCIPAL.id);
    const enc = d.productos.find((p) => p.id === 'encendedor')!;
    await repo.guardar(TIENDA_PRINCIPAL.id, 'productos', { ...enc, patrones: ['ENC(?!HIN)\\w*D\\w*R', 'MIO'] });
    const despues = (await repo.cargarDatos(TIENDA_PRINCIPAL.id)).productos.find((p) => p.id === 'encendedor')!;
    expect(despues.patrones).toContain('MIO');
    expect(despues.patrones).toContain('ENF\\w*DOR');
  });
});
