const pesos = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  maximumFractionDigits: 0,
});

export const dinero = (n: number) => pesos.format(Math.round(n));

export const entero = (n: number) => new Intl.NumberFormat('es-MX').format(Math.round(n));

export const porcentaje = (n: number) => `${Math.round(n * 100)}%`;

/** yyyy-mm-dd en hora local. */
export function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function sumarDias(iso: string, dias: number): string {
  const d = parseIso(iso);
  d.setDate(d.getDate() + dias);
  return isoDate(d);
}

const fCorta = new Intl.DateTimeFormat('es-MX', { weekday: 'short', day: 'numeric', month: 'short' });
const fDia = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' });

export const fechaCorta = (iso: string) => fCorta.format(parseIso(iso)).replace(/\./g, '');
export const diaMes = (iso: string) => fDia.format(parseIso(iso)).replace(/\./g, '');

export function rangoSemana(lunes: string): string {
  return `${diaMes(lunes)} – ${diaMes(sumarDias(lunes, 5))}`;
}

export const hoyIso = () => isoDate(new Date());

export const nuevoId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
