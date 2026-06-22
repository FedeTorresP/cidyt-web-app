import { useMemo, useState } from 'react'
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table'
import { MoreHorizontal, Plus, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  useCatalogMaintenanceList,
  useCreateCatalogItem,
  useUpdateCatalogItem,
  useSetCatalogActive,
} from '@/hooks/use-catalog-maintenance'
import type { CatalogMaintenanceItem } from '@/lib/firestore-catalog-crud'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { AlertBanner } from '@/components/shared/AlertBanner'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { cn } from '@/lib/utils'
import { CatalogFormDialog } from './CatalogFormDialog'
import type { CatalogTabConfig } from './catalog-tab-config'

export type AnyCatalogTabConfig =
  | CatalogTabConfig<import('@/types/models').Cubiculo>
  | CatalogTabConfig<import('@/types/models').Empresa>
  | CatalogTabConfig<import('@/types/models').Especialidad>

interface CatalogMaintenanceTabProps {
  config: AnyCatalogTabConfig
}

function matchesSearch(item: CatalogMaintenanceItem, query: string, keys: string[]): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const record = item as unknown as Record<string, unknown>
  return keys.some((key) => {
    const value = record[key]
    if (value == null) return false
    return String(value).toLowerCase().includes(q)
  })
}

function ActivoBadge({ activo }: { activo: boolean }) {
  return (
    <span
      className={cn(
        'inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold',
        activo
          ? 'bg-[var(--color-success)]/15 text-[var(--color-success)]'
          : 'bg-[var(--color-error)]/15 text-[var(--color-error)]',
      )}
    >
      {activo ? 'Activo' : 'Inactivo'}
    </span>
  )
}

function getDisplayColumns(config: AnyCatalogTabConfig): ColumnDef<CatalogMaintenanceItem>[] {
  const base: ColumnDef<CatalogMaintenanceItem>[] = [
    {
      accessorKey: 'nombre',
      header: 'Nombre',
      cell: ({ getValue }) => (
        <span className="text-left inline-block max-w-[280px] truncate" title={String(getValue() ?? '')}>
          {String(getValue() ?? '—')}
        </span>
      ),
    },
  ]

  if (config.id === 'empresas') {
    base.push({
      accessorKey: 'alias',
      header: 'Alias',
      cell: ({ getValue }) => String(getValue() ?? '—'),
    })
  }

  base.push({
    accessorKey: 'descripcion',
    header: 'Descripción',
    cell: ({ getValue }) => (
      <span className="text-left inline-block max-w-[240px] truncate" title={String(getValue() ?? '')}>
        {String(getValue() ?? '—')}
      </span>
    ),
  })

  if (config.id !== 'especialidades') {
    base.push({
      accessorKey: 'ordenMostrar',
      header: 'Orden',
      cell: ({ getValue }) => {
        const v = getValue()
        return v == null ? '—' : String(v)
      },
    })
  }

  base.push({
    accessorKey: 'activo',
    header: 'Estatus',
    cell: ({ getValue }) => <ActivoBadge activo={getValue() as boolean} />,
  })

  return base
}

