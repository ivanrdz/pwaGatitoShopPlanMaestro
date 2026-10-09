import { useState } from 'react';
import { useApp } from '@/state/appData';
import { kpisPorSemana, semanasParaMeta, type KpiSemana } from '@/domain/series';
import { dinero, entero, rangoSemana } from '@/shared/lib/format';
import { Simulador } from '@/features/indicadores/Simulador';
import { Embudo } from '@/features/indicadores/Embudo';

type Vista = 'semana' | 'embudo' | 'simulador';

function Cabeza({ vista, setVista }: { vista: Vista; setVista: (v: Vista) => void }) {
  const vistas: Array<[Vista, string]> = [
    ['semana', 'Por semana'],
    ['embudo', 'Embudo'],
    ['simulador', 'Simulador'],
  ];
  return (
    <div className="pagina-cabeza">
      <h1>Indicadores</h1>
      <div className="pestanas" role="tablist" aria-label="Vista">
        {vistas.map(([v, t]) => (
          <button key={v} type="button" role="tab" aria-selected={vista === v} onClick={() => setVista(v)}>
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}

type Formato = 'dinero' | 'entero' | 'pct' | 'decimal' | 'veces';
type Mejor = 'subir' | 'bajar';

interface Definicion {
  clave: keyof KpiSemana;
  nombre: string;
  ayuda: string;
  formato: Formato;
  mejor: Mejor;
  /** Para comparar semanas parciales y completas, escalamos a 7 días. */
  porDia?: boolean;
}

const GRUPOS: Array<{ titulo: string; kpis: Definicion[] }> = [
  {
    titulo: 'Ventas',
    kpis: [
      {
        clave: 'ventas',
        nombre: 'Ventas entregadas',
        ayuda: 'Lo que pagaron los clientes al recibir.',
        formato: 'dinero',
        mejor: 'subir',
        porDia: true,
      },
      {
        clave: 'pedidos',
        nombre: 'Pedidos entregados',
        ayuda: 'Pedidos cobrados en la semana.',
        formato: 'entero',
        mejor: 'subir',
        porDia: true,
      },
      {
        clave: 'ticket',
        nombre: 'Ticket promedio',
        ayuda: 'Ventas entre pedidos. Sube cuando venden más promos de 2.',
        formato: 'dinero',
        mejor: 'subir',
      },
      {
        clave: 'piezasPorPedido',
        nombre: 'Piezas por pedido',
        ayuda: 'Cuántas piezas lleva cada pedido en promedio.',
        formato: 'decimal',
        mejor: 'subir',
      },
    ],
  },
  {
    titulo: 'Rentabilidad',
    kpis: [
      {
        clave: 'utilidad',
        nombre: 'Utilidad real',
        ayuda: 'Efectivo menos piezas de caja, publicidad y gastos fijos. Antes de tu sueldo.',
        formato: 'dinero',
        mejor: 'subir',
        porDia: true,
      },
      { clave: 'margen', nombre: 'Margen real', ayuda: 'Utilidad real entre ventas.', formato: 'pct', mejor: 'subir' },
      {
        clave: 'logisticaPct',
        nombre: 'Logística sobre ventas',
        ayuda: 'Cuánto de cada peso vendido se va en envíos.',
        formato: 'pct',
        mejor: 'bajar',
      },
    ],
  },
  {
    titulo: 'Publicidad',
    kpis: [
      {
        clave: 'costoPorPedido',
        nombre: 'Publicidad por pedido',
        ayuda: 'Lo que te cuesta en anuncios cada pedido entregado.',
        formato: 'dinero',
        mejor: 'bajar',
      },
      {
        clave: 'roas',
        nombre: 'Retorno de publicidad',
        ayuda: 'Pesos vendidos por cada peso en anuncios.',
        formato: 'veces',
        mejor: 'subir',
      },
    ],
  },
  {
    titulo: 'Entregas',
    kpis: [
      {
        clave: 'entrega',
        nombre: 'Se entregó',
        ayuda: 'Entregados entre todos los intentos de la semana.',
        formato: 'pct',
        mejor: 'subir',
      },
      {
        clave: 'cancelacion',
        nombre: 'Cancelaciones',
        ayuda: 'Cancelados entre todos los intentos.',
        formato: 'pct',
        mejor: 'bajar',
      },
      {
        clave: 'reemplazos',
        nombre: 'Reemplazos',
        ayuda: 'Envíos sin cobro por producto dañado o equivocado.',
        formato: 'entero',
        mejor: 'bajar',
      },
    ],
  },
];

function formatear(v: number, f: Formato) {
  switch (f) {
    case 'dinero':
      return dinero(v);
    case 'entero':
      return entero(v);
    case 'pct':
      return `${(v * 100).toFixed(1)}%`;
    case 'decimal':
      return v.toFixed(2);
    case 'veces':
      return `${v.toFixed(1)}×`;
  }
}

const valor = (k: KpiSemana, d: Definicion) => {
  const v = k[d.clave] as number;
  return d.porDia && !k.completa ? (v / k.dias) * 7 : v;
};

function Tendencia({ valores, indice }: { valores: number[]; indice: number }) {
  const w = 96;
  const h = 32;
  if (valores.length < 2) return <svg width={w} height={h} aria-hidden="true" />;
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const x = (i: number) => (i / (valores.length - 1)) * (w - 6) + 3;
  const y = (v: number) => h - 4 - (max === min ? 0.5 : (v - min) / (max - min)) * (h - 8);
  const d = valores.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join('');
  return (
    <svg width={w} height={h} className="tendencia" aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx={x(indice)} cy={y(valores[indice])} r="3.2" fill="currentColor" />
    </svg>
  );
}

export function IndicadoresPage() {
  const { datos, libro } = useApp();
  const semanas = kpisPorSemana(datos);
  const [sel, setSel] = useState<number | null>(null);
  const [vista, setVista] = useState<Vista>('semana');
  const i = sel ?? semanas.length - 1;
  const actual = semanas[i];
  const previa = semanas[i - 1];
  const ventana = semanas.slice(Math.max(0, i - 7), i + 1);
  const faltan = semanasParaMeta(libro);
  const diasInventario = libro.inventario
    .filter((e) => e.capturado && e.diasRestantes !== null)
    .reduce<{ dias: number; nombre: string } | null>(
      (m, e) => (!m || (e.diasRestantes ?? 0) < m.dias ? { dias: e.diasRestantes ?? 0, nombre: e.producto.nombre } : m),
      null,
    );

  if (!actual) {
    return (
      <>
        <div className="pagina-cabeza">
          <h1>Indicadores</h1>
        </div>
        <p className="tenue">Aparecen cuando subas tus reportes.</p>
      </>
    );
  }

  if (vista !== 'semana') {
    return (
      <>
        <Cabeza vista={vista} setVista={setVista} />
        {vista === 'embudo' ? <Embudo /> : <Simulador />}
      </>
    );
  }

  return (
    <>
      <Cabeza vista={vista} setVista={setVista} />

      <div className="kpi-semana">
        <button
          type="button"
          className="boton-icono"
          disabled={i <= 0}
          onClick={() => setSel(i - 1)}
          aria-label="Semana anterior"
        >
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <div>
          <p className="kpi-semana-nombre">Semana {rangoSemana(actual.semana)}</p>
          <p className="tenue">
            {actual.completa
              ? 'Semana completa'
              : 'Solo el corte del jueves; ventas, pedidos y utilidad se proyectan a 7 días'}
            {previa ? '. Comparada con la semana anterior.' : '.'}
          </p>
        </div>
        <button
          type="button"
          className="boton-icono"
          disabled={i >= semanas.length - 1}
          onClick={() => setSel(i + 1)}
          aria-label="Semana siguiente"
        >
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <section className="seccion" aria-labelledby="salud-titulo">
        <h2 id="salud-titulo">Salud del negocio hoy</h2>
        <div className="kpis">
          <article className="kpi">
            <h3>Para ser autosuficiente</h3>
            <p className="kpi-valor num">{faltan === 0 ? 'Ya' : faltan === null ? '—' : `${faltan} sem.`}</p>
            <p className="tenue">
              {faltan === 0
                ? 'La reserva ya alcanza para comprar sin el banco.'
                : faltan === null
                  ? 'Hace falta ahorro positivo después del arranque para estimarlo.'
                  : `Al ritmo de ahorro de las últimas semanas, para juntar ${dinero(libro.meta)}.`}
            </p>
          </article>
          <article className="kpi">
            <h3>Inventario más corto</h3>
            <p className="kpi-valor num">{diasInventario ? `${diasInventario.dias} días` : '—'}</p>
            <p className="tenue">{diasInventario ? diasInventario.nombre : 'Captura tu inventario para calcularlo.'}</p>
          </article>
          <article className="kpi">
            <h3>Deuda con el banco</h3>
            <p className="kpi-valor num">{dinero(libro.deudaBanco)}</p>
            <p className="tenue">Reserva actual: {dinero(libro.reserva)}.</p>
          </article>
        </div>
      </section>

      {GRUPOS.map((g) => (
        <section key={g.titulo} className="seccion" aria-labelledby={`kpi-${g.titulo}`}>
          <h2 id={`kpi-${g.titulo}`}>{g.titulo}</h2>
          <div className="kpis">
            {g.kpis.map((d) => {
              const v = valor(actual, d);
              const antes = previa ? valor(previa, d) : null;
              const cambio = antes ? (v - antes) / Math.abs(antes) : null;
              const bueno = cambio === null || Math.abs(cambio) < 0.005 ? null : cambio > 0 === (d.mejor === 'subir');
              return (
                <article key={d.clave} className="kpi">
                  <h3>{d.nombre}</h3>
                  <div className="kpi-fila">
                    <p className="kpi-valor num">{formatear(v, d.formato)}</p>
                    <span className={`kpi-linea ${bueno === null ? '' : bueno ? 'bien' : 'mal'}`}>
                      <Tendencia valores={ventana.map((k) => valor(k, d))} indice={ventana.length - 1} />
                    </span>
                  </div>
                  {cambio !== null && (
                    <p className={`kpi-cambio ${bueno === null ? '' : bueno ? 'bien' : 'mal'}`}>
                      {cambio > 0 ? '▲' : cambio < 0 ? '▼' : '='} {Math.abs(cambio * 100).toFixed(0)}% vs. semana
                      anterior
                    </p>
                  )}
                  <p className="tenue">{d.ayuda}</p>
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </>
  );
}
