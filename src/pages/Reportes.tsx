import { useState } from 'react';
import { useApp } from '../state/AppData';
import { useCargador } from '../components/Cargador';
import { Dialogo } from '../components/Dialogo';
import { CampoNumero } from '../components/Campo';
import { Billete } from '../components/Billete';
import { dinero, entero, porcentaje, rangoSemana } from '../lib/format';
import { ESTATUS, type Reporte, type SnapshotReporte } from '../lib/types';
import { Linea, corto } from '../components/Graficas';

const nombreEstatus: Record<string, string> = {
  OK: 'Entregados',
  REAGENDO: 'Reagendados',
  CANCELO: 'Cancelados',
  REPETIDO: 'Repetidos',
  'SIN STOCK': 'Sin stock',
  'SIN SERVICIO': 'Sin servicio',
  'FUERA DE COBERTURA': 'Fuera de cobertura',
};

export function Reportes() {
  const { datos, libro } = useApp();
  const { elegirArchivos, procesar } = useCargador();
  const [arrastrando, setArrastrando] = useState(false);
  const [abierto, setAbierto] = useState<Reporte | null>(null);

  return (
    <>
      <div className="pagina-cabeza">
        <h1>Reportes</h1>
        <button type="button" className="boton boton-principal" onClick={elegirArchivos}>
          Subir reportes
        </button>
      </div>

      <div
        className={`zona-soltar ${arrastrando ? 'activa' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setArrastrando(true);
        }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={(e) => {
          e.preventDefault();
          setArrastrando(false);
          void procesar([...e.dataTransfer.files]);
        }}
      >
        <p>Arrastra aquí los PDF del lunes y del jueves, o usa el botón.</p>
        <p className="tenue">Los nombres y direcciones de tus clientes no se guardan, solo los totales y las piezas.</p>
      </div>

      {libro.semanas.length > 0 && (
        <div className="graficas">
          <Linea
            titulo="Pedidos que sí se entregaron"
            descripcion="Entregados entre todos los intentos de la semana."
            puntos={[...libro.semanas].reverse().map((s) => ({
              etiqueta: rangoSemana(s.semana).split(' – ')[0],
              detalle: `Semana del ${rangoSemana(s.semana)}`,
              valor: s.efectividad * 100,
            }))}
            color="var(--ahorro)"
            formato={(n) => `${Math.round(n)}%`}
            formatoDetalle={(n) => `${Math.round(n)}%`}
          />
          <Linea
            titulo="Publicidad por pedido entregado"
            descripcion="Lo que te cuesta en anuncios cada pedido que sí se cobró."
            puntos={[...libro.semanas].reverse().map((s) => ({
              etiqueta: rangoSemana(s.semana).split(' – ')[0],
              detalle: `Semana del ${rangoSemana(s.semana)}`,
              valor: s.publicidadPorPedido,
            }))}
            color="var(--publicidad)"
            formato={corto}
            formatoDetalle={dinero}
          />
        </div>
      )}

      {libro.semanas.length === 0 ? (
        <p className="tenue centro">Todavía no hay reportes.</p>
      ) : (
        <ul className="semanas">
          {libro.semanas.map((s) => {
            const deSemana = datos.reportes
              .filter((r) => r.semana === s.semana)
              .sort((a, b) => (a.tipo === 'parcial' ? -1 : 1) - (b.tipo === 'parcial' ? -1 : 1));
            return (
              <li key={s.semana} className="semana">
                <div className="semana-cabeza">
                  <h2>{rangoSemana(s.semana)}</h2>
                  {!s.tieneCompleto && <span className="etiqueta">Falta el del lunes</span>}
                </div>
                <dl className="semana-datos">
                  <div>
                    <dt>Pedidos</dt>
                    <dd className="num">{entero(s.pedidos)}</dd>
                  </div>
                  <div>
                    <dt>Efectivo</dt>
                    <dd className="num">{dinero(s.efectivo)}</dd>
                  </div>
                  <div>
                    <dt>Se entregó</dt>
                    <dd className="num">{porcentaje(s.efectividad)}</dd>
                  </div>
                  <div>
                    <dt>Publicidad por pedido</dt>
                    <dd className="num">{dinero(s.publicidadPorPedido)}</dd>
                  </div>
                </dl>
                <div className="semana-cortes">
                  {deSemana.map((r) => (
                    <button key={r.id} type="button" className="corte" onClick={() => setAbierto(r)}>
                      <span>{r.tipo === 'parcial' ? 'Corte del jueves' : 'Semana completa'}</span>
                      <span className="num">{dinero(r.efectivo)}</span>
                    </button>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {abierto && <DetalleReporte reporte={abierto} alCerrar={() => setAbierto(null)} />}
    </>
  );
}

function DetalleReporte({ reporte, alCerrar }: { reporte: Reporte; alCerrar: () => void }) {
  const { datos, libro, actualizarReporte, borrarReporte } = useApp();
  const [snap, setSnap] = useState<SnapshotReporte>(reporte.snapshot);
  const cambiado = JSON.stringify(snap) !== JSON.stringify(reporte.snapshot);
  const pago =
    reporte.tipo === 'parcial'
      ? libro.pagos.find((p) => p.reporteId === reporte.id && p.tipo === 'jueves')
      : libro.pagos.find((p) => p.reporteId === reporte.id);
  const nombre = (id: string) => datos.productos.find((p) => p.id === id)?.nombre ?? id;

  return (
    <Dialogo
      abierto
      titulo={`${reporte.tipo === 'parcial' ? 'Corte del jueves' : 'Semana completa'}, ${rangoSemana(reporte.semana)}`}
      alCerrar={alCerrar}
      pie={
        <>
          <button
            type="button"
            className="boton boton-peligro"
            onClick={async () => {
              if (window.confirm('¿Borrar este reporte? Se recalculan los pagos y el inventario.')) {
                await borrarReporte(reporte.id);
                alCerrar();
              }
            }}
          >
            Borrar reporte
          </button>
          <button
            type="button"
            className="boton boton-principal"
            disabled={!cambiado}
            onClick={async () => {
              await actualizarReporte({ ...reporte, snapshot: snap });
              alCerrar();
            }}
          >
            Guardar cambios
          </button>
        </>
      }
    >
      <dl className="cifras">
        <div>
          <dt>Ventas entregadas</dt>
          <dd className="num">{dinero(reporte.ventas)}</dd>
        </div>
        <div>
          <dt>Logística</dt>
          <dd className="num">−{dinero(reporte.logistica)}</dd>
        </div>
        <div>
          <dt>Costo de producto</dt>
          <dd className="num">−{dinero(reporte.costoProducto)}</dd>
        </div>
        <div className="cifra-total">
          <dt>Efectivo</dt>
          <dd className="num">{dinero(reporte.efectivo)}</dd>
        </div>
      </dl>

      {pago && (
        <>
          <h3 className="subtitulo">
            Cómo se reparte {pago.tipo === 'lunes' ? 'el pago del lunes' : pago.tipo === 'jueves' ? 'el pago del jueves' : 'el pago'}
          </h3>
          <Billete pago={pago} productos={datos.productos} />
        </>
      )}

      <h3 className="subtitulo">Pedidos</h3>
      <ul className="lista-simple">
        {ESTATUS.filter((e) => reporte.estatus[e].pedidos > 0).map((e) => (
          <li key={e}>
            <span>{nombreEstatus[e]}</span>
            <span className="num">{entero(reporte.estatus[e].pedidos)}</span>
          </li>
        ))}
        {reporte.reemplazos > 0 && (
          <li>
            <span>Reemplazos sin cobro</span>
            <span className="num">{entero(reporte.reemplazos)}</span>
          </li>
        )}
      </ul>

      <h3 className="subtitulo">Piezas entregadas</h3>
      <ul className="lista-simple">
        {Object.entries(reporte.piezas).map(([id, n]) => (
          <li key={id}>
            <span>{nombre(id)}</span>
            <span className="num">{entero(n)}</span>
          </li>
        ))}
        {reporte.noReconocidos.map((n) => (
          <li key={n.texto} className="tenue">
            <span>Sin reconocer: {n.texto.toLowerCase()}</span>
            <span className="num">{entero(n.piezas)}</span>
          </li>
        ))}
      </ul>

      <h3 className="subtitulo">Valores de este periodo</h3>
      <p className="tenue">
        Se guardaron al subir el reporte. Si en esa semana gastabas otra cantidad en anuncios, corrígela aquí.
      </p>
      <div className="rejilla-campos">
        <CampoNumero
          etiqueta="Publicidad por día"
          prefijo="$"
          valor={snap.gastoDiarioPublicidad}
          alCambiar={(v) => setSnap({ ...snap, gastoDiarioPublicidad: v })}
        />
        <CampoNumero
          etiqueta="Tu sueldo al mes"
          prefijo="$"
          valor={snap.sueldoMensual}
          alCambiar={(v) => setSnap({ ...snap, sueldoMensual: v })}
        />
        <CampoNumero
          etiqueta="Gastos fijos al mes"
          prefijo="$"
          valor={snap.fijosMensual}
          alCambiar={(v) => setSnap({ ...snap, fijosMensual: v })}
        />
        <CampoNumero
          etiqueta="Premio del banco"
          sufijo="%"
          valor={Math.round(snap.premioBanco * 1000) / 10}
          alCambiar={(v) => setSnap({ ...snap, premioBanco: v / 100 })}
        />
      </div>
    </Dialogo>
  );
}
