import {
  Timestamp,
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore'
import { getFirebaseAuth, getFirebaseFirestore } from '@/lib/firebase'
import { dayRangeMX, formatDateMX } from '@/lib/timezone'

/**
 * Acceso a datos operacionales de pacientes sobre Firestore (sin SAP / sin REST).
 * Fuente de verdad: colecciones `seguimientos`, `pacientes`, `paquetes`,
 * `medicos`, `val_corporal` y `estudios_paciente`.
 */

/** IDs de las 20 columnas de estudio (mismo orden que Lista del Día / Caja). */
export const ESTUDIO_COL_IDS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 19, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20,
] as const

/** Estudio adicional: doc id en catálogo `estudios`. */
export const ESTUDIO_ADICIONAL_ID = '100'

/* ═══════════════════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */

export function buildPacienteNombre(data: DocumentData | undefined): string {
  if (!data) return ''
  const parts: string[] = []
  if (data.nombre1) parts.push(String(data.nombre1))
  if (data.nombre2) parts.push(String(data.nombre2))
  if (data.apePaterno) parts.push(String(data.apePaterno))
  if (data.apeMaterno) parts.push(String(data.apeMaterno))
  return parts.join(' ')
}

/** Calcula la edad en años a partir de un Timestamp de nacimiento. */
export function calcEdad(fechaNacimiento: unknown): number | null {
  const d =
    fechaNacimiento instanceof Timestamp
      ? fechaNacimiento.toDate()
      : fechaNacimiento instanceof Date
        ? fechaNacimiento
        : null
  if (!d || Number.isNaN(d.getTime())) return null
  const hoy = new Date()
  let edad = hoy.getFullYear() - d.getFullYear()
  const m = hoy.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && hoy.getDate() < d.getDate())) edad--
  return edad >= 0 && edad < 200 ? edad : null
}

/** Carga documentos por id (únicos) y los devuelve en un Map id → data. */
async function mapDocsByIds(
  col: string,
  ids: Array<string | null | undefined>,
): Promise<Map<string, DocumentData>> {
  const db = getFirebaseFirestore()
  const unique = [...new Set(ids.filter((id): id is string => !!id))]
  const entries = await Promise.all(
    unique.map(async (id) => {
      const snap = await getDoc(doc(db, col, id))
      return [id, snap.exists() ? snap.data() : null] as const
    }),
  )
  const map = new Map<string, DocumentData>()
  for (const [id, data] of entries) if (data) map.set(id, data)
  return map
}

/** Mapa seguimientoId → { peso, talla } desde `val_corporal` (activo). */
async function fetchValCorporalMap(
  seguimientoIds: string[],
): Promise<Map<string, { peso: number; talla: number }>> {
  const map = new Map<string, { peso: number; talla: number }>()
  if (seguimientoIds.length === 0) return map
  const db = getFirebaseFirestore()
  for (let i = 0; i < seguimientoIds.length; i += 30) {
    const chunk = seguimientoIds.slice(i, i + 30)
    const snap = await getDocs(
      query(
        collection(db, 'val_corporal'),
        where('seguimientoId', 'in', chunk),
        where('activo', '==', true),
      ),
    )
    for (const d of snap.docs) {
      const data = d.data()
      map.set(String(data.seguimientoId ?? ''), {
        peso: Number(data.peso) || 0,
        talla: Number(data.talla) || 0,
      })
    }
  }
  return map
}

/* ═══════════════════════════════════════════════════════════════════════════
   ESTUDIOS_PACIENTE
   ═══════════════════════════════════════════════════════════════════════════ */

export interface EstudioPacienteRow {
  docId: string
  seguimientoId: string
  estudioId: string
  estatusEstudioId: string
  medicoId: string | null
  letraMedico: string | null
  observaciones: string
  nombre: string | null
}

