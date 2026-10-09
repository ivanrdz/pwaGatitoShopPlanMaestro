import { useMemo, useState } from 'react';
import { useApp } from '@/state/appData';
import { Dialogo } from '@/shared/ui/Dialogo';
import { CampoNumero, CampoTexto } from '@/shared/ui/Campo';
import { dinero, entero, fechaCorta, hoyIso, rangoSemana, piezasCorto } from '@/shared/lib/format';
import { useIr } from '@/app/rutas';
import { BarrasApiladas } from '@/shared/ui/Graficas';
import { piezasPorSemana, reemplazosPorProducto } from '@/domain/series';
import { useTiendas } from '@/state/tiendas';

const COLORES_PRODUCTO = ['var(--prod-1)', 'var(--prod-2)', 'var(--prod-3)', 'var(--prod-4)', 'var(--prod-5)'];

export function InventarioPage() {
  const ir = useIr();
  const { datos, libro, borrarCompra } = useApp();
  const [nueva, setNueva] = useState(false);
  const compras = [...datos.compras].sort((a, b) => b.fecha.localeCompare(a.fecha));
  const nombre = (id: string) => datos.productos.find((p) => p.id === id)?.nombre ?? id;

  return (
    <>
      <div className="pagina-cabeza">
        <h1>Inventario</h1>
        <button type="button" className="boton boton-principal" onClick={() => setNueva(true)}>
          Registrar compra
        </button>
      </div>

      <ul className="stock">
        {libro.inventario.map((e) => (
          <li key={e.producto.id} className={`stock-item ${e.bajo ? 'bajo' : ''}`}>
            <h2>{e.producto.nombre}</h2>
            <p className="stock-numero num">{e.capturado ? entero(Math.max(0, e.stock)) : '—'}</p>
            <p className="tenue">
              {!e.capturado
                ? 'Captura cuántas piezas tienes en Ajustes o registra una compra.'
                : e.promedioSemanal > 0
                  ? `Vendes unas ${entero(e.promedioSemanal)} por semana. Te alcanza para ${e.diasRestantes} días.`
                  : 'Sin ventas recientes para estimar.'}
            </p>
            {e.capturado && e.diasParaPedir !== null && (
              <p className={e.bajo ? 'aviso aviso-chico' : 'stock-pedir'}>
                {e.bajo
                  ? `Pide hoy. Tu proveedor tarda ${e.producto.diasEntrega} días.`
                  : `Pide antes del ${fechaCorta(e.pedirAntesDe!)}, al quedar ${entero(e.puntoPedido)} piezas.`}
              </p>
            )}
          </li>
        ))}
      </ul>
      <p className="tenue">
        El stock parte de tu inventario inicial y suma compras, menos lo entregado en los reportes.{' '}
        <button type="button" className="enlace" onClick={() => ir('ajustes')}>
          Cambiar inventario inicial
        </button>
      </p>

      <BarrasApiladas
        titulo="Piezas vendidas por semana"
        descripcion="Úsala para calcular cuándo pedir la siguiente caja."
        columnas={piezasPorSemana(
          libro.pagos,
          libro.inventario.map((e) => e.producto.id),
        )}
        series={libro.inventario.map((e, i) => ({
          clave: e.producto.id,
          nombre: e.producto.nombre,
          color: COLORES_PRODUCTO[i % COLORES_PRODUCTO.length],
        }))}
        formato={piezasCorto}
        formatoDetalle={(n) => `${entero(n)} piezas`}
      />

      <section className="seccion" aria-labelledby="compras-titulo">
        <h2 id="compras-titulo">Compras</h2>
        {compras.length === 0 ? (
          <p className="tenue">Cuando compres cajas, regístralas aquí para llevar el stock y la deuda con el banco.</p>
        ) : (
          <ul className="movimientos">
            {compras.map((c) => {
              const total = c.items.reduce((s, i) => s + i.costo, 0) + c.guia;
              return (
                <li key={c.id}>
                  <div>
                    <strong>{fechaCorta(c.fecha)}</strong>
                    <span className="tenue">
                      {c.items.map((i) => `${entero(i.piezas)} ${nombre(i.productoId).toLowerCase()}`).join(', ')}
                    </span>
                    <span className="tenue">
                      {c.financiadoPor === 'banco'
                        ? `La pagó el banco. Le devuelves ${dinero(total * (1 + c.premio))}.`
                        : 'La pagó la reserva de Gatito.'}
                    </span>
                  </div>
                  <div className="movimiento-lado">
                    <span className="num">{dinero(total)}</span>
                    <button
                      type="button"
                      className="enlace enlace-peligro"
                      onClick={() => {
                        if (window.confirm('¿Borrar esta compra?')) void borrarCompra(c.id);
                      }}
                    >
                      Borrar
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Reemplazos />

      {nueva && <NuevaCompra alCerrar={() => setNueva(false)} />}
    </>
  );
}

function NuevaCompra({ alCerrar }: { alCerrar: () => void }) {
  const { datos, libro, agregarCompra, guardarProducto } = useApp();
  const deCaja = datos.productos.filter((p) => p.activo && p.porCaja);
  const [fecha, setFecha] = useState(hoyIso());
  const [quien, setQuien] = useState<'banco' | 'gatito'>(libro.reserva >= libro.meta ? 'gatito' : 'banco');
  const [cajas, setCajas] = useState<Record<string, number>>({});
  const [piezas, setPiezas] = useState<Record<string, number>>({});
  const [costos, setCostos] = useState<Record<string, number>>({});
  /** null = se calcula sola: guía por caja × cajas. */
  const [guiaManual, setGuiaManual] = useState<number | null>(null);
  const [nota, setNota] = useState('');
  const [actualizarCosto, setActualizarCosto] = useState(true);

  const items = useMemo(
    () =>
      deCaja
        .map((p) => ({
          productoId: p.id,
          piezas: piezas[p.id] ?? (cajas[p.id] ?? 0) * p.piezasPorCaja,
          costo: costos[p.id] ?? (cajas[p.id] ?? 0) * p.precioCaja,
        }))
        .filter((i) => i.piezas > 0),
    [deCaja, cajas, piezas, costos],
  );
  const subtotal = items.reduce((s, i) => s + i.costo, 0);
  /** Cajas por producto; si solo capturaste piezas, se estima con las piezas por caja. */
  const cajasDe = (id: string, piezasItem: number) => {
    const p = deCaja.find((x) => x.id === id);
    return cajas[id] || (p && p.piezasPorCaja ? piezasItem / p.piezasPorCaja : 0);
  };
  const totalCajas = items.reduce((s, i) => s + cajasDe(i.productoId, i.piezas), 0);
  const guia = guiaManual ?? Math.round(datos.ajustes.guiaCompra * Math.ceil(totalCajas));
  const total = subtotal + (items.length ? guia : 0);
  const premio = datos.ajustes.premioBanco;

  const guardar = async () => {
    await agregarCompra({ fecha, financiadoPor: quien, items, guia, nota: nota || undefined });
    if (actualizarCosto && totalCajas > 0) {
      for (const i of items) {
        const p = datos.productos.find((x) => x.id === i.productoId);
        if (!p) continue;
        // La guía se cobra por caja: a cada producto le toca según sus cajas, no según sus piezas.
        const guiaProducto = (guia * cajasDe(i.productoId, i.piezas)) / totalCajas;
        const costoUnitario = Math.round(((i.costo + guiaProducto) / i.piezas) * 100) / 100;
        if (costoUnitario !== p.costoUnitario) await guardarProducto({ ...p, costoUnitario });
      }
    }
    alCerrar();
  };

  return (
    <Dialogo
      abierto
      titulo="Registrar compra"
      alCerrar={alCerrar}
      pie={
        <>
          <button type="button" className="boton boton-secundario" onClick={alCerrar}>
            Cancelar
          </button>
          <button type="button" className="boton boton-principal" disabled={items.length === 0} onClick={guardar}>
            Guardar compra
          </button>
        </>
      }
    >
      <div className="campo">
        <label htmlFor="fecha-compra">Fecha</label>
        <div className="campo-caja">
          <input id="fecha-compra" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
      </div>

      <fieldset className="opciones">
        <legend>¿Quién pone el dinero?</legend>
        <label className={quien === 'banco' ? 'activa' : ''}>
          <input type="radio" name="quien" checked={quien === 'banco'} onChange={() => setQuien('banco')} />
          El banco
        </label>
        <label className={quien === 'gatito' ? 'activa' : ''}>
          <input type="radio" name="quien" checked={quien === 'gatito'} onChange={() => setQuien('gatito')} />
          La reserva de Gatito ({dinero(libro.reserva)})
        </label>
      </fieldset>

      {deCaja.map((p) => (
        <div key={p.id} className="compra-producto">
          <h3>{p.nombre}</h3>
          <div className="rejilla-campos">
            <CampoNumero
              etiqueta="Cajas"
              valor={cajas[p.id] ?? 0}
              min={0}
              alCambiar={(v) => {
                setCajas({ ...cajas, [p.id]: v });
                const { [p.id]: _a, ...restoP } = piezas;
                const { [p.id]: _b, ...restoC } = costos;
                void _a;
                void _b;
                setPiezas(restoP);
                setCostos(restoC);
              }}
            />
            <CampoNumero
              etiqueta="Piezas"
              valor={piezas[p.id] ?? (cajas[p.id] ?? 0) * p.piezasPorCaja}
              min={0}
              alCambiar={(v) => setPiezas({ ...piezas, [p.id]: v })}
            />
            <CampoNumero
              etiqueta="Costo"
              prefijo="$"
              valor={costos[p.id] ?? (cajas[p.id] ?? 0) * p.precioCaja}
              min={0}
              alCambiar={(v) => setCostos({ ...costos, [p.id]: v })}
            />
          </div>
        </div>
      ))}

      <div className="rejilla-campos">
        <CampoNumero
          etiqueta="Guía de paquetería"
          prefijo="$"
          valor={guia}
          min={0}
          alCambiar={setGuiaManual}
          ayuda={
            guiaManual === null
              ? `${dinero(datos.ajustes.guiaCompra)} por caja × ${Math.ceil(totalCajas)} cajas`
              : undefined
          }
        />
        <CampoTexto etiqueta="Nota" value={nota} alCambiar={setNota} placeholder="Opcional" />
      </div>

      <label className="casilla">
        <input type="checkbox" checked={actualizarCosto} onChange={(e) => setActualizarCosto(e.target.checked)} />
        Actualizar el costo por pieza con esta compra
      </label>

      {items.length > 0 && (
        <div className="resumen-compra">
          <p>
            Total de la compra: <strong className="num">{dinero(total)}</strong>
          </p>
          {quien === 'banco' ? (
            <p>
              El banco presta {dinero(total)} y le regresarás {dinero(total * (1 + premio))} conforme se venda cada
              pieza.
            </p>
          ) : (
            <p>Sale de la reserva de Gatito; no generas deuda.</p>
          )}
        </div>
      )}
    </Dialogo>
  );
}

function Reemplazos() {
  const { datos } = useApp();
  const { activa } = useTiendas();
  const r = reemplazosPorProducto(datos);
  const [copiado, setCopiado] = useState(false);
  const conReemplazos = r.productos.filter((p) => p.reemplazadas > 0);
  if (!r.desde) return null;

  const resumen = [
    `Reemplazos de ${activa.nombre}, semanas del ${rangoSemana(r.desde)} al ${rangoSemana(r.hasta!)}:`,
    ...conReemplazos.map(
      (p) =>
        `- ${p.nombre}: ${entero(p.reemplazadas)} piezas reemplazadas de ${entero(p.vendidas)} vendidas (${(p.porcentaje * 100).toFixed(1)}%). Costo en piezas: ${dinero(p.costoPiezas)}.`,
    ),
    `Además pagamos ${entero(r.envios)} envíos de reemplazo, unos ${dinero(r.costoEnvios)}.`,
  ].join('\n');

  return (
    <section className="seccion" aria-labelledby="reemplazos-titulo">
      <div className="seccion-cabeza">
        <h2 id="reemplazos-titulo">Reemplazos por producto</h2>
        {conReemplazos.length > 0 && (
          <button
            type="button"
            className="enlace"
            onClick={async () => {
              await navigator.clipboard?.writeText(resumen);
              setCopiado(true);
              setTimeout(() => setCopiado(false), 2500);
            }}
          >
            {copiado ? 'Resumen copiado' : 'Copiar resumen para el proveedor'}
          </button>
        )}
      </div>
      <p className="tenue">Piezas enviadas sin cobro porque llegaron dañadas o equivocadas.</p>
      {r.sinDetalle > 0 && (
        <p className="aviso aviso-chico">
          {r.sinDetalle} semana{r.sinDetalle === 1 ? '' : 's'} se subieron antes de esta función. Vuelve a subir esos
          PDF para contar sus reemplazos por producto.
        </p>
      )}
      <div className="tabla-scroll">
        <table className="tabla">
          <thead>
            <tr>
              <th scope="col">Producto</th>
              <th scope="col">Vendidas</th>
              <th scope="col">Reemplazadas</th>
              <th scope="col">% reemplazo</th>
              <th scope="col">Costo piezas</th>
            </tr>
          </thead>
          <tbody>
            {r.productos.map((p) => (
              <tr key={p.productoId} className={p.porcentaje >= 0.05 ? 'fila-alerta' : ''}>
                <th scope="row">{p.nombre}</th>
                <td className="num">{entero(p.vendidas)}</td>
                <td className="num">{entero(p.reemplazadas)}</td>
                <td className="num">{(p.porcentaje * 100).toFixed(1)}%</td>
                <td className="num">{dinero(p.costoPiezas)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" colSpan={4}>
                Envíos de reemplazo ({entero(r.envios)})
              </th>
              <td className="num">{dinero(r.costoEnvios)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
