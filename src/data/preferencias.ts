/** Preferencias de este dispositivo (no se sincronizan). */
const CLAVE_ACTIVA = 'gatito-tienda-activa';

export function leerTiendaActiva(): string | null {
  try {
    return localStorage.getItem(CLAVE_ACTIVA);
  } catch {
    return null;
  }
}

export function guardarTiendaActiva(id: string) {
  try {
    localStorage.setItem(CLAVE_ACTIVA, id);
  } catch {
    // Sin almacenamiento (modo privado): se usa la tienda principal al volver a abrir.
  }
}
