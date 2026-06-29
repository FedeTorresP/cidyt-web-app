import { useQuery } from '@tanstack/react-query'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { getFirebaseAuth, getFirebaseFirestore } from '@/lib/firebase'
import { nowMX, formatDateMX } from '@/lib/timezone'
import { fetchTurnoOverrides, applyTurnoOverrides } from '@/lib/turno-overrides'

/* ═══════════════════════════════════════════════════════════════════════════
   TIPOS
   ═══════════════════════════════════════════════════════════════════════════ */

/** Celda de estudio en Caja: estatus + letra del médico (solo en Completo). */
export interface EstudioCajaCell {
  estatusId: number
  letraMedico: string | null
}

export interface PacienteCaja {
  seguimientoId: string
  turno: number
  nombre: string
  edad: number | null
  paqueteNombre: string | null
  peso: number | null
  talla: number | null
  desayuno: 0 | 1 | 2
  tarjetaEntRes: 0 | 1 | 2 | null
  estatusValpac: 0 | 1 | 2
  medicoInternista: string | null
  estudios: Record<number, EstudioCajaCell> // estudioId → celda
}

export const LISTA_CAJA_QUERY_KEY = ['lista-caja-pacientes']

/* ═══════════════════════════════════════════════════════════════════════════
   DATOS MOCK
   ═══════════════════════════════════════════════════════════════════════════ */

/** Forma cruda devuelta por el API / mock (estudios como estatusId numérico). */
type PacienteCajaRaw = Omit<PacienteCaja, 'estudios'> & { estudios: Record<number, number> }

