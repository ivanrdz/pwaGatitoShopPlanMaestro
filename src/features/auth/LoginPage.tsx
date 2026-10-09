import { useState, type FormEvent } from 'react';
import { supabase } from '@/data/supabaseCliente';
import { CampoTexto } from '@/shared/ui/Campo';

type Modo = 'entrar' | 'crear';

/** Traduce los errores más comunes de Supabase Auth. */
function mensajeDeError(m: string): string {
  if (/invalid login credentials/i.test(m)) return 'Correo o contraseña incorrectos.';
  if (/email not confirmed/i.test(m)) return 'Primero confirma tu correo con el enlace que te enviamos.';
  if (/already registered/i.test(m)) return 'Ese correo ya tiene cuenta. Inicia sesión.';
  if (/password should be at least/i.test(m)) return 'La contraseña debe tener al menos 6 caracteres.';
  if (/failed to fetch|network/i.test(m)) return 'No hay conexión a internet.';
  return m;
}

export function LoginPage() {
  const [modo, setModo] = useState<Modo>('entrar');
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setEnviando(true);
    setError(null);
    setAviso(null);
    try {
      if (modo === 'entrar') {
        const { error: err } = await supabase.auth.signInWithPassword({ email: correo.trim(), password: clave });
        if (err) setError(mensajeDeError(err.message));
      } else {
        const { data, error: err } = await supabase.auth.signUp({
          email: correo.trim(),
          password: clave,
          options: { emailRedirectTo: window.location.origin },
        });
        if (err) setError(mensajeDeError(err.message));
        else if (!data.session)
          setAviso('Te enviamos un correo. Abre el enlace para confirmar tu cuenta y luego inicia sesión.');
      }
    } catch (err) {
      setError(mensajeDeError(err instanceof Error ? err.message : String(err)));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <main className="login">
      <form className="login-caja" onSubmit={enviar} aria-labelledby="login-titulo">
        <div className="marca">
          <svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true">
            <path d="M6 27V9l5 5h10l5-5v18z" fill="currentColor" />
            <circle cx="12.5" cy="19" r="1.6" fill="var(--superficie)" />
            <circle cx="19.5" cy="19" r="1.6" fill="var(--superficie)" />
          </svg>
          <span>Gatito Finanzas</span>
        </div>
        <h1 id="login-titulo">{modo === 'entrar' ? 'Inicia sesión' : 'Crea tu cuenta'}</h1>
        <p className="tenue">Tus datos se guardan en la nube y los ves desde cualquier dispositivo.</p>
        <CampoTexto etiqueta="Correo" type="email" autoComplete="email" required value={correo} alCambiar={setCorreo} />
        <CampoTexto
          etiqueta="Contraseña"
          type="password"
          autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
          minLength={6}
          required
          value={clave}
          alCambiar={setClave}
        />
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {aviso && (
          <p className="aviso" role="status">
            {aviso}
          </p>
        )}
        <button type="submit" className="boton boton-principal boton-grande" disabled={enviando}>
          {enviando ? 'Un momento…' : modo === 'entrar' ? 'Entrar' : 'Crear cuenta'}
        </button>
        <button
          type="button"
          className="enlace"
          onClick={() => {
            setModo(modo === 'entrar' ? 'crear' : 'entrar');
            setError(null);
            setAviso(null);
          }}
        >
          {modo === 'entrar' ? '¿No tienes cuenta? Créala' : '¿Ya tienes cuenta? Inicia sesión'}
        </button>
      </form>
    </main>
  );
}
