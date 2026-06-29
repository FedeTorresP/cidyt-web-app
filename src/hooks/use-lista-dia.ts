import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  addDoc,
} from 'firebase/firestore'
import { getFirebaseAuth, getFirebaseFirestore } from '@/lib/firebase'
import { nowMX, formatDateMX } from '@/lib/timezone'
import { fetchTurnoOverrides, applyTurnoOverrides } from '@/lib/turno-overrides'

/* ═══════════════════════════════════════════════════════════════════════════
   TIPOS
   ═══════════════════════════════════════════════════════════════════════════ */

export interface EstudioCellState {
  estatusId: number
  medicoId?: string | null
  letraMedico?: string | null
  estudiosPacienteId?: string | null
}

export interface EstudioAdicionalListaDia {
  id: string
  nombre: string
  estatusEstId: number
  letraEstAdic: string | null
  observaciones: string | null
}

export interface PacienteListaDia {
  seguimientoId: string
  turno: number
  nombre: string
  desayuno: 0 | 1 | 2
  estatusValpac: 0 | 1 | 2
  padecimientoId: number
  medicoInternista: string | null
  paqueteId: string
  paqueteNombre: string
  edad: number
  peso: number
  talla: number
  fechaEntrega: string | null
  horaEntrega: string | null
  tarjetaEntRes: 0 | 1 | 2
  tieneAdicionales: boolean
  estudiosAdicionales?: EstudioAdicionalListaDia[]
  estudios: Record<number, EstudioCellState>
}

export interface UpdateEstudioPacienteInput {
  seguimientoId: string
  estudioId: number
  estatusEstudioId: number
  medicoId?: string | null
  letraMedico?: string | null
  estudiosPacienteId?: string | null
}

export const LISTA_DIA_QUERY_KEY = ['lista-dia-pacientes']

const ESTATUS_CON_LETRA = new Set([4]) // Completo — conservar letra del médico

/* ═══════════════════════════════════════════════════════════════════════════
   HELPERS — normalización estudios
   ═══════════════════════════════════════════════════════════════════════════ */

export function normalizeEstudios(
  raw: Record<number, number | EstudioCellState> | undefined,
): Record<number, EstudioCellState> {
  if (!raw) return {}
  const out: Record<number, EstudioCellState> = {}
  for (const [key, val] of Object.entries(raw)) {
    const estudioId = Number(key)
    if (typeof val === 'number') {
      out[estudioId] = { estatusId: val }
    } else {
      out[estudioId] = { ...val, estatusId: val.estatusId ?? 0 }
    }
  }
  return out
}

function cellFromEstatus(estatusId: number): EstudioCellState {
  return { estatusId }
}

function buildEstudiosFromLegacy(
  legacy: Record<number, number>,
  overrides?: Partial<Record<number, Partial<EstudioCellState>>>,
): Record<number, EstudioCellState> {
  const out: Record<number, EstudioCellState> = {}
  for (const [key, estatusId] of Object.entries(legacy)) {
    const id = Number(key)
    const base = cellFromEstatus(estatusId)
    const extra = overrides?.[id]
    out[id] = extra ? { ...base, ...extra } : base
  }
  return out
}

/* ═══════════════════════════════════════════════════════════════════════════
   DATOS MOCK
   ═══════════════════════════════════════════════════════════════════════════ */

