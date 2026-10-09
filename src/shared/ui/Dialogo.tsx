import { useEffect, useId, useRef, type ReactNode } from 'react';

interface Props {
  abierto: boolean;
  titulo: string;
  alCerrar: () => void;
  children: ReactNode;
  pie?: ReactNode;
}

/** Diálogo modal nativo: maneja foco, Escape y accesibilidad. */
export function Dialogo({ abierto, titulo, alCerrar, children, pie }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const cuerpo = useRef<HTMLDivElement>(null);
  const idTitulo = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (abierto && !d.open) {
      d.showModal();
      cuerpo.current?.focus();
    }
    if (!abierto && d.open) d.close();
  }, [abierto]);
  return (
    // Clic en el fondo cierra; con teclado, <dialog> ya cierra con Escape de forma nativa.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={ref}
      className="dialogo"
      aria-labelledby={idTitulo}
      onClose={alCerrar}
      onClick={(e) => {
        if (e.target === ref.current) alCerrar();
      }}
    >
      <div className="dialogo-caja">
        <header className="dialogo-cabeza">
          <h2 id={idTitulo}>{titulo}</h2>
          <button type="button" className="boton-icono" onClick={alCerrar} aria-label="Cerrar">
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </header>
        <div className="dialogo-cuerpo" ref={cuerpo} tabIndex={-1}>
          {abierto && children}
        </div>
        {pie && <footer className="dialogo-pie">{pie}</footer>}
      </div>
    </dialog>
  );
}
