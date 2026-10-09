import { ESTATUS, type DiaReporte, type Estatus, type Producto, type ReporteParseado } from '@/domain/types';
import { isoDate, sumarDias } from '@/shared/lib/format';

const DIA_RE =
  /(LUNES|MARTES|MI[ÉE]RCOLES|JUEVES|VIERNES|S[ÁA]BADO)\s+(\d{1,2})\/(\d{1,2})\/(\d{4})\s+([\d,]+)(?![\d,/])\s+([\d,]+)(?![\d,/])/gi;
const PRECIO_ESTATUS_RE = /\$\s?([\d,]+)\s+(OK|REAGENDO|CANCELO|REPETIDO|SIN STOCK|SIN SERVICIO|FUERA DE COBERTURA)\b/i;
/** Costo que cobra el proveedor en el pedido: el número que va justo después del envío ("$69 94"). */
const COSTO_FILA_RE = /^\s*(?:\$\s?[\d,]+|N\/A)\s+(\d+(?:\.\d+)?)(?![\d.,]|\s*(?:PZ|PIEZA))/i;
const SOLO_RE = /SOLO\s+(?:PIDIO\s+)?(\d+)|(\d+)\s*PZZ/i;

const numero = (s: string | undefined) => Number((s ?? '').replace(/[$,\s]/g, '')) || 0;

/** Mayúsculas y sin acentos, para comparar con los patrones. */
export const normalizar = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();

const nombreDia = (s: string) => normalizar(s);

function fechaIso(d: string, m: string, y: string) {
  return isoDate(new Date(Number(y), Number(m) - 1, Number(d)));
}

/** Reconoce el producto de un fragmento de texto. Devuelve el id o null. */
export function clasificar(texto: string, productos: Producto[]): string | null {
  const t = normalizar(texto);
  for (const p of productos) {
    if (!p.activo) continue;
    for (const patron of p.patrones) {
      try {
        if (new RegExp(patron, 'i').test(t)) return p.id;
      } catch {
        if (t.includes(normalizar(patron))) return p.id;
      }
    }
  }
  return null;
}

interface Pieza {
  productoId: string | null;
  cantidad: number;
  texto: string;
}

/** "2 foco bocina y 1 encendedor gris" → [{foco, 2}, {encendedor, 1}] */
export function separarPiezas(texto: string, productos: Producto[]): Pieza[] {
  const partes = normalizar(texto)
    .split(/\s+Y\s+|,/)
    .map((p) => p.trim())
    .filter(Boolean);
  const piezas: Pieza[] = [];
  partes.forEach((parte, i) => {
    // Cantidad de 1 o 2 dígitos: un número más largo es un código postal o un número de casa.
    const m = /^(\d{1,2})\s/.exec(parte);
    const cantidad = m ? Number(m[1]) : 1;
    const productoId = clasificar(parte, productos);
    // Las partes sin producto que no empiezan con número suelen ser parte del nombre del cliente.
    if (!productoId && i > 0 && !m) return;
    const sinCantidad = parte.replace(/^\d{1,2}\s+/, '');
    // Solo guardamos las dos primeras palabras: así no se guardan datos del cliente.
    const corto = sinCantidad.split(/\s+/).slice(0, 2).join(' ');
    piezas.push({ productoId, cantidad, texto: corto });
  });
  return piezas;
}

const estatusVacio = () =>
  Object.fromEntries(ESTATUS.map((e) => [e, { monto: 0, pedidos: 0 }])) as Record<
    Estatus,
    { monto: number; pedidos: number }
  >;

