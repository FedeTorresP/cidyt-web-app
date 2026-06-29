import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { doc, setDoc } from 'firebase/firestore'
import { getFirebaseAuth, getFirebaseFirestore } from '@/lib/firebase'
import { nowMX, formatDateMX } from '@/lib/timezone'
import { fetchTurnoOverrides, applyTurnoOverrides } from '@/lib/turno-overrides'

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
  empresaId: number
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
  id: number
  nombre: string
}

/* ═══════════════════════════════════════════════════════════════════════════
   DATOS MOCK
   ═══════════════════════════════════════════════════════════════════════════ */

const MOCK_PACIENTES: PacienteRegistro[] = [
  { seguimientoId: '73605', pacienteId: 'P001', nombre: 'ALFREDO CANO JAUREGUI SEGURA MILLAN', turno: 1, paqueteId: 'DT0066', paqueteNombre: 'CHECK UP EMPRESA D', empresaId: 1, fechaIngreso: formatDateMX(nowMX()), activo: true },
  { seguimientoId: '73607', pacienteId: 'P002', nombre: 'SIXTA GUTIERREZ RIVERA', turno: 2, paqueteId: 'DT0028', paqueteNombre: 'CHECK UP BASICO', empresaId: 2, fechaIngreso: formatDateMX(nowMX()), activo: true },
  { seguimientoId: '73608', pacienteId: 'P003', nombre: 'ASAHI TOSHIYA', turno: 3, paqueteId: 'DT0040', paqueteNombre: 'CHECK UP EMPRESA C', empresaId: 3, fechaIngreso: formatDateMX(nowMX()), activo: true },
  { seguimientoId: '73609', pacienteId: 'P004', nombre: 'VERONICA ADRIANA BAÑUELOS SANCHEZ', turno: 4, paqueteId: 'DT0028', paqueteNombre: 'CHECK UP BASICO', empresaId: 1, fechaIngreso: formatDateMX(nowMX()), activo: true },
  { seguimientoId: '73610', pacienteId: 'P005', nombre: 'MARIO DE MARCHIS PARESCHI', turno: 5, paqueteId: 'DT0028', paqueteNombre: 'CHECK UP BASICO', empresaId: 4, fechaIngreso: formatDateMX(nowMX()), activo: true },
  { seguimientoId: '73611', pacienteId: 'P006', nombre: 'MARIA GUADALUPE RUIZ DEL RIO', turno: 6, paqueteId: 'DT0028', paqueteNombre: 'CHECK UP BASICO', empresaId: 2, fechaIngreso: formatDateMX(nowMX()), activo: true },
  { seguimientoId: '73612', pacienteId: 'P007', nombre: 'SABINA GARCIA ORTEGA', turno: 7, paqueteId: 'DT0066', paqueteNombre: 'CHECK UP EMPRESA D', empresaId: 3, fechaIngreso: formatDateMX(nowMX()), activo: true },
  { seguimientoId: '73613', pacienteId: 'P008', nombre: 'JESUS AUGUSTO CARMONA COLINA', turno: 8, paqueteId: 'DT0028', paqueteNombre: 'CHECK UP BASICO', empresaId: 1, fechaIngreso: formatDateMX(nowMX()), activo: true },
  { seguimientoId: '73614', pacienteId: 'P009', nombre: 'JAIME VELAZQUEZ BERUMEN', turno: 9, paqueteId: 'DT0028', paqueteNombre: 'CHECK UP BASICO', empresaId: 2, fechaIngreso: formatDateMX(nowMX()), activo: true },
  { seguimientoId: '73615', pacienteId: 'P010', nombre: 'HEIDI PRAGER GUZMAN', turno: 10, paqueteId: 'DT0040', paqueteNombre: 'CHECK UP EMPRESA C', empresaId: 4, fechaIngreso: formatDateMX(nowMX()), activo: true },
  { seguimientoId: '73616', pacienteId: 'P011', nombre: 'MARIO ALFREDO DONIZ ISLAS', turno: 11, paqueteId: 'DT0028', paqueteNombre: 'CHECK UP BASICO', empresaId: 1, fechaIngreso: formatDateMX(nowMX()), activo: true },
  { seguimientoId: '73617', pacienteId: 'P012', nombre: 'JOSE LUIS RAMIREZ PALOMARES', turno: 12, paqueteId: 'DT0028', paqueteNombre: 'CHECK UP BASICO', empresaId: 3, fechaIngreso: formatDateMX(nowMX()), activo: true },
  { seguimientoId: '73618', pacienteId: 'P013', nombre: 'RICARDO EDDY MONTERRUBIO MORENO', turno: 13, paqueteId: 'DT0028', paqueteNombre: 'CHECK UP BASICO', empresaId: 2, fechaIngreso: formatDateMX(nowMX()), activo: true },
  { seguimientoId: '73619', pacienteId: 'P014', nombre: 'MONICA ALVAREZ RIOS', turno: 14, paqueteId: 'DT0028', paqueteNombre: 'CHECK UP BASICO', empresaId: 4, fechaIngreso: formatDateMX(nowMX()), activo: true },
  { seguimientoId: '73620', pacienteId: 'P015', nombre: 'MARIO LUIS PRADO BABAYAN', turno: 15, paqueteId: 'DT0028', paqueteNombre: 'CHECK UP BASICO', empresaId: 1, fechaIngreso: formatDateMX(nowMX()), activo: true },
]

