import { Link } from 'react-router';

export function NoEncontrado() {
  return (
    <div className="vacio">
      <p>Esta página no existe.</p>
      <Link className="boton boton-principal" to="/">
        Ir a Inicio
      </Link>
    </div>
  );
}
