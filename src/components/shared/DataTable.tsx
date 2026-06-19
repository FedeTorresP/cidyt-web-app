import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table'
import { cn } from '@/lib/utils'
import { TableSkeleton } from '@/components/shared/TableSkeleton'

interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[]
  data: TData[]
  className?: string
  compact?: boolean
  isLoading?: boolean
  skeletonRows?: number
  skeletonCols?: number
}

/**
 * Wrapper genérico de TanStack Table con estilos iPadOS ultra-compactos.
 * Traduce el patrón visual de caja.module.css del Legacy.
 */
export function DataTable<TData>({
  columns,
  data,
  className,
  compact = false,
  isLoading = false,
  skeletonRows = 6,
  skeletonCols = 5,
}: DataTableProps<TData>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  if (isLoading) {
    return <TableSkeleton rows={skeletonRows} cols={skeletonCols} className={className} />
  }

  return (
    <div
      className={cn(
        'overflow-x-auto rounded-[var(--radius-default)] shadow-[var(--shadow-card)] border border-[var(--color-borde)]',
        className,
      )}
    >
      <table className="w-full border-collapse bg-[var(--color-fondo-card)] min-w-[900px]">
        <thead className="bg-[var(--color-primario)] sticky top-0 z-10">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className={cn(
                    'text-center font-semibold text-white border-b-2 border-b-white/12 border-r border-r-white/8',
                    compact ? 'px-1 py-0.5 text-[0.65rem]' : 'px-2 py-1.5 text-xs',
                  )}
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
              className={idx % 2 === 0 ? 'bg-[var(--color-fondo)]' : 'bg-[var(--color-fondo-card)]'}
            >
              {row.getVisibleCells().map((cell) => (
                <td
                  key={cell.id}
                  className={cn(
                    'border-b border-b-[var(--color-borde)] border-r border-r-[var(--color-borde)] text-center align-middle whitespace-nowrap',
                    compact ? 'px-0.5 py-0 text-[0.75rem]' : 'px-2 py-1 text-xs',
                  )}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {data.length === 0 && (
        <div className="text-center py-8 text-[var(--color-texto-suave)] text-sm">
          No hay datos para mostrar.
        </div>
      )}
    </div>
  )
}
