import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Dialogo } from './Dialogo';
import { useApp, idReporte } from '../state/AppData';
import { parseReportText } from '../lib/parseReport';
import type { ReporteParseado } from '../lib/types';
import { dinero, entero, rangoSemana } from '../lib/format';

interface Leido {
  nombreArchivo: string;
  parseado?: ReporteParseado;
  error?: string;
}

interface Ctx {
  elegirArchivos: () => void;
  procesar: (archivos: File[]) => Promise<void>;
}

const CargadorCtx = createContext<Ctx | null>(null);

export function useCargador() {
  const c = useContext(CargadorCtx);
  if (!c) throw new Error('useCargador debe usarse dentro de CargadorProvider');
  return c;
}

export function CargadorProvider({ children, alGuardar }: { children: ReactNode; alGuardar: () => void }) {
  const { datos, agregarReportes } = useApp();
  const input = useRef<HTMLInputElement>(null);
  const [leyendo, setLeyendo] = useState(false);
  const [leidos, setLeidos] = useState<Leido[] | null>(null);
  const [guardando, setGuardando] = useState(false);

  const procesar = useCallback(
    async (archivos: File[]) => {
      const pdfs = archivos.filter((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
      if (pdfs.length === 0) {
        setLeidos([{ nombreArchivo: archivos[0]?.name ?? 'archivo', error: 'Solo puedo leer reportes en PDF.' }]);
        return;
      }
      setLeyendo(true);
      setLeidos([]);
      const { textoDePdf } = await import('../lib/pdfText');
      const resultado: Leido[] = [];
      for (const archivo of pdfs) {
        try {
          const texto = await textoDePdf(archivo);
          resultado.push({ nombreArchivo: archivo.name, parseado: parseReportText(texto, datos.productos) });
        } catch (e) {
          resultado.push({
            nombreArchivo: archivo.name,
            error: e instanceof Error ? e.message : 'No pude leer este PDF.',
          });
        }
      }
      const orden = { parcial: 0, completo: 1 };
      resultado.sort(
        (a, b) =>
          (a.parseado?.semana ?? '').localeCompare(b.parseado?.semana ?? '') ||
          orden[a.parseado?.tipo ?? 'completo'] - orden[b.parseado?.tipo ?? 'completo'],
      );
      setLeidos(resultado);
      setLeyendo(false);
    },
    [datos.productos],
  );

  const elegirArchivos = useCallback(() => input.current?.click(), []);

  const tiendaReporte = datos.ajustes.nombreEnReporte?.toUpperCase();
  const deOtraTienda = (l: Leido) => !!tiendaReporte && !!l.parseado && l.parseado.tienda !== tiendaReporte;
  const validos = (leidos ?? []).filter((l) => l.parseado && !deOtraTienda(l));
  const existentes = new Set(datos.reportes.map((r) => r.id));
  const reemplazos = validos.filter((l) => existentes.has(idReporte(l.parseado!.semana, l.parseado!.tipo))).length;

  const guardar = async () => {
    setGuardando(true);
    try {
      await agregarReportes(validos.map((l) => ({ parseado: l.parseado!, nombreArchivo: l.nombreArchivo })));
      setLeidos(null);
      alGuardar();
    } finally {
      setGuardando(false);
    }
  };

  return (
    <CargadorCtx.Provider value={{ elegirArchivos, procesar }}>
      {children}
      <input
        ref={input}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        hidden
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = '';
          if (files.length) void procesar(files);
        }}
      />
      <Dialogo
        abierto={leidos !== null}
        titulo={leyendo ? 'Leyendo reportes…' : validos.length === 1 ? 'Revisa el reporte' : 'Revisa los reportes'}
        alCerrar={() => !leyendo && !guardando && setLeidos(null)}
        pie={
          !leyendo && (
            <>
              <button type="button" className="boton boton-secundario" onClick={() => setLeidos(null)}>
                Cancelar
              </button>
              <button
                type="button"
                className="boton boton-principal"
                disabled={validos.length === 0 || guardando}
                onClick={guardar}
              >
                {guardando ? 'Guardando…' : validos.length > 1 ? `Guardar ${validos.length} reportes` : 'Guardar reporte'}
              </button>
            </>
          )
        }
      >
        {leyendo ? (
          <p className="tenue">Esto tarda unos segundos por archivo.</p>
        ) : (
          <>
            {reemplazos > 0 && (
              <p className="aviso">
                {reemplazos === 1
                  ? 'Ya tenías un reporte de ese mismo corte. Al guardar, lo reemplazo.'
                  : `Ya tenías ${reemplazos} de estos cortes. Al guardar, los reemplazo.`}
              </p>
            )}
            <ul className="lista-leidos">
              {(leidos ?? []).map((l) => (
                <li key={l.nombreArchivo}>
                  {l.parseado ? (
                    <>
                      <div className="leido-fila">
                        <strong>{rangoSemana(l.parseado.semana)}</strong>
                        <span className="etiqueta">
                          {l.parseado.tipo === 'parcial' ? 'Corte del jueves' : 'Semana completa'}
                        </span>
                      </div>
                      <div className="leido-fila tenue">
                        <span>{entero(l.parseado.pedidosEntregados)} pedidos entregados</span>
                        <span className="num">{dinero(l.parseado.efectivo)}</span>
                      </div>
                      {deOtraTienda(l) && (
                        <p className="error">
                          Este reporte es de {l.parseado.tienda} y estás en una tienda que usa {tiendaReporte}. Cambia de
                          tienda para subirlo; no se guardará aquí.
                        </p>
                      )}
                      {l.parseado.avisos.map((a) => (
                        <p key={a} className="aviso aviso-chico">
                          {a}
                        </p>
                      ))}
                    </>
                  ) : (
                    <>
                      <div className="leido-fila">
                        <strong>{l.nombreArchivo}</strong>
                      </div>
                      <p className="error">{l.error}</p>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </Dialogo>
    </CargadorCtx.Provider>
  );
}
