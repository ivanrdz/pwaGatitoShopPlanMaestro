export type Estatus = 'OK' | 'REAGENDO' | 'CANCELO' | 'REPETIDO' | 'SIN STOCK' | 'SIN SERVICIO' | 'FUERA DE COBERTURA';

export const ESTATUS: Estatus[] = [
  'OK',
  'REAGENDO',
  'CANCELO',
  'REPETIDO',
  'SIN STOCK',
  'SIN SERVICIO',
  'FUERA DE COBERTURA',
];

export interface Producto {
  id: string;
  nombre: string;
  /** Expresiones regulares (sin acentos, mayúsculas) para reconocerlo en el reporte. El orden de la lista de productos importa. */
  patrones: string[];
  /** Costo real por pieza, incluida la parte de la guía de paquetería. */
  costoUnitario: number;
  /** true = lo compras por caja y lo financia el banco o la reserva. false = el proveedor lo cobra al vender (ya viene restado en el efectivo). */
  porCaja: boolean;
  piezasPorCaja: number;
  precioCaja: number;
  stockInicial: number;
  /** Mínimo manual: te avisa al llegar aquí aunque el cálculo diga otra cosa. */
  puntoReorden: number;
  /** Días que tarda tu proveedor desde que pides hasta que tienes la caja. */
  diasEntrega: number;
  activo: boolean;
}

export interface GastoFijo {
  id: string;
  nombre: string;
  monto: number;
}

export interface Ajustes {
  /** Cómo aparece la tienda en el reporte (ej. GATITOSHOP). */
  nombreEnReporte: string;
  /** Días extra de margen al calcular cuándo pedir inventario. */
  diasColchon: number;
  premioBanco: number;
  sueldoMensual: number;
  gastosFijos: GastoFijo[];
  gastoDiarioPublicidad: number;
  cobroFacebook: number;
  colchonPublicidad: number;
  /** Guía de paquetería por cada caja que llega. */
  guiaCompra: number;
  /** Fecha (ISO) de arranque: desde aquí cuentan inventario, banco, sobre de publicidad y reserva. */
  inventarioDesde: string;
  saldoInicialReserva: number;
  saldoInicialPublicidad: number;
  /** Lo que ya le debías al banco el día de arranque, con premio incluido. */
  deudaInicialBanco: number;
}

export interface DiaReporte {
  dia: string;
  fecha: string;
  ventas: number;
  envios: number;
}

export interface SnapshotReporte {
  gastoDiarioPublicidad: number;
  sueldoMensual: number;
  fijosMensual: number;
  premioBanco: number;
}

export interface ReporteParseado {
  /** Lunes de la semana, ISO yyyy-mm-dd. */
  semana: string;
  etiqueta: string;
  tipo: 'parcial' | 'completo';
  ventas: number;
  pedidosEntregados: number;
  logistica: number;
  costoProducto: number;
  efectivo: number;
  estatus: Record<Estatus, { monto: number; pedidos: number }>;
  dias: DiaReporte[];
  piezas: Record<string, number>;
  noReconocidos: { texto: string; piezas: number }[];
  reemplazos: number;
  /** Piezas enviadas sin cobro (reemplazos), por producto. */
  reemplazosPorProducto: Record<string, number>;
  /**
   * Piezas de productos de caja que cobró el proveedor en el pedido (como antes de comprar por caja).
   * No salen de tu inventario ni se le deben al banco. Falta en reportes guardados por versiones anteriores.
   */
  piezasProveedor?: Record<string, number>;
  /** Nombre de la tienda que trae el reporte. */
  tienda: string;
  avisos: string[];
}

export interface Reporte extends Omit<ReporteParseado, 'avisos'> {
  id: string;
  nombreArchivo: string;
  cargadoEn: string;
  snapshot: SnapshotReporte;
}

export interface Compra {
  id: string;
  fecha: string;
  financiadoPor: 'banco' | 'gatito';
  items: { productoId: string; piezas: number; costo: number }[];
  guia: number;
  /** Premio del banco vigente al registrar la compra. */
  premio: number;
  nota?: string;
}

export interface CobroPublicidad {
  id: string;
  fecha: string;
  monto: number;
}

export interface Datos {
  ajustes: Ajustes;
  productos: Producto[];
  reportes: Reporte[];
  compras: Compra[];
  cobros: CobroPublicidad[];
}

export interface Tienda {
  id: string;
  nombre: string;
}