const PACIENTES_MOCK: PacienteListaDia[] = [
  { seguimientoId: '73605', turno: 1, nombre: 'ALFREDO CANO JAUREGUI SEGURA MILLAN', desayuno: 0, estatusValpac: 2, padecimientoId: 0, medicoInternista: 'NEGREROS BALVANERA FABIOLA', paqueteId: 'DT0066', paqueteNombre: 'CHECK UP EMPRESA D', edad: 41, peso: 0, talla: 0, fechaEntrega: 'Tue Dec 31', horaEntrega: null, tarjetaEntRes: 0, tieneAdicionales: true, estudiosAdicionales: [
    { id: 'ea-73605-1', nombre: 'VIT. B 12, VITA D', estatusEstId: 2, letraEstAdic: 'A', observaciones: null },
    { id: 'ea-73605-2', nombre: 'HEMOGLOBINA GLICOSILADA', estatusEstId: 4, letraEstAdic: 'B', observaciones: 'Resultado normal' },
  ], estudios: buildEstudiosFromLegacy({ 1: 4, 2: 4, 3: 2, 4: 1, 5: 1, 6: 1, 7: 4, 8: 1, 9: 6, 19: 6, 10: 1, 11: 1, 12: 1, 13: 6, 14: 1, 15: 4, 16: 1, 17: 1, 18: 1, 20: 1 }, { 7: { letraMedico: 'H' }, 15: { letraMedico: 'V' }, 16: { letraMedico: 'L' } }) },
  { seguimientoId: '73607', turno: 2, nombre: 'SIXTA GUTIERREZ RIVERA', desayuno: 0, estatusValpac: 0, padecimientoId: 0, medicoInternista: null, paqueteId: 'DT0028', paqueteNombre: 'CHECK UP BASICO', edad: 50, peso: 0, talla: 0, fechaEntrega: null, horaEntrega: null, tarjetaEntRes: 0, tieneAdicionales: false, estudios: buildEstudiosFromLegacy({ 1: 2, 2: 2, 3: 2, 4: 2, 5: 2, 6: 1, 7: 1, 8: 1, 9: 1, 19: 1, 10: 1, 11: 1, 12: 1, 13: 1, 14: 1, 15: 1, 16: 1, 17: 1, 18: 1, 20: 1 }) },
  { seguimientoId: '73608', turno: 3, nombre: 'ASAHI TOSHIYA', desayuno: 0, estatusValpac: 0, padecimientoId: 0, medicoInternista: null, paqueteId: 'DT0040', paqueteNombre: 'CHECK UP EMPRESA C', edad: 45, peso: 0, talla: 0, fechaEntrega: null, horaEntrega: null, tarjetaEntRes: 0, tieneAdicionales: false, estudios: buildEstudiosFromLegacy({ 1: 2, 2: 4, 3: 2, 4: 2, 5: 2, 6: 2, 7: 1, 8: 1, 9: 2, 19: 2, 10: 2, 11: 1, 12: 1, 13: 1, 14: 1, 15: 1, 16: 1, 17: 1, 18: 1, 20: 1 }) },
  { seguimientoId: '73609', turno: 4, nombre: 'VERONICA ADRIANA BAÑUELOS SANCHEZ', desayuno: 0, estatusValpac: 0, padecimientoId: 0, medicoInternista: null, paqueteId: 'DT0028', paqueteNombre: 'CHECK UP BASICO', edad: 38, peso: 0, talla: 0, fechaEntrega: null, horaEntrega: null, tarjetaEntRes: 0, tieneAdicionales: false, estudios: buildEstudiosFromLegacy({ 1: 2, 2: 4, 3: 2, 4: 2, 5: 2, 6: 2, 7: 1, 8: 2, 9: 1, 19: 2, 10: 1, 11: 4, 12: 1, 13: 1, 14: 1, 15: 1, 16: 1, 17: 1, 18: 1, 20: 1 }) },
  { seguimientoId: '73610', turno: 5, nombre: 'MARIO DE MARCHIS PARESCHI', desayuno: 0, estatusValpac: 0, padecimientoId: 0, medicoInternista: null, paqueteId: 'DT0028', paqueteNombre: 'CHECK UP BASICO', edad: 55, peso: 0, talla: 0, fechaEntrega: null, horaEntrega: null, tarjetaEntRes: 0, tieneAdicionales: false, estudios: buildEstudiosFromLegacy({ 1: 2, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 19: 1, 10: 1, 11: 1, 12: 1, 13: 1, 14: 1, 15: 1, 16: 1, 17: 1, 18: 1, 20: 1 }) },
  { seguimientoId: '73611', turno: 6, nombre: 'MARIA GUADALUPE RUIZ DEL RIO', desayuno: 0, estatusValpac: 0, padecimientoId: 0, medicoInternista: null, paqueteId: 'DT0028', paqueteNombre: 'CHECK UP BASICO', edad: 42, peso: 0, talla: 0, fechaEntrega: null, horaEntrega: null, tarjetaEntRes: 0, tieneAdicionales: false, estudios: buildEstudiosFromLegacy({ 1: 2, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 19: 1, 10: 1, 11: 1, 12: 1, 13: 1, 14: 1, 15: 1, 16: 1, 17: 1, 18: 1, 20: 1 }) },
  { seguimientoId: '73612', turno: 7, nombre: 'SABINA GARCIA ORTEGA', desayuno: 0, estatusValpac: 0, padecimientoId: 0, medicoInternista: null, paqueteId: 'DT0066', paqueteNombre: 'CHECK UP EMPRESA D', edad: 48, peso: 0, talla: 0, fechaEntrega: null, horaEntrega: null, tarjetaEntRes: 0, tieneAdicionales: false, estudios: buildEstudiosFromLegacy({ 1: 4, 2: 2, 3: 2, 4: 2, 5: 2, 6: 1, 7: 1, 8: 2, 9: 1, 19: 2, 10: 1, 11: 5, 12: 5, 13: 1, 14: 1, 15: 1, 16: 1, 17: 1, 18: 1, 20: 1 }) },
  { seguimientoId: '73613', turno: 8, nombre: 'JESUS AUGUSTO CARMONA COLINA', desayuno: 0, estatusValpac: 0, padecimientoId: 0, medicoInternista: null, paqueteId: 'DT0028', paqueteNombre: 'CHECK UP BASICO', edad: 60, peso: 0, talla: 0, fechaEntrega: null, horaEntrega: null, tarjetaEntRes: 0, tieneAdicionales: false, estudios: buildEstudiosFromLegacy({ 1: 2, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 19: 1, 10: 1, 11: 1, 12: 1, 13: 1, 14: 1, 15: 1, 16: 1, 17: 1, 18: 1, 20: 1 }) },
  { seguimientoId: '73614', turno: 9, nombre: 'JAIME VELAZQUEZ BERUMEN', desayuno: 0, estatusValpac: 0, padecimientoId: 0, medicoInternista: null, paqueteId: 'DT0028', paqueteNombre: 'CHECK UP BASICO', edad: 37, peso: 0, talla: 0, fechaEntrega: null, horaEntrega: null, tarjetaEntRes: 0, tieneAdicionales: false, estudios: buildEstudiosFromLegacy({ 1: 2, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 19: 6, 10: 1, 11: 1, 12: 1, 13: 6, 14: 1, 15: 6, 16: 1, 17: 1, 18: 1, 20: 1 }) },
  { seguimientoId: '73615', turno: 10, nombre: 'HEIDI PRAGER GUZMAN', desayuno: 0, estatusValpac: 0, padecimientoId: 0, medicoInternista: null, paqueteId: 'DT0040', paqueteNombre: 'CHECK UP EMPRESA C', edad: 44, peso: 0, talla: 0, fechaEntrega: null, horaEntrega: null, tarjetaEntRes: 0, tieneAdicionales: false, estudios: buildEstudiosFromLegacy({ 1: 4, 2: 2, 3: 2, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 19: 1, 10: 1, 11: 6, 12: 6, 13: 1, 14: 1, 15: 1, 16: 1, 17: 1, 18: 1, 20: 1 }) },
  { seguimientoId: '73616', turno: 11, nombre: 'MARIO ALFREDO DONIZ ISLAS', desayuno: 0, estatusValpac: 0, padecimientoId: 0, medicoInternista: null, paqueteId: 'DT0028', paqueteNombre: 'CHECK UP BASICO', edad: 52, peso: 0, talla: 0, fechaEntrega: null, horaEntrega: null, tarjetaEntRes: 0, tieneAdicionales: false, estudios: buildEstudiosFromLegacy({ 1: 2, 2: 4, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 19: 1, 10: 1, 11: 4, 12: 1, 13: 1, 14: 1, 15: 1, 16: 1, 17: 1, 18: 1, 20: 1 }) },
  { seguimientoId: '73617', turno: 12, nombre: 'JOSE LUIS RAMIREZ PALOMARES', desayuno: 0, estatusValpac: 0, padecimientoId: 0, medicoInternista: null, paqueteId: 'DT0028', paqueteNombre: 'CHECK UP BASICO', edad: 47, peso: 0, talla: 0, fechaEntrega: null, horaEntrega: null, tarjetaEntRes: 0, tieneAdicionales: false, estudios: buildEstudiosFromLegacy({ 1: 2, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 19: 1, 10: 1, 11: 1, 12: 1, 13: 1, 14: 1, 15: 1, 16: 1, 17: 1, 18: 1, 20: 1 }) },
  { seguimientoId: '73618', turno: 13, nombre: 'RICARDO EDDY MONTERRUBIO MORENO', desayuno: 0, estatusValpac: 0, padecimientoId: 0, medicoInternista: null, paqueteId: 'DT0028', paqueteNombre: 'CHECK UP BASICO', edad: 35, peso: 0, talla: 0, fechaEntrega: null, horaEntrega: null, tarjetaEntRes: 0, tieneAdicionales: false, estudios: buildEstudiosFromLegacy({ 1: 2, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 19: 1, 10: 1, 11: 1, 12: 1, 13: 1, 14: 1, 15: 1, 16: 1, 17: 1, 18: 1, 20: 1 }) },
  { seguimientoId: '73619', turno: 14, nombre: 'MONICA ALVAREZ RIOS', desayuno: 0, estatusValpac: 0, padecimientoId: 0, medicoInternista: null, paqueteId: 'DT0028', paqueteNombre: 'CHECK UP BASICO', edad: 39, peso: 0, talla: 0, fechaEntrega: null, horaEntrega: null, tarjetaEntRes: 0, tieneAdicionales: false, estudios: buildEstudiosFromLegacy({ 1: 2, 2: 2, 3: 2, 4: 2, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 19: 1, 10: 1, 11: 1, 12: 1, 13: 1, 14: 1, 15: 1, 16: 1, 17: 1, 18: 1, 20: 1 }) },
  { seguimientoId: '73620', turno: 15, nombre: 'MARIO LUIS PRADO BABAYAN', desayuno: 0, estatusValpac: 0, padecimientoId: 1, medicoInternista: null, paqueteId: 'DT0028', paqueteNombre: 'CHECK UP BASICO', edad: 58, peso: 0, talla: 0, fechaEntrega: null, horaEntrega: null, tarjetaEntRes: 0, tieneAdicionales: false, estudios: buildEstudiosFromLegacy({ 1: 2, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 19: 1, 10: 1, 11: 1, 12: 1, 13: 1, 14: 1, 15: 1, 16: 1, 17: 1, 18: 1, 20: 1 }) },
]

