import {
  collection,
  query,
  where,
  getDocs,
  type DocumentData,
} from 'firebase/firestore'
import { getFirebaseFirestore } from '@/lib/firebase'

/**
 * Lee documentos activos sin orderBy en Firestore (evita índices compuestos).
 * Filtra y ordena en cliente.
 */
export async function fetchActiveCatalog<T>(
  collectionName: string,
  mapDoc: (id: string, data: DocumentData) => T,
  sortFn?: (a: T, b: T) => number,
): Promise<T[]> {
  const db = getFirebaseFirestore()
  const catalogQuery = query(
    collection(db, collectionName),
    where('activo', '==', true),
  )
  const snapshot = await getDocs(catalogQuery)
  const items = snapshot.docs.map((d) => mapDoc(d.id, d.data()))
  if (sortFn) items.sort(sortFn)
  return items
}

export function sortByNombre(a: { nombre: string }, b: { nombre: string }): number {
  return a.nombre.localeCompare(b.nombre, 'es')
}

export function sortByNombreCompleto(
  a: { nombreCompleto: string | null },
  b: { nombreCompleto: string | null },
): number {
  return (a.nombreCompleto ?? '').localeCompare(b.nombreCompleto ?? '', 'es')
}
