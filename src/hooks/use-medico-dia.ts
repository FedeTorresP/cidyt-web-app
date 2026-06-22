import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  Timestamp,
} from 'firebase/firestore'
import { useAuth } from '@/hooks/use-auth'
import { getFirebaseFirestore } from '@/lib/firebase'
import type { MedicoLugarDia } from '@/types/models'

// ─── Query: asignaciones del día ─────────────────────────────────────────────

export interface AsignacionDia extends MedicoLugarDia {
  medicoNombre: string
  medicoLetra: string | null
  lugarNombre: string
  horarioNombre: string
}

function readLugarEstudioId(data: Record<string, unknown>): string {
  const canonical = data.lugarEstudioId
  if (typeof canonical === 'string' && canonical !== '') return canonical
  const legacy = data.lugarId
  if (typeof legacy === 'string' && legacy !== '') return legacy
  return ''
}

async function fetchAsignacionesDia(fecha: string): Promise<AsignacionDia[]> {
  const db = getFirebaseFirestore()

  const asignacionesQuery = query(
    collection(db, 'medico_lugar_dia'),
    where('fecha', '==', fecha),
    where('activo', '==', true),
  )
  const snapshot = await getDocs(asignacionesQuery)

  if (snapshot.empty) return []

  const [medicosSnap, lugaresSnap, horariosSnap] = await Promise.all([
    getDocs(collection(db, 'medicos')),
    getDocs(collection(db, 'lugar_estudio')),
    getDocs(collection(db, 'horarios')),
  ])

  const medicosMap = new Map<string, { nombre: string; letra: string | null }>()
  medicosSnap.docs.forEach((d) => {
    const data = d.data()
    const letraRaw = data.letra
    medicosMap.set(d.id, {
      nombre: data.nombreCompleto ?? `Médico #${d.id}`,
      letra: typeof letraRaw === 'string' && letraRaw.trim() !== '' ? letraRaw.trim() : null,
    })
  })

  const lugaresMap = new Map<string, string>()
  lugaresSnap.docs.forEach((d) => {
    lugaresMap.set(d.id, d.data().nombre ?? `Área #${d.id}`)
  })

  const horariosMap = new Map<string, string>()
  horariosSnap.docs.forEach((d) => {
    horariosMap.set(d.id, d.data().nombre ?? `Horario #${d.id}`)
  })

  const asignaciones: AsignacionDia[] = snapshot.docs.map((d) => {
    const data = d.data()
    const lugarEstudioId = readLugarEstudioId(data)
    const medico = medicosMap.get(String(data.medicoId))
    return {
      id: d.id,
      medicoId: String(data.medicoId),
      lugarEstudioId,
      horarioId: String(data.horarioId),
      fecha: String(data.fecha),
      activo: data.activo === true,
      creadoPor: data.creadoPor,
      fechaCreacion: data.fechaCreacion?.toDate?.() ?? undefined,
      medicoNombre: medico?.nombre ?? `Médico #${data.medicoId}`,
      medicoLetra: medico?.letra ?? null,
      lugarNombre: lugaresMap.get(lugarEstudioId) ?? `Área #${lugarEstudioId}`,
      horarioNombre: horariosMap.get(String(data.horarioId)) ?? `Horario #${data.horarioId}`,
    }
  })

  asignaciones.sort((a, b) => a.medicoNombre.localeCompare(b.medicoNombre))

  return asignaciones
}

export function useMedicoDiaAsignaciones(fecha: string) {
  const { user, loading: authLoading } = useAuth()

  return useQuery({
    queryKey: ['medico-lugar-dia', fecha],
    queryFn: () => fetchAsignacionesDia(fecha),
    enabled: !!fecha && !!user && !authLoading,
  })
}

// ─── Mutation: crear asignación ──────────────────────────────────────────────

export interface CrearAsignacionInput {
  medicoId: string
  lugarEstudioId: string
  horarioId: string
  fecha: string
  creadoPor: string
}

async function crearAsignacion(input: CrearAsignacionInput): Promise<void> {
  const db = getFirebaseFirestore()

  const duplicadoQuery = query(
    collection(db, 'medico_lugar_dia'),
    where('medicoId', '==', input.medicoId),
    where('fecha', '==', input.fecha),
    where('horarioId', '==', input.horarioId),
    where('activo', '==', true),
  )
  const duplicadoSnap = await getDocs(duplicadoQuery)

  if (!duplicadoSnap.empty) {
    throw new Error('La asignación ya existe para esa fecha y horario.')
  }

  await addDoc(collection(db, 'medico_lugar_dia'), {
    medicoId: input.medicoId,
    lugarEstudioId: input.lugarEstudioId,
    horarioId: input.horarioId,
    fecha: input.fecha,
    activo: true,
    creadoPor: input.creadoPor,
    fechaCreacion: Timestamp.now(),
  })
}

export function useCrearAsignacion() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: crearAsignacion,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['medico-lugar-dia', variables.fecha],
      })
    },
  })
}

// ─── Mutation: eliminar asignación (borrado lógico) ──────────────────────────

async function eliminarAsignacion(asignacionId: string): Promise<void> {
  const db = getFirebaseFirestore()
  const docRef = doc(db, 'medico_lugar_dia', asignacionId)
  await updateDoc(docRef, { activo: false })
}

export function useEliminarAsignacion() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: eliminarAsignacion,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['medico-lugar-dia'],
      })
    },
  })
}

/** Médico IDs con asistencia registrada para un área en una fecha. */
export function buildMedicosPresentesPorLugar(
  asignaciones: AsignacionDia[],
): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const asig of asignaciones) {
    if (!asig.activo || !asig.lugarEstudioId) continue
    const list = map.get(asig.lugarEstudioId) ?? []
    list.push(asig.medicoId)
    map.set(asig.lugarEstudioId, list)
  }
  return map
}
