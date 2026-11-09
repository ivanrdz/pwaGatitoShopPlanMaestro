import { useCallback, useEffect, useState } from 'react';
import type { ArchivoBandeja, Bandeja } from '@/data/bandeja';
import { useSesion } from '@/state/sesion';
import { useCargador } from './cargador';

/** Aviso cuando llegan reportes solos (n8n → bandeja). Revisa al abrir la app y al volver a ella. */
export function BandejaAviso() {
  const { bandeja } = useSesion();
  if (!bandeja) return null;
  return <AvisoConBandeja bandeja={bandeja} />;
}

export function AvisoConBandeja({ bandeja }: { bandeja: Bandeja }) {
  const { procesar } = useCargador();
  const [archivos, setArchivos] = useState<ArchivoBandeja[]>([]);
  const [estado, setEstado] = useState<'listo' | 'descargando' | 'error'>('listo');
  const [mensaje, setMensaje] = useState<string | null>(null);

  const revisar = useCallback(() => {
    bandeja.listar().then(setArchivos, () => setArchivos([]));
  }, [bandeja]);

  useEffect(() => {
    revisar();
    const alVolver = () => document.visibilityState === 'visible' && revisar();
    document.addEventListener('visibilitychange', alVolver);
    return () => document.removeEventListener('visibilitychange', alVolver);
  }, [revisar]);

  if (archivos.length === 0) return null;

  const abrir = async () => {
    setEstado('descargando');
    setMensaje(null);
    try {
      const files = await Promise.all(archivos.map((a) => bandeja.descargar(a)));
      setEstado('listo');
      await procesar(files, {
        alGuardar: async (guardados) => {
          // Solo se borran los que guardaste; los de otra tienda se quedan para cuando cambies.
          const rutas = archivos.filter((a) => guardados.includes(a.nombre)).map((a) => a.ruta);
          await bandeja.borrar(rutas);
          revisar();
        },
      });
    } catch (e) {
      setEstado('error');
      setMensaje(e instanceof Error ? e.message : 'No pude abrir tu bandeja.');
    }
  };

  return (
    <div className="aviso bandeja-aviso" role="status">
      <p>
        {archivos.length === 1 ? 'Llegó 1 reporte' : `Llegaron ${archivos.length} reportes`} por correo:{' '}
        <span className="tenue">{archivos.map((a) => a.nombre).join(', ')}</span>
      </p>
      {mensaje && <p className="error">{mensaje}</p>}
      <button type="button" className="boton boton-principal" onClick={abrir} disabled={estado === 'descargando'}>
        {estado === 'descargando' ? 'Descargando…' : 'Revisar y guardar'}
      </button>
    </div>
  );
}