/** Lee `estudios_paciente` (activo) para varios seguimientos (chunks de 30). */
export async function fetchEstudiosPacienteForSeguimientos(
  seguimientoIds: string[],
): Promise<EstudioPacienteRow[]> {
  if (seguimientoIds.length === 0) return []
  const db = getFirebaseFirestore()
  const out: EstudioPacienteRow[] = []
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
      const letra =
        typeof data.letraMedico === 'string' && data.letraMedico.trim() !== ''
          ? data.letraMedico.trim()
          : null
      out.push({
        docId: d.id,
        seguimientoId: String(data.seguimientoId ?? ''),
        estudioId: String(data.estudioId ?? ''),
        estatusEstudioId: String(data.estatusEstudioId ?? '0'),
        medicoId: data.medicoId != null ? String(data.medicoId) : null,
        letraMedico: letra,
        observaciones: typeof data.observaciones === 'string' ? data.observaciones : '',
        nombre: typeof data.nombre === 'string' ? data.nombre : null,
      })
    }
  }
  return out
}

/* ═══════════════════════════════════════════════════════════════════════════
   SEGUIMIENTOS DEL DÍA
   ═══════════════════════════════════════════════════════════════════════════ */

export interface SeguimientoDelDia {
  seguimientoId: string
  pacienteId: string
  empresaId: string
  paqueteId: string
  paqueteNombre: string | null
  turno: number
  fechaIngreso: string
  activo: boolean
  nombre: string
  edad: number | null
  sexo: string | null
  desayuno: 0 | 1 | 2
  estatusValpac: 0 | 1 | 2
  padecimientoId: number
  medicoInternistaId: string | null
  medicoInternista: string | null
  fechaEntrega: string | null
  horaEntrega: string | null
  tarjetaEntRes: 0 | 1 | 2
  peso: number | null
  talla: number | null
}

/**
 * Lee los seguimientos de un día (zona MX) con `activo` dado, resolviendo
 * nombre del paciente, nombre del paquete, médico internista y antropometría.
 */
export async function fetchSeguimientosDelDia(
  fecha: string,
  activo: boolean,
): Promise<SeguimientoDelDia[]> {
  const db = getFirebaseFirestore()
  const { start, end } = dayRangeMX(fecha)
  const snap = await getDocs(
    query(
      collection(db, 'seguimientos'),
      where('activo', '==', activo),
      where('fechaIngresoUtc', '>=', Timestamp.fromDate(start)),
      where('fechaIngresoUtc', '<', Timestamp.fromDate(end)),
    ),
  )

  const rows = snap.docs.map((d) => ({ id: d.id, data: d.data() }))
  if (rows.length === 0) return []

  const [pacientesMap, paquetesMap, medicosMap, valMap] = await Promise.all([
    mapDocsByIds('pacientes', rows.map((r) => r.data.pacienteId)),
    mapDocsByIds('paquetes', rows.map((r) => r.data.paqueteId)),
    mapDocsByIds('medicos', rows.map((r) => r.data.medicoInternistaId)),
    fetchValCorporalMap(rows.map((r) => r.id)),
  ])

  return rows.map(({ id, data }) => {
    const pac = data.pacienteId ? pacientesMap.get(String(data.pacienteId)) : undefined
    const paq = data.paqueteId ? paquetesMap.get(String(data.paqueteId)) : undefined
    const med = data.medicoInternistaId
      ? medicosMap.get(String(data.medicoInternistaId))
      : undefined
    const val = valMap.get(id)
    const fechaIngreso =
      data.fechaIngreso ??
      (data.fechaIngresoUtc?.toDate ? formatDateMX(data.fechaIngresoUtc.toDate()) : '')

    return {
      seguimientoId: id,
      pacienteId: String(data.pacienteId ?? ''),
      empresaId: String(data.empresaId ?? ''),
      paqueteId: String(data.paqueteId ?? ''),
      paqueteNombre: (paq?.nombre as string) ?? null,
      turno: Number(data.turno) || 0,
      fechaIngreso,
      activo: data.activo !== false,
      nombre: buildPacienteNombre(pac),
      edad: calcEdad(pac?.fechaNacimiento),
      sexo: pac?.sexo != null ? String(pac.sexo) : null,
      desayuno: (Number(data.desayuno) || 0) as 0 | 1 | 2,
      estatusValpac: (Number(data.estatusValpac) || 0) as 0 | 1 | 2,
      padecimientoId: Number(data.padecimientoId) || 0,
      medicoInternistaId: data.medicoInternistaId != null ? String(data.medicoInternistaId) : null,
      medicoInternista: (med?.nombreCompleto as string) ?? null,
      fechaEntrega: data.fechaEntrega ? String(data.fechaEntrega) : null,
      horaEntrega: data.horaEntrega ? String(data.horaEntrega) : null,
      tarjetaEntRes: (Number(data.tarjetaEntRes) || 0) as 0 | 1 | 2,
      peso: val?.peso ?? null,
      talla: val?.talla ?? null,
    }
  })
}

