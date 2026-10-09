import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Columna, Punto } from '../lib/series';

/** Mide el ancho real del contenedor para que el texto de la gráfica no se deforme. */
function useAncho<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [ancho, setAncho] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setAncho(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, ancho] as const;
}

/** Escala con números redondos: 0, 5k, 10k… */
function escala(minV: number, maxV: number) {
  const bajo = Math.min(0, minV);
  const alto = Math.max(maxV, bajo + 1);
  const crudo = (alto - bajo) / 4;
  const p = 10 ** Math.floor(Math.log10(crudo));
  const paso = [1, 2, 2.5, 5, 10].map((m) => m * p).find((x) => x >= crudo) ?? 10 * p;
  const lo = Math.floor(bajo / paso) * paso;
  const hi = Math.ceil(alto / paso) * paso;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + paso / 2; v += paso) ticks.push(Math.round(v * 1000) / 1000);
  return { lo, hi, ticks };
}

export const corto = (n: number) => {
  const a = Math.abs(n);
  const s = n < 0 ? '−' : '';
  if (a >= 1000) return `${s}$${(a / 1000).toFixed(a >= 10000 ? 0 : 1)}k`;
  return `${s}$${Math.round(a)}`;
};
export const piezasCorto = (n: number) => `${Math.round(n)}`;

const M = { arriba: 12, derecha: 8, abajo: 26, izquierda: 46 };

interface Serie {
  clave: string;
  nombre: string;
  color: string;
}

interface Marco {
  titulo: string;
  descripcion?: string;
  children: ReactNode;
  vacio?: boolean;
}

function Marco({ titulo, descripcion, children, vacio }: Marco) {
  return (
    <figure className="grafica">
      <figcaption>
        <h3>{titulo}</h3>
        {descripcion && <p className="tenue">{descripcion}</p>}
      </figcaption>
      {vacio ? <p className="grafica-vacia tenue">Aparece cuando subas tus reportes.</p> : children}
    </figure>
  );
}

function Ejes({
  ancho,
  y,
  ticks,
  formato,
}: {
  ancho: number;
  y: (v: number) => number;
  ticks: number[];
  formato: (n: number) => string;
}) {
  return (
    <g className="ejes" aria-hidden="true">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={M.izquierda} x2={ancho - M.derecha} y1={y(t)} y2={y(t)} />
          <text x={M.izquierda - 6} y={y(t)} dy="0.32em" textAnchor="end">
            {formato(t)}
          </text>
        </g>
      ))}
    </g>
  );
}

interface BarrasProps {
  titulo: string;
  descripcion?: string;
  columnas: Columna[];
  series: Serie[];
  formato: (n: number) => string;
  formatoDetalle: (n: number) => string;
  alto?: number;
  total?: { clave: string; nombre: string };
}

