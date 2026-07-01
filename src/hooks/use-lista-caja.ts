import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ESTUDIO_ADICIONAL_ID,
  ESTUDIO_COL_IDS,
  fetchEstudiosPacienteForSeguimientos,
  fetchSeguimientosDelDia,
  type EstudioPacienteRow,
  type SeguimientoDelDia,
} from '@/lib/pacientes-firestore'
import {
  useSeguimientosDiaSync,
  type SeguimientosDiaSnapshot,
} from './use-seguimientos-dia-sync'

/* ═══════════════════════════════════════════════════════════════════════════
   TIPOS
   ═══════════════════════════════════════════════════════════════════════════ */

/** Celda de estudio en Caja: estatus + letra del médico (solo en Completo). */
export interface EstudioCajaCell {
  estatusId: number
  letraMedico: string | null
}

export interface PacienteCaja {
  seguimientoId: string
  turno: number
  nombre: string
  edad: number | null
  paqueteNombre: string | null
  peso: number | null
  talla: number | null
  desayuno: 0 | 1 | 2
  tarjetaEntRes: 0 | 1 | 2 | null
  estatusValpac: 0 | 1 | 2
  medicoInternista: string | null
  estudios: Record<number, EstudioCajaCell> // estudioId → celda
}

export const LISTA_CAJA_QUERY_KEY = ['lista-caja-pacientes']

/* ═══════════════════════════════════════════════════════════════════════════
   FIRESTORE — construir filas desde seguimientos + estudios_paciente
   ═══════════════════════════════════════════════════════════════════════════ */

function buildPacienteCaja(s: SeguimientoDelDia, eps: EstudioPacienteRow[]): PacienteCaja {
  // Base: las 20 columnas fijas inicializadas en "No Incluido" (fuera del paquete),
  // igual que Lista del Día. Los estudios del paquete se sobreponen abajo con su
  // estatus real (estudios_paciente).
  const estudios: Record<number, EstudioCajaCell> = {}
  for (const id of ESTUDIO_COL_IDS) estudios[id] = { estatusId: 1, letraMedico: null }

  for (const ep of eps) {
    if (ep.estudioId === ESTUDIO_ADICIONAL_ID) continue
    const key = Number(ep.estudioId)
    if (!Number.isFinite(key) || !(key in estudios)) continue
    estudios[key] = {
      estatusId: Number(ep.estatusEstudioId) || 0,
      letraMedico: ep.letraMedico,
    }
  }

  return {
    seguimientoId: s.seguimientoId,
    turno: s.turno,
    nombre: s.nombre,
    edad: s.edad,
    paqueteNombre: s.paqueteNombre,
    peso: s.peso,
    talla: s.talla,
    desayuno: s.desayuno,
    tarjetaEntRes: s.tarjetaEntRes,
    estatusValpac: s.estatusValpac,
    medicoInternista: s.medicoInternista,
    estudios,
  }
}

/** Construye las filas de Caja a partir de un snapshot combinado. */
function buildListaCajaFromSnapshot({
  seguimientos,
  epBySeg,
}: SeguimientosDiaSnapshot): PacienteCaja[] {
  return seguimientos.map((s) => buildPacienteCaja(s, epBySeg.get(s.seguimientoId) ?? []))
}

async function fetchListaCaja(fecha: string): Promise<PacienteCaja[]> {
  const seguimientos = await fetchSeguimientosDelDia(fecha, true)
  if (seguimientos.length === 0) return []

  const segIds = seguimientos.map((s) => s.seguimientoId)
  const eps = await fetchEstudiosPacienteForSeguimientos(segIds)

  const bySeg = new Map<string, EstudioPacienteRow[]>()
  for (const ep of eps) {
    const arr = bySeg.get(ep.seguimientoId)
    if (arr) arr.push(ep)
    else bySeg.set(ep.seguimientoId, [ep])
  }

  return seguimientos.map((s) => buildPacienteCaja(s, bySeg.get(s.seguimientoId) ?? []))
}

/* ═══════════════════════════════════════════════════════════════════════════
   HOOK PRINCIPAL
   ═══════════════════════════════════════════════════════════════════════════ */

export function useListaCaja(fecha: string) {
  const qc = useQueryClient()

  const result = useQuery({
    queryKey: [...LISTA_CAJA_QUERY_KEY, fecha],
    queryFn: () => fetchListaCaja(fecha),
    // El listener onSnapshot es la fuente viva: sin polling ni refetch por foco.
    staleTime: Infinity,
    refetchInterval: false,
    refetchOnWindowFocus: false,
  })

  const handleSnapshot = useCallback(
    (snapshot: SeguimientosDiaSnapshot) => {
      qc.setQueryData<PacienteCaja[]>(
        [...LISTA_CAJA_QUERY_KEY, fecha],
        buildListaCajaFromSnapshot(snapshot),
      )
    },
    [qc, fecha],
  )

  useSeguimientosDiaSync(fecha, handleSnapshot)

  return result
}
