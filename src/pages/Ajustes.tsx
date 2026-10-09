import { useRef, useState } from 'react';
import { useApp } from '../state/AppData';
import { CampoNumero, CampoTexto } from '../components/Campo';
import { dinero, hoyIso, nuevoId } from '../lib/format';
import { esRespaldoValido } from '../lib/db';
import type { Ajustes as TAjustes, Producto } from '../lib/types';
import { useTiendas } from '../state/Tiendas';
import { TIENDA_PRINCIPAL } from '../lib/db';

export function Ajustes() {
  const { datos, guardarAjustes, guardarProducto, importar, borrarTodo } = useApp();
  const [a, setA] = useState<TAjustes>(datos.ajustes);
  const [guardado, setGuardado] = useState(false);
  const archivo = useRef<HTMLInputElement>(null);
  const cambiado = JSON.stringify(a) !== JSON.stringify(datos.ajustes);
  const fijos = a.gastosFijos.reduce((s, g) => s + g.monto, 0);

  const guardar = async () => {
    await guardarAjustes(a);
    setGuardado(true);
    setTimeout(() => setGuardado(false), 2500);
  };

  const exportar = () => {
    const blob = new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = `gatito-respaldo-${hoyIso()}.json`;
    enlace.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="pagina-cabeza">
        <h1>Ajustes</h1>
      </div>

      <section className="seccion" aria-labelledby="dinero-titulo">
        <h2 id="dinero-titulo">Tu dinero</h2>
        <p className="tenue">Se usan para los reportes que subas de aquí en adelante.</p>
        <div className="rejilla-campos">
          <CampoNumero etiqueta="Tu sueldo al mes" prefijo="$" valor={a.sueldoMensual} min={0} alCambiar={(v) => setA({ ...a, sueldoMensual: v })} />
          <CampoNumero
            etiqueta="Premio del banco"
            sufijo="%"
            valor={Math.round(a.premioBanco * 1000) / 10}
            min={0}
            alCambiar={(v) => setA({ ...a, premioBanco: v / 100 })}
          />
          <CampoNumero
            etiqueta="Publicidad por día"
            prefijo="$"
            valor={a.gastoDiarioPublicidad}
            min={0}
            alCambiar={(v) => setA({ ...a, gastoDiarioPublicidad: v })}
            ayuda="Lo que gastas en promedio al día en Facebook."
          />
          <CampoNumero
            etiqueta="Cada cobro de Facebook"
            prefijo="$"
            valor={a.cobroFacebook}
            min={0}
            alCambiar={(v) => setA({ ...a, cobroFacebook: v })}
          />
          <CampoNumero
            etiqueta="Colchón para la tarjeta"
            prefijo="$"
            valor={a.colchonPublicidad}
            min={0}
            alCambiar={(v) => setA({ ...a, colchonPublicidad: v })}
            ayuda="Se suma a la meta de la reserva."
          />
          <CampoNumero
            etiqueta="Guía por caja"
            prefijo="$"
            valor={a.guiaCompra}
            min={0}
            alCambiar={(v) => setA({ ...a, guiaCompra: v })}
            ayuda="Lo que cobra la paquetería por cada caja que te mandan."
          />
          <CampoNumero
            etiqueta="Colchón al pedir inventario"
            sufijo="días"
            valor={a.diasColchon}
            min={0}
            alCambiar={(v) => setA({ ...a, diasColchon: v })}
            ayuda="Días extra además de lo que tarda tu proveedor."
          />
          <CampoTexto
            etiqueta="Nombre de la tienda en el reporte"
            value={a.nombreEnReporte}
            alCambiar={(v) => setA({ ...a, nombreEnReporte: v.toUpperCase().replace(/\s+/g, '') })}
          />
        </div>

        <h3 className="subtitulo">Gastos fijos ({dinero(fijos)} al mes)</h3>
        <ul className="fijos">
          {a.gastosFijos.map((g, i) => (
            <li key={g.id}>
              <CampoTexto
                etiqueta="Concepto"
                value={g.nombre}
                alCambiar={(v) => {
                  const lista = [...a.gastosFijos];
                  lista[i] = { ...g, nombre: v };
                  setA({ ...a, gastosFijos: lista });
                }}
              />
              <CampoNumero
                etiqueta="Al mes"
                prefijo="$"
                valor={g.monto}
                min={0}
                alCambiar={(v) => {
                  const lista = [...a.gastosFijos];
                  lista[i] = { ...g, monto: v };
                  setA({ ...a, gastosFijos: lista });
                }}
              />
              <button
                type="button"
                className="boton-icono"
                aria-label={`Quitar ${g.nombre}`}
                onClick={() => setA({ ...a, gastosFijos: a.gastosFijos.filter((x) => x.id !== g.id) })}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="boton boton-secundario"
          onClick={() => setA({ ...a, gastosFijos: [...a.gastosFijos, { id: nuevoId(), nombre: '', monto: 0 }] })}
        >
          Agregar gasto fijo
        </button>

        <h3 className="subtitulo">Arranque</h3>
        <p className="tenue">
          El día que empiezas a llevar las cuentas. Los reportes de antes se ven en el historial, pero no mueven
          inventario, banco ni sobres. Captura cómo estabas ese día; las piezas de cada producto van en Productos.
        </p>
        <div className="rejilla-campos">
          <div className="campo">
            <label htmlFor="inv-desde">Llevar las cuentas desde</label>
            <div className="campo-caja">
              <input id="inv-desde" type="date" value={a.inventarioDesde} onChange={(e) => setA({ ...a, inventarioDesde: e.target.value })} />
            </div>
          </div>
          <CampoNumero
            etiqueta="Reserva de Gatito ese día"
            prefijo="$"
            valor={a.saldoInicialReserva}
            alCambiar={(v) => setA({ ...a, saldoInicialReserva: v })}
          />
          <CampoNumero
            etiqueta="Sobre de publicidad ese día"
            prefijo="$"
            valor={a.saldoInicialPublicidad}
            alCambiar={(v) => setA({ ...a, saldoInicialPublicidad: v })}
          />
          <CampoNumero
            etiqueta="Deuda con el banco ese día"
            prefijo="$"
            valor={a.deudaInicialBanco}
            min={0}
            alCambiar={(v) => setA({ ...a, deudaInicialBanco: v })}
            ayuda="Con el premio ya incluido."
          />
        </div>

        <div className="barra-guardar">
          <button type="button" className="boton boton-principal" disabled={!cambiado} onClick={guardar}>
            Guardar ajustes
          </button>
          <span role="status" className="tenue">
            {guardado ? 'Ajustes guardados.' : ''}
          </span>
        </div>
      </section>

      <section className="seccion" aria-labelledby="productos-titulo">
        <h2 id="productos-titulo">Productos</h2>
        <p className="tenue">El orden importa: el foco va antes que el soporte bocina porque los dos dicen “bocina”.</p>
        <div className="productos">
          {datos.productos.map((p) => (
            <EditorProducto key={p.id} producto={p} alGuardar={guardarProducto} />
          ))}
        </div>
        <button
          type="button"
          className="boton boton-secundario"
          onClick={() =>
            guardarProducto({
              id: nuevoId(),
              nombre: 'Producto nuevo',
              patrones: [],
              costoUnitario: 0,
              porCaja: false,
              piezasPorCaja: 0,
              precioCaja: 0,
              stockInicial: 0,
              puntoReorden: 0,
              diasEntrega: 7,
              activo: true,
            })
          }
        >
          Agregar producto
        </button>
      </section>

      <SeccionTiendas />

      <section className="seccion" aria-labelledby="respaldo-titulo">
        <h2 id="respaldo-titulo">Respaldo</h2>
        <p className="tenue">Todo vive en este navegador. Descarga un respaldo de vez en cuando para no perderlo.</p>
        <div className="botones">
          <button type="button" className="boton boton-secundario" onClick={exportar}>
            Descargar respaldo
          </button>
          <button type="button" className="boton boton-secundario" onClick={() => archivo.current?.click()}>
            Restaurar respaldo
          </button>
          <button
            type="button"
            className="boton boton-peligro"
            onClick={async () => {
              if (window.confirm('¿Borrar todos los reportes, compras y ajustes de este dispositivo?')) await borrarTodo();
            }}
          >
            Borrar todo
          </button>
        </div>
        <input
          ref={archivo}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            try {
              const d: unknown = JSON.parse(await f.text());
              if (!esRespaldoValido(d)) throw new Error();
              if (window.confirm('Esto reemplaza todo lo que hay en este dispositivo. ¿Continuar?')) {
                await importar(d);
                setA(d.ajustes);
              }
            } catch {
              window.alert('Ese archivo no es un respaldo de Gatito Finanzas.');
            }
          }}
        />
      </section>
    </>
  );
}

function EditorProducto({ producto, alGuardar }: { producto: Producto; alGuardar: (p: Producto) => Promise<void> }) {
  const [p, setP] = useState(producto);
  const cambiado = JSON.stringify(p) !== JSON.stringify(producto);
  return (
    <details className="producto">
      <summary>
        <span>{producto.nombre}</span>
        <span className="tenue">{producto.porCaja ? 'Por caja' : 'Lo cobra el proveedor al vender'}</span>
      </summary>
      <div className="rejilla-campos">
        <CampoTexto etiqueta="Nombre" value={p.nombre} alCambiar={(v) => setP({ ...p, nombre: v })} />
        <CampoNumero
          etiqueta="Costo por pieza"
          prefijo="$"
          valor={p.costoUnitario}
          min={0}
          alCambiar={(v) => setP({ ...p, costoUnitario: v })}
          ayuda={p.porCaja ? 'Incluye la parte de la guía.' : undefined}
        />
        {p.porCaja && (
          <>
            <CampoNumero etiqueta="Piezas por caja" valor={p.piezasPorCaja} min={0} alCambiar={(v) => setP({ ...p, piezasPorCaja: v })} />
            <CampoNumero etiqueta="Precio de la caja" prefijo="$" valor={p.precioCaja} min={0} alCambiar={(v) => setP({ ...p, precioCaja: v })} />
            <CampoNumero
              etiqueta="Tu proveedor tarda"
              sufijo="días"
              valor={p.diasEntrega}
              min={0}
              alCambiar={(v) => setP({ ...p, diasEntrega: v })}
              ayuda="Desde que pides hasta que tienes la caja."
            />
            <CampoNumero
              etiqueta="Mínimo para avisarme"
              sufijo="piezas"
              valor={p.puntoReorden}
              min={0}
              alCambiar={(v) => setP({ ...p, puntoReorden: v })}
            />
            <CampoNumero
              etiqueta="Inventario inicial"
              sufijo="piezas"
              valor={p.stockInicial}
              min={0}
              alCambiar={(v) => setP({ ...p, stockInicial: v })}
            />
          </>
        )}
      </div>
      <CampoTexto
        etiqueta="Cómo aparece en el reporte"
        value={p.patrones.join(', ')}
        alCambiar={(v) => setP({ ...p, patrones: v.split(',').map((x) => x.trim()).filter(Boolean) })}
      />
      <label className="casilla">
        <input type="checkbox" checked={p.porCaja} onChange={(e) => setP({ ...p, porCaja: e.target.checked })} />
        Lo compro por caja
      </label>
      <label className="casilla">
        <input type="checkbox" checked={p.activo} onChange={(e) => setP({ ...p, activo: e.target.checked })} />
        Lo sigo vendiendo
      </label>
      <button type="button" className="boton boton-principal" disabled={!cambiado} onClick={() => alGuardar(p)}>
        Guardar producto
      </button>
    </details>
  );
}

function SeccionTiendas() {
  const { tiendas, activa, cambiar, crear, renombrar, eliminar } = useTiendas();
  const [nombre, setNombre] = useState('');
  const [enReporte, setEnReporte] = useState('');
  return (
    <section className="seccion" aria-labelledby="tiendas-titulo">
      <h2 id="tiendas-titulo">Tiendas</h2>
      <p className="tenue">
        Cada tienda lleva por separado sus reportes, productos, inventario, banco y sobres. Cambia de tienda desde el menú.
      </p>
      <ul className="tiendas">
        {tiendas.map((t) => (
          <li key={t.id}>
            <CampoTexto etiqueta={t.id === activa.id ? 'Tienda actual' : 'Tienda'} value={t.nombre} alCambiar={(v) => renombrar(t.id, v)} />
            <div className="botones">
              {t.id !== activa.id && (
                <button type="button" className="boton boton-secundario" onClick={() => cambiar(t.id)}>
                  Abrir
                </button>
              )}
              {t.id !== TIENDA_PRINCIPAL.id && (
                <button
                  type="button"
                  className="boton boton-peligro"
                  onClick={async () => {
                    if (window.confirm(`¿Borrar la tienda ${t.nombre} y todos sus datos?`)) await eliminar(t.id);
                  }}
                >
                  Borrar
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      <h3 className="subtitulo">Agregar tienda</h3>
      <div className="rejilla-campos">
        <CampoTexto etiqueta="Nombre" value={nombre} alCambiar={setNombre} placeholder="Renta la Luna" />
        <CampoTexto
          etiqueta="Cómo aparece en su reporte"
          value={enReporte}
          alCambiar={(v) => setEnReporte(v.toUpperCase().replace(/\s+/g, ''))}
          placeholder="RENTALALUNA"
        />
      </div>
      <button
        type="button"
        className="boton boton-principal"
        disabled={!nombre.trim()}
        onClick={async () => {
          await crear(nombre, enReporte);
          setNombre('');
          setEnReporte('');
        }}
      >
        Crear y abrir tienda
      </button>
    </section>
  );
}
