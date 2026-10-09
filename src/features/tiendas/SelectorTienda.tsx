import { useNavigate } from 'react-router';
import { useTiendas } from '@/state/tiendas';

/** Selector de tienda. Solo aparece cuando tienes más de una. */
export function SelectorTienda({ className = '' }: { className?: string }) {
  const { tiendas, activa, cambiar } = useTiendas();
  const navigate = useNavigate();
  if (tiendas.length < 2) return null;
  return (
    <label className={`selector-tienda ${className}`}>
      <span>Tienda</span>
      <select
        value={activa.id}
        onChange={(e) => {
          cambiar(e.target.value);
          navigate('/');
        }}
      >
        {tiendas.map((t) => (
          <option key={t.id} value={t.id}>
            {t.nombre}
          </option>
        ))}
      </select>
    </label>
  );
}
