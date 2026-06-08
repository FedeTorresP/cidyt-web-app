/**
 * Servicio de tiempo — conversión UTC ↔ zona horaria institucional.
 * Zona: America/Mexico_City (fija para el CIDyT de Médica Sur).
 */

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
  return date.toLocaleDateString('en-CA', { timeZone: TIMEZONE })
}

/**
 * Calcula el inicio (00:00:00) y fin (23:59:59.999) UTC de un día local.
 */
export function getDayRangeUtc(localDateStr: string): { startUtc: Date; endUtc: Date } {
  const startLocal = new Date(`${localDateStr}T00:00:00`)
  const endLocal = new Date(`${localDateStr}T23:59:59.999`)

  // Usar el Intl API para calcular offset
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    timeZoneName: 'shortOffset',
  })

  // Obtener el offset parseando el resultado (e.g., "GMT-6")
  const parts = formatter.formatToParts(startLocal)
  const tzPart = parts.find((p) => p.type === 'timeZoneName')?.value ?? ''
  const match = tzPart.match(/GMT([+-]\d+)/)
  const offsetHours = match ? parseInt(match[1], 10) : -6

  const startUtc = new Date(startLocal.getTime() - offsetHours * 60 * 60 * 1000)
  const endUtc = new Date(endLocal.getTime() - offsetHours * 60 * 60 * 1000)

  return { startUtc, endUtc }
}

/**
 * Obtiene la fecha de hoy como YYYY-MM-DD en la zona institucional.
 */
export function getTodayLocalDate(): string {
  return toLocalDateString(new Date())
}
