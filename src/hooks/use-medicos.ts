import { useQuery } from '@tanstack/react-query'
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
} from 'firebase/firestore'
import { getFirebaseFirestore } from '@/lib/firebase'

export interface MedicoActivo {
  id: string
  nombreCompleto: string | null
}

async function fetchMedicosActivos(): Promise<MedicoActivo[]> {
  const db = getFirebaseFirestore()
  const medicosQuery = query(
    collection(db, 'medicos'),
    where('activo', '==', true),
    orderBy('nombreCompleto', 'asc'),
  )
  const snapshot = await getDocs(medicosQuery)
  return snapshot.docs.map((d) => ({
    id: d.id,
    nombreCompleto: d.data().nombreCompleto ?? null,
  }))
}

export function useMedicosActivos() {
  return useQuery({
    queryKey: ['medicos-activos'],
    queryFn: fetchMedicosActivos,
  })
}
