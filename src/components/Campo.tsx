import { useId, type InputHTMLAttributes } from 'react';

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  etiqueta: string;
  valor: number;
  alCambiar: (n: number) => void;
  prefijo?: string;
  sufijo?: string;
  ayuda?: string;
}

/** Campo numérico con teclado numérico en el celular. */
export function CampoNumero({ etiqueta, valor, alCambiar, prefijo, sufijo, ayuda, ...resto }: Props) {
  const id = useId();
  return (
    <div className="campo">
      <label htmlFor={id}>{etiqueta}</label>
      <div className="campo-caja">
        {prefijo && <span className="campo-afijo">{prefijo}</span>}
        <input
          id={id}
          type="number"
          inputMode="decimal"
          step="any"
          value={Number.isFinite(valor) ? valor : 0}
          onChange={(e) => alCambiar(e.target.value === '' ? 0 : Number(e.target.value))}
          aria-describedby={ayuda ? `${id}-ayuda` : undefined}
          {...resto}
        />
        {sufijo && <span className="campo-afijo">{sufijo}</span>}
      </div>
      {ayuda && (
        <p id={`${id}-ayuda`} className="campo-ayuda">
          {ayuda}
        </p>
      )}
    </div>
  );
}

interface TextoProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  etiqueta: string;
  alCambiar: (v: string) => void;
}

export function CampoTexto({ etiqueta, alCambiar, ...resto }: TextoProps) {
  const id = useId();
  return (
    <div className="campo">
      <label htmlFor={id}>{etiqueta}</label>
      <div className="campo-caja">
        <input id={id} onChange={(e) => alCambiar(e.target.value)} {...resto} />
      </div>
    </div>
  );
}
