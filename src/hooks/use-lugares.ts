import { useQuery } from '@tanstack/react-query'
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
} from 'firebase/firestore'
import { getFirebaseFirestore } from '@/lib/firebase'

export interface LugarActivo {
  id: string
  nombre: string
}

async function fetchLugaresActivos(): Promise<LugarActivo[]> {
  const db = getFirebaseFirestore()
  const lugaresQuery = query(
    collection(db, 'lugares'),
    where('activo', '==', true),
    orderBy('nombre', 'asc'),
  )
  const snapshot = await getDocs(lugaresQuery)
  return snapshot.docs.map((d) => ({
    id: d.id,
    nombre: d.data().nombre ?? '',
  }))
}

export function useLugaresActivos() {
  return useQuery({
    queryKey: ['lugares-activos'],
    queryFn: fetchLugaresActivos,
  })
}
