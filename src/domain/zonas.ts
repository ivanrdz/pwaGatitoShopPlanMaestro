/** Zonas de entrega, según la ciudad del pedido y el costo de envío. */
export type Zona = 'metro' | 'periferia' | 'coahuila';

export const ZONAS: Array<{ id: Zona; nombre: string; descripcion: string }> = [
  {
    id: 'metro',
    nombre: 'Área metropolitana',
    descripcion: 'Monterrey, Apodaca, Guadalupe, Escobedo, San Nicolás, Santa Catarina…',
  },
  {
    id: 'periferia',
    nombre: 'Periferia de Nuevo León',
    descripcion: 'Cadereyta, Pesquería, El Carmen, Zuazua, Ciénega, Salinas…',
  },
  { id: 'coahuila', nombre: 'Coahuila', descripcion: 'Saltillo, Ramos Arizpe, Arteaga.' },
];

const COAHUILA = /\b(SALTILLO|RAMOS|ARTEAGA|COAH|DERRAMADERO)/;
const PERIFERIA =
  /\b(CADEREYTA|PESQUER[IÍ]A|EL CARMEN|ZUAZUA|CI[EÉ]NEGA|SALINAS|SANTIAGO|ALLENDE|MONTEMORELOS|HIDALGO|ABASOLO|MINA|DR\.? GONZ[AÁ]LEZ|MARIN|MAR[IÍ]N)\b/;

/**
 * Zona de un pedido. El texto es el renglón del pedido (con la dirección) y el envío,
 * lo que cobra el repartidor si se entregó ($59 / $69); null si no se entregó.
 */
export function zonaDePedido(texto: string, envio: number | null): Zona {
  const t = texto.toUpperCase();
  if (COAHUILA.test(t)) return 'coahuila';
  if (envio !== null && envio > 0) return envio >= 65 ? 'periferia' : 'metro';
  return PERIFERIA.test(t) ? 'periferia' : 'metro';
}

/** Totales por zona de un reporte (sin datos de clientes). */
export interface TotalesZona {
  /** Envíos a ruta (todos los estatus menos repetidos). */
  intentos: number;
  entregados: number;
  /** Lo que cobraron los pedidos entregados. */
  ventas: number;
  /** Lo que te cobró el repartidor por esas entregas. */
  envio: number;
}

export const totalesVacios = (): Record<Zona, TotalesZona> => ({
  metro: { intentos: 0, entregados: 0, ventas: 0, envio: 0 },
  periferia: { intentos: 0, entregados: 0, ventas: 0, envio: 0 },
  coahuila: { intentos: 0, entregados: 0, ventas: 0, envio: 0 },
});
