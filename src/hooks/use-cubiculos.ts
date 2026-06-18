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


/* ═══════════════════════════════════════════════════════════════════════════
   DASHBOARD — Lista de Cubículos (polling API, full-screen dark)
   ═══════════════════════════════════════════════════════════════════════════ */

import { getFirebaseAuth } from '@/lib/firebase'

export interface CubiculoItem {
  cubiculoId: number
  nombre: string
  ordenMostrar: number
  medicoId: number | null
  medicoNombre: string | null    // Solo apellido paterno, max 11 chars
  estatusId: number | null       // 1=Disponible, 2=Ocupado, 3=Terminado, 4=Conectado, 5=Inactivo
  estatusNombre: string | null
  fechaCrea: string | null       // ISO timestamp del inicio de sesión
  minTranscurridos: number | null
}

const API_BASE = import.meta.env.VITE_API_URL ?? ''

async function fetchCubiculosListado(): Promise<CubiculoItem[]> {
  try {
    const headers: HeadersInit = { 'Content-Type': 'application/json' }
    const user = getFirebaseAuth().currentUser
    if (user) {
      const token = await user.getIdToken()
      headers.Authorization = `Bearer ${token}`
    }
    const res = await fetch(`${API_BASE}/api/cubiculo/listado`, { headers })
    if (res.ok) return await res.json()
  } catch {
    // fallback to mock
  }
  return MOCK_CUBICULOS_LISTADO
}

export function useCubiculosListado() {
  return useQuery({
    queryKey: ['cubiculos-listado'],
    queryFn: fetchCubiculosListado,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  })
}

/* ═══════════════════════════════════════════════════════════════════════════
   MOCK — 21 cubículos con estados variados
   ═══════════════════════════════════════════════════════════════════════════ */

const MOCK_CUBICULOS_LISTADO: CubiculoItem[] = [
  { cubiculoId: 1, nombre: 'Consultorio 1', ordenMostrar: 1, medicoId: null, medicoNombre: null, estatusId: 1, estatusNombre: 'Disponible', fechaCrea: null, minTranscurridos: null },
  { cubiculoId: 2, nombre: 'Consultorio 2', ordenMostrar: 2, medicoId: 102, medicoNombre: 'SANCHEZ', estatusId: 2, estatusNombre: 'Ocupado', fechaCrea: '2026-06-17T13:47:00Z', minTranscurridos: 30 },
  { cubiculoId: 3, nombre: 'Consultorio 3', ordenMostrar: 3, medicoId: null, medicoNombre: null, estatusId: 1, estatusNombre: 'Disponible', fechaCrea: null, minTranscurridos: null },
  { cubiculoId: 4, nombre: 'Consultorio 4', ordenMostrar: 4, medicoId: 103, medicoNombre: 'TORRES', estatusId: 2, estatusNombre: 'Ocupado', fechaCrea: '2026-06-17T13:37:00Z', minTranscurridos: 40 },
  { cubiculoId: 6, nombre: 'Consultorio 6', ordenMostrar: 5, medicoId: null, medicoNombre: null, estatusId: 1, estatusNombre: 'Disponible', fechaCrea: null, minTranscurridos: null },
  { cubiculoId: 7, nombre: 'Consultorio 7', ordenMostrar: 6, medicoId: 104, medicoNombre: 'RUIZ', estatusId: 2, estatusNombre: 'Ocupado', fechaCrea: '2026-06-17T14:07:00Z', minTranscurridos: 10 },
  { cubiculoId: 8, nombre: 'Consultorio 8 | Ortopedia', ordenMostrar: 7, medicoId: 101, medicoNombre: 'HOYO', estatusId: 2, estatusNombre: 'Ocupado', fechaCrea: '2026-06-17T14:12:00Z', minTranscurridos: 5 },
  { cubiculoId: 10, nombre: 'Consultorio 10', ordenMostrar: 8, medicoId: null, medicoNombre: null, estatusId: 1, estatusNombre: 'Disponible', fechaCrea: null, minTranscurridos: null },
  { cubiculoId: 11, nombre: 'Consultorio 11 | Ortopedia', ordenMostrar: 9, medicoId: null, medicoNombre: null, estatusId: 1, estatusNombre: 'Disponible', fechaCrea: null, minTranscurridos: null },
  { cubiculoId: 12, nombre: 'Consultorio 12', ordenMostrar: 10, medicoId: 106, medicoNombre: 'MENDEZ', estatusId: 2, estatusNombre: 'Ocupado', fechaCrea: '2026-06-17T13:42:00Z', minTranscurridos: 35 },
  { cubiculoId: 14, nombre: 'Consultorio 14', ordenMostrar: 11, medicoId: null, medicoNombre: null, estatusId: 1, estatusNombre: 'Disponible', fechaCrea: null, minTranscurridos: null },
  { cubiculoId: 15, nombre: 'A. Mayor', ordenMostrar: 12, medicoId: null, medicoNombre: null, estatusId: 1, estatusNombre: 'Disponible', fechaCrea: null, minTranscurridos: null },
  { cubiculoId: 16, nombre: 'Oftalmología 1', ordenMostrar: 13, medicoId: 107, medicoNombre: 'VEGA', estatusId: 2, estatusNombre: 'Ocupado', fechaCrea: '2026-06-17T14:02:00Z', minTranscurridos: 15 },
  { cubiculoId: 17, nombre: 'Oftalmología 2', ordenMostrar: 14, medicoId: null, medicoNombre: null, estatusId: 1, estatusNombre: 'Disponible', fechaCrea: null, minTranscurridos: null },
  { cubiculoId: 18, nombre: 'Dental', ordenMostrar: 15, medicoId: 105, medicoNombre: 'GARCIA', estatusId: 2, estatusNombre: 'Ocupado', fechaCrea: '2026-06-17T14:12:00Z', minTranscurridos: 0 },
  { cubiculoId: 19, nombre: 'Audiometría 1', ordenMostrar: 16, medicoId: 108, medicoNombre: 'AYALA', estatusId: 2, estatusNombre: 'Ocupado', fechaCrea: '2026-06-17T13:52:00Z', minTranscurridos: 25 },
  { cubiculoId: 20, nombre: 'Audiometría 2', ordenMostrar: 17, medicoId: null, medicoNombre: null, estatusId: 1, estatusNombre: 'Disponible', fechaCrea: null, minTranscurridos: null },
  { cubiculoId: 21, nombre: 'Nutrición 1', ordenMostrar: 18, medicoId: null, medicoNombre: null, estatusId: 1, estatusNombre: 'Disponible', fechaCrea: null, minTranscurridos: null },
  { cubiculoId: 22, nombre: 'Nutrición 2', ordenMostrar: 19, medicoId: 109, medicoNombre: 'LOPEZ', estatusId: 2, estatusNombre: 'Ocupado', fechaCrea: '2026-06-17T13:57:00Z', minTranscurridos: 20 },
  { cubiculoId: 23, nombre: 'Ginecología', ordenMostrar: 20, medicoId: null, medicoNombre: null, estatusId: 1, estatusNombre: 'Disponible', fechaCrea: null, minTranscurridos: null },
]
