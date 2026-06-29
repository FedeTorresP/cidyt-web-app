import { createLazyFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { toast, Toaster } from 'sonner'
import { Download, Loader2 } from 'lucide-react'
import {
  fetchReporteGeneral,
  fetchReporteCaja,
  fetchReporteEstadistica,
  fetchReporteCheckup,
  fetchReporteConsultasEspecialista,
  type RangoUtc,
} from '@/hooks/use-reportes'
import { useCubiculos } from '@/hooks/use-cubiculos'
import { getDayRangeUtc } from '@/services/time'
import { formatDateMX, nowMX } from '@/lib/timezone'
import {
  exportReporteGeneral,
  exportReporteCaja,
  exportReporteEstadistica,
  exportReporteCheckup,
  exportReporteConsultasEspecialista,
} from '@/lib/excel-export'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export const Route = createLazyFileRoute('/_authenticated/reportes')({
  component: ReportesPage,
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getTodayMX(): string {
  return formatDateMX(nowMX())
}

function getFirstDayOfMonthMX(): string {
  const today = getTodayMX()
  return today.substring(0, 8) + '01'
}

function buildRango(fechaInicio: string, fechaFin: string): RangoUtc {
  const start = getDayRangeUtc(fechaInicio)
  const end = getDayRangeUtc(fechaFin)
  return { startUtc: start.startUtc, endUtc: end.endUtc }
}

// ─── Tipos de descarga ───────────────────────────────────────────────────────

type ReporteKey = 'general' | 'caja' | 'estadistica' | 'checkup' | 'consultas'

// ─── Componente principal ────────────────────────────────────────────────────

function ReportesPage() {
  const today = getTodayMX()
  const firstOfMonth = getFirstDayOfMonthMX()

  // Estado de fechas por reporte
  const [fechaGeneral, setFechaGeneral] = useState(today)
  const [fechaCheckup, setFechaCheckup] = useState(today)
  const [fechaCajaInicio, setFechaCajaInicio] = useState(firstOfMonth)
  const [fechaCajaFin, setFechaCajaFin] = useState(today)
  const [fechaEstInicio, setFechaEstInicio] = useState(firstOfMonth)
  const [fechaEstFin, setFechaEstFin] = useState(today)
  const [fechaConsInicio, setFechaConsInicio] = useState(firstOfMonth)
  const [fechaConsFin, setFechaConsFin] = useState(today)

  // Cubículos
  const [cubiculoId, setCubiculoId] = useState('')
  const cubiculosQuery = useCubiculos()
  const cubiculos = cubiculosQuery.data ?? []

  // Estado de descarga
  const [downloading, setDownloading] = useState<ReporteKey | null>(null)

  // ─── Handlers de descarga ────────────────────────────────────────────

  async function handleDescargarGeneral() {
    setDownloading('general')
    try {
      const rango = buildRango(fechaGeneral, fechaGeneral)
      const data = await fetchReporteGeneral(rango)
      await exportReporteGeneral(data, fechaGeneral)
      toast.success('Reporte General descargado correctamente.')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      toast.error('Error al generar el reporte.', { description: msg })
    } finally {
      setDownloading(null)
    }
  }

  async function handleDescargarCaja() {
    if (fechaCajaFin < fechaCajaInicio) {
      toast.warning('La fecha fin no puede ser menor que la fecha inicio.')
      return
    }
    setDownloading('caja')
    try {
      const rango = buildRango(fechaCajaInicio, fechaCajaFin)
      const data = await fetchReporteCaja(rango)
      await exportReporteCaja(data, fechaCajaInicio, fechaCajaFin)
      toast.success('Reporte de Caja descargado correctamente.')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      toast.error('Error al generar el reporte.', { description: msg })
    } finally {
      setDownloading(null)
    }
  }

  async function handleDescargarEstadistica() {
    if (!cubiculoId) {
      toast.warning('Seleccione un cubículo para el reporte de estadística.')
      return
    }
    if (fechaEstFin < fechaEstInicio) {
      toast.warning('La fecha fin no puede ser menor que la fecha inicio.')
      return
    }
    setDownloading('estadistica')
    try {
      const rango = buildRango(fechaEstInicio, fechaEstFin)
      const data = await fetchReporteEstadistica(rango)
      const cubNombre = cubiculos.find((c) => c.id === cubiculoId)?.nombre ?? cubiculoId
      await exportReporteEstadistica(data, cubNombre, fechaEstInicio, fechaEstFin)
      toast.success('Reporte de Estadística descargado correctamente.')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      toast.error('Error al generar el reporte.', { description: msg })
    } finally {
      setDownloading(null)
    }
  }

  async function handleDescargarConsultas() {
    if (fechaConsFin < fechaConsInicio) {
      toast.warning('La fecha fin no puede ser menor que la fecha inicio.')
      return
    }
    setDownloading('consultas')
    try {
      const rango = buildRango(fechaConsInicio, fechaConsFin)
      const data = await fetchReporteConsultasEspecialista(rango)
      await exportReporteConsultasEspecialista(data, fechaConsInicio, fechaConsFin)
      toast.success('Reporte de Consultas por Especialista descargado correctamente.')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      toast.error('Error al generar el reporte.', { description: msg })
    } finally {
      setDownloading(null)
    }
  }

  async function handleDescargarCheckup() {
    setDownloading('checkup')
    try {
      const rango = buildRango(fechaCheckup, fechaCheckup)
      const data = await fetchReporteCheckup(rango)
      await exportReporteCheckup(data, fechaCheckup)
      toast.success('Reporte Control CheckUp descargado correctamente.')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      toast.error('Error al generar el reporte.', { description: msg })
    } finally {
      setDownloading(null)
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────

  return (
    <div className="max-w-[1100px]">
      <Toaster position="top-right" richColors closeButton />

      <h1 className="text-xl font-bold mb-5">Reportes y Exportaci&oacute;n Excel</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* ────────────────────────────────────────────────────────────────
         * Card 1 — Reporte General
         * ──────────────────────────────────────────────────────────────── */}
        <Card className="border-green-200">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold">Reporte General</CardTitle>
              <span className="bg-blue-50 text-blue-600 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                Diario
              </span>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Pacientes del d&iacute;a con turno, datos personales, empresa, paquete, hora de
              ingreso y estatus.
            </p>
            <div className="flex flex-col gap-1">
              <label htmlFor="fecha-general" className="text-xs font-medium text-muted-foreground">
                Fecha
              </label>
              <Input
                id="fecha-general"
                type="date"
                value={fechaGeneral}
                onChange={(e) => setFechaGeneral(e.target.value)}
              />
            </div>
            <Button
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold"
              onClick={handleDescargarGeneral}
              disabled={downloading === 'general'}
            >
              {downloading === 'general' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generando...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Descargar Excel
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* ────────────────────────────────────────────────────────────────
         * Card 2 — Reporte de Caja
         * ──────────────────────────────────────────────────────────────── */}
        <Card className="border-green-200">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold">Reporte de Caja</CardTitle>
              <span className="bg-blue-50 text-blue-600 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                Por rango
              </span>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Facturas del per&iacute;odo con datos de paciente, empresa, promotor, tipo de
              servicio y factura.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <label htmlFor="caja-inicio" className="text-xs font-medium text-muted-foreground">
                  Fecha inicio
                </label>
                <Input
                  id="caja-inicio"
                  type="date"
                  value={fechaCajaInicio}
                  onChange={(e) => {
                    setFechaCajaInicio(e.target.value)
                    if (fechaCajaFin < e.target.value) setFechaCajaFin(e.target.value)
                  }}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="caja-fin" className="text-xs font-medium text-muted-foreground">
                  Fecha fin
                </label>
                <Input
                  id="caja-fin"
                  type="date"
                  value={fechaCajaFin}
                  min={fechaCajaInicio}
                  onChange={(e) => setFechaCajaFin(e.target.value)}
                />
              </div>
            </div>
            <Button
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold"
              onClick={handleDescargarCaja}
              disabled={downloading === 'caja'}
            >
              {downloading === 'caja' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generando...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Descargar Excel
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* ────────────────────────────────────────────────────────────────
         * Card 3 — Estadística por Consultorio
         * ──────────────────────────────────────────────────────────────── */}
        <Card className="border-green-200">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold">
                Estad&iacute;stica por Consultorio
              </CardTitle>
              <span className="bg-blue-50 text-blue-600 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                Por rango
              </span>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Sesiones de cub&iacute;culo del per&iacute;odo: m&eacute;dico, estatus, usuario y
              fecha/hora de registro.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <label htmlFor="est-inicio" className="text-xs font-medium text-muted-foreground">
                  Fecha inicio
                </label>
                <Input
                  id="est-inicio"
                  type="date"
                  value={fechaEstInicio}
                  onChange={(e) => {
                    setFechaEstInicio(e.target.value)
                    if (fechaEstFin < e.target.value) setFechaEstFin(e.target.value)
                  }}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="est-fin" className="text-xs font-medium text-muted-foreground">
                  Fecha fin
                </label>
                <Input
                  id="est-fin"
                  type="date"
                  value={fechaEstFin}
                  min={fechaEstInicio}
                  onChange={(e) => setFechaEstFin(e.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="est-cubiculo" className="text-xs font-medium text-muted-foreground">
                Cub&iacute;culo
              </label>
              <select
                id="est-cubiculo"
                value={cubiculoId}
                onChange={(e) => setCubiculoId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">— Seleccione cub&iacute;culo —</option>
                {cubiculos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre ?? c.id}
                  </option>
                ))}
              </select>
            </div>
            <Button
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold"
              onClick={handleDescargarEstadistica}
              disabled={downloading === 'estadistica' || !cubiculoId}
            >
              {downloading === 'estadistica' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generando...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Descargar Excel
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* ────────────────────────────────────────────────────────────────
         * Card 4 — Control CheckUp
         * ──────────────────────────────────────────────────────────────── */}
        <Card className="border-green-200">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold">Control CheckUp</CardTitle>
              <span className="bg-blue-50 text-blue-600 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                Diario
              </span>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Pacientes del d&iacute;a con el estatus de cada estudio del paquete, una columna
              por estudio.
            </p>
            <div className="flex flex-col gap-1">
              <label htmlFor="fecha-checkup" className="text-xs font-medium text-muted-foreground">
                Fecha
              </label>
              <Input
                id="fecha-checkup"
                type="date"
                value={fechaCheckup}
                onChange={(e) => setFechaCheckup(e.target.value)}
              />
            </div>
            <Button
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold"
              onClick={handleDescargarCheckup}
              disabled={downloading === 'checkup'}
            >
              {downloading === 'checkup' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generando...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Descargar Excel
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* ────────────────────────────────────────────────────────────────
         * Card 5 — Consultas por Especialista
         * ──────────────────────────────────────────────────────────────── */}
        <Card className="border-green-200">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold">Consultas por Especialista</CardTitle>
              <span className="bg-blue-50 text-blue-600 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                Por rango
              </span>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground leading-relaxed">
              N&uacute;mero de consultas (estudios completados) que brind&oacute; cada especialista
              en el per&iacute;odo.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <label htmlFor="cons-inicio" className="text-xs font-medium text-muted-foreground">
                  Fecha inicio
                </label>
                <Input
                  id="cons-inicio"
                  type="date"
                  value={fechaConsInicio}
                  onChange={(e) => {
                    setFechaConsInicio(e.target.value)
                    if (fechaConsFin < e.target.value) setFechaConsFin(e.target.value)
                  }}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="cons-fin" className="text-xs font-medium text-muted-foreground">
                  Fecha fin
                </label>
                <Input
                  id="cons-fin"
                  type="date"
                  value={fechaConsFin}
                  min={fechaConsInicio}
                  onChange={(e) => setFechaConsFin(e.target.value)}
                />
              </div>
            </div>
            <Button
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold"
              onClick={handleDescargarConsultas}
              disabled={downloading === 'consultas'}
            >
              {downloading === 'consultas' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generando...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Descargar Excel
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