export function parseReportText(raw: string, productos: Producto[]): ReporteParseado {
  const texto = raw.replace(/\s+/g, ' ').trim();
  const avisos: string[] = [];

  // Inicio de la tabla de pedidos. La primera celda suele decir TIENDA, pero a veces la editan ("Hh"),
  // así que se reconoce por las columnas FECHA PRODUCTO CLIENTE y se incluye la palabra anterior.
  const columnas = texto.search(/\bFECHA\s+PRODUCTO\s+CLIENTE\b/i);
  const corte = columnas > 0 ? texto.lastIndexOf(' ', columnas - 2) + 1 : columnas;
  const encabezado = corte >= 0 ? texto.slice(0, corte) : texto;
  const cuerpo = corte >= 0 ? texto.slice(corte) : '';

  const etiqueta = /^(\S+)\s+VENTAS\s+BRUTAS/i.exec(texto)?.[1] ?? '';
  const tienda = (/TIENDA\s+(\S+)\s+SEMANAL/i.exec(encabezado)?.[1] ?? 'GATITOSHOP').toUpperCase();
  const escapada = tienda.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const filaRe = new RegExp(`${escapada}\\s+(\\d{1,2})\\/(\\d{1,2})\\/(\\d{4})`, 'gi');

  // Días de la semana con ventas y envíos.
  const dias: DiaReporte[] = [];
  for (const m of encabezado.matchAll(DIA_RE)) {
    const dia = nombreDia(m[1]);
    if (dias.some((d) => d.dia === dia)) continue;
    dias.push({ dia, fecha: fechaIso(m[2], m[3], m[4]), ventas: numero(m[5]), envios: numero(m[6]) });
  }
  if (dias.length === 0) {
    throw new Error('No encontré los días de la semana. ¿Es un reporte de Gatito Shop?');
  }

  const lunesDia = dias.find((d) => d.dia === 'LUNES');
  let semana: string;
  if (lunesDia) {
    semana = lunesDia.fecha;
  } else {
    const orden = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
    semana = sumarDias(dias[0].fecha, -orden.indexOf(dias[0].dia));
  }

  // Estatus del encabezado.
  const estatus = estatusVacio();
  for (const e of ESTATUS) {
    const etiquetaEstatus = e === 'OK' ? 'ENTREGADO' : e;
    const re = new RegExp(`(?:^|\\s)${etiquetaEstatus}\\s+\\$([\\d,]+)\\s+(\\d+)(?![\\d,])`, 'i');
    const m = re.exec(encabezado);
    if (m) estatus[e] = { monto: numero(m[1]), pedidos: Number(m[2]) };
  }

  const ventas = estatus.OK.monto;
  const pedidosEntregados = estatus.OK.pedidos;
  const logistica = numero(/LOGISTICA\s+\$([\d,]+)/i.exec(encabezado)?.[1]);
  const costoProducto = numero(/COSTO\s+DE\s+PRODUCTO\s+\$([\d,]+)/i.exec(encabezado)?.[1]);
  let efectivo = numero(/EFECTIVO\s+\$([\d,]+)/i.exec(encabezado)?.[1]);
  if (!efectivo && ventas) {
    efectivo = ventas - logistica - costoProducto;
    avisos.push('El reporte no traía el efectivo; lo calculé como ventas − logística − costo de producto.');
  }

  const sumaDias = dias.reduce((s, d) => s + d.ventas, 0);
  if (ventas && Math.abs(sumaDias - ventas) > 2) {
    avisos.push(`Las ventas por día suman ${sumaDias} pero el total entregado dice ${ventas}.`);
  }
  if (Math.abs(ventas - logistica - costoProducto - efectivo) > 2) {
    avisos.push('El efectivo no cuadra con ventas − logística − costo de producto.');
  }

  const finDeSemana = dias.filter((d) => ['JUEVES', 'VIERNES', 'SABADO'].includes(d.dia));
  const tipo: 'parcial' | 'completo' =
    finDeSemana.length > 0 && finDeSemana.every((d) => d.ventas === 0) ? 'parcial' : 'completo';

  // Pedidos entregados: piezas por producto.
  const piezas: Record<string, number> = {};
  const noReconocidos = new Map<string, number>();
  let reemplazos = 0;
  const reemplazosPorProducto: Record<string, number> = {};
  const piezasProveedor: Record<string, number> = {};
  const porId = new Map(productos.map((p) => [p.id, p]));
  let filasOk = 0;
  const filas = [...cuerpo.matchAll(filaRe)];
  filas.forEach((fila, i) => {
    const inicio = (fila.index ?? 0) + fila[0].length;
    const fin = i + 1 < filas.length ? (filas[i + 1].index ?? cuerpo.length) : cuerpo.length;
    const trozo = cuerpo.slice(inicio, fin);
    const pe = PRECIO_ESTATUS_RE.exec(trozo);
    if (!pe || pe[2].toUpperCase() !== 'OK') return;
    filasOk += 1;
    const precio = numero(pe[1]);
    if (precio === 0) reemplazos += 1;

    const diagonal = trozo.indexOf('/');
    const finProducto = diagonal >= 0 ? Math.min(diagonal, pe.index) : pe.index;
    const lista = separarPiezas(trozo.slice(0, finProducto), productos);

    const despues = trozo.slice(pe.index + pe[0].length);
    const solo = SOLO_RE.exec(despues);
    const reconocidas = lista.filter((p) => p.productoId);
    if (solo && reconocidas.length === 1) reconocidas[0].cantidad = Number(solo[1] ?? solo[2]);

    // Si el proveedor cobró las piezas de caja en este pedido, no salieron de tu inventario.
    const costoFila = Number(COSTO_FILA_RE.exec(despues)?.[1] ?? 0);
    if (costoFila > 0) {
      let deCaja = 0;
      let sinCaja = 0;
      for (const p of reconocidas) {
        const prod = porId.get(p.productoId!);
        if (!prod) continue;
        if (prod.porCaja) deCaja += p.cantidad * prod.costoUnitario;
        else sinCaja += p.cantidad * prod.costoUnitario;
      }
      if (deCaja > 0 && costoFila - sinCaja >= deCaja / 2) {
        for (const p of reconocidas) {
          if (porId.get(p.productoId!)?.porCaja)
            piezasProveedor[p.productoId!] = (piezasProveedor[p.productoId!] ?? 0) + p.cantidad;
        }
      }
    }

    for (const p of lista) {
      if (p.productoId && precio === 0) {
        reemplazosPorProducto[p.productoId] = (reemplazosPorProducto[p.productoId] ?? 0) + p.cantidad;
      }
      if (p.productoId) piezas[p.productoId] = (piezas[p.productoId] ?? 0) + p.cantidad;
      else noReconocidos.set(p.texto, (noReconocidos.get(p.texto) ?? 0) + p.cantidad);
    }
  });

  if (pedidosEntregados && filasOk !== pedidosEntregados) {
    avisos.push(`Leí ${filasOk} pedidos entregados en el detalle y el resumen dice ${pedidosEntregados}.`);
  }

  return {
    semana,
    etiqueta,
    tipo,
    ventas,
    pedidosEntregados,
    logistica,
    costoProducto,
    efectivo,
    estatus,
    dias,
    piezas,
    noReconocidos: [...noReconocidos].map(([texto, n]) => ({ texto, piezas: n })),
    reemplazos,
    reemplazosPorProducto,
    piezasProveedor,
    tienda,
    avisos,
  };
}
