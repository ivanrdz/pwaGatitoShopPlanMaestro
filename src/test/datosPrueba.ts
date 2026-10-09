import { calcularLibro } from '@/domain/finance';
import { ajustesIniciales, productosIniciales } from '@/domain/defaults';
import { ESTATUS, type Datos, type Reporte } from '@/domain/types';
import type { AppData } from '@/state/appData';

/** Semana de prueba con números redondos: 100 envíos, 50 entregados. */
export function semanaPrueba(lunes: string, entregados = 50, intentos = 100): Reporte {
  const estatus = Object.fromEntries(ESTATUS.map((e) => [e, { monto: 0, pedidos: 0 }])) as Reporte['estatus'];
  estatus.OK.pedidos = entregados;
  estatus.CANCELO.pedidos = intentos - entregados;
  return {
    id: `${lunes}-completo`,
    semana: lunes,
    etiqueta: '',
    tipo: 'completo',
    ventas: entregados * 250,
    pedidosEntregados: entregados,
    logistica: entregados * 61,
    costoProducto: 0,
    efectivo: entregados * 180,
    estatus,
    dias: [],
    piezas: {},
    noReconocidos: [],
    reemplazos: 0,
    reemplazosPorProducto: {},
    tienda: 'GATITOSHOP',
    nombreArchivo: '',
    cargadoEn: '',
    snapshot: { gastoDiarioPublicidad: 600, sueldoMensual: 18000, fijosMensual: 1140, premioBanco: 0.15 },
  };
}

export function datosPrueba(reportes: Reporte[] = [semanaPrueba('2026-09-28')]): Datos {
  return { ajustes: ajustesIniciales(), productos: productosIniciales(), reportes, compras: [], cobros: [] };
}

const noop = async () => undefined;

/** Valor de contexto con datos fijos y acciones vacías. */
export function appDataPrueba(datos: Datos = datosPrueba()): AppData {
  return {
    datos,
    libro: calcularLibro(datos),
    guardarAjustes: noop,
    guardarProducto: noop,
    agregarReportes: async () => [],
    actualizarReporte: noop,
    borrarReporte: noop,
    agregarCompra: noop,
    borrarCompra: noop,
    agregarCobro: noop,
    borrarCobro: noop,
    importar: noop,
    borrarTodo: noop,
  };
}
