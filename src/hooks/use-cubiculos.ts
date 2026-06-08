import { useQuery } from '@tanstack/react-query'
import {
  collection,
  query,
  orderBy,
  getDocs,
  doc,
  getDoc,
} from 'firebase/firestore'
import { getFirebaseFirestore } from '@/lib/firebase'

export interface CubiculoConEstado {
  id: string
  nombre: string | null
  descripcion: string | null
  entidadNombre: string | null
  estatusNombre: string
  ordenMostrar: number | null
}

export interface SesionCubiculoConNombres {
  id: string
  cubiculoId: string
  cubiculoNombre: string | null
  medicoId: string
  medicoNombreCompleto: string | null
  estatusCubiculoMedicoId: string
  estatusNombre: string
  createdAt: Date
}

async function fetchCubiculos(): Promise<CubiculoConEstado[]> {
  const db = getFirebaseFirestore()
  const cubiculosQuery = query(
    collection(db, 'cubiculos'),
    orderBy('ordenMostrar', 'asc'),
  )
  const snapshot = await getDocs(cubiculosQuery)
  if (snapshot.empty) return []

  // Resolver nombres de entidad
  const entidadIds = new Set<string>()
  for (const d of snapshot.docs) {
    const data = d.data()
    if (data.entidadId) entidadIds.add(data.entidadId)
  }

  const entidadMap = new Map<string, string | null>()
  await Promise.all(
    Array.from(entidadIds).map(async (entidadId) => {
      const entidadDoc = await getDoc(doc(db, 'entidades', entidadId))
      entidadMap.set(entidadId, entidadDoc.exists() ? (entidadDoc.data()?.nombre ?? null) : null)
    }),
  )

  return snapshot.docs.map((d) => {
    const data = d.data()
    return {
      id: d.id,
      nombre: data.nombre ?? null,
      descripcion: data.descripcion ?? null,
      entidadNombre: data.entidadId ? (entidadMap.get(data.entidadId) ?? null) : null,
      estatusNombre: data.estatusCubiculo ?? 'Desconocido',
      ordenMostrar: data.ordenMostrar ?? null,
    }
  })
}

async function fetchSesionesCubiculo(): Promise<SesionCubiculoConNombres[]> {
  const db = getFirebaseFirestore()
  const sesionesQuery = query(
    collection(db, 'sesiones_cubiculo'),
    orderBy('createdAt', 'asc'),
  )
  const snapshot = await getDocs(sesionesQuery)
  if (snapshot.empty) return []

  const cubiculoIds = new Set<string>()
  const medicoIds = new Set<string>()
  const estatusIds = new Set<string>()

  for (const d of snapshot.docs) {
    const data = d.data()
    if (data.cubiculoId) cubiculoIds.add(data.cubiculoId)
    if (data.medicoId) medicoIds.add(data.medicoId)
    if (data.estatusCubiculoMedicoId) estatusIds.add(data.estatusCubiculoMedicoId)
  }

  const cubiculoMap = new Map<string, string | null>()
  const medicoMap = new Map<string, string | null>()
  const estatusMap = new Map<string, string>()

  await Promise.all([
    ...Array.from(cubiculoIds).map(async (id) => {
      const d = await getDoc(doc(db, 'cubiculos', id))
      cubiculoMap.set(id, d.exists() ? (d.data()?.nombre ?? null) : null)
    }),
    ...Array.from(medicoIds).map(async (id) => {
      const d = await getDoc(doc(db, 'medicos', id))
      medicoMap.set(id, d.exists() ? (d.data()?.nombreCompleto ?? null) : null)
    }),
    ...Array.from(estatusIds).map(async (id) => {
      const d = await getDoc(doc(db, 'estatus_cubiculo_medico', id))
      estatusMap.set(id, d.exists() ? (d.data()?.nombre ?? 'Desconocido') : 'Desconocido')
    }),
  ])

  return snapshot.docs.map((d) => {
    const data = d.data()
    return {
      id: d.id,
      cubiculoId: data.cubiculoId ?? '',
      cubiculoNombre: data.cubiculoId ? (cubiculoMap.get(data.cubiculoId) ?? null) : null,
      medicoId: data.medicoId ?? '',
      medicoNombreCompleto: data.medicoId ? (medicoMap.get(data.medicoId) ?? null) : null,
      estatusCubiculoMedicoId: data.estatusCubiculoMedicoId ?? '',
      estatusNombre: data.estatusCubiculoMedicoId
        ? (estatusMap.get(data.estatusCubiculoMedicoId) ?? 'Desconocido')
        : 'Desconocido',
      createdAt: data.createdAt?.toDate?.() ?? new Date(),
    }
  })
}

export function useCubiculos() {
  return useQuery({
    queryKey: ['cubiculos'],
    queryFn: fetchCubiculos,
  })
}

export function useSesionesCubiculo() {
  return useQuery({
    queryKey: ['sesiones-cubiculo'],
    queryFn: fetchSesionesCubiculo,
  })
}
