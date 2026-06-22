import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchCatalogMaintenanceList,
  createCatalogItem,
  updateCatalogItem,
  setCatalogActive,
  type CatalogCreateInput,
  type CatalogUpdateInput,
} from '@/lib/firestore-catalog-crud'
import type { CatalogMaintenanceCollection } from '@/types/models'

export function catalogMaintenanceQueryKey(collection: CatalogMaintenanceCollection) {
  return ['catalog-maintenance', collection] as const
}

export function useCatalogMaintenanceList(collection: CatalogMaintenanceCollection) {
  return useQuery({
    queryKey: catalogMaintenanceQueryKey(collection),
    queryFn: () => fetchCatalogMaintenanceList(collection),
  })
}

export function useCreateCatalogItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CatalogCreateInput) => createCatalogItem(input),
    onSuccess: (_id, input) => {
      qc.invalidateQueries({ queryKey: catalogMaintenanceQueryKey(input.collection) })
    },
  })
}

export function useUpdateCatalogItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CatalogUpdateInput) => updateCatalogItem(input),
    onSuccess: (_data, input) => {
      qc.invalidateQueries({ queryKey: catalogMaintenanceQueryKey(input.collection) })
    },
  })
}

export function useSetCatalogActive() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      collection,
      id,
      activo,
    }: {
      collection: CatalogMaintenanceCollection
      id: string
      activo: boolean
    }) => setCatalogActive(collection, id, activo),
    onSuccess: (_data, input) => {
      qc.invalidateQueries({ queryKey: catalogMaintenanceQueryKey(input.collection) })
    },
  })
}
