import { useMemo, useState } from 'react';
import { useApp } from '@/state/appData';
import {
  baseSimulacion,
  escenarioActual,
  simular,
  type Escenario,
  type Resultado,
} from '@/features/indicadores/simulador';
import { CampoNumero } from '@/shared/ui/Campo';
import { dinero, entero } from '@/shared/lib/format';

interface Fila {
  nombre: string;
  valor: (r: Resultado) => number | null;
  formato: (n: number) => string;
  mejor: 'subir' | 'bajar';
}

const semanas = (n: number) => `${entero(n)} sem.`;

const FILAS: Fila[] = [
  { nombre: 'Pedidos por semana', valor: (r) => r.pedidosSemana, formato: entero, mejor: 'subir' },
  { nombre: 'Ventas al mes', valor: (r) => r.ventasMes, formato: dinero, mejor: 'subir' },
  { nombre: 'Publicidad al mes', valor: (r) => r.publicidadMes, formato: dinero, mejor: 'bajar' },
  { nombre: 'Utilidad real al mes', valor: (r) => r.utilidadMes, formato: dinero, mejor: 'subir' },
  { nombre: 'Premio del banco al mes', valor: (r) => r.premioMes, formato: dinero, mejor: 'bajar' },
  { nombre: 'Tu sueldo al mes', valor: (r) => r.sueldoMes, formato: dinero, mejor: 'subir' },
  { nombre: 'Ahorro de Gatito al mes', valor: (r) => r.ahorroMes, formato: dinero, mejor: 'subir' },
  { nombre: 'Semanas para la meta', valor: (r) => r.semanasMeta, formato: semanas, mejor: 'bajar' },
];

export function Simulador() {
  const { datos, libro } = useApp();
  const base = useMemo(() => baseSimulacion(datos, libro), [datos, libro]);
  const [esc, setEsc] = useState<Escenario | null>(base ? escenarioActual(base) : null);

  if (!base || !esc) {
    return <p className="tenue">El simulador necesita al menos una semana completa de reportes.</p>;
  }

  const hoy = simular(base, escenarioActual(base));
  const nuevo = simular(base, esc);
  const atajos: Array<{ texto: string; aplicar: Partial<Escenario> }> = [
    { texto: 'Publicidad a $900 al día', aplicar: { publicidadDiaria: 900 } },
    { texto: 'Sueldo de $22,000', aplicar: { sueldoMensual: 22000 } },
    { texto: 'Entregar el 70%', aplicar: { entrega: 0.7 } },
  ];

  return (
    <div className="simulador">
      <section className="simulador-controles" aria-labelledby="sim-titulo">
        <h2 id="sim-titulo">¿Qué pasa si…?</h2>
        <p className="tenue">
          Parte de tus últimas {base.semanas} semanas completas: cada pedido entregado te cuesta{' '}
          {dinero(base.costoPorPedido)} en anuncios y te deja{' '}
          {dinero(base.efectivoPorPedido - base.reposicionPorPedido)} después de logística y producto.
        </p>
        <div className="botones">
          {atajos.map((a) => (
            <button
              key={a.texto}
              type="button"
              className="boton boton-secundario"
              onClick={() => setEsc({ ...esc, ...a.aplicar })}
            >
              {a.texto}
            </button>
          ))}
        </div>

        <div className="control-deslizador">
          <label htmlFor="sim-pub">
            Publicidad por día <strong className="num">{dinero(esc.publicidadDiaria)}</strong>
          </label>
          <input
            id="sim-pub"
            type="range"
            min={100}
            max={2000}
            step={10}
            value={esc.publicidadDiaria}
            onChange={(e) => setEsc({ ...esc, publicidadDiaria: Number(e.target.value) })}
          />
        </div>
        <div className="control-deslizador">
          <label htmlFor="sim-entrega">
            Pedidos que se entregan <strong className="num">{Math.round(esc.entrega * 100)}%</strong>
          </label>
          <input
            id="sim-entrega"
            type="range"
            min={30}
            max={95}
            step={1}
            value={Math.round(esc.entrega * 100)}
            onChange={(e) => setEsc({ ...esc, entrega: Number(e.target.value) / 100 })}
          />
        </div>
        <div className="rejilla-campos">
          <CampoNumero
            etiqueta="Tu sueldo al mes"
            prefijo="$"
            valor={esc.sueldoMensual}
            min={0}
            alCambiar={(v) => setEsc({ ...esc, sueldoMensual: v })}
          />
          <CampoNumero
            etiqueta="Gastos fijos al mes"
            prefijo="$"
            valor={esc.fijosMensual}
            min={0}
            alCambiar={(v) => setEsc({ ...esc, fijosMensual: v })}
          />
        </div>
        <button type="button" className="enlace" onClick={() => setEsc(escenarioActual(base))}>
          Volver a como estás hoy
        </button>
      </section>

      <section className="simulador-resultado" aria-labelledby="sim-res-titulo" aria-live="polite">
        <h2 id="sim-res-titulo">Resultado</h2>
        <div className="tabla-scroll">
          <table className="tabla">
            <thead>
              <tr>
                <th scope="col">Por mes</th>
                <th scope="col">Hoy</th>
                <th scope="col">Escenario</th>
                <th scope="col">Cambio</th>
              </tr>
            </thead>
            <tbody>
              {FILAS.map((f) => {
                const a = f.valor(hoy);
                const b = f.valor(nuevo);
                const dif = a !== null && b !== null ? b - a : null;
                const tono =
                  dif === null || Math.abs(dif) < 0.5 ? '' : dif > 0 === (f.mejor === 'subir') ? 'bien' : 'mal';
                return (
                  <tr key={f.nombre}>
                    <th scope="row">{f.nombre}</th>
                    <td className="num">{a === null ? 'Sin ahorro' : f.formato(a)}</td>
                    <td className="num">{b === null ? 'Sin ahorro' : f.formato(b)}</td>
                    <td className={`num ${tono}`}>
                      {dif === null || Math.abs(dif) < 0.5 ? '—' : `${dif > 0 ? '+' : '−'}${f.formato(Math.abs(dif))}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="tenue">
          Supone que cada peso extra en anuncios trae pedidos al mismo costo que hoy. En la práctica, al subir mucho el
          gasto el costo por pedido suele subir; prueba cambios graduales y compara con tus indicadores.
        </p>
      </section>
    </div>
  );
}
