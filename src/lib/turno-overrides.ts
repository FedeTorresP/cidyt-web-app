import { collection, getDocs } from 'firebase/firestore'
import { getFirebaseFirestore } from '@/lib/firebase'

/**
 * Lee los turnos persistidos en `seguimientos/{id}.turno`.
 *
 * Se usa únicamente en modo fallback (sin API on-prem) para que un cambio de
 * turno hecho en "Registro de Pacientes" se refleje en el resto de la app
 * (Lista del Día, Caja, etc.), ya que los datos mock no son persistentes.
 */
export async function fetchTurnoOverrides(): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  try {
    const db = getFirebaseFirestore()
    const snap = await getDocs(collection(db, 'seguimientos'))
    snap.forEach((d) => {
      const t = d.data().turno
      if (typeof t === 'number') map.set(d.id, t)
    })
  } catch {
    // sin acceso a Firestore: se mantienen los turnos originales
  }
  return map
}

/** Aplica los turnos guardados sobre una lista que tenga `seguimientoId` y `turno`. */
export function applyTurnoOverrides<T extends { seguimientoId: string; turno: number }>(
  items: T[],
  overrides: Map<string, number>,
): T[] {
  if (overrides.size === 0) return items
  return items.map((it) =>
    overrides.has(it.seguimientoId) ? { ...it, turno: overrides.get(it.seguimientoId)! } : it,
  )
}
