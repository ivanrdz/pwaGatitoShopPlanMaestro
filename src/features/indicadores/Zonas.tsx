import { useMemo, useState } from 'react';
import { useApp } from '@/state/appData';
import { ZONAS, type Zona } from '@/domain/zonas';
import { CampoNumero } from '@/shared/ui/Campo';
import { dinero, entero } from '@/shared/lib/format';
import { calcularZonas, compararRepartidor } from './calculoZonas';

const pct = (n: number) => `${Math.round(n * 100)}%`;
const PERIODOS = [
  { valor: 4, texto: '4 semanas' },
  { valor: 8, texto: '8 semanas' },
  { valor: 0, texto: 'Todo' },
];

export function Zonas() {
  const { datos } = useApp();
  const [periodo, setPeriodo] = useState(8);
  const [sueldo, setSueldo] = useState(3500);
  const [otros, setOtros] = useState(0);
  const [cubiertas, setCubiertas] = useState<Zona[]>(['metro']);
  const z = useMemo(() => calcularZonas(datos, periodo || undefined), [datos, periodo]);

  if (!z) return <p className="tenue">Las zonas aparecen cuando subas tus reportes.</p>;
  if (z.semanas === 0) {
    return (
      <p className="aviso">
        Tus reportes se subieron antes de separar por zona. Vuelve a subirlos en Reportes y aquí verás Monterrey, la
        periferia y Coahuila por separado.
      </p>
    );
  }

  const r = compararRepartidor(z, { sueldoSemanal: sueldo, otrosSemanal: otros, zonasCubiertas: cubiertas });
  const nombre = (id: Zona) => ZONAS.find((x) => x.id === id)!.nombre;
  const alternar = (id: Zona) => setCubiertas((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  return (
    <div className="embudo">
      <div className="embudo-periodo">
        <div className="pestanas pestanas-chicas" role="group" aria-label="Periodo">
          {PERIODOS.map((p) => (
            <button key={p.valor} type="button" aria-pressed={periodo === p.valor} onClick={() => setPeriodo(p.valor)}>
              {p.texto}
            </button>
          ))}
        </div>
        <p className="tenue">
          {z.semanas === 1 ? '1 semana' : `${z.semanas} semanas`}
          {z.sinZonas > 0 && ` · ${z.sinZonas} sin zona (vuelve a subirlas)`}
        </p>
      </div>

      <section className="seccion" aria-labelledby="zonas-titulo">
        <h2 id="zonas-titulo">Por zona</h2>
        <div className="kpis">
          {z.zonas.map((x) => (
            <article key={x.zona} className="kpi">
              <h3>{nombre(x.zona)}</h3>
              <p className="kpi-valor num">{entero(x.entregadosPorSemana)} entregas</p>
              <p className="tenue">
                por semana · {pct(x.entrega)} se entrega · {pct(x.participacion)} de tus entregas
              </p>
              <p className="tenue">
                Envío: {dinero(x.envioPorSemana)} a la semana ({dinero(x.envioPorEntrega)} c/u)
              </p>
            </article>
          ))}
        </div>
        <div className="tabla-scroll">
          <table className="tabla">
            <thead>
              <tr>
                <th scope="col">Zona</th>
                <th scope="col">Envíos</th>
                <th scope="col">Entregados</th>
                <th scope="col">% entrega</th>
                <th scope="col">Ventas</th>
                <th scope="col">Ticket</th>
                <th scope="col">Envío pagado</th>
              </tr>
            </thead>
            <tbody>
              {z.zonas.map((x) => (
                <tr key={x.zona}>
                  <th scope="row">{nombre(x.zona)}</th>
                  <td className="num">{entero(x.intentos)}</td>
                  <td className="num">{entero(x.entregados)}</td>
                  <td className="num">{pct(x.entrega)}</td>
                  <td className="num">{dinero(x.ventas)}</td>
                  <td className="num">{dinero(x.ticket)}</td>
                  <td className="num">{dinero(x.envio)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="tenue">
          La zona sale de la ciudad de la dirección y del costo de envío ($59 área metropolitana, $69 periferia y
          Coahuila). Solo se guardan totales, nunca direcciones.
        </p>
      </section>

      <section className="seccion" aria-labelledby="rep-titulo">
        <h2 id="rep-titulo">¿Me conviene un repartidor propio?</h2>
        <div className="simulador">
          <div className="simulador-controles">
            <div className="rejilla-campos">
              <CampoNumero etiqueta="Le pagarías por semana" prefijo="$" valor={sueldo} min={0} alCambiar={setSueldo} />
              <CampoNumero
                etiqueta="Gasolina u otros por semana"
                prefijo="$"
                valor={otros}
                min={0}
                alCambiar={setOtros}
                ayuda="Solo si tú los pagas aparte."
              />
            </div>
            <fieldset className="zonas-cubiertas">
              <legend>Zonas que cubriría</legend>
              {ZONAS.map((x) => (
                <label key={x.id} className="casilla">
                  <input type="checkbox" checked={cubiertas.includes(x.id)} onChange={() => alternar(x.id)} />
                  <span>
                    {x.nombre} <span className="tenue">· {x.descripcion}</span>
                  </span>
                </label>
              ))}
            </fieldset>
          </div>
          <div className="simulador-resultado" aria-live="polite">
            <div className="kpis">
              <article className="kpi">
                <h3>Hoy pagas de envío ahí</h3>
                <p className="kpi-valor num">{dinero(r.envioQueDejasDePagar)}</p>
                <p className="tenue">por semana, unas {entero(r.entregasPorSemana)} entregas.</p>
              </article>
              <article className="kpi">
                <h3>El repartidor te costaría</h3>
                <p className="kpi-valor num">{dinero(r.costo)}</p>
                <p className="tenue">por semana.</p>
              </article>
              <article className="kpi kpi-destacado">
                <h3>{r.ahorro >= 0 ? 'Te ahorrarías' : 'Te costaría de más'}</h3>
                <p className={`kpi-valor num ${r.ahorro < 0 ? 'negativo' : 'positivo'}`}>
                  {dinero(Math.abs(r.ahorro))}
                </p>
                <p className="tenue">
                  por semana, unos {dinero(Math.abs(r.ahorro) * 4.3)} al mes.
                  {r.entregasParaQueConvenga !== null &&
                    ` Conviene desde ${entero(r.entregasParaQueConvenga)} entregas por semana en esas zonas.`}
                </p>
              </article>
            </div>
            <p className="tenue">
              No incluye el cobro de empaque del repartidor actual ($61 por corte) ni el efecto de entregar más: con
              alguien tuyo que reintente, tu % de entrega podría subir.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