/** Barras apiladas. Toca una barra para ver su detalle debajo. */
export function BarrasApiladas({
  titulo,
  descripcion,
  columnas,
  series,
  formato,
  formatoDetalle,
  alto = 200,
  total,
}: BarrasProps) {
  const [ref, ancho] = useAncho<HTMLDivElement>();
  const [sel, setSel] = useState<number | null>(null);
  const activo = sel ?? columnas.length - 1;
  const sumas = columnas.map((c) => series.reduce((s, x) => s + Math.max(0, c.valores[x.clave] ?? 0), 0));
  const { hi: max, ticks } = escala(0, Math.max(0, ...sumas));
  const h = alto - M.arriba - M.abajo;
  const yB = (v: number) => M.arriba + h - (v / max) * h;
  const banda = columnas.length ? (ancho - M.izquierda - M.derecha) / columnas.length : 0;
  const anchoBarra = Math.min(36, banda * 0.62);
  const cadaCuanto = Math.max(1, Math.ceil(columnas.length / Math.max(1, Math.floor((ancho - M.izquierda) / 54))));
  const col = columnas[activo];

  return (
    <Marco titulo={titulo} descripcion={descripcion} vacio={columnas.length === 0}>
      <div ref={ref} className="grafica-lienzo">
        {ancho > 0 && (
          <svg width={ancho} height={alto} role="img" aria-label={`${titulo}. ${columnas.length} semanas.`}>
            <Ejes ancho={ancho} y={yB} ticks={ticks} formato={formato} />
            {columnas.map((c, i) => {
              let base = 0;
              const x = M.izquierda + banda * i + (banda - anchoBarra) / 2;
              return (
                <g
                  key={i}
                  className={`barra ${i === activo ? 'activa' : ''}`}
                  onClick={() => setSel(i)}
                  onMouseEnter={() => setSel(i)}
                >
                  <rect x={M.izquierda + banda * i} y={M.arriba} width={banda} height={h} fill="transparent" />
                  {series.map((s) => {
                    const v = Math.max(0, c.valores[s.clave] ?? 0);
                    const alturaV = (v / max) * h;
                    const y = M.arriba + h - ((base + v) / max) * h;
                    base += v;
                    return v > 0 ? (
                      <rect key={s.clave} x={x} y={y} width={anchoBarra} height={alturaV} fill={s.color} />
                    ) : null;
                  })}
                  {i % cadaCuanto === 0 && (
                    <text x={x + anchoBarra / 2} y={alto - 8} textAnchor="middle" className="eje-x">
                      {c.etiqueta}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        )}
      </div>
      {series.length > 1 && (
        <ul className="leyenda">
          {series.map((s) => (
            <li key={s.clave}>
              <span style={{ background: s.color }} aria-hidden="true" />
              {s.nombre}
            </li>
          ))}
        </ul>
      )}
      {col && (
        <div className="grafica-detalle" aria-live="polite">
          <strong>{col.detalle}</strong>
          <dl>
            {total && (
              <div className="detalle-total">
                <dt>{total.nombre}</dt>
                <dd className="num">{formatoDetalle(col.valores[total.clave] ?? 0)}</dd>
              </div>
            )}
            {series.map((s) => (
              <div key={s.clave}>
                <dt>
                  <span style={{ background: s.color }} aria-hidden="true" />
                  {s.nombre}
                </dt>
                <dd className={`num ${(col.valores[s.clave] ?? 0) < 0 ? 'negativo' : ''}`}>
                  {formatoDetalle(col.valores[s.clave] ?? 0)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </Marco>
  );
}

interface LineaProps {
  titulo: string;
  descripcion?: string;
  puntos: Punto[];
  color: string;
  formato: (n: number) => string;
  formatoDetalle: (n: number) => string;
  referencia?: { valor: number; etiqueta: string };
  alto?: number;
  escalones?: boolean;
}

/** Línea con área suave. Opcionalmente una meta punteada. */
export function Linea({
  titulo,
  descripcion,
  puntos,
  color,
  formato,
  formatoDetalle,
  referencia,
  alto = 180,
  escalones,
}: LineaProps) {
  const [ref, ancho] = useAncho<HTMLDivElement>();
  const [sel, setSel] = useState<number | null>(null);
  const activo = sel ?? puntos.length - 1;
  const {
    lo: minimo,
    hi,
    ticks,
  } = escala(
    Math.min(0, ...puntos.map((p) => p.valor)),
    Math.max(referencia?.valor ?? 0, ...puntos.map((p) => p.valor)),
  );
  const h = alto - M.arriba - M.abajo;
  const w = ancho - M.izquierda - M.derecha;
  const x = (i: number) => M.izquierda + (puntos.length <= 1 ? w / 2 : (i / (puntos.length - 1)) * w);
  const y = (v: number) => M.arriba + h - ((v - minimo) / (hi - minimo)) * h;
  let d = '';
  puntos.forEach((p, i) => {
    if (i === 0) d += `M${x(i)},${y(p.valor)}`;
    else if (escalones) d += `H${x(i)}V${y(p.valor)}`;
    else d += `L${x(i)},${y(p.valor)}`;
  });
  const area = puntos.length ? `${d}V${y(minimo)}H${x(0)}Z` : '';
  const cadaCuanto = Math.max(1, Math.ceil(puntos.length / Math.max(1, Math.floor(w / 58))));
  const p = puntos[activo];

  return (
    <Marco titulo={titulo} descripcion={descripcion} vacio={puntos.length === 0}>
      <div ref={ref} className="grafica-lienzo">
        {ancho > 0 && (
          <svg
            width={ancho}
            height={alto}
            role="img"
            aria-label={`${titulo}. Último valor ${p ? formatoDetalle(p.valor) : ''}.`}
            onMouseLeave={() => setSel(null)}
          >
            <Ejes ancho={ancho} y={y} ticks={ticks} formato={formato} />
            {referencia && (
              <g className="referencia">
                <line x1={M.izquierda} x2={ancho - M.derecha} y1={y(referencia.valor)} y2={y(referencia.valor)} />
                <text x={ancho - M.derecha} y={y(referencia.valor) - 6} textAnchor="end">
                  {referencia.etiqueta}
                </text>
              </g>
            )}
            <path d={area} fill={color} opacity={0.12} />
            <path d={d} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" />
            {puntos.map((pt, i) => (
              <g key={i} onClick={() => setSel(i)} onMouseEnter={() => setSel(i)}>
                <rect
                  x={x(i) - w / Math.max(1, puntos.length) / 2}
                  y={M.arriba}
                  width={w / Math.max(1, puntos.length)}
                  height={h}
                  fill="transparent"
                />
                <circle
                  cx={x(i)}
                  cy={y(pt.valor)}
                  r={i === activo ? 5 : 3}
                  fill={i === activo ? color : 'var(--superficie)'}
                  stroke={color}
                  strokeWidth={2}
                />
                {i % cadaCuanto === 0 && (
                  <text x={x(i)} y={alto - 8} textAnchor="middle" className="eje-x">
                    {pt.etiqueta}
                  </text>
                )}
              </g>
            ))}
          </svg>
        )}
      </div>
      {p && (
        <div className="grafica-detalle" aria-live="polite">
          <strong>{p.detalle}</strong>
          <span className={`num grafica-valor ${p.valor < 0 ? 'negativo' : ''}`}>{formatoDetalle(p.valor)}</span>
        </div>
      )}
    </Marco>
  );
}
