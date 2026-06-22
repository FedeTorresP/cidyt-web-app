import { buildEstudioLugarMap } from '@/hooks/use-estudios'
import { buildMedicosPorLugarEstudio } from '@/hooks/use-medico-lugar-estudio'
import { buildMedicosPresentesPorLugar } from '@/hooks/use-medico-dia'
import type { EstudioCatalogo } from '@/hooks/use-estudios'
import type { MedicoLugarEstudio } from '@/types/models'
import type { AsignacionDia } from '@/hooks/use-medico-dia'

export interface MedicoOption {
  id: string
  letra: string | null
  nombreCompleto: string | null
}

export interface MedicoResolverContext {
  estudioLugarMap: Map<string, string>
  medicosPorLugar: Map<string, string[]>
  presentesPorLugar: Map<string, string[]>
  medicosCatalog: Map<string, MedicoOption>
}

export function buildMedicoCatalogMap(
  medicos: Array<{ id: string; letra: string | null; nombreCompleto: string | null }>,
): Map<string, MedicoOption> {
  const map = new Map<string, MedicoOption>()
  for (const m of medicos) {
    map.set(m.id, { id: m.id, letra: m.letra, nombreCompleto: m.nombreCompleto })
  }
  return map
}

export function buildMedicoResolverContext(
  estudios: EstudioCatalogo[],
  relaciones: MedicoLugarEstudio[],
  asignaciones: AsignacionDia[],
  medicos: Array<{ id: string; letra: string | null; nombreCompleto: string | null }>,
): MedicoResolverContext {
  return {
    estudioLugarMap: buildEstudioLugarMap(estudios),
    medicosPorLugar: buildMedicosPorLugarEstudio(relaciones),
    presentesPorLugar: buildMedicosPresentesPorLugar(asignaciones),
    medicosCatalog: buildMedicoCatalogMap(medicos),
  }
}

/** Estudio tiene área asignable (lugar_estudio). */
export function isEstudioAsignable(
  estudioId: string | number,
  estudioLugarMap: Map<string, string>,
): boolean {
  return estudioLugarMap.has(String(estudioId))
}

function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids)]
}

/** Médicos elegibles (catálogo ∩ presentes hoy) para un estudio. */
export function getMedicosDisponiblesParaEstudio(
  estudioId: string | number,
  ctx: MedicoResolverContext,
): MedicoOption[] {
  const lugarEstudioId = ctx.estudioLugarMap.get(String(estudioId))
  if (!lugarEstudioId) return []

  const elegibles = ctx.medicosPorLugar.get(lugarEstudioId) ?? []
  const presentes = ctx.presentesPorLugar.get(lugarEstudioId) ?? []
  const presentesSet = new Set(presentes)

  const disponibles = uniqueIds(elegibles.filter((id) => presentesSet.has(id)))

  return disponibles
    .map((id) => ctx.medicosCatalog.get(id))
    .filter((m): m is MedicoOption => m != null)
    .sort((a, b) => (a.letra ?? a.nombreCompleto ?? '').localeCompare(b.letra ?? b.nombreCompleto ?? '', 'es'))
}

/** Médicos del catálogo que pueden atender un área (sin filtrar asistencia). */
export function getMedicosPorLugar(
  lugarEstudioId: string,
  ctx: Pick<MedicoResolverContext, 'medicosPorLugar' | 'medicosCatalog'>,
): MedicoOption[] {
  const ids = ctx.medicosPorLugar.get(lugarEstudioId) ?? []
  return uniqueIds(ids)
    .map((id) => ctx.medicosCatalog.get(id))
    .filter((m): m is MedicoOption => m != null)
    .sort((a, b) => (a.letra ?? a.nombreCompleto ?? '').localeCompare(b.letra ?? b.nombreCompleto ?? '', 'es'))
}
