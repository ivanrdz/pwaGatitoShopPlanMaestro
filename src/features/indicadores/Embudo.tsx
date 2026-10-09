import { useMemo, useState } from 'react';
import { useApp } from '@/state/appData';
import {
  MOTIVOS,
  calcularEmbudo,
  enviosParaMeta,
  escenarioEntrega,
  proyectarEnvios,
  utilidadPorEnvioEscalada,
} from '@/features/indicadores/embudo';
import { CampoNumero } from '@/shared/ui/Campo';
import { dinero, entero, rangoSemana } from '@/shared/lib/format';

const pct = (n: number) => `${(n * 100).toFixed(0)}%`;
const dineroCentavos = (n: number) =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(n);

const PERIODOS = [
  { valor: 4, texto: '4 semanas' },
  { valor: 8, texto: '8 semanas' },
  { valor: 0, texto: 'Todo' },
];

const ENTREGAS = [0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8];

export function Embudo() {
  const { datos, libro } = useApp();
  const [periodo, setPeriodo] = useState(8);
  const [modo, setModo] = useState<'envios' | 'meta'>('envios');
  const [envios, setEnvios] = useState(100);
  const [meta, setMeta] = useState(10000);
  const [diasOperacion, setDiasOperacion] = useState(6);
  const [encarecimiento, setEncarecimiento] = useState(0);

  const conPremio = libro.deudaBanco > 0;
  const e = useMemo(
    () => calcularEmbudo(datos, { ultimas: periodo || undefined, conPremio }),
    [datos, periodo, conPremio],
  );

  if (!e) {
    return <p className="tenue">El embudo aparece cuando subas tus reportes.</p>;
  }

  const porEnvio = utilidadPorEnvioEscalada(e, encarecimiento);
  const proyeccion =
    modo === 'envios' ? proyectarEnvios(e, envios, encarecimiento) : enviosParaMeta(e, meta, encarecimiento);
  const enviosEscenario = modo === 'envios' ? envios : (proyeccion?.envios ?? 100);
  const hoyEscenario = escenarioEntrega(e, enviosEscenario, e.entrega, encarecimiento);
  const noEntregados = MOTIVOS.map((m) => ({ ...m, n: e.noEntregados[m.clave] ?? 0 }))
    .filter((m) => m.n > 0)
    .sort((a, b) => b.n - a.n);
  const totalNo = e.envios - e.entregados;
  const etiquetaPeriodo = e.semanas.length === 1 ? '1 semana' : `${e.semanas.length} semanas`;

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
          {etiquetaPeriodo}: {rangoSemana(e.semanas[0].semana).split(' – ')[0]} a{' '}
          {rangoSemana(e.semanas.at(-1)!.semana).split(' – ')[1]}
        </p>
      </div>

      {/* ---------- El embudo ---------- */}
      <section className="seccion" aria-labelledby="emb-titulo">
        <h2 id="emb-titulo">Tu embudo</h2>
        <div className="embudo-caja">
          <ol className="embudo-pasos">
            <li>
              <div className="embudo-paso-cabeza">
                <span>Envíos a ruta</span>
                <strong className="num">{entero(e.envios)}</strong>
              </div>
              <div className="embudo-barra">
                <span className="embudo-tramo-envios" style={{ width: '100%' }} />
              </div>
            </li>
            <li>
              <div className="embudo-paso-cabeza">
                <span>
                  Entregados <span className="tenue">({pct(e.entrega)})</span>
                </span>
                <strong className="num">{entero(e.entregados)}</strong>
              </div>
              <div className="embudo-barra">
                <span className="embudo-tramo-entregados" style={{ width: `${e.entrega * 100}%` }} />
              </div>
            </li>
            <li>
              <div className="embudo-paso-cabeza">
                <span>Efectivo cobrado</span>
                <strong className="num">{dinero(e.efectivo)}</strong>
              </div>
            </li>
            <li>
              <div className="embudo-paso-cabeza">
                <span>Utilidad</span>
                <strong className={`num ${e.utilidad < 0 ? 'negativo' : 'positivo'}`}>{dinero(e.utilidad)}</strong>
              </div>
              <p className="tenue">
                Efectivo menos producto de caja{conPremio ? ' con premio del banco' : ''}, publicidad y gastos fijos.
                Antes de tu sueldo.
              </p>
            </li>
          </ol>
          {totalNo > 0 && (
            <div className="embudo-no">
              <h3>No se entregaron: {entero(totalNo)}</h3>
              <ul className="lista-simple">
                {noEntregados.map((m) => (
                  <li key={m.clave}>
                    <span>{m.nombre}</span>
                    <span className="num">
                      {entero(m.n)} <span className="tenue">({pct(m.n / e.envios)})</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="kpis">
          <article className="kpi">
            <h3>Cada envío te deja</h3>
            <p className="kpi-valor num">{dineroCentavos(e.utilidadPorEnvio)}</p>
            <p className="tenue">De utilidad, contando los que no se entregan.</p>
          </article>
          <article className="kpi">
            <h3>Efectivo por envío</h3>
            <p className="kpi-valor num">{dineroCentavos(e.efectivoPorEnvio)}</p>
            <p className="tenue">Lo que cobras en promedio por cada envío que sale.</p>
          </article>
          <article className="kpi">
            <h3>Utilidad por entrega</h3>
            <p className="kpi-valor num">{dineroCentavos(e.utilidadPorEntrega)}</p>
            <p className="tenue">Cuánto deja cada pedido que sí se cobra.</p>
          </article>
          <article className="kpi">
            <h3>Tu ritmo hoy</h3>
            <p className="kpi-valor num">{entero(e.enviosPorSemana)}</p>
            <p className="tenue">Envíos por semana, que dejan {dinero(e.utilidadPorSemana)} de utilidad.</p>
          </article>
        </div>
      </section>

      {/* ---------- Calculadora ---------- */}
      <section className="seccion" aria-labelledby="calc-titulo">
        <h2 id="calc-titulo">Calculadora de envíos</h2>
        <div className="simulador">
          <div className="simulador-controles">
            <div className="pestanas" role="tablist" aria-label="Pregunta">
              <button type="button" role="tab" aria-selected={modo === 'envios'} onClick={() => setModo('envios')}>
                Si hago N envíos
              </button>
              <button type="button" role="tab" aria-selected={modo === 'meta'} onClick={() => setModo('meta')}>
                Quiero ganar $X
              </button>
            </div>
            {modo === 'envios' ? (
              <CampoNumero etiqueta="Envíos que quiero hacer" valor={envios} min={0} alCambiar={setEnvios} />
            ) : (
              <div className="rejilla-campos">
                <CampoNumero
                  etiqueta="Utilidad que quiero por semana"
                  prefijo="$"
                  valor={meta}
                  min={0}
                  alCambiar={setMeta}
                />
                <CampoNumero
                  etiqueta="Días que trabajas por semana"
                  valor={diasOperacion}
                  min={1}
                  max={7}
                  alCambiar={setDiasOperacion}
                />
              </div>
            )}
            <div className="control-deslizador">
              <label htmlFor="emb-enc">
                Anuncios más caros al escalar <strong className="num">+{Math.round(encarecimiento * 100)}%</strong>
              </label>
              <input
                id="emb-enc"
                type="range"
                min={0}
                max={60}
                step={5}
                value={Math.round(encarecimiento * 100)}
                onChange={(ev) => setEncarecimiento(Number(ev.target.value) / 100)}
              />
              <p className="campo-ayuda">
                Facebook suele cobrar más por conversación al subir mucho el presupuesto. Con +
                {Math.round(encarecimiento * 100)}%, cada envío te deja {dineroCentavos(porEnvio)} en lugar de{' '}
                {dineroCentavos(e.utilidadPorEnvio)}.
              </p>
            </div>
          </div>

          <div className="simulador-resultado" aria-live="polite">
            {proyeccion ? (
              <div className="kpis">
                {modo === 'meta' && (
                  <article className="kpi kpi-destacado">
                    <h3>Envíos que necesitas</h3>
                    <p className="kpi-valor num">{entero(proyeccion.envios)} por semana</p>
                    <p className="tenue">
                      Unos {entero(Math.ceil(proyeccion.envios / Math.max(1, diasOperacion)))} al día.{' '}
                      {proyeccion.envios > e.enviosPorSemana
                        ? `Hoy haces ${entero(e.enviosPorSemana)}: ${pct(proyeccion.envios / e.enviosPorSemana - 1)} más.`
                        : `Hoy haces ${entero(e.enviosPorSemana)}: ya estás ahí.`}
                    </p>
                  </article>
                )}
                <article className="kpi">
                  <h3>Entregas esperadas</h3>
                  <p className="kpi-valor num">{entero(proyeccion.entregas)}</p>
                  <p className="tenue">Al {pct(e.entrega)} de entrega de este periodo.</p>
                </article>
                <article className="kpi">
                  <h3>Efectivo esperado</h3>
                  <p className="kpi-valor num">{dinero(proyeccion.efectivo)}</p>
                </article>
                <article className={`kpi ${modo === 'envios' ? 'kpi-destacado' : ''}`}>
                  <h3>Utilidad esperada</h3>
                  <p className={`kpi-valor num ${proyeccion.utilidad < 0 ? 'negativo' : ''}`}>
                    {dinero(proyeccion.utilidad)}
                  </p>
                  <p className="tenue">Antes de tu sueldo.</p>
                </article>
              </div>
            ) : (
              <p className="aviso">
                Con estos números cada envío no deja utilidad, así que ninguna cantidad de envíos llega a la meta. Baja
                el encarecimiento o revisa tus costos.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ---------- Escenarios de entrega ---------- */}
      <section className="seccion" aria-labelledby="ent-titulo">
        <h2 id="ent-titulo">¿Y si se entregan más?</h2>
        <p className="tenue">
          Mismos {entero(enviosEscenario)} envíos y misma publicidad; solo cambia cuántos se entregan. Cada entrega
          extra deja efectivo sin costar más anuncios. Es la palanca más barata: no requiere subir el presupuesto.
        </p>
        <div className="tabla-scroll">
          <table className="tabla">
            <thead>
              <tr>
                <th scope="col">Se entrega</th>
                <th scope="col">Entregas</th>
                <th scope="col">Efectivo</th>
                <th scope="col">Utilidad</th>
                <th scope="col">vs. hoy</th>
              </tr>
            </thead>
            <tbody>
              {[e.entrega, ...ENTREGAS.filter((p) => Math.abs(p - e.entrega) > 0.004)]
                .sort((a, b) => a - b)
                .map((p) => {
                  const s = escenarioEntrega(e, enviosEscenario, p, encarecimiento);
                  const dif = s.utilidad - hoyEscenario.utilidad;
                  const hoy = p === e.entrega;
                  return (
                    <tr key={p} className={hoy ? 'fila-hoy' : undefined}>
                      <th scope="row">
                        {pct(p)}
                        {hoy ? ' · hoy' : ''}
                      </th>
                      <td className="num">{entero(s.entregas)}</td>
                      <td className="num">{dinero(s.efectivo)}</td>
                      <td className="num">{dinero(s.utilidad)}</td>
                      <td className={`num ${hoy || Math.abs(dif) < 0.5 ? '' : dif > 0 ? 'bien' : 'mal'}`}>
                        {hoy || Math.abs(dif) < 0.5 ? '—' : `${dif > 0 ? '+' : '−'}${dinero(Math.abs(dif))}`}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </section>

      {/* ---------- Por semana ---------- */}
      <section className="seccion" aria-labelledby="sem-titulo">
        <h2 id="sem-titulo">Semana por semana</h2>
        <div className="tabla-scroll">
          <table className="tabla">
            <thead>
              <tr>
                <th scope="col">Semana</th>
                <th scope="col">Envíos</th>
                <th scope="col">Entregados</th>
                <th scope="col">% entrega</th>
                <th scope="col">Efectivo</th>
                <th scope="col">Utilidad</th>
                <th scope="col">Por envío</th>
              </tr>
            </thead>
            <tbody>
              {[...e.semanas].reverse().map((s) => (
                <tr key={s.semana}>
                  <th scope="row">
                    {rangoSemana(s.semana)}
                    {!s.completa && <span className="tenue"> · solo jueves</span>}
                  </th>
                  <td className="num">{entero(s.envios)}</td>
                  <td className="num">{entero(s.entregados)}</td>
                  <td className="num">{pct(s.envios ? s.entregados / s.envios : 0)}</td>
                  <td className="num">{dinero(s.efectivo)}</td>
                  <td className={`num ${s.utilidad < 0 ? 'negativo' : ''}`}>{dinero(s.utilidad)}</td>
                  <td className="num">{dineroCentavos(s.envios ? s.utilidad / s.envios : 0)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">Total</th>
                <td className="num">{entero(e.envios)}</td>
                <td className="num">{entero(e.entregados)}</td>
                <td className="num">{pct(e.entrega)}</td>
                <td className="num">{dinero(e.efectivo)}</td>
                <td className="num">{dinero(e.utilidad)}</td>
                <td className="num">{dineroCentavos(e.utilidadPorEnvio)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="tenue">
          Un pedido que se reagenda y se entrega otro día cuenta como dos envíos, así que el % de entrega real por
          cliente es un poco mejor que este. La calculadora usa la misma regla, así que sus resultados siguen cuadrando
          con tus cortes.
        </p>
      </section>
    </div>
  );
}
