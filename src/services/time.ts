/**
 * Servicio de tiempo — conversión UTC ↔ zona horaria institucional.
 * Zona: America/Mexico_City (fija para el CIDyT de Médica Sur).
 *
 * Usa date-fns-tz para cálculos precisos con soporte DST.
 */

import { toZonedTime, fromZonedTime, format } from 'date-fns-tz'

const TIMEZONE = import.meta.env.VITE_APP_TIMEZONE || 'America/Mexico_City'

/**
 * Convierte una fecha a la zona horaria institucional como string legible.
 */
export function toLocalString(date: Date, options?: Intl.DateTimeFormatOptions): string {
  return date.toLocaleString('es-MX', {
    timeZone: TIMEZONE,
    ...options,
  })
}

/**
 * Formatea una fecha como YYYY-MM-DD en la zona horaria institucional.
 */
export function toLocalDateString(date: Date): string {
  return format(toZonedTime(date, TIMEZONE), 'yyyy-MM-dd', { timeZone: TIMEZONE })
}

/**
 * Calcula el inicio (00:00:00) y fin (23:59:59.999) UTC de un día local.
 * Usa fromZonedTime para conversión precisa con DST.
 */
export function getDayRangeUtc(localDateStr: string): { startUtc: Date; endUtc: Date } {
  // Interpretamos la cadena como hora local de la zona institucional
  const startUtc = fromZonedTime(new Date(`${localDateStr}T00:00:00`), TIMEZONE)
  const endUtc = fromZonedTime(new Date(`${localDateStr}T23:59:59.999`), TIMEZONE)

  return { startUtc, endUtc }
}

/**
 * Obtiene la fecha de hoy como YYYY-MM-DD en la zona institucional.
 */
export function getTodayLocalDate(): string {
  return toLocalDateString(new Date())
}