export function CatalogMaintenanceTab({ config }: CatalogMaintenanceTabProps) {
  const { data, isLoading, error } = useCatalogMaintenanceList(config.collection)
  const createItem = useCreateCatalogItem()
  const updateItem = useUpdateCatalogItem()
  const setActive = useSetCatalogActive()

  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [showCreate, setShowCreate] = useState(false)
  const [editingItem, setEditingItem] = useState<CatalogMaintenanceItem | null>(null)

  const filtered = useMemo(() => {
    const list = data ?? []
    return list.filter((item) => matchesSearch(item, search, config.searchKeys))
  }, [data, search, config.searchKeys])

  const pageSize = config.pageSize ?? filtered.length
  const totalPages = config.pageSize ? Math.max(1, Math.ceil(filtered.length / pageSize)) : 1
  const safePage = Math.min(page, totalPages - 1)

  const pageData = useMemo(() => {
    if (!config.pageSize) return filtered
    const start = safePage * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, config.pageSize, safePage, pageSize])

  const columns = useMemo<ColumnDef<CatalogMaintenanceItem>[]>(() => {
    const dataColumns = getDisplayColumns(config)
    return [
      ...dataColumns,
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const item = row.original
          const label = config.itemLabel(item as never)
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label={`Acciones — ${label}`}>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setEditingItem(item)}>
                  Editar
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {item.activo ? (
                  <DropdownMenuItem
                    destructive
                    onClick={async () => {
                      if (!confirm(`¿Desactivar "${label}"?`)) return
                      await setActive.mutateAsync({
                        collection: config.collection,
                        id: item.id,
                        activo: false,
                      })
                    }}
                  >
                    Desactivar
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    onClick={async () => {
                      await setActive.mutateAsync({
                        collection: config.collection,
                        id: item.id,
                        activo: true,
                      })
                    }}
                  >
                    Reactivar
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )
        },
      },
    ]
  }, [config, setActive])

  const table = useReactTable({
    data: pageData,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner size="md" />
      </div>
    )
  }

  if (error) {
    return (
      <AlertBanner variant="error">
        Error al cargar {config.label.toLowerCase()}: {error instanceof Error ? error.message : 'Error desconocido'}
      </AlertBanner>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Input
            placeholder={config.searchPlaceholder}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(0)
            }}
            style={{ paddingRight: 36 }}
            aria-label={`Buscar en ${config.label}`}
          />
          <Search
            className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-texto-suave)]"
            style={{ pointerEvents: 'none' }}
          />
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" />
          Nuevo
        </Button>
      </div>

      <div className="overflow-x-auto rounded-[var(--radius-default)] shadow-[var(--shadow-card)] border border-[var(--color-borde)]">
        <table className="w-full border-collapse bg-[var(--color-fondo-card)] min-w-[700px]">
          <thead className="bg-[var(--color-primario)] sticky top-0 z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-2 py-1.5 text-xs text-center font-semibold text-white border-b-2 border-b-white/12 border-r border-r-white/8"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row, idx) => (
              <tr
                key={row.id}
                className={cn(
                  idx % 2 === 0 ? 'bg-[var(--color-fondo)]' : 'bg-[var(--color-fondo-card)]',
                  !row.original.activo && 'opacity-60',
                )}
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className="px-2 py-1.5 text-xs border-b border-b-[var(--color-borde)] border-r border-r-[var(--color-borde)] text-center align-middle whitespace-nowrap"
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {(data?.length ?? 0) === 0 && (
          <div className="text-center py-8 text-[var(--color-texto-suave)] text-sm">
            No hay registros en {config.label.toLowerCase()}.
          </div>
        )}
        {(data?.length ?? 0) > 0 && filtered.length === 0 && (
          <div className="text-center py-8 text-[var(--color-texto-suave)] text-sm">
            Sin resultados para &quot;{search}&quot;.
          </div>
        )}
      </div>

      {config.pageSize && filtered.length > 0 && (
        <div className="flex items-center justify-between gap-3 text-sm text-[var(--color-texto-suave)]">
          <span>
            {filtered.length} registro{filtered.length !== 1 ? 's' : ''}
            {search ? ' (filtrados)' : ''}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={safePage <= 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              aria-label="Página anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span>
              Página {safePage + 1} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={safePage >= totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              aria-label="Página siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <CatalogFormDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        config={config as CatalogTabConfig<CatalogMaintenanceItem>}
        onSubmit={async (values) => {
          await createItem.mutateAsync(config.toCreateInput(values))
        }}
      />

      {editingItem && (
        <CatalogFormDialog
          open={!!editingItem}
          onOpenChange={(open) => {
            if (!open) setEditingItem(null)
          }}
          config={config as CatalogTabConfig<CatalogMaintenanceItem>}
          item={editingItem}
          onSubmit={async (values) => {
            await updateItem.mutateAsync(config.toUpdateInput(editingItem.id, values))
          }}
        />
      )}
    </div>
  )
}
