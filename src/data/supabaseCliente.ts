import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const llave = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** true si la app está configurada para guardar en la nube. */
export const nubeConfigurada = Boolean(url && llave);

/** Cliente único de Supabase; null si no hay variables de entorno. */
export const supabase: SupabaseClient | null = nubeConfigurada
  ? createClient(url!, llave!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;
