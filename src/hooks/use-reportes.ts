import { useQuery } from '@tanstack/react-query'
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  getDoc,
  Timestamp,
} from 'firebase/firestore'
import { getFirebaseFirestore } from '@/lib/firebase'

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface FilaCheckup {
  seguimientoId: string
  pacienteNombre: string
  fechaIngresoLocal: Date
  estatusSeguimientoNombre: string
  totalEstudios: number
}

export interface FilaEstadistica {
  estudioNombre: string
  estudioTipoNombre: string | null
  total: number
}

export interface FilaGeneral {
  seguimientoId: string
  pacienteNombre: string
  fechaIngresoLocal: Date
  estatusSeguimientoNombre: string
  empresaNombre: string | null
  estudios: string
}

export interface RangoUtc {
  startUtc: Date
  endUtc: Date
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildPacienteNombre(data: Record<string, unknown>): string {
  const parts: string[] = []
  if (data.nombre1) parts.push(String(data.nombre1))
  if (data.nombre2) parts.push(String(data.nombre2))
  if (data.apePaterno) parts.push(String(data.apePaterno))
  if (data.apeMaterno) parts.push(String(data.apeMaterno))
  return parts.join(' ')
}

// ─── Fetchers ────────────────────────────────────────────────────────────────

async function fetchReporteCheckup(rango: RangoUtc): Promise<FilaCheckup[]> {
  const db = getFirebaseFirestore()
  const segQuery = query(
    collection(db, 'seguimientos'),
    where('activo', '==', true),
    where('fechaIngresoUtc', '>=', Timestamp.fromDate(rango.startUtc)),
    where('fechaIngresoUtc', '<=', Timestamp.fromDate(rango.endUtc)),
    orderBy('fechaIngresoUtc', 'asc'),
  )
  const snapshot = await getDocs(segQuery)

  return Promise.all(
    snapshot.docs.map(async (d) => {
      const data = d.data()

      let pacienteNombre = ''
      if (data.pacienteId) {
        const pacDoc = await getDoc(doc(db, 'pacientes', data.pacienteId))
        if (pacDoc.exists()) {
          pacienteNombre = buildPacienteNombre(pacDoc.data()!)
        }
      }

      const estudiosSnap = await getDocs(
        query(
          collection(db, 'estudios_paciente'),
          where('seguimientoId', '==', d.id),
          where('activo', '==', true),
        ),
      )

      return {
        seguimientoId: d.id,
        pacienteNombre,
        fechaIngresoLocal: data.fechaIngresoUtc?.toDate?.() ?? new Date(),
        estatusSeguimientoNombre: data.estatusSeguimiento ?? '',
        totalEstudios: estudiosSnap.size,
      }
    }),
  )
}

async function fetchReporteGeneral(rango: RangoUtc): Promise<FilaGeneral[]> {
  const db = getFirebaseFirestore()
  const segQuery = query(
    collection(db, 'seguimientos'),
    where('activo', '==', true),
    where('fechaIngresoUtc', '>=', Timestamp.fromDate(rango.startUtc)),
    where('fechaIngresoUtc', '<=', Timestamp.fromDate(rango.endUtc)),
    orderBy('fechaIngresoUtc', 'asc'),
  )
  const snapshot = await getDocs(segQuery)

  return Promise.all(
    snapshot.docs.map(async (d) => {
      const data = d.data()

      let pacienteNombre = ''
      if (data.pacienteId) {
        const pacDoc = await getDoc(doc(db, 'pacientes', data.pacienteId))
        if (pacDoc.exists()) {
          pacienteNombre = buildPacienteNombre(pacDoc.data()!)
        }
      }

      let empresaNombre: string | null = null
      if (data.empresaId) {
        const empDoc = await getDoc(doc(db, 'empresas', data.empresaId))
        if (empDoc.exists()) {
          empresaNombre = (empDoc.data()?.nombre as string) ?? null
        }
      }

      const epSnap = await getDocs(
        query(
          collection(db, 'estudios_paciente'),
          where('seguimientoId', '==', d.id),
          where('activo', '==', true),
        ),
      )

      const estudioNames: string[] = []
      for (const epDoc of epSnap.docs) {
        const epData = epDoc.data()
        if (epData.estudioId) {
          const estDoc = await getDoc(doc(db, 'estudios', epData.estudioId))
          if (estDoc.exists()) {
            estudioNames.push((estDoc.data()?.nombre as string) ?? '')
          }
        }
      }
      estudioNames.sort()

      return {
        seguimientoId: d.id,
        pacienteNombre,
        fechaIngresoLocal: data.fechaIngresoUtc?.toDate?.() ?? new Date(),
        estatusSeguimientoNombre: data.estatusSeguimiento ?? '',
        empresaNombre,
        estudios: estudioNames.join(', '),
      }
    }),
  )
}

async function fetchReporteEstadistica(rango: RangoUtc): Promise<FilaEstadistica[]> {
  const db = getFirebaseFirestore()

  const segSnap = await getDocs(
    query(
      collection(db, 'seguimientos'),
      where('activo', '==', true),
      where('fechaIngresoUtc', '>=', Timestamp.fromDate(rango.startUtc)),
      where('fechaIngresoUtc', '<=', Timestamp.fromDate(rango.endUtc)),
    ),
  )

  const seguimientoIds = segSnap.docs.map((d) => d.id)
  if (seguimientoIds.length === 0) return []

  const allEstudiosPaciente: Array<{ estudioId: string; estudioTipoId: string | null }> = []

  for (let i = 0; i < seguimientoIds.length; i += 30) {
    const batch = seguimientoIds.slice(i, i + 30)
    const epSnap = await getDocs(
      query(
        collection(db, 'estudios_paciente'),
        where('seguimientoId', 'in', batch),
        where('activo', '==', true),
      ),
    )
    for (const d of epSnap.docs) {
      const epData = d.data()
      allEstudiosPaciente.push({
        estudioId: epData.estudioId ?? '',
        estudioTipoId: epData.estudioTipoId ?? null,
      })
    }
  }

  const countMap = new Map<string, { estudioTipoId: string | null; count: number }>()
  for (const ep of allEstudiosPaciente) {
    const existing = countMap.get(ep.estudioId)
    if (existing) {
      existing.count += 1
    } else {
      countMap.set(ep.estudioId, { estudioTipoId: ep.estudioTipoId, count: 1 })
    }
  }

  const results: FilaEstadistica[] = []
  for (const [estudioId, { estudioTipoId, count }] of countMap.entries()) {
    let estudioNombre = estudioId
    let estudioTipoNombre: string | null = null

    const estDoc = await getDoc(doc(db, 'estudios', estudioId))
    if (estDoc.exists()) {
      estudioNombre = (estDoc.data()?.nombre as string) ?? estudioId
    }

    if (estudioTipoId) {
      const tipoDoc = await getDoc(doc(db, 'estudio_tipos', estudioTipoId))
      if (tipoDoc.exists()) {
        estudioTipoNombre = (tipoDoc.data()?.nombre as string) ?? null
      }
    }

    results.push({ estudioNombre, estudioTipoNombre, total: count })
  }

  results.sort((a, b) => b.total - a.total)
  return results
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

export function useReporteCheckup(rango: RangoUtc | null) {
  return useQuery({
    queryKey: ['reporte-checkup', rango?.startUtc.toISOString(), rango?.endUtc.toISOString()],
    queryFn: () => fetchReporteCheckup(rango!),
    enabled: !!rango,
  })
}

export function useReporteGeneral(rango: RangoUtc | null) {
  return useQuery({
    queryKey: ['reporte-general', rango?.startUtc.toISOString(), rango?.endUtc.toISOString()],
    queryFn: () => fetchReporteGeneral(rango!),
    enabled: !!rango,
  })
}

export function useReporteEstadistica(rango: RangoUtc | null) {
  return useQuery({
    queryKey: ['reporte-estadistica', rango?.startUtc.toISOString(), rango?.endUtc.toISOString()],
    queryFn: () => fetchReporteEstadistica(rango!),
    enabled: !!rango,
  })
}
