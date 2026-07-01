import { useCallback } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  addDoc,
} from 'firebase/firestore'
import { getFirebaseFirestore } from '@/lib/firebase'
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

export interface EstudioCellState {
  estatusId: number
  medicoId?: string | null
  letraMedico?: string | null
  estudiosPacienteId?: string | null
}

export interface EstudioAdicionalListaDia {
  id: string
  nombre: string
  estatusEstId: number
  letraEstAdic: string | null
  observaciones: string | null
}

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
  estudiosAdicionales?: EstudioAdicionalListaDia[]
  estudios: Record<number, EstudioCellState>
}

export interface UpdateEstudioPacienteInput {
  seguimientoId: string
  estudioId: number
  estatusEstudioId: number
  medicoId?: string | null
  letraMedico?: string | null
  estudiosPacienteId?: string | null
}

export const LISTA_DIA_QUERY_KEY = ['lista-dia-pacientes']

const ESTATUS_CON_LETRA = new Set([4]) // Completo — conservar letra del médico

/* ═══════════════════════════════════════════════════════════════════════════
   HELPERS — normalización estudios
   ═══════════════════════════════════════════════════════════════════════════ */

export function normalizeEstudios(
  raw: Record<number, number | EstudioCellState> | undefined,
): Record<number, EstudioCellState> {
  if (!raw) return {}
  const out: Record<number, EstudioCellState> = {}
  for (const [key, val] of Object.entries(raw)) {
    const estudioId = Number(key)
    if (typeof val === 'number') {
      out[estudioId] = { estatusId: val }
    } else {
      out[estudioId] = { ...val, estatusId: val.estatusId ?? 0 }
    }
  }
  return out
}

/* ═══════════════════════════════════════════════════════════════════════════
   FIRESTORE — construir filas desde seguimientos + estudios_paciente
   ═══════════════════════════════════════════════════════════════════════════ */

function buildPacienteListaDia(
  s: SeguimientoDelDia,
  eps: EstudioPacienteRow[],
): PacienteListaDia {
  // Base: las 20 columnas fijas inicializadas en "No Incluido" (fuera del paquete).
  // Los estudios del paquete se sobreponen abajo con su estatus real (estudios_paciente).
  const estudios: Record<number, EstudioCellState> = {}
  for (const id of ESTUDIO_COL_IDS) estudios[id] = { estatusId: 1 }

  const adicionales: EstudioAdicionalListaDia[] = []
  for (const ep of eps) {
    if (ep.estudioId === ESTUDIO_ADICIONAL_ID) {
      adicionales.push({
        id: ep.docId,
        nombre: ep.nombre ?? '',
        estatusEstId: Number(ep.estatusEstudioId) || 0,
        letraEstAdic: ep.letraMedico,
        observaciones: ep.observaciones || null,
      })
      continue
    }
    const key = Number(ep.estudioId)
    if (!Number.isFinite(key) || !(key in estudios)) continue
    estudios[key] = {
      estatusId: Number(ep.estatusEstudioId) || 0,
      medicoId: ep.medicoId,
      letraMedico: ep.letraMedico,
      estudiosPacienteId: ep.docId,
    }
  }

  return {
    seguimientoId: s.seguimientoId,
    turno: s.turno,
    nombre: s.nombre,
    desayuno: s.desayuno,
    estatusValpac: s.estatusValpac,
    padecimientoId: s.padecimientoId,
    medicoInternista: s.medicoInternista,
    paqueteId: s.paqueteId,
    paqueteNombre: s.paqueteNombre ?? '',
    edad: s.edad ?? 0,
    peso: s.peso ?? 0,
    talla: s.talla ?? 0,
    fechaEntrega: s.fechaEntrega,
    horaEntrega: s.horaEntrega,
    tarjetaEntRes: s.tarjetaEntRes,
    tieneAdicionales: adicionales.length > 0,
    estudiosAdicionales: adicionales,
    estudios,
  }
}

/** Construye las filas de Lista del Día a partir de un snapshot combinado. */
function buildListaDiaFromSnapshot({
  seguimientos,
  epBySeg,
}: SeguimientosDiaSnapshot): PacienteListaDia[] {
  return seguimientos.map((s) => buildPacienteListaDia(s, epBySeg.get(s.seguimientoId) ?? []))
}

async function fetchListaDia(fecha: string): Promise<PacienteListaDia[]> {
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

  return seguimientos.map((s) => buildPacienteListaDia(s, bySeg.get(s.seguimientoId) ?? []))
}

/* ═══════════════════════════════════════════════════════════════════════════
   FIRESTORE — escribir estudios_paciente
   ═══════════════════════════════════════════════════════════════════════════ */

