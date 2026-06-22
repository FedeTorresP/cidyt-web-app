import { useQuery } from '@tanstack/react-query'
import {
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore'
import { useAuth } from '@/hooks/use-auth'
import { getFirebaseFirestore } from '@/lib/firebase'
import type { Estudio } from '@/types/models'

export type EstudioCatalogo = Pick<
  Estudio,
  'id' | 'nombre' | 'abreviatura' | 'lugarEstudioId' | 'ordenMostrar' | 'activo'
>

async function fetchEstudiosActivos(): Promise<EstudioCatalogo[]> {
  const db = getFirebaseFirestore()
  const estudiosQuery = query(
    collection(db, 'estudios'),
    where('activo', '==', true),
  )
  const snapshot = await getDocs(estudiosQuery)
  return snapshot.docs
    .map((d) => {
      const data = d.data()
      const lugarEstudioId = data.lugarEstudioId
      return {
        id: d.id,
        nombre: data.nombre ?? '',
        abreviatura: data.abreviatura ?? undefined,
        lugarEstudioId:
          typeof lugarEstudioId === 'string' && lugarEstudioId !== ''
            ? lugarEstudioId
            : null,
        ordenMostrar: data.ordenMostrar ?? undefined,
        activo: data.activo === true,
      }
    })
    .sort((a, b) => (a.ordenMostrar ?? 0) - (b.ordenMostrar ?? 0))
}

export function useEstudiosActivos() {
  const { user, loading: authLoading } = useAuth()

  return useQuery({
    queryKey: ['estudios-activos'],
    queryFn: fetchEstudiosActivos,
    enabled: !!user && !authLoading,
  })
}

/** Mapa estudioId → lugarEstudioId para estudios con médico asignable. */
export function buildEstudioLugarMap(estudios: EstudioCatalogo[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const estudio of estudios) {
    if (estudio.lugarEstudioId) {
      map.set(estudio.id, estudio.lugarEstudioId)
    }
  }
  return map
}
