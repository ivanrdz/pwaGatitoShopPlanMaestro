import { ErrorNube } from '@/data/supabase';

/** Mensaje de error amigable con opción de reintentar. */
export function PantallaError({ error, alReintentar }: { error: unknown; alReintentar?: () => void }) {
  const sinRed = typeof navigator !== 'undefined' && !navigator.onLine;
  const mensaje = sinRed
    ? 'No hay conexión a internet.'
    : error instanceof ErrorNube
      ? error.message
      : 'No pude abrir tus datos.';
  return (
    <div className="pantalla-centro" role="alert">
      <p>{mensaje}</p>
      <p className="tenue">
        {sinRed
          ? 'Tus datos están en la nube; conéctate y vuelve a intentar.'
          : 'Revisa que el navegador no esté en modo incógnito y vuelve a intentar.'}
      </p>
      {alReintentar && (
        <button type="button" className="boton boton-principal" onClick={alReintentar}>
          Reintentar
        </button>
      )}
    </div>
  );
}
