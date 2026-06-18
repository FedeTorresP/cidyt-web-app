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
import { getFirebaseFirestore } from '@/lib/firebase'
import type { MedicoLugarDia } from '@/types/models'

// ─── Query: asignaciones del día ─────────────────────────────────────────────

export interface AsignacionDia extends MedicoLugarDia {
  medicoNombre: string
  lugarNombre: string
  horarioNombre: string
}

async function fetchAsignacionesDia(fecha: string): Promise<AsignacionDia[]> {
  const db = getFirebaseFirestore()

  // Obtener asignaciones activas para la fecha
  const asignacionesQuery = query(
    collection(db, 'medico_lugar_dia'),
    where('fecha', '==', fecha),
    where('activo', '==', true),
  )
  const snapshot = await getDocs(asignacionesQuery)

  if (snapshot.empty) return []

  // Obtener catálogos para resolver nombres
  const [medicosSnap, lugaresSnap, horariosSnap] = await Promise.all([
    getDocs(collection(db, 'medicos')),
    getDocs(collection(db, 'lugares')),
    getDocs(collection(db, 'horarios')),
  ])

  const medicosMap = new Map<string, string>()
  medicosSnap.docs.forEach((d) => {
    medicosMap.set(d.id, d.data().nombreCompleto ?? `Médico #${d.id}`)
  })

  const lugaresMap = new Map<string, string>()
  lugaresSnap.docs.forEach((d) => {
    lugaresMap.set(d.id, d.data().nombre ?? `Lugar #${d.id}`)
  })

  const horariosMap = new Map<string, string>()
  horariosSnap.docs.forEach((d) => {
    horariosMap.set(d.id, d.data().nombre ?? `Horario #${d.id}`)
  })

  const asignaciones: AsignacionDia[] = snapshot.docs.map((d) => {
    const data = d.data()
    return {
      id: d.id,
      medicoId: data.medicoId,
      lugarId: data.lugarId,
      horarioId: data.horarioId,
      fecha: data.fecha,
      activo: data.activo,
      creadoPor: data.creadoPor,
      fechaCreacion: data.fechaCreacion?.toDate?.() ?? undefined,
      medicoNombre: medicosMap.get(data.medicoId) ?? `Médico #${data.medicoId}`,
      lugarNombre: lugaresMap.get(data.lugarId) ?? `Lugar #${data.lugarId}`,
      horarioNombre: horariosMap.get(data.horarioId) ?? `Horario #${data.horarioId}`,
    }
  })

  // Ordenar por nombre del médico
  asignaciones.sort((a, b) => a.medicoNombre.localeCompare(b.medicoNombre))

  return asignaciones
}

export function useMedicoDiaAsignaciones(fecha: string) {
  return useQuery({
    queryKey: ['medico-lugar-dia', fecha],
    queryFn: () => fetchAsignacionesDia(fecha),
    enabled: !!fecha,
  })
}

// ─── Mutation: crear asignación ──────────────────────────────────────────────

export interface CrearAsignacionInput {
  medicoId: string
  lugarId: string
  horarioId: string
  fecha: string
  creadoPor: string
}

async function crearAsignacion(input: CrearAsignacionInput): Promise<void> {
  const db = getFirebaseFirestore()

  // Verificar duplicado: misma combinación medicoId + fecha + horarioId + activo
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
    lugarId: input.lugarId,
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
