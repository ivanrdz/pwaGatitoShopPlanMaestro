/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL del proyecto de Supabase. Sin ella, la app guarda todo en este dispositivo. */
  readonly VITE_SUPABASE_URL?: string;
  /** Llave pública (anon) de Supabase. Nunca la service_role. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
