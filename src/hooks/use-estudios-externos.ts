import { useMutation, useQueryClient } from '@tanstack/react-query'
import { getFirebaseAuth } from '@/lib/firebase'

/* ═══════════════════════════════════════════════════════════════════════════
   TIPOS
   ═══════════════════════════════════════════════════════════════════════════ */

export interface EstudioExternoPayload {
  fecha: string              // YYYY-MM-DD
  nombre_paciente: string
  nombre_estudio: string
  observaciones?: string
}

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
   HOOK — useRegistrarEstudioExterno
   ═══════════════════════════════════════════════════════════════════════════ */

export function useRegistrarEstudioExterno() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (data: EstudioExternoPayload) => {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/api/externos`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          fecha: data.fecha,
          nombre_paciente: data.nombre_paciente,
          nombre_estudio: data.nombre_estudio,
          observaciones: data.observaciones ?? '',
        }),
      })
      if (!res.ok) throw new Error('Error al registrar estudio externo')
      return await res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['estudios-externos'] })
    },
  })
}
