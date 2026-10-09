import { useApp } from '../state/AppData';
import { dinero, fechaCorta } from '../lib/format';
import { Linea, corto } from '../components/Graficas';
import { deudaEnElTiempo } from '../lib/series';

export function Banco() {
  const { datos, libro } = useApp();
  const movimientos = [...libro.movimientosBanco].reverse();

  return (
    <>
      <div className="pagina-cabeza">
        <h1>Banco</h1>
      </div>
      <section className="banco-resumen">
        <p className="tenue">Le debes al banco</p>
        <p className="pago-monto num">{dinero(libro.deudaBanco)}</p>
        <dl className="cifras">
          <div>
            <dt>Te ha prestado</dt>
            <dd className="num">{dinero(libro.prestadoTotal)}</dd>
          </div>
          <div>
            <dt>Le has regresado</dt>
            <dd className="num">{dinero(libro.devueltoTotal)}</dd>
          </div>
          <div>
            <dt>Ganancia del banco hasta hoy</dt>
            <dd className="num">{dinero(libro.premioCobrado)}</dd>
          </div>
          <div>
            <dt>Premio actual</dt>
            <dd className="num">{Math.round(datos.ajustes.premioBanco * 100)}%</dd>
          </div>
        </dl>
        <p className="tenue">
          Cada pieza de caja que se entrega regresa su costo más el premio. Cuando la deuda llega a cero, ese dinero
          se queda en Gatito para la siguiente compra.
        </p>
      </section>

      <Linea
        titulo="Deuda con el banco"
        descripcion="Sube con cada compra financiada y baja con cada pago."
        puntos={deudaEnElTiempo(libro)}
        color="var(--banco)"
        formato={corto}
        formatoDetalle={dinero}
        escalones
      />

      <section className="seccion" aria-labelledby="mov-titulo">
        <h2 id="mov-titulo">Movimientos</h2>
        {movimientos.length === 0 ? (
          <p className="tenue">Registra una compra pagada por el banco en Inventario para empezar.</p>
        ) : (
          <ul className="movimientos">
            {movimientos.map((m, i) => (
              <li key={`${m.fecha}-${i}`}>
                <div>
                  <strong>{m.concepto}</strong>
                  <span className="tenue">{fechaCorta(m.fecha)}</span>
                </div>
                <div className="movimiento-lado">
                  <span className={`num ${m.monto < 0 ? 'positivo' : ''}`}>
                    {m.monto < 0 ? `−${dinero(-m.monto)}` : `+${dinero(m.monto)}`}
                  </span>
                  <span className="tenue num">Saldo {dinero(m.saldo)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
