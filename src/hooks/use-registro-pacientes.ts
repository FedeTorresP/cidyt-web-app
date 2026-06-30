import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Timestamp, doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { getFirebaseAuth, getFirebaseFirestore } from '@/lib/firebase'
import { formatDateMX } from '@/lib/timezone'
import { fetchActiveCatalog, sortByNombre } from '@/lib/firestore-catalog'
import {
  crearPacienteFirestore,
  fetchSeguimientosDelDia,
  type CrearPacienteInput,
} from '@/lib/pacientes-firestore'

/* ═══════════════════════════════════════════════════════════════════════════
   TIPOS
   ═══════════════════════════════════════════════════════════════════════════ */

export interface PacienteRegistro {
  seguimientoId: string
  pacienteId: string
  nombre: string
  turno: number
  paqueteId: string
  paqueteNombre: string | null
  empresaId: string
  fechaIngreso: string
  activo: boolean
}

export interface PacienteFormData {
  primerNombre: string
  segundoNombre: string
  apellidoPaterno: string
  apellidoMaterno: string
  fechaNac: string          // YYYY-MM-DD
  genero: string            // 'M' | 'F'
  historia: string
  paqueteId: string
  empresaId: string
  turno: string
}

export interface PacienteDetalle extends PacienteFormData {
  seguimientoId: string
}

export interface Paquete {
  id: string
  nombre: string
}

export interface Empresa {
  id: string
  nombre: string
}

/* ═══════════════════════════════════════════════════════════════════════════
   FETCH — Pacientes del Día (Firestore)
   ═══════════════════════════════════════════════════════════════════════════ */

async function fetchPacientesDelDia(fecha: string, activo: boolean): Promise<PacienteRegistro[]> {
  const seguimientos = await fetchSeguimientosDelDia(fecha, activo)
  return seguimientos.map((s) => ({
    seguimientoId: s.seguimientoId,
    pacienteId: s.pacienteId,
    nombre: s.nombre,
    turno: s.turno,
    paqueteId: s.paqueteId,
    paqueteNombre: s.paqueteNombre,
    empresaId: s.empresaId,
    fechaIngreso: s.fechaIngreso,
    activo: s.activo,
  }))
}

/* ═══════════════════════════════════════════════════════════════════════════
   FETCH — Catálogos (paquetes + empresas) desde Firestore
   ═══════════════════════════════════════════════════════════════════════════ */

async function fetchCatalogos(): Promise<{ paquetes: Paquete[]; empresas: Empresa[] }> {
  const [paquetes, empresas] = await Promise.all([
    fetchActiveCatalog<Paquete>(
      'paquetes',
      (id, data) => ({ id, nombre: (data.nombre as string) ?? id }),
      sortByNombre,
    ),
    fetchActiveCatalog<Empresa>(
      'empresas',
      (id, data) => ({ id, nombre: (data.nombre as string) ?? id }),
      sortByNombre,
    ),
  ])
  return { paquetes, empresas }
}

/* ═══════════════════════════════════════════════════════════════════════════
   FETCH — Detalle Paciente (para editar) desde Firestore
   ═══════════════════════════════════════════════════════════════════════════ */

function tsToDateInput(value: unknown): string {
  const d = value instanceof Timestamp ? value.toDate() : null
  if (!d || Number.isNaN(d.getTime())) return ''
  return formatDateMX(d)
}

async function fetchPacienteDetalle(seguimientoId: string): Promise<PacienteDetalle> {
  const db = getFirebaseFirestore()
  const segSnap = await getDoc(doc(db, 'seguimientos', seguimientoId))
  if (!segSnap.exists()) throw new Error('Seguimiento no encontrado')
  const seg = segSnap.data()

  let pac: Record<string, unknown> = {}
  if (seg.pacienteId) {
    const pacSnap = await getDoc(doc(db, 'pacientes', String(seg.pacienteId)))
    if (pacSnap.exists()) pac = pacSnap.data()
  }

  return {
    seguimientoId,
    primerNombre: (pac.nombre1 as string) ?? '',
    segundoNombre: (pac.nombre2 as string) ?? '',
    apellidoPaterno: (pac.apePaterno as string) ?? '',
    apellidoMaterno: (pac.apeMaterno as string) ?? '',
    fechaNac: tsToDateInput(pac.fechaNacimiento),
    genero: (pac.sexo as string) ?? '',
    historia: (pac.historia as string) ?? '',
    paqueteId: (seg.paqueteId as string) ?? '',
    empresaId: (seg.empresaId as string) ?? '',
    turno: String(seg.turno ?? ''),
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   HOOKS
   ═══════════════════════════════════════════════════════════════════════════ */

export function usePacientesDelDia(fecha: string, activo: boolean) {
  return useQuery({
    queryKey: ['registro-pacientes', fecha, activo],
    queryFn: () => fetchPacientesDelDia(fecha, activo),
  })
}

export function useCatalogos() {
  return useQuery({
    queryKey: ['catalogos-registro'],
    queryFn: fetchCatalogos,
    staleTime: 5 * 60 * 1000, // 5 min
  })
}

export function usePacienteDetalle(seguimientoId: string | null) {
  return useQuery({
    queryKey: ['paciente-detalle', seguimientoId],
    queryFn: () => fetchPacienteDetalle(seguimientoId!),
    enabled: !!seguimientoId,
  })
}

/* ═══════════════════════════════════════════════════════════════════════════
   MUTACIONES
   ═══════════════════════════════════════════════════════════════════════════ */

export function useCrearPaciente() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (input: CrearPacienteInput) => crearPacienteFirestore(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['registro-pacientes'] })
      qc.invalidateQueries({ queryKey: ['lista-dia-pacientes'] })
      qc.invalidateQueries({ queryKey: ['lista-caja-pacientes'] })
    },
  })
}