const PACIENTES_MOCK: PacienteCajaRaw[] = [
  { seguimientoId: '73605', turno: 1, nombre: 'ALFREDO CANO JAUREGUI SEGURA MILLAN', edad: 41, paqueteNombre: 'CHECK UP EMPRESA D', peso: 0, talla: 0, desayuno: 0, tarjetaEntRes: 0, estatusValpac: 2, medicoInternista: 'NEGREROS BALVANERA FABIOLA', estudios: { 1: 4, 2: 4, 3: 2, 4: 1, 5: 1, 6: 1, 7: 4, 8: 1, 9: 6, 19: 6, 10: 1, 11: 1, 12: 1, 13: 6, 14: 1, 15: 4, 16: 1, 17: 1, 18: 1, 20: 1 } },
  { seguimientoId: '73607', turno: 2, nombre: 'SIXTA GUTIERREZ RIVERA', edad: 50, paqueteNombre: 'CHECK UP BASICO', peso: 0, talla: 0, desayuno: 0, tarjetaEntRes: 0, estatusValpac: 0, medicoInternista: null, estudios: { 1: 2, 2: 2, 3: 2, 4: 2, 5: 2, 6: 1, 7: 1, 8: 1, 9: 1, 19: 1, 10: 1, 11: 1, 12: 1, 13: 1, 14: 1, 15: 1, 16: 1, 17: 1, 18: 1, 20: 1 } },
  { seguimientoId: '73608', turno: 3, nombre: 'ASAHI TOSHIYA', edad: 45, paqueteNombre: 'CHECK UP EMPRESA C', peso: 0, talla: 0, desayuno: 0, tarjetaEntRes: 0, estatusValpac: 0, medicoInternista: null, estudios: { 1: 2, 2: 4, 3: 2, 4: 2, 5: 2, 6: 2, 7: 1, 8: 1, 9: 2, 19: 2, 10: 2, 11: 1, 12: 1, 13: 1, 14: 1, 15: 1, 16: 1, 17: 1, 18: 1, 20: 1 } },
  { seguimientoId: '73609', turno: 4, nombre: 'VERONICA ADRIANA BAÑUELOS SANCHEZ', edad: 38, paqueteNombre: 'CHECK UP BASICO', peso: 0, talla: 0, desayuno: 0, tarjetaEntRes: 0, estatusValpac: 0, medicoInternista: null, estudios: { 1: 2, 2: 4, 3: 2, 4: 2, 5: 2, 6: 2, 7: 1, 8: 2, 9: 1, 19: 2, 10: 1, 11: 4, 12: 1, 13: 1, 14: 1, 15: 1, 16: 1, 17: 1, 18: 1, 20: 1 } },
  { seguimientoId: '73610', turno: 5, nombre: 'MARIO DE MARCHIS PARESCHI', edad: 55, paqueteNombre: 'CHECK UP BASICO', peso: 0, talla: 0, desayuno: 0, tarjetaEntRes: 0, estatusValpac: 0, medicoInternista: null, estudios: { 1: 2, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 19: 1, 10: 1, 11: 1, 12: 1, 13: 1, 14: 1, 15: 1, 16: 1, 17: 1, 18: 1, 20: 1 } },
  { seguimientoId: '73611', turno: 6, nombre: 'MARIA GUADALUPE RUIZ DEL RIO', edad: 42, paqueteNombre: 'CHECK UP BASICO', peso: 0, talla: 0, desayuno: 0, tarjetaEntRes: 0, estatusValpac: 0, medicoInternista: null, estudios: { 1: 2, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 19: 1, 10: 1, 11: 1, 12: 1, 13: 1, 14: 1, 15: 1, 16: 1, 17: 1, 18: 1, 20: 1 } },
  { seguimientoId: '73612', turno: 7, nombre: 'SABINA GARCIA ORTEGA', edad: 48, paqueteNombre: 'CHECK UP EMPRESA D', peso: 0, talla: 0, desayuno: 0, tarjetaEntRes: 0, estatusValpac: 0, medicoInternista: null, estudios: { 1: 4, 2: 2, 3: 2, 4: 2, 5: 2, 6: 1, 7: 1, 8: 2, 9: 1, 19: 2, 10: 1, 11: 5, 12: 5, 13: 1, 14: 1, 15: 1, 16: 1, 17: 1, 18: 1, 20: 1 } },
  { seguimientoId: '73613', turno: 8, nombre: 'JESUS AUGUSTO CARMONA COLINA', edad: 60, paqueteNombre: 'CHECK UP BASICO', peso: 0, talla: 0, desayuno: 0, tarjetaEntRes: 0, estatusValpac: 0, medicoInternista: null, estudios: { 1: 2, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 19: 1, 10: 1, 11: 1, 12: 1, 13: 1, 14: 1, 15: 1, 16: 1, 17: 1, 18: 1, 20: 1 } },
  { seguimientoId: '73614', turno: 9, nombre: 'JAIME VELAZQUEZ BERUMEN', edad: 37, paqueteNombre: 'CHECK UP BASICO', peso: 0, talla: 0, desayuno: 0, tarjetaEntRes: 0, estatusValpac: 0, medicoInternista: null, estudios: { 1: 2, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 19: 6, 10: 1, 11: 1, 12: 1, 13: 6, 14: 1, 15: 6, 16: 1, 17: 1, 18: 1, 20: 1 } },
  { seguimientoId: '73615', turno: 10, nombre: 'HEIDI PRAGER GUZMAN', edad: 44, paqueteNombre: 'CHECK UP EMPRESA C', peso: 0, talla: 0, desayuno: 0, tarjetaEntRes: 0, estatusValpac: 0, medicoInternista: null, estudios: { 1: 4, 2: 2, 3: 2, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 19: 1, 10: 1, 11: 6, 12: 6, 13: 1, 14: 1, 15: 1, 16: 1, 17: 1, 18: 1, 20: 1 } },
  { seguimientoId: '73616', turno: 11, nombre: 'MARIO ALFREDO DONIZ ISLAS', edad: 52, paqueteNombre: 'CHECK UP BASICO', peso: 0, talla: 0, desayuno: 0, tarjetaEntRes: 0, estatusValpac: 0, medicoInternista: null, estudios: { 1: 2, 2: 4, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 19: 1, 10: 1, 11: 4, 12: 1, 13: 1, 14: 1, 15: 1, 16: 1, 17: 1, 18: 1, 20: 1 } },
  { seguimientoId: '73617', turno: 12, nombre: 'JOSE LUIS RAMIREZ PALOMARES', edad: 47, paqueteNombre: 'CHECK UP BASICO', peso: 0, talla: 0, desayuno: 0, tarjetaEntRes: 0, estatusValpac: 0, medicoInternista: null, estudios: { 1: 2, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 19: 1, 10: 1, 11: 1, 12: 1, 13: 1, 14: 1, 15: 1, 16: 1, 17: 1, 18: 1, 20: 1 } },
  { seguimientoId: '73618', turno: 13, nombre: 'RICARDO EDDY MONTERRUBIO MORENO', edad: 35, paqueteNombre: 'CHECK UP BASICO', peso: 0, talla: 0, desayuno: 0, tarjetaEntRes: 0, estatusValpac: 0, medicoInternista: null, estudios: { 1: 2, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 19: 1, 10: 1, 11: 1, 12: 1, 13: 1, 14: 1, 15: 1, 16: 1, 17: 1, 18: 1, 20: 1 } },
  { seguimientoId: '73619', turno: 14, nombre: 'MONICA ALVAREZ RIOS', edad: 39, paqueteNombre: 'CHECK UP BASICO', peso: 0, talla: 0, desayuno: 0, tarjetaEntRes: 0, estatusValpac: 0, medicoInternista: null, estudios: { 1: 2, 2: 2, 3: 2, 4: 2, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 19: 1, 10: 1, 11: 1, 12: 1, 13: 1, 14: 1, 15: 1, 16: 1, 17: 1, 18: 1, 20: 1 } },
  { seguimientoId: '73620', turno: 15, nombre: 'MARIO LUIS PRADO BABAYAN', edad: 58, paqueteNombre: 'CHECK UP BASICO', peso: 0, talla: 0, desayuno: 0, tarjetaEntRes: 0, estatusValpac: 0, medicoInternista: null, estudios: { 1: 2, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 19: 1, 10: 1, 11: 1, 12: 1, 13: 1, 14: 1, 15: 1, 16: 1, 17: 1, 18: 1, 20: 1 } },
]

