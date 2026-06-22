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

export function useMedicosActivos() {
  const { user, loading: authLoading } = useAuth()

  return useQuery({
    queryKey: ['medicos-activos'],
    queryFn: fetchMedicosActivos,
    enabled: !!user && !authLoading,
  })
}
