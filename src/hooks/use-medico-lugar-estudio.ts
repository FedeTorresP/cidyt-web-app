import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore'
import { useAuth } from '@/hooks/use-auth'
import { getFirebaseFirestore } from '@/lib/firebase'
import type { MedicoLugarEstudio } from '@/types/models'

async function fetchMedicoLugarEstudio(): Promise<MedicoLugarEstudio[]> {
  const db = getFirebaseFirestore()
  const bridgeQuery = query(
    collection(db, 'medico_lugar_estudio'),
    where('activo', '==', true),
  )
  const snapshot = await getDocs(bridgeQuery)
  return snapshot.docs.map((d) => {
    const data = d.data()
    return {
      id: d.id,
      medicoId: String(data.medicoId ?? ''),
      lugarEstudioId: String(data.lugarEstudioId ?? ''),
      activo: data.activo === true,
    }
  })
}

export function useMedicoLugarEstudio() {
  const { user, loading: authLoading } = useAuth()

  return useQuery({
    queryKey: ['medico-lugar-estudio'],
    queryFn: fetchMedicoLugarEstudio,
    enabled: !!user && !authLoading,
  })
}

/** Médico IDs que pueden atender un área/rama (`lugar_estudio`). */
export function buildMedicosPorLugarEstudio(
  relaciones: MedicoLugarEstudio[],
): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const rel of relaciones) {
    if (!rel.activo) continue
    const list = map.get(rel.lugarEstudioId) ?? []
    list.push(rel.medicoId)
    map.set(rel.lugarEstudioId, list)
  }
  return map
}

export function useMedicosPorLugarEstudioMap() {
  const { data: relaciones = [], ...rest } = useMedicoLugarEstudio()
  const map = useMemo(
    () => buildMedicosPorLugarEstudio(relaciones),
    [relaciones],
  )
  return { map, relaciones, ...rest }
}