const MOCK_PAQUETES: Paquete[] = [
  { id: 'DT0001', nombre: 'CHECK UP CIDYT D' },
  { id: 'DT0002', nombre: 'CHECK UP EJECUTIVO C Y D + TOMOGRAFIA' },
  { id: 'DT0028', nombre: 'CHECK UP BASICO' },
  { id: 'DT0040', nombre: 'CHECK UP EMPRESA C' },
  { id: 'DT0050', nombre: 'CHECK UP EMPRESA B' },
  { id: 'DT0066', nombre: 'CHECK UP EMPRESA D' },
  { id: 'DT0070', nombre: 'CHECK UP EMPRESA A' },
]

const MOCK_EMPRESAS: Empresa[] = [
  { id: 1, nombre: 'BANDAI' },
  { id: 2, nombre: 'MEDICA SUR' },
  { id: 3, nombre: 'TOYOTA' },
  { id: 4, nombre: 'HONDA' },
  { id: 5, nombre: 'SAMSUNG' },
]

/* ═══════════════════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */

const API_BASE = import.meta.env.VITE_API_URL ?? ''

async function getAuthHeaders(): Promise<HeadersInit> {
  const headers: HeadersInit = { 'Content-Type': 'application/json' }
  const user = getFirebaseAuth().currentUser
  if (user) {
    const token = await user.getIdToken()
    headers.Authorization = `Bearer ${token}`
  }
  return headers
}

/* ═══════════════════════════════════════════════════════════════════════════
   FETCH — Pacientes del Día
   ═══════════════════════════════════════════════════════════════════════════ */

async function fetchPacientesDelDia(fecha: string, activo: boolean): Promise<PacienteRegistro[]> {
  try {
    const headers = await getAuthHeaders()
    const res = await fetch(
      `${API_BASE}/api/pacientes?fecha=${fecha}&activo=${activo ? 1 : 0}`,
      { headers },
    )
    if (res.ok) return await res.json()
  } catch {
    // fallback
  }
  const hoy = formatDateMX(nowMX())
  if (fecha !== hoy) return []
  // Sin backend: usamos datos mock pero aplicamos los turnos persistidos en Firestore
  const overrides = await fetchTurnoOverrides()
  return applyTurnoOverrides(MOCK_PACIENTES.filter((p) => p.activo === activo), overrides)
}

/* ═══════════════════════════════════════════════════════════════════════════
   FETCH — Catálogos (paquetes + empresas)
   ═══════════════════════════════════════════════════════════════════════════ */