async function persistEstudioPaciente(input: UpdateEstudioPacienteInput): Promise<string | null> {
  const db = getFirebaseFirestore()
  const estudioIdStr = String(input.estudioId)
  const estatusStr = String(input.estatusEstudioId)

  const payload = {
    estatusEstudioId: estatusStr,
    medicoId: input.medicoId ?? null,
    letraMedico: input.letraMedico ?? null,
  }

  if (input.estudiosPacienteId) {
    await updateDoc(doc(db, 'estudios_paciente', input.estudiosPacienteId), payload)
    return input.estudiosPacienteId
  }

  const snap = await getDocs(
    query(
      collection(db, 'estudios_paciente'),
      where('seguimientoId', '==', input.seguimientoId),
      where('estudioId', '==', estudioIdStr),
      where('activo', '==', true),
    ),
  )

  if (!snap.empty) {
    const docId = snap.docs[0].id
    await updateDoc(doc(db, 'estudios_paciente', docId), payload)
    return docId
  }

  const ref = await addDoc(collection(db, 'estudios_paciente'), {
    seguimientoId: input.seguimientoId,
    estudioId: estudioIdStr,
    estatusEstudioId: estatusStr,
    medicoId: input.medicoId ?? null,
    letraMedico: input.letraMedico ?? null,
    activo: true,
  })
  return ref.id
}

/** Calcula el nuevo estado de celda al cambiar estatus (limpia letra si aplica). */
export function buildEstudioCellUpdate(
  prev: EstudioCellState | undefined,
  estatusId: number,
  medicoId?: string | null,
  letraMedico?: string | null,
): EstudioCellState {
  const keepLetter = ESTATUS_CON_LETRA.has(estatusId)
  return {
    estatusId,
    estudiosPacienteId: prev?.estudiosPacienteId ?? null,
    medicoId: keepLetter ? (medicoId ?? prev?.medicoId ?? null) : null,
    letraMedico: keepLetter ? (letraMedico ?? prev?.letraMedico ?? null) : null,
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   HOOK PRINCIPAL
   ═══════════════════════════════════════════════════════════════════════════ */

export function useListaDia(fecha: string) {
  const qc = useQueryClient()

  const result = useQuery({
    queryKey: [...LISTA_DIA_QUERY_KEY, fecha],
    queryFn: () => fetchListaDia(fecha),
    // El listener onSnapshot es la fuente viva: sin polling ni refetch por foco.
    staleTime: Infinity,
    refetchInterval: false,
    refetchOnWindowFocus: false,
  })

  const handleSnapshot = useCallback(
    (snapshot: SeguimientosDiaSnapshot) => {
      qc.setQueryData<PacienteListaDia[]>(
        [...LISTA_DIA_QUERY_KEY, fecha],
        buildListaDiaFromSnapshot(snapshot),
      )
    },
    [qc, fecha],
  )

  useSeguimientosDiaSync(fecha, handleSnapshot)

  return result
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

export function useUpdateEstudioPaciente(fecha: string) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: persistEstudioPaciente,
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: [...LISTA_DIA_QUERY_KEY, fecha] })
      const previous = qc.getQueryData<PacienteListaDia[]>([...LISTA_DIA_QUERY_KEY, fecha])

      qc.setQueryData<PacienteListaDia[]>(
        [...LISTA_DIA_QUERY_KEY, fecha],
        (old) => {
          if (!old) return old
          return old.map((p) => {
            if (p.seguimientoId !== input.seguimientoId) return p
            const prevCell = p.estudios[input.estudioId]
            const newCell = buildEstudioCellUpdate(
              prevCell,
              input.estatusEstudioId,
              input.medicoId,
              input.letraMedico,
            )
            return {
              ...p,
              estudios: { ...p.estudios, [input.estudioId]: newCell },
            }
          })
        },
      )

      return { previous }
    },
    onError: (_err, _input, context) => {
      if (context?.previous) {
        qc.setQueryData([...LISTA_DIA_QUERY_KEY, fecha], context.previous)
      }
    },
    onSuccess: (docId, input) => {
      if (docId) {
        qc.setQueryData<PacienteListaDia[]>(
          [...LISTA_DIA_QUERY_KEY, fecha],
          (old) => {
            if (!old) return old
            return old.map((p) => {
              if (p.seguimientoId !== input.seguimientoId) return p
              const cell = p.estudios[input.estudioId]
              if (!cell) return p
              return {
                ...p,
                estudios: {
                  ...p.estudios,
                  [input.estudioId]: { ...cell, estudiosPacienteId: docId },
                },
              }
            })
          },
        )
      }
      // Correlación con Lista de Pacientes Caja: la fuente de verdad es
      // `estudios_paciente` (ya persistido). El listener onSnapshot de Caja
      // propaga el nuevo estatus en tiempo real (mismo dispositivo u otros iPad),
      // por lo que ya no se invalida el cache de Caja manualmente.
    },
  })
}
