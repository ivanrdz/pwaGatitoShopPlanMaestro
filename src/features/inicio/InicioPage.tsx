import { useEffect, useState } from 'react';
import { useApp } from '@/state/appData';
import { useCargador } from '@/features/reportes/cargador';
import { Billete } from '@/features/inicio/Billete';
import { Dialogo } from '@/shared/ui/Dialogo';
import { CampoNumero } from '@/shared/ui/Campo';
import { dinero, entero, fechaCorta, hoyIso, corto, piezasCorto } from '@/shared/lib/format';
import { useIr, type Ruta } from '@/app/rutas';
import { BarrasApiladas, Linea } from '@/shared/ui/Graficas';
import { SOBRES, repartoPorSemana, reservaEnElTiempo } from '@/domain/series';

const colorSobre = (c: string) => `var(--${c})`;

const nombrePago = { jueves: 'Pago del jueves', lunes: 'Pago del lunes', semana: 'Pago de la semana' } as const;

export function InicioPage() {
  const ir = useIr();
  const { datos, libro, agregarCobro } = useApp();
  const { elegirArchivos } = useCargador();
  const { pagos } = libro;
  const [indice, setIndice] = useState(pagos.length - 1);
  const [cobro, setCobro] = useState<number | null>(null);

  // Al subir reportes nuevos, muestra el pago más reciente.
  useEffect(() => setIndice(pagos.length - 1), [pagos.length]);

  if (pagos.length === 0) {
    return (
      <section className="vacio">
        <h1>Sube tu primer reporte</h1>
        <p>
          Elige el PDF del corte del lunes o del jueves. Te digo cuánto regresar al banco, cuánto apartar para
          publicidad, tu sueldo y cuánto guardar.
        </p>
        <button type="button" className="boton boton-principal boton-grande" onClick={elegirArchivos}>
          Subir reporte
        </button>
        <p className="tenue">Puedes elegir varios PDF a la vez para cargar tu historial.</p>
        {libro.inventario.every((e) => !e.capturado) && (
          <p className="tenue">
            Antes de empezar, captura cuántas piezas tienes hoy en{' '}
            <button type="button" className="enlace" onClick={() => ir('ajustes')}>
              Ajustes
            </button>
            .
          </p>
        )}
      </section>
    );
  }

  const pago = pagos[Math.min(Math.max(indice, 0), pagos.length - 1)];
  const progreso = libro.meta > 0 ? Math.min(1, Math.max(0, libro.reserva / libro.meta)) : 0;

  const semanas = repartoPorSemana(pagos);
  const reservaPuntos = reservaEnElTiempo(datos, libro);

  return (
    <div className="inicio">
      <section className="pago" aria-labelledby="pago-titulo">
        <div className="pago-nav">
          <button
            type="button"
            className="boton-icono"
            onClick={() => setIndice(indice - 1)}
            disabled={indice <= 0}
            aria-label="Pago anterior"
          >
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <p id="pago-titulo" className="pago-nombre">
            {nombrePago[pago.tipo]} <span className="tenue">{fechaCorta(pago.fecha)}</span>
          </p>
          <button
            type="button"
            className="boton-icono"
            onClick={() => setIndice(indice + 1)}
            disabled={indice >= pagos.length - 1}
            aria-label="Pago siguiente"
          >
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <p className="pago-monto num">{dinero(pago.efectivo)}</p>
        <p className="pago-sub tenue">{entero(pago.pedidos)} pedidos entregados</p>
        {pago.previo && (
          <p className="aviso aviso-chico pago-previo">
            Es de antes de tu fecha de arranque: te muestra el reparto, pero no mueve tus saldos.
          </p>
        )}
        <Billete pago={pago} productos={datos.productos} />
      </section>

      <div className="inicio-lado">
        <section className="seccion" aria-labelledby="estado-titulo">
          <h2 id="estado-titulo">Cómo va Gatito</h2>
          <div className="tablero">
            <article className="tile">
              <h3>Deuda con el banco</h3>
              <p className="tile-monto num">{dinero(libro.deudaBanco)}</p>
              <p className="tenue">Ya incluye el premio del {Math.round(datos.ajustes.premioBanco * 100)}%.</p>
              <button type="button" className="enlace" onClick={() => ir('banco')}>
                Ver movimientos
              </button>
            </article>
            <article className="tile">
              <h3>Sobre de publicidad</h3>
              <p className={`tile-monto num ${libro.sobrePublicidad < 0 ? 'negativo' : ''}`}>
                {dinero(libro.sobrePublicidad)}
              </p>
              <p className="tenue">Apartado menos lo que Facebook ya te cobró.</p>
              <button
                type="button"
                className="boton boton-secundario"
                onClick={() => setCobro(datos.ajustes.cobroFacebook)}
              >
                Registrar cobro
              </button>
            </article>
            <article className="tile tile-meta">
              <h3>Reserva de Gatito</h3>
              <p className="tile-monto num">{dinero(libro.reserva)}</p>
              <div
                className="meta-barra"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progreso * 100)}
                aria-label="Avance hacia la meta"
              >
                <span style={{ width: `${progreso * 100}%` }} />
              </div>
              <p className="tenue">
                {progreso >= 1
                  ? 'Gatito ya puede comprar sus cajas sin el banco.'
                  : `Meta: ${dinero(libro.meta)} para comprar las cajas sin pedir prestado.`}
              </p>
            </article>
          </div>
        </section>

        <section className="seccion" aria-labelledby="tendencias-titulo">
          <h2 id="tendencias-titulo">Tendencias</h2>
          <div className="graficas">
            <BarrasApiladas
              titulo="A dónde se fue el dinero"
              descripcion="Cada semana, el pago del jueves y el del lunes juntos."
              columnas={semanas}
              series={SOBRES.map((s) => ({ clave: s.clave, nombre: s.nombre, color: colorSobre(s.clave) }))}
              total={{ clave: 'efectivo', nombre: 'Efectivo recibido' }}
              formato={corto}
              formatoDetalle={dinero}
            />
            <Linea
              titulo="Reserva de Gatito"
              descripcion="Cómo crece pago a pago desde tu fecha de arranque."
              puntos={reservaPuntos}
              color="var(--ahorro)"
              referencia={{ valor: libro.meta, etiqueta: `Meta ${corto(libro.meta)}` }}
              formato={corto}
              formatoDetalle={dinero}
            />
            <BarrasApiladas
              titulo="Pedidos entregados"
              descripcion="Tus ventas siguen a lo que inviertes en anuncios."
              columnas={semanas}
              series={[{ clave: 'pedidos', nombre: 'Pedidos', color: 'var(--tinta-2)' }]}
              formato={piezasCorto}
              formatoDetalle={entero}
            />
          </div>
        </section>

        {libro.alertas.length > 0 && (
          <section className="seccion" aria-labelledby="alertas-titulo">
            <h2 id="alertas-titulo">Pendientes</h2>
            <ul className="alertas">
              {libro.alertas.map((a) => (
                <li key={a.id} className={`alerta alerta-${a.tono}`}>
                  <span>{a.texto}</span>
                  {a.ir && (
                    <button type="button" className="enlace" onClick={() => ir(a.ir as Ruta)}>
                      Revisar
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="seccion" aria-labelledby="inv-titulo">
          <div className="seccion-cabeza">
            <h2 id="inv-titulo">Inventario</h2>
            <button type="button" className="enlace" onClick={() => ir('inventario')}>
              Registrar compra
            </button>
          </div>
          <ul className="inventario-lista">
            {libro.inventario.map((e) => (
              <li key={e.producto.id} className={e.bajo ? 'bajo' : ''}>
                <span>{e.producto.nombre}</span>
                {e.capturado ? (
                  <>
                    <span className="num">{entero(Math.max(0, e.stock))} piezas</span>
                    <span className="tenue">
                      {e.diasRestantes === null ? 'sin ventas recientes' : `≈ ${e.diasRestantes} días`}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="tenue">Sin capturar</span>
                    <span />
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <Dialogo
        abierto={cobro !== null}
        titulo="Cobro de Facebook"
        alCerrar={() => setCobro(null)}
        pie={
          <>
            <button type="button" className="boton boton-secundario" onClick={() => setCobro(null)}>
              Cancelar
            </button>
            <button
              type="button"
              className="boton boton-principal"
              disabled={!cobro}
              onClick={async () => {
                await agregarCobro({ fecha: hoyIso(), monto: cobro ?? 0 });
                setCobro(null);
              }}
            >
              Registrar cobro
            </button>
          </>
        }
      >
        <p className="tenue">Lo que te cargó Facebook a la tarjeta. Se descuenta del sobre de publicidad.</p>
        <CampoNumero etiqueta="Monto cobrado" prefijo="$" valor={cobro ?? 0} alCambiar={setCobro} min={0} />
      </Dialogo>
    </div>
  );
}
