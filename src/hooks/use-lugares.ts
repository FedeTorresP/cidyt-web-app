import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/hooks/use-auth'
import { fetchActiveCatalog, sortByNombre } from '@/lib/firestore-catalog'
import type { LugarEstudio } from '@/types/models'

/** Área/rama activa — lee la colección Firestore `lugar_estudio`. */
export type LugarActivo = Pick<LugarEstudio, 'id' | 'nombre'>

async function fetchLugaresEstudioActivos(): Promise<LugarActivo[]> {
  return fetchActiveCatalog(
    'lugar_estudio',
    (id, data) => ({
      id,
      nombre: String(data.nombre ?? ''),
    }),
    sortByNombre,
  )
}

export function useLugaresActivos() {
  const { user, loading: authLoading } = useAuth()

  return useQuery({
    queryKey: ['lugar-estudio-activos'],
    queryFn: fetchLugaresEstudioActivos,
    enabled: !!user && !authLoading,
  })
}
