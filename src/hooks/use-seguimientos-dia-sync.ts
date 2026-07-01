import { useEffect, useRef, useState } from 'react'
import type { FirestoreError } from 'firebase/firestore'
import { toast } from 'sonner'
import {
  chunkSeguimientoIds,
  mapSeguimientoRow,
  resolveSeguimientoAuxMaps,
  subscribeEstudiosPacienteChunk,
  subscribeSeguimientosDelDia,
  type EstudioPacienteRow,
  type SeguimientoAuxMaps,
  type SeguimientoDelDia,
  type SeguimientoDocRaw,
} from '@/lib/pacientes-firestore'

/**
 * Datos combinados que emite el motor de sincronización: los seguimientos ya
 * resueltos y los `estudios_paciente` agrupados por `seguimientoId`.
 */
export interface SeguimientosDiaSnapshot {
  seguimientos: SeguimientoDelDia[]
  epBySeg: Map<string, EstudioPacienteRow[]>
}

/**
 * Motor de sincronización en tiempo real de los datos operativos del día.
 *
 * - 1 listener sobre `seguimientos` del día (rango `fechaIngresoUtc`, `activo`).
 * - N listeners sobre `estudios_paciente` en chunks de ≤30 `seguimientoId`, que
 *   se re-suscriben SOLO cuando cambia el conjunto de ids (altas/bajas).
 * - Mapas auxiliares (paciente/paquete/médico/antropometría) se resuelven vía
 *   `getDoc/getDocs` únicamente cuando cambia el conjunto de ids.
 *
 * Emite el snapshot combinado a `onData` cada vez que algo cambia. El consumidor
 * decide cómo integrarlo (p. ej. `setQueryData`). `onData` puede ser inestable;
 * se lee siempre la última referencia.
 */
export function useSeguimientosDiaSync(
  fecha: string,
  onData: (snapshot: SeguimientosDiaSnapshot) => void,
): { isLoading: boolean; error: FirestoreError | null } {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<FirestoreError | null>(null)

  const onDataRef = useRef(onData)
  onDataRef.current = onData

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError(null)

    // Estado vivo de la suscripción (refs para evitar re-render / re-suscripción).
    let rawRows: SeguimientoDocRaw[] | null = null
    let aux: SeguimientoAuxMaps | null = null
    let idsKey = '' // clave del conjunto ordenado de ids actualmente suscrito
    let auxGen = 0 // generación para descartar resoluciones auxiliares obsoletas
    let epUnsubs: Array<() => void> = []
    let epChunkRows: EstudioPacienteRow[][] = []

    const errorToastId = `seg-dia-sync-${fecha}`

    function handleError(err: FirestoreError) {
      if (cancelled) return
      setError(err)
      toast.error('Se perdió la sincronización en tiempo real. Reintentando…', {
        id: errorToastId,
      })
    }

    function emit() {
      if (cancelled || !rawRows || !aux) return
      const resolvedAux = aux
      const epBySeg = new Map<string, EstudioPacienteRow[]>()
      for (const rows of epChunkRows) {
        for (const ep of rows) {
          const arr = epBySeg.get(ep.seguimientoId)
          if (arr) arr.push(ep)
          else epBySeg.set(ep.seguimientoId, [ep])
        }
      }
      const seguimientos = rawRows.map((r) => mapSeguimientoRow(r.id, r.data, resolvedAux))
      onDataRef.current({ seguimientos, epBySeg })
      setIsLoading(false)
    }

    function teardownEpListeners() {
      for (const unsub of epUnsubs) unsub()
      epUnsubs = []
      epChunkRows = []
    }

    function resubscribeEstudios(segIds: string[]) {
      teardownEpListeners()
      const chunks = chunkSeguimientoIds(segIds)
      epChunkRows = chunks.map(() => [])
      epUnsubs = chunks.map((chunk, index) =>
        subscribeEstudiosPacienteChunk(
          chunk,
          (rows) => {
            if (cancelled) return
            epChunkRows[index] = rows
            emit()
          },
          handleError,
        ),
      )
    }

    const segUnsub = subscribeSeguimientosDelDia(
      fecha,
      (rows) => {
        if (cancelled) return
        rawRows = rows

        if (rows.length === 0) {
          idsKey = ''
          aux = { pacientesMap: new Map(), paquetesMap: new Map(), medicosMap: new Map(), valMap: new Map() }
          teardownEpListeners()
          emit()
          return
        }

        const sortedIds = rows.map((r) => r.id).sort()
        const nextIdsKey = sortedIds.join('|')

        if (nextIdsKey !== idsKey) {
          // El conjunto de seguimientos cambió (alta/baja): re-resolver
          // auxiliares y re-suscribir los listeners de estudios por chunk.
          idsKey = nextIdsKey
          const gen = ++auxGen
          resubscribeEstudios(sortedIds)
          resolveSeguimientoAuxMaps(rows)
            .then((resolved) => {
              if (cancelled || gen !== auxGen) return
              aux = resolved
              emit()
            })
            .catch(() => {
              if (cancelled || gen !== auxGen) return
              // Sin auxiliares aún no podemos construir filas; se reintenta en
              // el próximo snapshot. No bloqueamos la vista con error fatal.
            })
        } else if (aux) {
          // Mismo conjunto de ids: solo cambiaron campos del seguimiento
          // (desayuno, estatusValpac, etc.). Reutilizamos los auxiliares.
          emit()
        }
      },
      handleError,
    )

    return () => {
      cancelled = true
      segUnsub()
      teardownEpListeners()
    }
  }, [fecha])

  return { isLoading, error }
}