/* ═══════════════════════════════════════════════════════════════════════════
   FIRESTORE — enriquecer estudios_paciente
   ═══════════════════════════════════════════════════════════════════════════ */

interface EstudioPacienteFirestore {
  docId: string
  seguimientoId: string
  estudioId: string
  estatusEstudioId: string
  medicoId: string | null
  letraMedico: string | null
}

async function fetchEstudiosPacienteForSeguimientos(
  seguimientoIds: string[],
): Promise<EstudioPacienteFirestore[]> {
  if (seguimientoIds.length === 0) return []

  const db = getFirebaseFirestore()
  const results: EstudioPacienteFirestore[] = []

  // Firestore 'in' queries limited to 30 values
  const chunks: string[][] = []
  for (let i = 0; i < seguimientoIds.length; i += 30) {
    chunks.push(seguimientoIds.slice(i, i + 30))
  }

  for (const chunk of chunks) {
    const snap = await getDocs(
      query(
        collection(db, 'estudios_paciente'),
        where('seguimientoId', 'in', chunk),
        where('activo', '==', true),
      ),
    )
    for (const d of snap.docs) {
      const data = d.data()
      results.push({
        docId: d.id,
        seguimientoId: String(data.seguimientoId ?? ''),
        estudioId: String(data.estudioId ?? ''),
        estatusEstudioId: String(data.estatusEstudioId ?? '0'),
        medicoId: data.medicoId != null ? String(data.medicoId) : null,
        letraMedico:
          typeof data.letraMedico === 'string' && data.letraMedico.trim() !== ''
            ? data.letraMedico.trim()
            : null,
      })
    }
  }

  return results
}

