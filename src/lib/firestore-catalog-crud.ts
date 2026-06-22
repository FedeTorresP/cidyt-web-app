import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  type DocumentData,
  type UpdateData,
} from 'firebase/firestore'
import { getFirebaseFirestore } from '@/lib/firebase'
import type {
  CatalogMaintenanceCollection,
  Cubiculo,
  Empresa,
  Especialidad,
} from '@/types/models'

export type CatalogMaintenanceItem = Cubiculo | Empresa | Especialidad

/**
 * Lee todos los documentos de un catálogo (activos e inactivos).
 */
export async function fetchCatalogAll<T>(
  collectionName: CatalogMaintenanceCollection,
  mapDoc: (id: string, data: DocumentData) => T,
  sortFn?: (a: T, b: T) => number,
): Promise<T[]> {
  const db = getFirebaseFirestore()
  const snapshot = await getDocs(collection(db, collectionName))
  const items = snapshot.docs.map((d) => mapDoc(d.id, d.data()))
  if (sortFn) items.sort(sortFn)
  return items
}

function mapCubiculo(id: string, data: DocumentData): Cubiculo {
  return {
    id,
    nombre: data.nombre ?? null,
    descripcion: data.descripcion ?? null,
    entidadId: data.entidadId ?? null,
    estatusCubiculoId: data.estatusCubiculoId ?? data.estatusCubiculo ?? '1',
    ordenMostrar: data.ordenMostrar ?? null,
    activo: data.activo !== false,
  }
}

function mapEmpresa(id: string, data: DocumentData): Empresa {
  return {
    id,
    nombre: data.nombre ?? '',
    descripcion: data.descripcion ?? null,
    alias: data.alias ?? null,
    ordenMostrar: data.ordenMostrar ?? null,
    activo: data.activo !== false,
  }
}

function mapEspecialidad(id: string, data: DocumentData): Especialidad {
  return {
    id,
    nombre: data.nombre ?? '',
    descripcion: data.descripcion ?? null,
    activo: data.activo !== false,
  }
}

const MAPPERS: Record<
  CatalogMaintenanceCollection,
  (id: string, data: DocumentData) => CatalogMaintenanceItem
> = {
  cubiculos: mapCubiculo,
  empresas: mapEmpresa,
  especialidades: mapEspecialidad,
}

const SORT_FNS: Record<
  CatalogMaintenanceCollection,
  (a: CatalogMaintenanceItem, b: CatalogMaintenanceItem) => number
> = {
  cubiculos: (a, b) => {
    const ca = a as Cubiculo
    const cb = b as Cubiculo
    const orderA = ca.ordenMostrar ?? Number.MAX_SAFE_INTEGER
    const orderB = cb.ordenMostrar ?? Number.MAX_SAFE_INTEGER
    if (orderA !== orderB) return orderA - orderB
    return (ca.nombre ?? '').localeCompare(cb.nombre ?? '', 'es')
  },
  empresas: (a, b) => {
    const ea = a as Empresa
    const eb = b as Empresa
    const orderA = ea.ordenMostrar ?? Number.MAX_SAFE_INTEGER
    const orderB = eb.ordenMostrar ?? Number.MAX_SAFE_INTEGER
    if (orderA !== orderB) return orderA - orderB
    return ea.nombre.localeCompare(eb.nombre, 'es')
  },
  especialidades: (a, b) =>
    (a as Especialidad).nombre.localeCompare((b as Especialidad).nombre, 'es'),
}

export async function fetchCatalogMaintenanceList(
  collectionName: CatalogMaintenanceCollection,
): Promise<CatalogMaintenanceItem[]> {
  const mapper = MAPPERS[collectionName]
  const sortFn = SORT_FNS[collectionName]
  return fetchCatalogAll(collectionName, mapper, sortFn)
}

async function getNextCatalogId(collectionName: CatalogMaintenanceCollection): Promise<string> {
  const db = getFirebaseFirestore()
  const snapshot = await getDocs(collection(db, collectionName))
  let maxId = 0
  for (const d of snapshot.docs) {
    const numeric = parseInt(d.id, 10)
    if (!Number.isNaN(numeric) && numeric > maxId) maxId = numeric
  }
  return String(maxId + 1)
}

export type CatalogCreateInput =
  | { collection: 'cubiculos'; data: Omit<Cubiculo, 'id'> }
  | { collection: 'empresas'; data: Omit<Empresa, 'id'> }
  | { collection: 'especialidades'; data: Omit<Especialidad, 'id'> }

export type CatalogUpdateInput =
  | { collection: 'cubiculos'; id: string; data: Partial<Omit<Cubiculo, 'id'>> }
  | { collection: 'empresas'; id: string; data: Partial<Omit<Empresa, 'id'>> }
  | { collection: 'especialidades'; id: string; data: Partial<Omit<Especialidad, 'id'>> }

function stripUndefined(data: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined),
  )
}

export async function createCatalogItem(input: CatalogCreateInput): Promise<string> {
  const db = getFirebaseFirestore()
  const id = await getNextCatalogId(input.collection)
  const ref = doc(db, input.collection, id)
  await setDoc(ref, stripUndefined({ ...input.data, activo: input.data.activo ?? true }))
  return id
}

export async function updateCatalogItem(input: CatalogUpdateInput): Promise<void> {
  const db = getFirebaseFirestore()
  const ref = doc(db, input.collection, input.id)
  const payload = stripUndefined(input.data as Record<string, unknown>) as UpdateData<DocumentData>
  await updateDoc(ref, payload)
}

export async function setCatalogActive(
  collectionName: CatalogMaintenanceCollection,
  id: string,
  activo: boolean,
): Promise<void> {
  const db = getFirebaseFirestore()
  const ref = doc(db, collectionName, id)
  await updateDoc(ref, { activo })
}
