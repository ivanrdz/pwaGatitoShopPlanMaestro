import type { Ajustes, Producto } from './types';
import { hoyIso } from './format';

/**
 * El orden importa: el foco va antes que el soporte bocina,
 * porque "FOCO BOCINA" también contiene la palabra BOCINA.
 */
export const productosIniciales = (): Producto[] => [
  {
    id: 'foco',
    nombre: 'Foco bocina',
    patrones: ['FOCO'],
    costoUnitario: 54,
    porCaja: false,
    piezasPorCaja: 0,
    precioCaja: 0,
    stockInicial: 0,
    puntoReorden: 0,
    diasEntrega: 7,
    activo: true,
  },
  {
    id: 'bocina',
    nombre: 'Soporte bocina',
    patrones: ['BOCINA'],
    costoUnitario: 57.55,
    porCaja: true,
    piezasPorCaja: 100,
    precioCaja: 5500,
    stockInicial: 0,
    puntoReorden: 35,
    diasEntrega: 7,
    activo: true,
  },
  {
    id: 'ventosa',
    nombre: 'Soporte ventosa',
    patrones: ['VENTOS'],
    costoUnitario: 20.28,
    porCaja: true,
    piezasPorCaja: 200,
    precioCaja: 3800,
    stockInicial: 0,
    puntoReorden: 35,
    diasEntrega: 7,
    activo: true,
  },
  {
    id: 'encendedor',
    nombre: 'Encendedor electrónico',
    patrones: ['ENC(?!HIN)\\w*D\\w*R', 'ENX\\w*DOR'],
    costoUnitario: 30.28,
    porCaja: true,
    piezasPorCaja: 200,
    precioCaja: 5800,
    stockInicial: 0,
    puntoReorden: 70,
    diasEntrega: 7,
    activo: true,
  },
  {
    id: 'masajeador',
    nombre: 'Masajeador electrónico',
    patrones: ['MASAJ'],
    costoUnitario: 25,
    porCaja: false,
    piezasPorCaja: 0,
    precioCaja: 0,
    stockInicial: 0,
    puntoReorden: 0,
    diasEntrega: 7,
    activo: true,
  },
];

export const ajustesIniciales = (): Ajustes => ({
  nombreEnReporte: 'GATITOSHOP',
  diasColchon: 3,
  premioBanco: 0.15,
  sueldoMensual: 18000,
  gastosFijos: [
    { id: 'claude', nombre: 'Claude', monto: 370 },
    { id: 'chatgpt', nombre: 'ChatGPT', monto: 370 },
    { id: 'n8n', nombre: 'n8n', monto: 200 },
    { id: 'vercel', nombre: 'Vercel', monto: 200 },
  ],
  gastoDiarioPublicidad: 660,
  cobroFacebook: 4000,
  colchonPublicidad: 4000,
  guiaCompra: 255,
  inventarioDesde: hoyIso(),
  saldoInicialReserva: 0,
  saldoInicialPublicidad: 0,
  deudaInicialBanco: 0,
});

/** Producto con todos los campos, para datos guardados por versiones anteriores. */
export const completarProducto = (p: Partial<Producto> & Pick<Producto, 'id' | 'nombre'>): Producto => ({
  patrones: [],
  costoUnitario: 0,
  porCaja: false,
  piezasPorCaja: 0,
  precioCaja: 0,
  stockInicial: 0,
  puntoReorden: 0,
  diasEntrega: 7,
  activo: true,
  ...p,
});