function enrichPacientesWithFirestore(
  pacientes: PacienteListaDia[],
  estudiosPaciente: EstudioPacienteFirestore[],
): PacienteListaDia[] {
  if (estudiosPaciente.length === 0) return pacientes

  const bySegEstudio = new Map<string, EstudioPacienteFirestore>()
  for (const ep of estudiosPaciente) {
    bySegEstudio.set(`${ep.seguimientoId}:${ep.estudioId}`, ep)
  }

  return pacientes.map((pac) => {
    const estudios = { ...pac.estudios }
    let changed = false

    for (const [estudioKey, cell] of Object.entries(estudios)) {
      const ep = bySegEstudio.get(`${pac.seguimientoId}:${estudioKey}`)
      if (!ep) continue
      changed = true
      estudios[Number(estudioKey)] = {
        ...cell,
        estatusId: Number(ep.estatusEstudioId) || cell.estatusId,
        medicoId: ep.medicoId,
        letraMedico: ep.letraMedico,
        estudiosPacienteId: ep.docId,
      }
    }

    return changed ? { ...pac, estudios } : pac
  })
}

/* ═══════════════════════════════════════════════════════════════════════════
   FETCH (con fallback a mock)
   ═══════════════════════════════════════════════════════════════════════════ */

const API_BASE = import.meta.env.VITE_API_URL ?? ''