export function useEditarPaciente() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ seguimientoId, data }: { seguimientoId: string; data: PacienteFormData }) => {
      const db = getFirebaseFirestore()
      const uid = getFirebaseAuth().currentUser?.uid ?? 'system'

      const segRef = doc(db, 'seguimientos', seguimientoId)
      const segSnap = await getDoc(segRef)
      if (!segSnap.exists()) throw new Error('Seguimiento no encontrado')
      const pacienteId = String(segSnap.data().pacienteId ?? '')

      if (pacienteId) {
        await updateDoc(doc(db, 'pacientes', pacienteId), {
          nombre1: data.primerNombre.trim().toUpperCase(),
          nombre2: data.segundoNombre.trim().toUpperCase(),
          apePaterno: data.apellidoPaterno.trim().toUpperCase(),
          apeMaterno: data.apellidoMaterno.trim().toUpperCase(),
          fechaNacimiento: data.fechaNac
            ? Timestamp.fromDate(new Date(`${data.fechaNac}T00:00:00`))
            : null,
          sexo: data.genero || null,
          historia: data.historia.trim().toUpperCase(),
          updatedBy: uid,
          updatedAt: serverTimestamp(),
        })
      }

      await updateDoc(segRef, {
        paqueteId: data.paqueteId,
        empresaId: data.empresaId || null,
        turno: Number(data.turno),
        updatedBy: uid,
        updatedAt: serverTimestamp(),
      })

      return { seguimientoId }
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['registro-pacientes'] })
      qc.invalidateQueries({ queryKey: ['paciente-detalle', variables.seguimientoId] })
      qc.invalidateQueries({ queryKey: ['lista-dia-pacientes'] })
      qc.invalidateQueries({ queryKey: ['lista-caja-pacientes'] })
    },
  })
}

/**
 * Cambia solo el turno de un paciente (edición inline en la tabla),
 * persistiendo en `seguimientos/{id}.turno`.
 */
export function useSetTurno() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ seguimientoId, turno }: { seguimientoId: string; turno: number }) => {
      const db = getFirebaseFirestore()
      await updateDoc(doc(db, 'seguimientos', seguimientoId), {
        turno,
        updatedAt: serverTimestamp(),
      })
      return { seguimientoId, turno }
    },
    onMutate: async ({ seguimientoId, turno }) => {
      await qc.cancelQueries({ queryKey: ['registro-pacientes'] })
      const snapshots = qc.getQueriesData<PacienteRegistro[]>({ queryKey: ['registro-pacientes'] })
      for (const [key, data] of snapshots) {
        if (!data) continue
        qc.setQueryData<PacienteRegistro[]>(
          key,
          data.map((p) => (p.seguimientoId === seguimientoId ? { ...p, turno } : p)),
        )
      }
      return { snapshots }
    },
    onError: (_err, _vars, context) => {
      context?.snapshots?.forEach(([key, data]) => qc.setQueryData(key, data))
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['registro-pacientes'] })
      qc.invalidateQueries({ queryKey: ['lista-dia-pacientes'] })
      qc.invalidateQueries({ queryKey: ['lista-caja-pacientes'] })
    },
  })
}

export function useToggleActivo() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ seguimientoId, activo }: { seguimientoId: string; activo: number }) => {
      const db = getFirebaseFirestore()
      await updateDoc(doc(db, 'seguimientos', seguimientoId), {
        activo: activo === 1,
        updatedAt: serverTimestamp(),
      })
      return { seguimientoId, activo }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['registro-pacientes'] })
      qc.invalidateQueries({ queryKey: ['lista-dia-pacientes'] })
      qc.invalidateQueries({ queryKey: ['lista-caja-pacientes'] })
    },
  })
}
