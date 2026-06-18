import { useQuery } from '@tanstack/react-query'
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
} from 'firebase/firestore'
import { getFirebaseFirestore } from '@/lib/firebase'

export interface HorarioActivo {
  id: string
  nombre: string
}

async function fetchHorariosActivos(): Promise<HorarioActivo[]> {
  const db = getFirebaseFirestore()
  const horariosQuery = query(
    collection(db, 'horarios'),
    where('activo', '==', true),
    orderBy('nombre', 'asc'),
  )
  const snapshot = await getDocs(horariosQuery)
  return snapshot.docs.map((d) => ({
    id: d.id,
    nombre: d.data().nombre ?? '',
  }))
}

export function useHorariosActivos() {
  return useQuery({
    queryKey: ['horarios-activos'],
    queryFn: fetchHorariosActivos,
  })
}