/* ═══════════════════════════════════════════════════════════════════════════
   FETCH (con fallback a mock)
   ═══════════════════════════════════════════════════════════════════════════ */

const API_BASE = import.meta.env.VITE_API_URL ?? ''

/** Normaliza estudios crudos (número) a celdas con letra de médico vacía. */
function normalizeCajaEstudios(raw: Record<number, number>): Record<number, EstudioCajaCell> {
  const out: Record<number, EstudioCajaCell> = {}
  for (const [key, estatusId] of Object.entries(raw)) {
    out[Number(key)] = { estatusId: Number(estatusId) || 0, letraMedico: null }
  }
  return out
}

/** Lee estudios_paciente de Firestore para enriquecer las celdas con la letra del médico. */
async function enrichCajaWithFirestore(pacientes: PacienteCaja[]): Promise<PacienteCaja[]> {
  if (pacientes.length === 0) return pacientes
  const seguimientoIds = pacientes.map((p) => p.seguimientoId)
  const db = getFirebaseFirestore()

  const bySegEstudio = new Map<string, { estatusId: number; letraMedico: string | null }>()
  for (let i = 0; i < seguimientoIds.length; i += 30) {
    const chunk = seguimientoIds.slice(i, i + 30)
    const snap = await getDocs(
      query(
        collection(db, 'estudios_paciente'),
        where('seguimientoId', 'in', chunk),
        where('activo', '==', true),
      ),
    )
    for (const d of snap.docs) {
      const data = d.data()
      const letra = typeof data.letraMedico === 'string' && data.letraMedico.trim() !== ''
        ? data.letraMedico.trim()
        : null
      bySegEstudio.set(`${String(data.seguimientoId ?? '')}:${String(data.estudioId ?? '')}`, {
        estatusId: Number(data.estatusEstudioId) || 0,
        letraMedico: letra,
      })
    }
  }

  if (bySegEstudio.size === 0) return pacientes

  return pacientes.map((pac) => {
    const estudios = { ...pac.estudios }
    let changed = false
    for (const estudioKey of Object.keys(estudios)) {
      const ep = bySegEstudio.get(`${pac.seguimientoId}:${estudioKey}`)
      if (!ep) continue
      changed = true
      estudios[Number(estudioKey)] = {
        estatusId: ep.estatusId || estudios[Number(estudioKey)].estatusId,
        letraMedico: ep.letraMedico,
      }
    }
    return changed ? { ...pac, estudios } : pac
  })
}

async function fetchListaCaja(fecha: string): Promise<PacienteCaja[]> {
  let raw: PacienteCajaRaw[] | null = null
  try {
    const user = getFirebaseAuth().currentUser
    const headers: HeadersInit = { 'Content-Type': 'application/json' }
    if (user) {
      const token = await user.getIdToken()
      headers.Authorization = `Bearer ${token}`
    }
    const res = await fetch(`${API_BASE}/api/caja?fecha=${fecha}`, { headers })
    if (res.ok) raw = (await res.json()) as PacienteCajaRaw[]
  } catch {
    // fallback
  }
  if (raw == null) {
    const hoy = formatDateMX(nowMX())
    // Sin backend: usar mock con los turnos persistidos en Registro de Pacientes
    raw = fecha === hoy ? applyTurnoOverrides(PACIENTES_MOCK, await fetchTurnoOverrides()) : []
  }

  const pacientes: PacienteCaja[] = raw.map((p) => ({
    ...p,
    estudios: normalizeCajaEstudios(p.estudios),
  }))

  try {
    return await enrichCajaWithFirestore(pacientes)
  } catch {
    return pacientes
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   HOOK PRINCIPAL
   ═══════════════════════════════════════════════════════════════════════════ */

export function useListaCaja(fecha: string) {
  return useQuery({
    queryKey: [...LISTA_CAJA_QUERY_KEY, fecha],
    queryFn: () => fetchListaCaja(fecha),
  })
}
