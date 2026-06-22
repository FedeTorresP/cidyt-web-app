import type { CatalogMaintenanceCollection, Cubiculo, Empresa, Especialidad } from '@/types/models'
import type { CatalogCreateInput, CatalogUpdateInput } from '@/lib/firestore-catalog-crud'

export type CatalogTabId = 'cubiculos' | 'empresas' | 'especialidades'

export type CatalogFormFieldType = 'text' | 'number' | 'textarea' | 'select'

export interface CatalogFormField {
  name: string
  label: string
  type: CatalogFormFieldType
  required?: boolean
  placeholder?: string
  /** Solo para type === 'select' — opciones estáticas. */
  options?: { value: string; label: string }[]
  /** Carga opciones desde catálogo Firestore (p. ej. entidades). */
  optionsFrom?: 'entidades'
  defaultValue?: string | number
}

export interface CatalogTabConfig<T extends { id: string; activo: boolean }> {
  id: CatalogTabId
  collection: CatalogMaintenanceCollection
  label: string
  searchPlaceholder: string
  /** Campos usados en búsqueda client-side. */
  searchKeys: string[]
  pageSize?: number
  formFields: CatalogFormField[]
  itemLabel: (item: T) => string
  toCreateInput: (values: Record<string, string>) => CatalogCreateInput
  toUpdateInput: (id: string, values: Record<string, string>) => CatalogUpdateInput
}

function str(values: Record<string, string>, key: string): string {
  return (values[key] ?? '').trim()
}

function numOrNull(values: Record<string, string>, key: string): number | null {
  const raw = values[key]?.trim()
  if (!raw) return null
  const n = Number(raw)
  return Number.isNaN(n) ? null : n
}

export const CATALOG_TAB_CONFIGS: {
  cubiculos: CatalogTabConfig<Cubiculo>
  empresas: CatalogTabConfig<Empresa>
  especialidades: CatalogTabConfig<Especialidad>
} = {
  cubiculos: {
    id: 'cubiculos',
    collection: 'cubiculos',
    label: 'Cubículos',
    searchPlaceholder: 'Buscar por nombre o descripción...',
    searchKeys: ['nombre', 'descripcion'],
    formFields: [
      { name: 'nombre', label: 'Nombre', type: 'text', required: true },
      { name: 'descripcion', label: 'Descripción', type: 'textarea' },
      { name: 'ordenMostrar', label: 'Orden', type: 'number' },
      {
        name: 'entidadId',
        label: 'Entidad',
        type: 'select',
        optionsFrom: 'entidades',
      },
      {
        name: 'estatusCubiculoId',
        label: 'Estatus cubículo',
        type: 'text',
        defaultValue: '1',
        placeholder: 'ID de estatus (default: 1)',
      },
    ],
    itemLabel: (item) => (item as Cubiculo).nombre ?? item.id,
    toCreateInput: (values) => ({
      collection: 'cubiculos',
      data: {
        nombre: str(values, 'nombre') || null,
        descripcion: str(values, 'descripcion') || null,
        ordenMostrar: numOrNull(values, 'ordenMostrar'),
        entidadId: str(values, 'entidadId') || null,
        estatusCubiculoId: str(values, 'estatusCubiculoId') || '1',
        activo: true,
      },
    }),
    toUpdateInput: (id, values) => ({
      collection: 'cubiculos',
      id,
      data: {
        nombre: str(values, 'nombre') || null,
        descripcion: str(values, 'descripcion') || null,
        ordenMostrar: numOrNull(values, 'ordenMostrar'),
        entidadId: str(values, 'entidadId') || null,
        estatusCubiculoId: str(values, 'estatusCubiculoId') || '1',
      },
    }),
  },
  empresas: {
    id: 'empresas',
    collection: 'empresas',
    label: 'Empresas',
    searchPlaceholder: 'Buscar por nombre, alias o descripción...',
    searchKeys: ['nombre', 'alias', 'descripcion'],
    pageSize: 50,
    formFields: [
      { name: 'nombre', label: 'Nombre', type: 'text', required: true },
      { name: 'alias', label: 'Alias', type: 'text' },
      { name: 'descripcion', label: 'Descripción', type: 'textarea' },
      { name: 'ordenMostrar', label: 'Orden', type: 'number' },
    ],
    itemLabel: (item) => (item as Empresa).nombre,
    toCreateInput: (values) => ({
      collection: 'empresas',
      data: {
        nombre: str(values, 'nombre'),
        alias: str(values, 'alias') || null,
        descripcion: str(values, 'descripcion') || null,
        ordenMostrar: numOrNull(values, 'ordenMostrar'),
        activo: true,
      },
    }),
    toUpdateInput: (id, values) => ({
      collection: 'empresas',
      id,
      data: {
        nombre: str(values, 'nombre'),
        alias: str(values, 'alias') || null,
        descripcion: str(values, 'descripcion') || null,
        ordenMostrar: numOrNull(values, 'ordenMostrar'),
      },
    }),
  },
  especialidades: {
    id: 'especialidades',
    collection: 'especialidades',
    label: 'Especialidades',
    searchPlaceholder: 'Buscar por nombre o descripción...',
    searchKeys: ['nombre', 'descripcion'],
    formFields: [
      { name: 'nombre', label: 'Nombre', type: 'text', required: true },
      { name: 'descripcion', label: 'Descripción', type: 'textarea' },
    ],
    itemLabel: (item) => (item as Especialidad).nombre,
    toCreateInput: (values) => ({
      collection: 'especialidades',
      data: {
        nombre: str(values, 'nombre'),
        descripcion: str(values, 'descripcion') || null,
        activo: true,
      },
    }),
    toUpdateInput: (id, values) => ({
      collection: 'especialidades',
      id,
      data: {
        nombre: str(values, 'nombre'),
        descripcion: str(values, 'descripcion') || null,
      },
    }),
  },
}
