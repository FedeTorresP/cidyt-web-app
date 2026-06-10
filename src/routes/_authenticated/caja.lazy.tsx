import { createLazyFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { useFacturas, type FilaCaja } from '@/hooks/use-facturas'
import { getDayRangeUtc } from '@/services/time'
import { nowMX, formatDateMX, formatTimeMX } from '@/lib/timezone'
import { DataTable } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { AlertBanner } from '@/components/shared/AlertBanner'

export const Route = createLazyFileRoute('/_authenticated/caja')({
  component: CajaPage,
})

const columns: ColumnDef<FilaCaja, unknown>[] = [
  {
    accessorKey: 'facturaNo',
    header: '# Fact',
    cell: ({ getValue }) => getValue() ?? '—',
  },
  {
    accessorKey: 'pacienteNombre',
    header: 'Paciente',
  },
  {
    accessorKey: 'empresaNombre',
    header: 'Empresa',
    cell: ({ getValue }) => getValue() ?? '—',
  },
  {
    accessorKey: 'fechaIngresoLocal',
    header: 'Fecha Ingreso',
    cell: ({ getValue }) => {
      const date = getValue() as Date | null
      return date ? `${formatDateMX(date)} ${formatTimeMX(date)}` : '—'
    },
  },
]

function CajaPage() {
  const [fecha, setFecha] = useState(() => formatDateMX(nowMX()))
  const rango = getDayRangeUtc(fecha)
  const { data, isLoading, error, refetch } = useFacturas(rango.startUtc, rango.endUtc)

  return (
    <div className="text-[0.8rem]">
      <h1 className="text-lg font-bold mb-1.5 text-[var(--color-texto)]">Caja</h1>

      <div className="sticky top-0 z-20 flex items-center gap-1.5 flex-wrap p-1.5 px-2.5 mb-1.5 bg-[var(--color-fondo-card)] border border-[var(--color-borde)] rounded-[var(--radius-default)] shadow-[0_2px_8px_rgba(10,31,92,0.06)]">
        <span className="text-[var(--color-texto-suave)] font-medium text-[0.8rem]">Fecha:</span>
        <Input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          className="w-auto min-h-[32px] h-8 text-[0.85rem] px-2"
        />
        <Button size="sm" onClick={() => refetch()} disabled={isLoading}>
          {isLoading ? <LoadingSpinner size="sm" className="border-white/35 border-t-white" /> : null}
          Actualizar
        </Button>
        {data && (
          <span className="bg-[rgba(25,118,210,0.1)] text-[var(--color-info)] rounded-full px-2.5 py-0.5 text-[0.75rem] font-semibold">
            {data.length} registros
          </span>
        )}
      </div>

      {error && (
        <AlertBanner variant="error" className="mb-2">
          Error al cargar facturas.
        </AlertBanner>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8">
          <LoadingSpinner size="md" />
        </div>
      ) : (
        <DataTable columns={columns} data={data ?? []} compact />
      )}
    </div>
  )
}
