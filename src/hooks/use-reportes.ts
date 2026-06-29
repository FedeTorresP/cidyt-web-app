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
            // Usar nombre corto (abreviatura) cuando exista
            const ed = estDoc.data()
            estudioNames.push((ed?.abreviatura as string) ?? (ed?.nombre as string) ?? '')
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
      // Usar nombre corto (abreviatura) cuando exista
      const ed = estDoc.data()
      estudioNombre = (ed?.abreviatura as string) ?? (ed?.nombre as string) ?? estudioId
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

// ─── Reporte de Caja (placeholder) ───────────────────────────────────────────

export interface FilaCaja {
  pacienteNombre: string
  empresa: string | null
  folio: string | null
  total: number
  fechaRegistro: Date
}

/**
 * Placeholder — consulta seguimientos y devuelve datos mínimos con formato de caja.
 * Se reemplazará cuando exista la colección real de facturación/caja en Firestore.
 */
async function fetchReporteCaja(rango: RangoUtc): Promise<FilaCaja[]> {
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

      return {
        pacienteNombre,
        empresa: empresaNombre,
        folio: data.folio ?? null,
        total: data.total ?? 0,
        fechaRegistro: data.fechaIngresoUtc?.toDate?.() ?? new Date(),
      }
    }),
  )
}

// ─── Reporte: Consultas por especialista ─────────────────────────────────────

export interface FilaConsultasEspecialista {
  letra: string
  medicoNombre: string | null
  total: number
}

/**
 * Cuenta los estudios COMPLETADOS (estatus 4) agrupados por la letra del médico,
 * dentro del rango de fechas (unión estudios_paciente → seguimientos).
 */
async function fetchReporteConsultasEspecialista(
  rango: RangoUtc,
): Promise<FilaConsultasEspecialista[]> {
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

  // Mapa letra → nombre del médico
  const medSnap = await getDocs(collection(db, 'medicos'))
  const letraToNombre = new Map<string, string>()
  for (const m of medSnap.docs) {
    const data = m.data()
    const letra = typeof data.letra === 'string' ? data.letra.trim() : ''
    if (letra) letraToNombre.set(letra, (data.nombreCompleto as string) ?? '')
  }

  const countByLetra = new Map<string, number>()
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
      const data = d.data()
      if (Number(data.estatusEstudioId) !== 4) continue
      const letra = typeof data.letraMedico === 'string' ? data.letraMedico.trim() : ''
      if (!letra) continue
      countByLetra.set(letra, (countByLetra.get(letra) ?? 0) + 1)
    }
  }

  const results: FilaConsultasEspecialista[] = [...countByLetra.entries()].map(
    ([letra, total]) => ({ letra, medicoNombre: letraToNombre.get(letra) ?? null, total }),
  )
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

export function useReporteCaja(rango: RangoUtc | null) {
  return useQuery({
    queryKey: ['reporte-caja', rango?.startUtc.toISOString(), rango?.endUtc.toISOString()],
    queryFn: () => fetchReporteCaja(rango!),
    enabled: !!rango,
  })
}

export function useReporteConsultasEspecialista(rango: RangoUtc | null) {
  return useQuery({
    queryKey: ['reporte-consultas-especialista', rango?.startUtc.toISOString(), rango?.endUtc.toISOString()],
    queryFn: () => fetchReporteConsultasEspecialista(rango!),
    enabled: !!rango,
  })
}

// ─── Funciones de fetch directas (para uso imperativo en la página) ──────────

export {
  fetchReporteCheckup,
  fetchReporteGeneral,
  fetchReporteEstadistica,
  fetchReporteCaja,
  fetchReporteConsultasEspecialista,
}
