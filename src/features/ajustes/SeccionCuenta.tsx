import { useEffect, useState } from 'react';
import { repositorioLocal } from '@/data/indexeddb';
import { subirANube } from '@/data/subirANube';
import { useSesion } from '@/state/sesion';

/** Cuántos reportes hay guardados en este dispositivo, sin crear nada si no hay. */
async function reportesLocales(): Promise<number> {
  if (!('indexedDB' in globalThis) || !indexedDB.databases) return 0;
  const bases = await indexedDB.databases();
  if (!bases.some((b) => b.name?.startsWith('gatito-finanzas'))) return 0;
  let total = 0;
  for (const t of await repositorioLocal.listarTiendas())
    total += (await repositorioLocal.cargarDatos(t.id)).reportes.length;
  return total;
}

/** Cuenta de la nube: quién eres, cerrar sesión y subir lo que había en este dispositivo. */
export function SeccionCuenta() {
  const { repo, correo, salir, usuarioId } = useSesion();
  const [locales, setLocales] = useState(0);
  const [estado, setEstado] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);

  useEffect(() => {
    if (repo.tipo === 'nube') reportesLocales().then(setLocales, () => setLocales(0));
  }, [repo]);

  if (repo.tipo !== 'nube') {
    return (
      <section className="seccion" aria-labelledby="cuenta-titulo">
        <h2 id="cuenta-titulo">Dónde se guardan tus datos</h2>
        <p className="tenue">
          En este dispositivo. Para verlos desde cualquier lugar, configura Supabase (ver README) y vuelve a publicar la
          app.
        </p>
      </section>
    );
  }

  const subir = async () => {
    if (!window.confirm('Esto copia tus tiendas de este dispositivo a la nube y reemplaza lo que haya allá. ¿Seguir?'))
      return;
    setSubiendo(true);
    try {
      const r = await subirANube(repositorioLocal, repo, setEstado);
      setEstado(`Listo: ${r.tiendas} tienda${r.tiendas === 1 ? '' : 's'} y ${r.reportes} reportes en la nube.`);
      window.setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      setEstado(e instanceof Error ? e.message : 'No se pudo subir.');
    } finally {
      setSubiendo(false);
    }
  };

  return (
    <section className="seccion" aria-labelledby="cuenta-titulo">
      <h2 id="cuenta-titulo">Tu cuenta</h2>
      <p>
        Tus datos se guardan en la nube con <strong>{correo}</strong>.
      </p>
      {locales > 0 && (
        <div className="aviso">
          <p>Este dispositivo tiene {locales} reportes guardados de antes. Súbelos para tenerlos en la nube.</p>
          <button type="button" className="boton boton-principal" disabled={subiendo} onClick={subir}>
            {subiendo ? 'Subiendo…' : 'Subir a la nube'}
          </button>
        </div>
      )}
      {estado && <p role="status">{estado}</p>}
      {usuarioId && <IdParaN8n usuarioId={usuarioId} />}
      <div className="botones">
        <button type="button" className="boton boton-secundario" onClick={() => void salir()}>
          Cerrar sesión
        </button>
      </div>
    </section>
  );
}

/** Tu id de usuario, para configurar el flujo de n8n que deja los reportes en tu bandeja. */
function IdParaN8n({ usuarioId }: { usuarioId: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <div className="id-n8n">
      <h3>Reportes automáticos</h3>
      <p className="tenue">
        Para que los cortes lleguen solos desde tu correo, pon este ID en el flujo de n8n (ver README, sección «Reportes
        automáticos»).
      </p>
      <div className="id-n8n-fila">
        <code>{usuarioId}</code>
        <button
          type="button"
          className="boton boton-secundario"
          onClick={() =>
            navigator.clipboard?.writeText(usuarioId).then(
              () => setCopiado(true),
              () => setCopiado(false),
            )
          }
        >
          {copiado ? 'Copiado' : 'Copiar'}
        </button>
      </div>
    </div>
  );
}
