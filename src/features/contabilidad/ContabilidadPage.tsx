import { useMemo, useState } from 'react';
import { useApp } from '@/state/appData';
import { contabilidadMensual } from '@/domain/contabilidad';
import { dinero } from '@/shared/lib/format';
import { estadosACsv, estadosDelMes, type Estado, type Fila } from './filas';

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];
const nombreMes = (mes: string) => `${MESES[Number(mes.slice(5, 7)) - 1]} ${mes.slice(0, 4)}`;

function Cambio({ fila }: { fila: Fila }) {
  if (fila.anterior === undefined) return <td className="num tenue">—</td>;
  const dif = fila.valor - fila.anterior;
  if (Math.abs(dif) < 0.5) return <td className="num tenue">igual</td>;
  // En gastos, subir es malo; en ingresos y utilidades, subir es bueno.
  const bueno = fila.resta ? dif < 0 : dif > 0;
  return (
    <td className={`num ${bueno ? 'bien' : 'mal'}`}>
      {dif > 0 ? '+' : '−'}
      {dinero(Math.abs(dif))}
    </td>
  );
}

function TablaEstado({ estado, conAnterior }: { estado: Estado; conAnterior: boolean }) {
  return (
    <section className="seccion estado-financiero" aria-labelledby={`est-${estado.id}`}>
      <h2 id={`est-${estado.id}`}>{estado.titulo}</h2>
      <p className="tenue">{estado.descripcion}</p>
      <div className="tabla-scroll">
        <table className="tabla tabla-estado">
          <thead>
            <tr>
              <th scope="col">Concepto</th>
              <th scope="col">Este mes</th>
              {conAnterior && <th scope="col">vs. mes anterior</th>}
            </tr>
          </thead>
          <tbody>
            {estado.filas.map((f) => (
              <tr key={f.etiqueta} className={f.nivel ? `fila-${f.nivel}` : undefined}>
                <th scope="row">
                  {f.etiqueta}
                  {f.nota && <span className="fila-nota">{f.nota}</span>}
                </th>
                <td className={`num ${!f.resta && f.valor < 0 ? 'negativo' : ''}`}>
                  {f.resta && f.valor > 0.5 ? '−' : ''}
                  {dinero(Math.abs(f.valor) < 0.5 ? 0 : f.resta ? Math.abs(f.valor) : f.valor)}
                </td>
                {conAnterior && <Cambio fila={f} />}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function ContabilidadPage() {
  const { datos, libro } = useApp();
  const meses = useMemo(() => contabilidadMensual(datos, libro), [datos, libro]);
  const [indice, setIndice] = useState(meses.length - 1);

  if (meses.length === 0) {
    return (
      <>
        <div className="pagina-cabeza">
          <h1>Contabilidad</h1>
        </div>
        <p className="tenue">Tus estados financieros aparecen cuando subas tus reportes.</p>
      </>
    );
  }

  const i = Math.min(Math.max(indice, 0), meses.length - 1);
  const m = meses[i];
  const ant = meses[i - 1];
  const nombreProducto = (id: string) => datos.productos.find((p) => p.id === id)?.nombre ?? id;
  const estados = estadosDelMes(m, ant, nombreProducto);
  const esMesArranque = m.mes === datos.ajustes.inventarioDesde.slice(0, 7);

  const descargar = () => {
    const blob = new Blob([estadosACsv(m.mes, estados)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gatito-estados-${m.mes}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="contabilidad">
      <div className="pagina-cabeza">
        <h1>Contabilidad</h1>
        <div className="botones no-imprimir">
          <button type="button" className="boton boton-secundario" onClick={descargar}>
            Descargar CSV
          </button>
          <button type="button" className="boton boton-secundario" onClick={() => window.print()}>
            Imprimir o PDF
          </button>
        </div>
      </div>

      <div className="mes-nav">
        <button
          type="button"
          className="boton-icono no-imprimir"
          onClick={() => setIndice(i - 1)}
          disabled={i <= 0}
          aria-label="Mes anterior"
        >
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <label className="mes-select">
          <span className="sr-only">Mes</span>
          <select value={i} onChange={(e) => setIndice(Number(e.target.value))}>
            {meses.map((x, n) => (
              <option key={x.mes} value={n}>
                {nombreMes(x.mes)}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="boton-icono no-imprimir"
          onClick={() => setIndice(i + 1)}
          disabled={i >= meses.length - 1}
          aria-label="Mes siguiente"
        >
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {!m.balance && (
        <p className="aviso">
          Este mes es de antes de tu fecha de arranque: tienes el estado de resultados, pero sin saldos no hay balance
          ni flujo de efectivo.
        </p>
      )}
      {esMesArranque && m.balance && (
        <p className="tenue">Este mes cuenta desde tu fecha de arranque, así que no se compara con el anterior.</p>
      )}

      {estados.map((e) => (
        // En el mes de arranque no se compara: cuenta desde el día de arranque, no el mes completo.
        <TablaEstado key={e.id} estado={e} conAnterior={Boolean(ant) && !esMesArranque} />
      ))}

      {m.capital && (
        <section className="seccion" aria-labelledby="cuadre-titulo">
          <h2 id="cuadre-titulo">Cómo cambió lo que vale Gatito</h2>
          <ul className="lista-simple">
            <li>
              <span>Capital al empezar el mes</span>
              <span className="num">{dinero(m.capital.inicial)}</span>
            </li>
            <li>
              <span>Utilidad neta del mes</span>
              <span className="num">{dinero(m.capital.utilidadNeta)}</span>
            </li>
            {Math.abs(m.capital.publicidadSinCobrar) >= 1 && (
              <li>
                <span>
                  Publicidad que Facebook aún no cobra
                  <span className="fila-nota">
                    Se restó como gasto estimado, pero el dinero sigue en el sobre. Registra tus cobros de Facebook.
                  </span>
                </span>
                <span className="num">{dinero(m.capital.publicidadSinCobrar)}</span>
              </li>
            )}
            {Math.abs(m.capital.vendidoAntesDelConteo) >= 1 && (
              <li>
                <span>
                  Piezas vendidas antes de tu conteo
                  <span className="fila-nota">
                    Se vendieron antes de tu fecha de arranque: su costo cuenta en el mes, pero ya no estaban en tu
                    inventario inicial.
                  </span>
                </span>
                <span className="num">{dinero(m.capital.vendidoAntesDelConteo)}</span>
              </li>
            )}
            {Math.abs(m.capital.otros) >= 1 && (
              <li>
                <span>
                  Otros ajustes
                  <span className="fila-nota">Redondeos o cambios en el costo por pieza.</span>
                </span>
                <span className="num">{dinero(m.capital.otros)}</span>
              </li>
            )}
            <li>
              <strong>Capital al cerrar el mes</strong>
              <strong className="num">{dinero(m.capital.final)}</strong>
            </li>
          </ul>
        </section>
      )}
    </div>
  );
}
