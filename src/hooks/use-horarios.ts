import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/hooks/use-auth'
import { fetchActiveCatalog, sortByNombre } from '@/lib/firestore-catalog'

export interface HorarioActivo {
  id: string
  nombre: string
}

async function fetchHorariosActivos(): Promise<HorarioActivo[]> {
  return fetchActiveCatalog(
    'horarios',
    (id, data) => ({
      id,
      nombre: String(data.nombre ?? ''),
    }),
    sortByNombre,
  )
}

export function useHorariosActivos() {
  const { user, loading: authLoading } = useAuth()

  return useQuery({
    queryKey: ['horarios-activos'],
    queryFn: fetchHorariosActivos,
    enabled: !!user && !authLoading,
  })
}