async function fetchCatalogos(): Promise<{ paquetes: Paquete[]; empresas: Empresa[] }> {
  try {
    const headers = await getAuthHeaders()
    const [resPaq, resEmp] = await Promise.all([
      fetch(`${API_BASE}/api/catalogos/paquetes`, { headers }),
      fetch(`${API_BASE}/api/catalogos/empresas`, { headers }),
    ])
    if (resPaq.ok && resEmp.ok) {
      const paquetes: Paquete[] = await resPaq.json()
      const empresas: Empresa[] = await resEmp.json()
      return { paquetes, empresas }
    }
  } catch {
    // fallback
  }
  return { paquetes: MOCK_PAQUETES, empresas: MOCK_EMPRESAS }
}

/* ═══════════════════════════════════════════════════════════════════════════
   FETCH — Detalle Paciente (para editar)
   ═══════════════════════════════════════════════════════════════════════════ */

async function fetchPacienteDetalle(seguimientoId: string): Promise<PacienteDetalle> {
  try {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE}/api/pacientes/${seguimientoId}`, { headers })
    if (res.ok) return await res.json()
  } catch {
    // fallback
  }
  // Mock: retornar datos genéricos basados en el mock de la lista
  const pac = MOCK_PACIENTES.find((p) => p.seguimientoId === seguimientoId)
  const partes = (pac?.nombre ?? 'JORGE QUAN LAO').split(' ')
  return {
    seguimientoId,
    primerNombre: partes[0] ?? '',
    segundoNombre: partes.length > 3 ? partes[1] : '',
    apellidoPaterno: partes.length > 3 ? partes[2] : partes[1] ?? '',
    apellidoMaterno: partes.length > 3 ? partes.slice(3).join(' ') : partes[2] ?? '',
    fechaNac: '1957-08-09',
    genero: '',
    historia: '1000038465',
    paqueteId: pac?.paqueteId ?? 'DT0001',
    empresaId: String(pac?.empresaId ?? 1),
    turno: String(pac?.turno ?? 1),
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

export function useEditarPaciente() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ seguimientoId, data }: { seguimientoId: string; data: PacienteFormData }) => {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/api/pacientes/${seguimientoId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          Primer_Nombre: data.primerNombre.trim().toUpperCase(),
          Segundo_Nombre: data.segundoNombre.trim().toUpperCase(),
          Apellido_Paterno: data.apellidoPaterno.trim().toUpperCase(),
          Apellido_Materno: data.apellidoMaterno.trim().toUpperCase(),
          Fecha_Nac: data.fechaNac,
          Genero: data.genero,
          Historia: data.historia.trim().toUpperCase(),
          Paquete_id: data.paqueteId,
          Empresa_id: Number(data.empresaId),
          Turno: Number(data.turno),
        }),
      })
      if (!res.ok) throw new Error('Error al actualizar paciente')
      return await res.json()
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['registro-pacientes'] })
      qc.invalidateQueries({ queryKey: ['paciente-detalle', variables.seguimientoId] })
    },
  })
}

/**
 * Cambia solo el turno de un paciente (edición inline en la tabla).
 * Escritura primaria: PATCH /api/pacientes/:id { Turno }.
 * Si el backend no responde, cae a Firestore `seguimientos/{id}.turno`.
 */
export function useSetTurno() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ seguimientoId, turno }: { seguimientoId: string; turno: number }) => {
      // Solo intentamos la API on-prem si está configurada (evita 404 contra el dev server)
      if (API_BASE) {
        try {
          const headers = await getAuthHeaders()
          const res = await fetch(`${API_BASE}/api/pacientes/${seguimientoId}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ Turno: turno }),
          })
          if (res.ok) return { seguimientoId, turno }
        } catch {
          // fallback a Firestore
        }
      }
      // Fallback Firestore: merge para crear el doc si aún no existe (datos mock)
      const db = getFirebaseFirestore()
      await setDoc(doc(db, 'seguimientos', seguimientoId), { turno }, { merge: true })
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
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/api/pacientes/${seguimientoId}/activo`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ Seguimiento_id: seguimientoId, Activo: activo }),
      })
      if (!res.ok) throw new Error('Error al cambiar estado del paciente')
      return await res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['registro-pacientes'] })
    },
  })
}
