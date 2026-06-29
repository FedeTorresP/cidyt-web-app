import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addDoc,
  collection,
  getDocs,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore'
import { getFirebaseAuth, getFirebaseFirestore } from '@/lib/firebase'

/* ═══════════════════════════════════════════════════════════════════════════
   TIPOS
   ═══════════════════════════════════════════════════════════════════════════ */

/** Áreas disponibles para estudios externos (sin cita). */
export const AREAS_EXTERNAS = [
  { id: 'LAB', nombre: 'Laboratorio' },
  { id: 'IMG', nombre: 'Imagen' },
  { id: 'CARDIO', nombre: 'Cardiología' },
  { id: 'OTRO', nombre: 'Otro' },
] as const

export interface EstudioExternoPayload {
  fecha: string // YYYY-MM-DD
  nombre_paciente: string
  area: string
  nombre_estudio: string
  observaciones?: string
}

export interface EstudioExterno {
  id: string
  fecha: string
  nombrePaciente: string
  area: string
  nombreEstudio: string
  observaciones: string
  createdBy: string | null
}

const COLLECTION = 'estudios_externos'
const QUERY_KEY = ['estudios-externos']

/* ═══════════════════════════════════════════════════════════════════════════
   FETCH — listado por fecha (Firestore directo)
   ═══════════════════════════════════════════════════════════════════════════ */

async function fetchEstudiosExternos(fecha: string): Promise<EstudioExterno[]> {
  const db = getFirebaseFirestore()
  const snap = await getDocs(
    query(
      collection(db, COLLECTION),
      where('fecha', '==', fecha),
      where('activo', '==', true),
    ),
  )
  const items = snap.docs.map((d) => {
    const data = d.data()
    return {
      id: d.id,
      fecha: String(data.fecha ?? ''),
      nombrePaciente: String(data.nombrePaciente ?? ''),
      area: String(data.area ?? ''),
      nombreEstudio: String(data.nombreEstudio ?? ''),
      observaciones: String(data.observaciones ?? ''),
      createdBy: data.createdBy != null ? String(data.createdBy) : null,
    }
  })
  // Orden alfabético por nombre de paciente
  items.sort((a, b) => a.nombrePaciente.localeCompare(b.nombrePaciente, 'es'))
  return items
}

export function useEstudiosExternos(fecha: string) {
  return useQuery({
    queryKey: [...QUERY_KEY, fecha],
    queryFn: () => fetchEstudiosExternos(fecha),
  })
}

/* ═══════════════════════════════════════════════════════════════════════════
   MUTATION — registrar (Firestore directo)
   ═══════════════════════════════════════════════════════════════════════════ */

export function useRegistrarEstudioExterno() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (data: EstudioExternoPayload) => {
      const db = getFirebaseFirestore()
      const user = getFirebaseAuth().currentUser
      const ref = await addDoc(collection(db, COLLECTION), {
        fecha: data.fecha,
        nombrePaciente: data.nombre_paciente.trim().toUpperCase(),
        area: data.area,
        nombreEstudio: data.nombre_estudio.trim(),
        observaciones: data.observaciones?.trim() ?? '',
        activo: true,
        createdBy: user?.email ?? user?.uid ?? null,
        createdAt: serverTimestamp(),
      })
      return ref.id
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY })
    },
  })
}
