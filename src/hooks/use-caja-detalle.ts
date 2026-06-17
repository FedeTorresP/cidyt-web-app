import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getFirebaseAuth } from '@/lib/firebase'

/* ═══════════════════════════════════════════════════════════════════════════
   TIPOS
   ═══════════════════════════════════════════════════════════════════════════ */

export interface SeguimientoDetalleCaja {
  seguimientoId: string
  pacienteId: string
  nombre: string
  historia: string | null
  fechaNac: string | null // YYYY-MM-DD
  genero: 'm' | 'f' | null
  paqueteNombre: string | null
  ctaPac: number | null
  estatusValpac: 0 | 1 | 2
  fechaEgreso: string | null
  horaEgreso: string | null
  userEgresoArea: string | null
}

export interface EstudioAdicional {
  id: string
  nombre: string
  estatusEstId: number
  letraEstAdic: string | null
  observaciones: string | null
}

export interface FacturaCaja {
  facturaId: string
  facturaNo: number | null
  promotorId: string | null
  promotorNombre: string | null
  empresaId: number | null
  empresa: string | null
  tipoServicioId: number | null
  tipoFactura: number | null
  descripcion1: string | null
  observaciones: string | null
  fechaIngreso: string | null
  userCrea: string | null
}

export interface Promotor {
  id: string
  nombre: string
}

export interface CajaDetalleData {
  seguimiento: SeguimientoDetalleCaja
  estudiosAdicionales: EstudioAdicional[]
  facturas: FacturaCaja[]
  promotores: Promotor[]
}

/* ═══════════════════════════════════════════════════════════════════════════
   PAYLOAD TYPES (para mutaciones)
   ═══════════════════════════════════════════════════════════════════════════ */

export interface GuardarFacturaPayload {
  seguimientoId: string
  facturaId?: string // si existe → update (PATCH), si no → create (POST)
  facturaNo: number | null
  ctaPac: number | null
  tipoServicioId: number | null
  tipoFactura: number | null
  empresa: string | null
  empresaId: number | null
  promotorId: string | null
  descripcion1: string | null
  observaciones: string | null
}

export interface EliminarFacturaPayload {
  seguimientoId: string
  facturaId: string
}

export interface ConfirmarEgresoPayload {
  seguimientoId: string
}

/* ═══════════════════════════════════════════════════════════════════════════
   DATOS MOCK
   ═══════════════════════════════════════════════════════════════════════════ */

const MOCK_DATA: CajaDetalleData = {
  seguimiento: {
    seguimientoId: '73605',
    pacienteId: 'PAC-1001',
    nombre: 'ALFREDO CANO JAUREGUI SEGURA MILLAN',
    historia: '230145',
    fechaNac: '1985-05-22',
    genero: 'm',
    paqueteNombre: 'CHECK UP EMPRESA D',
    ctaPac: null,
    estatusValpac: 0,
    fechaEgreso: null,
    horaEgreso: null,
    userEgresoArea: null,
  },
  estudiosAdicionales: [
    { id: 'ea-1', nombre: 'VIT. B 12, VITA D', estatusEstId: 2, letraEstAdic: 'A', observaciones: null },
    { id: 'ea-2', nombre: 'HEMOGLOBINA GLICOSILADA', estatusEstId: 4, letraEstAdic: 'B', observaciones: 'Resultado normal' },
  ],
  facturas: [
    {
      facturaId: 'f-001',
      facturaNo: 12345,
      promotorId: 'prom-1',
      promotorNombre: 'GARCIA LOPEZ MARIA',
      empresaId: 100,
      empresa: 'EMPRESA DEMO S.A.',
      tipoServicioId: 2,
      tipoFactura: 1,
      descripcion1: 'Check up ejecutivo completo',
      observaciones: null,
      fechaIngreso: '2026-06-17 08:30',
      userCrea: 'ADMIN',
    },
  ],
  promotores: [
    { id: 'prom-1', nombre: 'GARCIA LOPEZ MARIA' },
    { id: 'prom-2', nombre: 'HERNANDEZ RUIZ PEDRO' },
    { id: 'prom-3', nombre: 'MARTINEZ SOTO ANA' },
  ],
}

/* ═══════════════════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */

const API_BASE = import.meta.env.VITE_API_URL ?? ''

async function authHeaders(): Promise<HeadersInit> {
  const user = getFirebaseAuth().currentUser
  if (!user) return { 'Content-Type': 'application/json' }
  const token = await user.getIdToken()
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
}

/* ═══════════════════════════════════════════════════════════════════════════
   FETCH (con fallback a mock)
   ═══════════════════════════════════════════════════════════════════════════ */

async function fetchCajaDetalle(seguimientoId: string): Promise<CajaDetalleData> {
  try {
    const headers = await authHeaders()
    const res = await fetch(`${API_BASE}/api/caja/${seguimientoId}`, { headers })
    if (res.ok) return await res.json()
  } catch {
    // fallback
  }
  // Mock data
  return { ...MOCK_DATA, seguimiento: { ...MOCK_DATA.seguimiento, seguimientoId } }
}

/* ═══════════════════════════════════════════════════════════════════════════
   QUERY HOOK
   ═══════════════════════════════════════════════════════════════════════════ */

export function useCajaDetalle(seguimientoId: string) {
  return useQuery({
    queryKey: ['caja-detalle', seguimientoId],
    queryFn: () => fetchCajaDetalle(seguimientoId),
    enabled: !!seguimientoId,
  })
}

/* ═══════════════════════════════════════════════════════════════════════════
   MUTATION — Guardar / Actualizar Factura
   ═══════════════════════════════════════════════════════════════════════════ */

export function useGuardarFactura() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (payload: GuardarFacturaPayload) => {
      const headers = await authHeaders()
      const isUpdate = !!payload.facturaId
      const url = isUpdate
        ? `${API_BASE}/api/caja/${payload.seguimientoId}/facturas/${payload.facturaId}`
        : `${API_BASE}/api/caja/${payload.seguimientoId}/facturas`
      const method = isUpdate ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Error al guardar factura')
      return await res.json()
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['caja-detalle', variables.seguimientoId] })
    },
  })
}

/* ═══════════════════════════════════════════════════════════════════════════
   MUTATION — Eliminar Factura (soft delete)
   ═══════════════════════════════════════════════════════════════════════════ */

export function useEliminarFactura() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (payload: EliminarFacturaPayload) => {
      const headers = await authHeaders()
      const res = await fetch(
        `${API_BASE}/api/caja/${payload.seguimientoId}/facturas/${payload.facturaId}`,
        {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ Activo: 0 }),
        },
      )
      if (!res.ok) throw new Error('Error al eliminar factura')
      return await res.json()
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['caja-detalle', variables.seguimientoId] })
    },
  })
}

/* ═══════════════════════════════════════════════════════════════════════════
   MUTATION — Confirmar Egreso
   ═══════════════════════════════════════════════════════════════════════════ */

export function useConfirmarEgreso() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (payload: ConfirmarEgresoPayload) => {
      const headers = await authHeaders()
      const res = await fetch(
        `${API_BASE}/api/caja/${payload.seguimientoId}/egreso`,
        {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ egreso: true }),
        },
      )
      if (!res.ok) throw new Error('Error al confirmar egreso')
      return await res.json()
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['caja-detalle', variables.seguimientoId] })
    },
  })
}
