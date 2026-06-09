import { createLazyFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import {
  useReporteCheckup,
  useReporteGeneral,
  useReporteEstadistica,
  type FilaCheckup,
  type FilaGeneral,
  type FilaEstadistica,
  type RangoUtc,
} from '@/hooks/use-reportes'
import { getDayRangeUtc, getTodayLocalDate, toLocalString } from '@/services/time'
import { DataTable } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'

export const Route = createLazyFileRoute('/_authenticated/reportes')({
  component: ReportesPage,
})

type TipoReporte = 'checkup' | 'general' | 'estadistica'

const checkupColumns: ColumnDef<FilaCheckup, unknown>[] = [
  { accessorKey: 'pacienteNombre', header: 'Paciente' },
  {
    accessorKey: 'fechaIngresoLocal',
    header: 'Ingreso',
    cell: ({ getValue }) => toLocalString(getValue() as Date, { hour: '2-digit', minute: '2-digit' }),
  },
  { accessorKey: 'estatusSeguimientoNombre', header: 'Estatus' },
  { accessorKey: 'totalEstudios', header: 'Estudios' },
]

const generalColumns: ColumnDef<FilaGeneral, unknown>[] = [
  { accessorKey: 'pacienteNombre', header: 'Paciente' },
  {
    accessorKey: 'fechaIngresoLocal',
    header: 'Ingreso',
    cell: ({ getValue }) => toLocalString(getValue() as Date, { hour: '2-digit', minute: '2-digit' }),
  },
  { accessorKey: 'estatusSeguimientoNombre', header: 'Estatus' },
  { accessorKey: 'empresaNombre', header: 'Empresa', cell: ({ getValue }) => getValue() ?? '—' },
  { accessorKey: 'estudios', header: 'Estudios' },
]

const estadisticaColumns: ColumnDef<FilaEstadistica, unknown>[] = [
  { accessorKey: 'estudioNombre', header: 'Estudio' },
  { accessorKey: 'estudioTipoNombre', header: 'Tipo', cell: ({ getValue }) => getValue() ?? '—' },
  { accessorKey: 'total', header: 'Total' },
]

function ReportesPage() {
  const [tipo, setTipo] = useState<TipoReporte>('checkup')
  const [fechaInicio, setFechaInicio] = useState(getTodayLocalDate())
  const [fechaFin, setFechaFin] = useState(getTodayLocalDate())
  const [rango, setRango] = useState<RangoUtc | null>(null)

  const checkup = useReporteCheckup(tipo === 'checkup' ? rango : null)
  const general = useReporteGeneral(tipo === 'general' ? rango : null)
  const estadistica = useReporteEstadistica(tipo === 'estadistica' ? rango : null)

  function handleGenerar() {
    const start = getDayRangeUtc(fechaInicio)
    const end = getDayRangeUtc(fechaFin)
    setRango({ startUtc: start.startUtc, endUtc: end.endUtc })
  }

  const isLoading = checkup.isLoading || general.isLoading || estadistica.isLoading

  return (
    <div>
      <h1 className="text-xl font-bold mb-4 text-[var(--color-texto)]">Reportes</h1>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-sm">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-3 flex-wrap">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[var(--color-texto-suave)]">Tipo</label>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value as TipoReporte)}
                className="min-h-[32px] px-2 text-sm rounded-[var(--radius-default)] border border-[var(--color-borde)] w-auto"
              >
                <option value="checkup">Checkup</option>
                <option value="general">General</option>
                <option value="estadistica">Estadística</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[var(--color-texto-suave)]">Desde</label>
              <Input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} className="w-auto min-h-[32px] h-8 text-sm" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[var(--color-texto-suave)]">Hasta</label>
              <Input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} className="w-auto min-h-[32px] h-8 text-sm" />
            </div>
            <Button size="sm" onClick={handleGenerar} disabled={isLoading}>
              {isLoading ? <LoadingSpinner size="sm" className="border-white/35 border-t-white" /> : null}
              Generar
            </Button>
          </div>
        </CardContent>
      </Card>

      {tipo === 'checkup' && rango && (
        <DataTable columns={checkupColumns} data={checkup.data ?? []} />
      )}
      {tipo === 'general' && rango && (
        <DataTable columns={generalColumns} data={general.data ?? []} />
      )}
      {tipo === 'estadistica' && rango && (
        <DataTable columns={estadisticaColumns} data={estadistica.data ?? []} />
      )}
    </div>
  )
}
