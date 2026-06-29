import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/hooks/use-auth'
import { fetchActiveCatalog, sortByNombreCompleto } from '@/lib/firestore-catalog'
import type { Medico } from '@/types/models'

export type MedicoActivo = Pick<Medico, 'id' | 'nombreCompleto' | 'letra'>

async function fetchMedicosActivos(): Promise<MedicoActivo[]> {
  return fetchActiveCatalog(
    'medicos',
    (id, data) => {
      const letraRaw = data.letra
      return {
        id,
        nombreCompleto: data.nombreCompleto ?? null,
        letra: typeof letraRaw === 'string' && letraRaw.trim() !== '' ? letraRaw.trim() : null,
      }
    },
    sortByNombreCompleto,
  )
}

/** Mapa medicoId → letra para enriquecer listados operacionales (p. ej. cubículos TV). */
export async function fetchMedicoLetraMap(): Promise<Map<string, string>> {
  const medicos = await fetchMedicosActivos()
  const map = new Map<string, string>()
  for (const m of medicos) {
    if (m.letra) map.set(m.id, m.letra)
  }
  return map
}

export function useMedicosActivos() {
  const { user, loading: authLoading } = useAuth()

  return useQuery({
    queryKey: ['medicos-activos'],
    queryFn: fetchMedicosActivos,
    enabled: !!user && !authLoading,
  })
}

/**
 * Un médico es Internista cuando no tiene letra asignada o cuando el campo
 * de letra (Nombre_Corto) contiene literalmente "INTERNISTA".
 */
export function esMedicoInternista(m: Pick<Medico, 'letra'>): boolean {
  const l = m.letra?.trim().toUpperCase()
  return !l || l === 'INTERNISTA'
}

/**
 * Etiqueta para mostrar un médico: la letra cuando es un médico de área,
 * o la palabra "INTERNISTA" para el segundo conjunto de médicos.
 */
export function formatMedicoLabel(letra: string | null, nombre: string | null): string {
  const nom = nombre ?? 'Sin nombre'
  return esMedicoInternista({ letra }) ? `INTERNISTA — ${nom}` : `${letra} — ${nom}`
}