/* ═══════════════════════════════════════════════════════════════════════════
   ALTA MANUAL DE PACIENTE
   ═══════════════════════════════════════════════════════════════════════════ */

export interface CrearPacienteInput {
  primerNombre: string
  segundoNombre: string
  apellidoPaterno: string
  apellidoMaterno: string
  fechaNac: string // yyyy-MM-dd
  genero: string // 'M' | 'F'
  historia: string
  paqueteId: string
  empresaId: string
  turno: number
  /** Día de ingreso (yyyy-MM-dd, zona MX). */
  fecha: string
}

/**
 * Alta manual: crea `pacientes` + `seguimientos` y siembra `estudios_paciente`
 * a partir de `paquete_detalle` del paquete elegido. Escritura atómica (batch).
 * @returns el id del seguimiento creado.
 */
export async function crearPacienteFirestore(input: CrearPacienteInput): Promise<string> {
  const db = getFirebaseFirestore()
  const uid = getFirebaseAuth().currentUser?.uid ?? 'system'
  const { start } = dayRangeMX(input.fecha)

  // 1) Paciente
  const pacienteRef = await addDoc(collection(db, 'pacientes'), {
    nombre1: input.primerNombre.trim().toUpperCase(),
    nombre2: input.segundoNombre.trim().toUpperCase(),
    apePaterno: input.apellidoPaterno.trim().toUpperCase(),
    apeMaterno: input.apellidoMaterno.trim().toUpperCase(),
    fechaNacimiento: input.fechaNac ? Timestamp.fromDate(new Date(`${input.fechaNac}T00:00:00`)) : null,
    sexo: input.genero || null,
    historia: input.historia.trim().toUpperCase(),
    activo: true,
    createdBy: uid,
    updatedBy: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  // 2) Seguimiento
  const seguimientoRef = await addDoc(collection(db, 'seguimientos'), {
    pacienteId: pacienteRef.id,
    empresaId: input.empresaId || null,
    paqueteId: input.paqueteId,
    turno: input.turno,
    fechaIngreso: input.fecha,
    fechaIngresoUtc: Timestamp.fromDate(start),
    estatusSeguimiento: 'EN_PROCESO',
    activo: true,
    desayuno: 0,
    estatusValpac: 0,
    padecimientoId: 0,
    medicoInternistaId: null,
    fechaEntrega: null,
    horaEntrega: null,
    fechaEnvio: null,
    horaEnvio: null,
    tarjetaEntRes: 0,
    observaciones: '',
    createdBy: uid,
    updatedBy: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  // 3) Sembrar estudios_paciente desde paquete_detalle (estudios incluidos)
  const detalleSnap = await getDocs(
    query(
      collection(db, 'paquete_detalle'),
      where('paqueteId', '==', input.paqueteId),
      where('activo', '==', true),
    ),
  )

  if (!detalleSnap.empty) {
    const batch = writeBatch(db)
    for (const d of detalleSnap.docs) {
      const det = d.data()
      const ref = doc(collection(db, 'estudios_paciente'))
      batch.set(ref, {
        seguimientoId: seguimientoRef.id,
        estudioId: String(det.estudioId),
        estatusEstudioId: String(det.estatusInicial ?? 0),
        medicoId: null,
        letraMedico: null,
        observaciones: '',
        activo: true,
      })
    }
    await batch.commit()
  }

  return seguimientoRef.id
}
