import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getFirebaseAuth } from '@/lib/firebase'
import { nowMX, formatDateMX } from '@/lib/timezone'

/* ═══════════════════════════════════════════════════════════════════════════
   TIPOS
   ═══════════════════════════════════════════════════════════════════════════ */

export interface PacienteListaDia {
  seguimientoId: string
  turno: number
  nombre: string
  desayuno: 0 | 1 | 2
  estatusValpac: 0 | 1 | 2
  padecimientoId: number
  medicoInternista: string | null
  paqueteId: string
  paqueteNombre: string
  edad: number
  peso: number
  talla: number
  fechaEntrega: string | null
  horaEntrega: string | null
  tarjetaEntRes: 0 | 1 | 2
  tieneAdicionales: boolean
  estudios: Record<number, number>
}

export const LISTA_DIA_QUERY_KEY = ['lista-dia-pacientes']

/* ═══════════════════════════════════════════════════════════════════════════
   DATOS MOCK
   ═══════════════════════════════════════════════════════════════════════════ */

const PACIENTES_MOCK: PacienteListaDia[] = [
  { seguimientoId: '73605', turno: 1, nombre: 'ALFREDO CANO JAUREGUI SEGURA MILLAN', desayuno: 0, estatusValpac: 2, padecimientoId: 0, medicoInternista: 'NEGREROS BALVANERA FABIOLA', paqueteId: 'DT0066', paqueteNombre: 'CHECK UP EMPRESA D', edad: 41, peso: 0, talla: 0, fechaEntrega: 'Tue Dec 31', horaEntrega: null, tarjetaEntRes: 0, tieneAdicionales: true, estudios: { 1: 4, 2: 4, 3: 2, 4: 1, 5: 1, 6: 1, 7: 4, 8: 1, 9: 6, 19: 6, 10: 1, 11: 1, 12: 1, 13: 6, 14: 1, 15: 4, 16: 1, 17: 1, 18: 1, 20: 1 } },
  { seguimientoId: '73607', turno: 2, nombre: 'SIXTA GUTIERREZ RIVERA', desayuno: 0, estatusValpac: 0, padecimientoId: 0, medicoInternista: null, paqueteId: 'DT0028', paqueteNombre: 'CHECK UP BASICO', edad: 50, peso: 0, talla: 0, fechaEntrega: null, horaEntrega: null, tarjetaEntRes: 0, tieneAdicionales: false, estudios: { 1: 2, 2: 2, 3: 2, 4: 2, 5: 2, 6: 1, 7: 1, 8: 1, 9: 1, 19: 1, 10: 1, 11: 1, 12: 1, 13: 1, 14: 1, 15: 1, 16: 1, 17: 1, 18: 1, 20: 1 } },
  { seguimientoId: '73608', turno: 3, nombre: 'ASAHI TOSHIYA', desayuno: 0, estatusValpac: 0, padecimientoId: 0, medicoInternista: null, paqueteId: 'DT0040', paqueteNombre: 'CHECK UP EMPRESA C', edad: 45, peso: 0, talla: 0, fechaEntrega: null, horaEntrega: null, tarjetaEntRes: 0, tieneAdicionales: false, estudios: { 1: 2, 2: 4, 3: 2, 4: 2, 5: 2, 6: 2, 7: 1, 8: 1, 9: 2, 19: 2, 10: 2, 11: 1, 12: 1, 13: 1, 14: 1, 15: 1, 16: 1, 17: 1, 18: 1, 20: 1 } },
  { seguimientoId: '73609', turno: 4, nombre: 'VERONICA ADRIANA BAÑUELOS SANCHEZ', desayuno: 0, estatusValpac: 0, padecimientoId: 0, medicoInternista: null, paqueteId: 'DT0028', paqueteNombre: 'CHECK UP BASICO', edad: 38, peso: 0, talla: 0, fechaEntrega: null, horaEntrega: null, tarjetaEntRes: 0, tieneAdicionales: false, estudios: { 1: 2, 2: 4, 3: 2, 4: 2, 5: 2, 6: 2, 7: 1, 8: 2, 9: 1, 19: 2, 10: 1, 11: 4, 12: 1, 13: 1, 14: 1, 15: 1, 16: 1, 17: 1, 18: 1, 20: 1 } },
  { seguimientoId: '73610', turno: 5, nombre: 'MARIO DE MARCHIS PARESCHI', desayuno: 0, estatusValpac: 0, padecimientoId: 0, medicoInternista: null, paqueteId: 'DT0028', paqueteNombre: 'CHECK UP BASICO', edad: 55, peso: 0, talla: 0, fechaEntrega: null, horaEntrega: null, tarjetaEntRes: 0, tieneAdicionales: false, estudios: { 1: 2, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 19: 1, 10: 1, 11: 1, 12: 1, 13: 1, 14: 1, 15: 1, 16: 1, 17: 1, 18: 1, 20: 1 } },
  { seguimientoId: '73611', turno: 6, nombre: 'MARIA GUADALUPE RUIZ DEL RIO', desayuno: 0, estatusValpac: 0, padecimientoId: 0, medicoInternista: null, paqueteId: 'DT0028', paqueteNombre: 'CHECK UP BASICO', edad: 42, peso: 0, talla: 0, fechaEntrega: null, horaEntrega: null, tarjetaEntRes: 0, tieneAdicionales: false, estudios: { 1: 2, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 19: 1, 10: 1, 11: 1, 12: 1, 13: 1, 14: 1, 15: 1, 16: 1, 17: 1, 18: 1, 20: 1 } },
  { seguimientoId: '73612', turno: 7, nombre: 'SABINA GARCIA ORTEGA', desayuno: 0, estatusValpac: 0, padecimientoId: 0, medicoInternista: null, paqueteId: 'DT0066', paqueteNombre: 'CHECK UP EMPRESA D', edad: 48, peso: 0, talla: 0, fechaEntrega: null, horaEntrega: null, tarjetaEntRes: 0, tieneAdicionales: false, estudios: { 1: 4, 2: 2, 3: 2, 4: 2, 5: 2, 6: 1, 7: 1, 8: 2, 9: 1, 19: 2, 10: 1, 11: 5, 12: 5, 13: 1, 14: 1, 15: 1, 16: 1, 17: 1, 18: 1, 20: 1 } },
  { seguimientoId: '73613', turno: 8, nombre: 'JESUS AUGUSTO CARMONA COLINA', desayuno: 0, estatusValpac: 0, padecimientoId: 0, medicoInternista: null, paqueteId: 'DT0028', paqueteNombre: 'CHECK UP BASICO', edad: 60, peso: 0, talla: 0, fechaEntrega: null, horaEntrega: null, tarjetaEntRes: 0, tieneAdicionales: false, estudios: { 1: 2, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 19: 1, 10: 1, 11: 1, 12: 1, 13: 1, 14: 1, 15: 1, 16: 1, 17: 1, 18: 1, 20: 1 } },
  { seguimientoId: '73614', turno: 9, nombre: 'JAIME VELAZQUEZ BERUMEN', desayuno: 0, estatusValpac: 0, padecimientoId: 0, medicoInternista: null, paqueteId: 'DT0028', paqueteNombre: 'CHECK UP BASICO', edad: 37, peso: 0, talla: 0, fechaEntrega: null, horaEntrega: null, tarjetaEntRes: 0, tieneAdicionales: false, estudios: { 1: 2, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 19: 6, 10: 1, 11: 1, 12: 1, 13: 6, 14: 1, 15: 6, 16: 1, 17: 1, 18: 1, 20: 1 } },
  { seguimientoId: '73615', turno: 10, nombre: 'HEIDI PRAGER GUZMAN', desayuno: 0, estatusValpac: 0, padecimientoId: 0, medicoInternista: null, paqueteId: 'DT0040', paqueteNombre: 'CHECK UP EMPRESA C', edad: 44, peso: 0, talla: 0, fechaEntrega: null, horaEntrega: null, tarjetaEntRes: 0, tieneAdicionales: false, estudios: { 1: 4, 2: 2, 3: 2, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 19: 1, 10: 1, 11: 6, 12: 6, 13: 1, 14: 1, 15: 1, 16: 1, 17: 1, 18: 1, 20: 1 } },
  { seguimientoId: '73616', turno: 11, nombre: 'MARIO ALFREDO DONIZ ISLAS', desayuno: 0, estatusValpac: 0, padecimientoId: 0, medicoInternista: null, paqueteId: 'DT0028', paqueteNombre: 'CHECK UP BASICO', edad: 52, peso: 0, talla: 0, fechaEntrega: null, horaEntrega: null, tarjetaEntRes: 0, tieneAdicionales: false, estudios: { 1: 2, 2: 4, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 19: 1, 10: 1, 11: 4, 12: 1, 13: 1, 14: 1, 15: 1, 16: 1, 17: 1, 18: 1, 20: 1 } },
  { seguimientoId: '73617', turno: 12, nombre: 'JOSE LUIS RAMIREZ PALOMARES', desayuno: 0, estatusValpac: 0, padecimientoId: 0, medicoInternista: null, paqueteId: 'DT0028', paqueteNombre: 'CHECK UP BASICO', edad: 47, peso: 0, talla: 0, fechaEntrega: null, horaEntrega: null, tarjetaEntRes: 0, tieneAdicionales: false, estudios: { 1: 2, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 19: 1, 10: 1, 11: 1, 12: 1, 13: 1, 14: 1, 15: 1, 16: 1, 17: 1, 18: 1, 20: 1 } },
  { seguimientoId: '73618', turno: 13, nombre: 'RICARDO EDDY MONTERRUBIO MORENO', desayuno: 0, estatusValpac: 0, padecimientoId: 0, medicoInternista: null, paqueteId: 'DT0028', paqueteNombre: 'CHECK UP BASICO', edad: 35, peso: 0, talla: 0, fechaEntrega: null, horaEntrega: null, tarjetaEntRes: 0, tieneAdicionales: false, estudios: { 1: 2, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 19: 1, 10: 1, 11: 1, 12: 1, 13: 1, 14: 1, 15: 1, 16: 1, 17: 1, 18: 1, 20: 1 } },
  { seguimientoId: '73619', turno: 14, nombre: 'MONICA ALVAREZ RIOS', desayuno: 0, estatusValpac: 0, padecimientoId: 0, medicoInternista: null, paqueteId: 'DT0028', paqueteNombre: 'CHECK UP BASICO', edad: 39, peso: 0, talla: 0, fechaEntrega: null, horaEntrega: null, tarjetaEntRes: 0, tieneAdicionales: false, estudios: { 1: 2, 2: 2, 3: 2, 4: 2, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 19: 1, 10: 1, 11: 1, 12: 1, 13: 1, 14: 1, 15: 1, 16: 1, 17: 1, 18: 1, 20: 1 } },
  { seguimientoId: '73620', turno: 15, nombre: 'MARIO LUIS PRADO BABAYAN', desayuno: 0, estatusValpac: 0, padecimientoId: 1, medicoInternista: null, paqueteId: 'DT0028', paqueteNombre: 'CHECK UP BASICO', edad: 58, peso: 0, talla: 0, fechaEntrega: null, horaEntrega: null, tarjetaEntRes: 0, tieneAdicionales: false, estudios: { 1: 2, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 19: 1, 10: 1, 11: 1, 12: 1, 13: 1, 14: 1, 15: 1, 16: 1, 17: 1, 18: 1, 20: 1 } },
]

