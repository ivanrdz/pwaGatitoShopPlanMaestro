import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { repositorioLocal } from '@/data/indexeddb';
import { crearRepositorioNube } from '@/data/supabase';
import { supabase } from '@/data/supabaseCliente';
import { LoginPage } from '@/features/auth/LoginPage';
import { SesionCtx, type Sesion } from './sesion';

const sesionLocal: Sesion = { repo: repositorioLocal, correo: null, salir: async () => undefined };

/**
 * Decide dónde viven los datos:
 * - Con Supabase configurado, pide iniciar sesión y guarda en la nube.
 * - Sin Supabase, guarda en este dispositivo (como antes).
 */
export function SesionProvider({ children }: { children: ReactNode }) {
  if (!supabase) return <SesionCtx.Provider value={sesionLocal}>{children}</SesionCtx.Provider>;
  return <SesionNube>{children}</SesionNube>;
}

function SesionNube({ children }: { children: ReactNode }) {
  const sb = supabase!;
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    let vivo = true;
    sb.auth
      .getSession()
      .then(({ data }) => vivo && setSession(data.session))
      .catch(() => vivo && setSession(null));
    const { data } = sb.auth.onAuthStateChange((_evento, s) => setSession(s));
    return () => {
      vivo = false;
      data.subscription.unsubscribe();
    };
  }, [sb]);

  const usuarioId = session?.user.id;
  const valor = useMemo<Sesion | null>(
    () =>
      usuarioId
        ? {
            repo: crearRepositorioNube(sb),
            correo: session?.user.email ?? null,
            salir: async () => {
              await sb.auth.signOut();
            },
          }
        : null,
    // Solo cambia cuando cambia el usuario, no en cada renovación del token.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [usuarioId, sb],
  );

  if (session === undefined) return <div className="pantalla-centro tenue">Cargando…</div>;
  if (!valor) return <LoginPage />;
  return (
    <SesionCtx.Provider value={valor} key={usuarioId}>
      {children}
    </SesionCtx.Provider>
  );
}
