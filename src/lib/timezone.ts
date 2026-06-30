/**
 * Helpers de zona horaria — IPadCIDyT v2.0
 *
 * Todas las fechas y horas del sistema operan en America/Mexico_City.
 * Se usa date-fns-tz para conversiones precisas con soporte de DST.
 */

import { toZonedTime, fromZonedTime, format } from 'date-fns-tz';

/** Zona horaria fija del sistema. */
const TZ = 'America/Mexico_City';

/**
 * Retorna la fecha/hora actual en la zona horaria America/Mexico_City.
 * El objeto Date resultante representa el instante actual expresado
 * como si fuera hora local de México.
 */
export function nowMX(): Date {
  return toZonedTime(new Date(), TZ);
}

/**
 * Formatea una fecha UTC como cadena 'yyyy-MM-dd' en zona Mexico_City.
 * @param d - Fecha a formatear (puede ser UTC o ya zonificada).
 * @returns Cadena con formato 'yyyy-MM-dd', p.ej. '2024-07-15'.
 */
export function formatDateMX(d: Date): string {
  return format(toZonedTime(d, TZ), 'yyyy-MM-dd', { timeZone: TZ });
}

/**
 * Formatea una fecha UTC como cadena 'HH:mm:ss' en zona Mexico_City.
 * @param d - Fecha a formatear (puede ser UTC o ya zonificada).
 * @returns Cadena con formato 'HH:mm:ss', p.ej. '09:30:00'.
 */
export function formatTimeMX(d: Date): string {
  return format(toZonedTime(d, TZ), 'HH:mm:ss', { timeZone: TZ });
}

/**
 * Convierte un día calendario 'yyyy-MM-dd' (en zona Mexico_City) al rango de
 * instantes UTC [inicio, fin) que lo cubre. Útil para consultar Firestore por
 * `fechaIngresoUtc` (Timestamp) reutilizando el índice (activo, fechaIngresoUtc).
 * @param fecha - Cadena 'yyyy-MM-dd'.
 * @returns { start, end } donde start = 00:00 MX y end = 00:00 MX del día siguiente.
 */
export function dayRangeMX(fecha: string): { start: Date; end: Date } {
  const start = fromZonedTime(`${fecha}T00:00:00`, TZ);
  const [y, m, d] = fecha.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  const nextStr = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`;
  const end = fromZonedTime(`${nextStr}T00:00:00`, TZ);
  return { start, end };
}
