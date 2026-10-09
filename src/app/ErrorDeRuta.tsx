import { isRouteErrorResponse, useRouteError } from 'react-router';

/** Error al cargar o mostrar una pantalla (por ejemplo, una versión nueva sin internet). */
export function ErrorDeRuta() {
  const error = useRouteError();
  const mensaje = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : 'Error desconocido';
  return (
    <div className="pantalla-centro" role="alert">
      <p>No pude abrir esta pantalla.</p>
      <p className="tenue">{mensaje}</p>
      <button type="button" className="boton boton-principal" onClick={() => window.location.assign('/')}>
        Ir a Inicio
      </button>
    </div>
  );
}