/* ═══════════════════════════════════════════════════════════════════════════
   FETCH (con fallback a mock)
   ═══════════════════════════════════════════════════════════════════════════ */

const API_BASE = import.meta.env.VITE_API_URL ?? ''

async function fetchListaDia(fecha: string): Promise<PacienteListaDia[]> {
  try {
    const user = getFirebaseAuth().currentUser
    const headers: HeadersInit = { 'Content-Type': 'application/json' }
    if (user) {
      const token = await user.getIdToken()
      headers.Authorization = `Bearer ${token}`
    }
    const res = await fetch(`${API_BASE}/api/lista-dia?fecha=${fecha}`, { headers })
    if (res.ok) return await res.json()
  } catch {
    // fallback
  }
  // Mock: solo retorna datos para hoy
  const hoy = formatDateMX(nowMX())
  return fecha === hoy ? PACIENTES_MOCK : []
}

/* ═══════════════════════════════════════════════════════════════════════════
   HOOK PRINCIPAL
   ═══════════════════════════════════════════════════════════════════════════ */

export function useListaDia(fecha: string) {
  return useQuery({
    queryKey: [...LISTA_DIA_QUERY_KEY, fecha],
    queryFn: () => fetchListaDia(fecha),
  })
}

/* ═══════════════════════════════════════════════════════════════════════════
   MUTACIONES OPTIMISTAS (actualizar cache local)
   ═══════════════════════════════════════════════════════════════════════════ */

/** Actualiza un paciente en el cache de lista-dia. */
export function useUpdatePacienteCache() {
  const qc = useQueryClient()

  return (fecha: string, seguimientoId: string, updates: Partial<PacienteListaDia>) => {
    qc.setQueryData<PacienteListaDia[]>(
      [...LISTA_DIA_QUERY_KEY, fecha],
      (old) => {
        if (!old) return old
        return old.map((p) =>
          p.seguimientoId === seguimientoId ? { ...p, ...updates } : p,
        )
      },
    )
  }
}
