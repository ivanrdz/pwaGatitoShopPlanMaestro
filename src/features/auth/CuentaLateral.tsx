import { useSesion } from '@/state/sesion';

/** Correo y "Cerrar sesión" al pie del menú lateral (solo en computadora y con datos en la nube). */
export function CuentaLateral() {
  const { correo, salir } = useSesion();
  if (!correo) return null;
  return (
    <div className="cuenta-lateral">
      <span className="cuenta-correo" title={correo}>
        {correo}
      </span>
      <button type="button" className="enlace" onClick={() => void salir()}>
        Cerrar sesión
      </button>
    </div>
  );
}
