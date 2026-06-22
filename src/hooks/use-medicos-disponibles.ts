import { useMemo, useCallback } from 'react'
import { useEstudiosActivos } from '@/hooks/use-estudios'
import { useMedicoLugarEstudio } from '@/hooks/use-medico-lugar-estudio'
import { useMedicoDiaAsignaciones } from '@/hooks/use-medico-dia'
import { useMedicosActivos } from '@/hooks/use-medicos'
import {
  buildMedicoResolverContext,
  getMedicosDisponiblesParaEstudio,
  getMedicosPorLugar,
  isEstudioAsignable,
  type MedicoOption,
  type MedicoResolverContext,
} from '@/lib/medico-resolver'

export function useMedicosDisponiblesPorEstudio(fecha: string) {
  const { data: estudios = [], isLoading: loadingEstudios } = useEstudiosActivos()
  const { data: relaciones = [], isLoading: loadingRelaciones } = useMedicoLugarEstudio()
  const { data: asignaciones = [], isLoading: loadingAsignaciones } = useMedicoDiaAsignaciones(fecha)
  const { data: medicos = [], isLoading: loadingMedicos } = useMedicosActivos()

  const ctx = useMemo(
    () => buildMedicoResolverContext(estudios, relaciones, asignaciones, medicos),
    [estudios, relaciones, asignaciones, medicos],
  )

  const getMedicosForEstudio = useCallback(
    (estudioId: string | number): MedicoOption[] =>
      getMedicosDisponiblesParaEstudio(estudioId, ctx),
    [ctx],
  )

  const isAsignable = useCallback(
    (estudioId: string | number): boolean => isEstudioAsignable(estudioId, ctx.estudioLugarMap),
    [ctx.estudioLugarMap],
  )

  const getMedicosForLugar = useCallback(
    (lugarEstudioId: string): MedicoOption[] =>
      getMedicosPorLugar(lugarEstudioId, ctx),
    [ctx],
  )

  const isLoading = loadingEstudios || loadingRelaciones || loadingAsignaciones || loadingMedicos

  return {
    ctx,
    getMedicosForEstudio,
    getMedicosForLugar,
    isAsignable,
    estudioLugarMap: ctx.estudioLugarMap,
    isLoading,
  }
}

export type { MedicoOption, MedicoResolverContext }