async function fetchListaDiaRaw(fecha: string): Promise<PacienteListaDia[]> {
  try {
    const user = getFirebaseAuth().currentUser
    const headers: HeadersInit = { 'Content-Type': 'application/json' }
    if (user) {
      const token = await user.getIdToken()
      headers.Authorization = `Bearer ${token}`
    }
    const res = await fetch(`${API_BASE}/api/lista-dia?fecha=${fecha}`, { headers })
    if (res.ok) {
      const data = (await res.json()) as Array<Omit<PacienteListaDia, 'estudios'> & { estudios: Record<number, number | EstudioCellState> }>
      return data.map((p) => ({
        ...p,
        estudios: normalizeEstudios(p.estudios),
      }))
    }
  } catch {
    // fallback
  }
  const hoy = formatDateMX(nowMX())
  if (fecha !== hoy) return []
  // Sin backend: reflejar los turnos cambiados en Registro de Pacientes
  const overrides = await fetchTurnoOverrides()
  return applyTurnoOverrides(PACIENTES_MOCK, overrides)
}

async function fetchListaDia(fecha: string): Promise<PacienteListaDia[]> {
  const pacientes = await fetchListaDiaRaw(fecha)
  if (pacientes.length === 0) return pacientes

  try {
    const seguimientoIds = pacientes.map((p) => p.seguimientoId)
    const estudiosPaciente = await fetchEstudiosPacienteForSeguimientos(seguimientoIds)
    return enrichPacientesWithFirestore(pacientes, estudiosPaciente)
  } catch {
    return pacientes
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   FIRESTORE — escribir estudios_paciente
   ═══════════════════════════════════════════════════════════════════════════ */

async function persistEstudioPaciente(input: UpdateEstudioPacienteInput): Promise<string | null> {
  const db = getFirebaseFirestore()
  const estudioIdStr = String(input.estudioId)
  const estatusStr = String(input.estatusEstudioId)

  const payload = {
    estatusEstudioId: estatusStr,
    medicoId: input.medicoId ?? null,
    letraMedico: input.letraMedico ?? null,
  }

  if (input.estudiosPacienteId) {
    await updateDoc(doc(db, 'estudios_paciente', input.estudiosPacienteId), payload)
    return input.estudiosPacienteId
  }

  const snap = await getDocs(
    query(
      collection(db, 'estudios_paciente'),
      where('seguimientoId', '==', input.seguimientoId),
      where('estudioId', '==', estudioIdStr),
      where('activo', '==', true),
    ),
  )

  if (!snap.empty) {
    const docId = snap.docs[0].id
    await updateDoc(doc(db, 'estudios_paciente', docId), payload)
    return docId
  }

  const ref = await addDoc(collection(db, 'estudios_paciente'), {
    seguimientoId: input.seguimientoId,
    estudioId: estudioIdStr,
    estatusEstudioId: estatusStr,
    medicoId: input.medicoId ?? null,
    letraMedico: input.letraMedico ?? null,
    activo: true,
  })
  return ref.id
}

/** Calcula el nuevo estado de celda al cambiar estatus (limpia letra si aplica). */
export function buildEstudioCellUpdate(
  prev: EstudioCellState | undefined,
  estatusId: number,
  medicoId?: string | null,
  letraMedico?: string | null,
): EstudioCellState {
  const keepLetter = ESTATUS_CON_LETRA.has(estatusId)
  return {
    estatusId,
    estudiosPacienteId: prev?.estudiosPacienteId ?? null,
    medicoId: keepLetter ? (medicoId ?? prev?.medicoId ?? null) : null,
    letraMedico: keepLetter ? (letraMedico ?? prev?.letraMedico ?? null) : null,
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   HOOK PRINCIPAL
   ═══════════════════════════════════════════════════════════════════════════ */

export function useListaDia(fecha: string) {
  return useQuery({
    queryKey: [...LISTA_DIA_QUERY_KEY, fecha],
    queryFn: () => fetchListaDia(fecha),
  })
}

/* ═══════════════════════════════════════════════════════════════════════════
   MUTACIONES OPTIMISTAS (actualizar cache local)
   ═══════════════════════════════════════════════════════════════════════════ */

/** Actualiza un paciente en el cache de lista-dia. */
export function useUpdatePacienteCache() {
  const qc = useQueryClient()

  return (fecha: string, seguimientoId: string, updates: Partial<PacienteListaDia>) => {
    qc.setQueryData<PacienteListaDia[]>(
      [...LISTA_DIA_QUERY_KEY, fecha],
      (old) => {
        if (!old) return old
        return old.map((p) =>
          p.seguimientoId === seguimientoId ? { ...p, ...updates } : p,
        )
      },
    )
  }
}

export function useUpdateEstudioPaciente(fecha: string) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: persistEstudioPaciente,
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: [...LISTA_DIA_QUERY_KEY, fecha] })
      const previous = qc.getQueryData<PacienteListaDia[]>([...LISTA_DIA_QUERY_KEY, fecha])

      qc.setQueryData<PacienteListaDia[]>(
        [...LISTA_DIA_QUERY_KEY, fecha],
        (old) => {
          if (!old) return old
          return old.map((p) => {
            if (p.seguimientoId !== input.seguimientoId) return p
            const prevCell = p.estudios[input.estudioId]
            const newCell = buildEstudioCellUpdate(
              prevCell,
              input.estatusEstudioId,
              input.medicoId,
              input.letraMedico,
            )
            return {
              ...p,
              estudios: { ...p.estudios, [input.estudioId]: newCell },
            }
          })
        },
      )

      return { previous }
    },
    onError: (_err, _input, context) => {
      if (context?.previous) {
        qc.setQueryData([...LISTA_DIA_QUERY_KEY, fecha], context.previous)
      }
    },
    onSuccess: (docId, input) => {
      if (!docId) return
      qc.setQueryData<PacienteListaDia[]>(
        [...LISTA_DIA_QUERY_KEY, fecha],
        (old) => {
          if (!old) return old
          return old.map((p) => {
            if (p.seguimientoId !== input.seguimientoId) return p
            const cell = p.estudios[input.estudioId]
            if (!cell) return p
            return {
              ...p,
              estudios: {
                ...p.estudios,
                [input.estudioId]: { ...cell, estudiosPacienteId: docId },
              },
            }
          })
        },
      )
    },
  })
}
