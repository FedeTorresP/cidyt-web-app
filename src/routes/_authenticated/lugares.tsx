import { useState, useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { toast } from 'sonner'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { useAuth } from '@/hooks/use-auth'
import { useMedicosActivos } from '@/hooks/use-medicos'
import { useLugaresActivos } from '@/hooks/use-lugares'
import { useHorariosActivos } from '@/hooks/use-horarios'
import {
  useMedicoDiaAsignaciones,
  useCrearAsignacion,
  useEliminarAsignacion,
} from '@/hooks/use-medico-dia'
import { formatDateMX, nowMX } from '@/lib/timezone'

export const Route = createFileRoute('/_authenticated/lugares')({
  component: MedicoDiaPage,
})

function MedicoDiaPage() {
  const { user } = useAuth()
  const todayMX = formatDateMX(nowMX())

  // ── Estado del formulario ──────────────────────────────────────────────────
  const [formMedicoId, setFormMedicoId] = useState('')
  const [formLugarId, setFormLugarId] = useState('')
  const [formFecha, setFormFecha] = useState(todayMX)
  const [formHorarioId, setFormHorarioId] = useState('')

  // ── Estado de la tabla ─────────────────────────────────────────────────────
  const [tablaFecha, setTablaFecha] = useState(todayMX)
  const [queryFecha, setQueryFecha] = useState(todayMX)

  // ── Catálogos ──────────────────────────────────────────────────────────────
  const { data: medicos, isLoading: loadingMedicos, isError: errorMedicos, error: medicosError } = useMedicosActivos()
  const { data: lugares, isLoading: loadingLugares, isError: errorLugares, error: lugaresError } = useLugaresActivos()
  const { data: horarios, isLoading: loadingHorarios, isError: errorHorarios, error: horariosError } = useHorariosActivos()

  // ── Asignaciones del día ───────────────────────────────────────────────────
  const {
    data: asignaciones,
    isLoading: loadingAsignaciones,
    refetch: refetchAsignaciones,
  } = useMedicoDiaAsignaciones(queryFecha)

  // ── Mutations ──────────────────────────────────────────────────────────────
  const crearMutation = useCrearAsignacion()
  const eliminarMutation = useEliminarAsignacion()

  const catalogosLoading = loadingMedicos || loadingLugares || loadingHorarios
  const catalogosError = errorMedicos || errorLugares || errorHorarios
  const catalogosErrorMessage =
    (medicosError instanceof Error && medicosError.message) ||
    (lugaresError instanceof Error && lugaresError.message) ||
    (horariosError instanceof Error && horariosError.message) ||
    'No se pudieron cargar los catálogos desde Firestore.'

  useEffect(() => {
    if (catalogosError) {
      console.error('[Lugares] Error cargando catálogos:', { medicosError, lugaresError, horariosError })
      toast.error(catalogosErrorMessage)
    }
  }, [catalogosError, catalogosErrorMessage, medicosError, lugaresError, horariosError])

  // ── Handlers ───────────────────────────────────────────────────────────────

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!formMedicoId) {
      toast.error('Seleccione un médico.')
      return
    }
    if (!formLugarId) {
      toast.error('Seleccione un lugar de estudio.')
      return
    }
    if (!formFecha) {
      toast.error('Seleccione una fecha.')
      return
    }
    if (!formHorarioId) {
      toast.error('Seleccione un horario.')
      return
    }

    crearMutation.mutate(
      {
        medicoId: formMedicoId,
        lugarEstudioId: formLugarId,
        horarioId: formHorarioId,
        fecha: formFecha,
        creadoPor: user?.email ?? user?.uid ?? 'unknown',
      },
      {
        onSuccess: () => {
          toast.success('Asignación registrada correctamente.')
          setFormMedicoId('')
          setFormLugarId('')
          setFormHorarioId('')
          // Si la fecha del formulario coincide con la tabla, refrescar
          if (formFecha === queryFecha) {
            refetchAsignaciones()
          }
        },
        onError: (err) => {
          const msg = err instanceof Error ? err.message : 'Error al crear la asignación.'
          toast.error(msg)
        },
      },
    )
  }

  function handleActualizar() {
    setQueryFecha(tablaFecha)
  }

  function handleEliminar(asignacionId: string, medicoNombre: string) {
    if (!confirm(`¿Eliminar la asignación de ${medicoNombre}?`)) return

    eliminarMutation.mutate(asignacionId, {
      onSuccess: () => {
        toast.success('Asignación eliminada correctamente.')
      },
      onError: (err) => {
        const msg = err instanceof Error ? err.message : 'Error al eliminar la asignación.'
        toast.error(msg)
      },
    })
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <h1 className="page-title">Médico por Ubicación y Día</h1>

      {/* ── Formulario: Nueva Asignación ──────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Nueva Asignación</CardTitle>
        </CardHeader>
        <CardContent>
          {catalogosLoading ? (
            <div className="flex justify-center py-6">
              <LoadingSpinner size="md" />
            </div>
          ) : catalogosError ? (
            <p className="text-sm text-red-600">
              Error al cargar catálogos: {catalogosErrorMessage}
            </p>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Médico */}
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="form-medico"
                    className="text-sm font-medium text-[var(--color-texto-suave)]"
                  >
                    Médico <span className="text-red-600">*</span>
                  </label>
                  <select
                    id="form-medico"
                    value={formMedicoId}
                    onChange={(e) => setFormMedicoId(e.target.value)}
                    required
                    aria-required="true"
                    className="h-11 w-full rounded-md border border-[var(--color-borde)] bg-white px-3 text-sm text-[var(--color-texto)] outline-none focus:ring-2 focus:ring-[var(--color-primario)]"
                  >
                    <option value="">— Seleccione médico —</option>
                    {medicos?.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.letra ? `${m.letra} — ${m.nombreCompleto ?? `Médico #${m.id}`}` : (m.nombreCompleto ?? `Médico #${m.id}`)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Lugar de Estudio */}
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="form-lugar"
                    className="text-sm font-medium text-[var(--color-texto-suave)]"
                  >
                    Lugar de Estudio <span className="text-red-600">*</span>
                  </label>
                  <select
                    id="form-lugar"
                    value={formLugarId}
                    onChange={(e) => setFormLugarId(e.target.value)}
                    required
                    aria-required="true"
                    className="h-11 w-full rounded-md border border-[var(--color-borde)] bg-white px-3 text-sm text-[var(--color-texto)] outline-none focus:ring-2 focus:ring-[var(--color-primario)]"
                  >
                    <option value="">— Seleccione lugar —</option>
                    {lugares?.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Fecha */}
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="form-fecha"
                    className="text-sm font-medium text-[var(--color-texto-suave)]"
                  >
                    Fecha <span className="text-red-600">*</span>
                  </label>
                  <Input
                    id="form-fecha"
                    type="date"
                    value={formFecha}
                    onChange={(e) => setFormFecha(e.target.value)}
                    required
                    aria-required="true"
                    className="h-11"
                  />
                </div>

                {/* Horario */}
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="form-horario"
                    className="text-sm font-medium text-[var(--color-texto-suave)]"
                  >
                    Horario <span className="text-red-600">*</span>
                  </label>
                  <select
                    id="form-horario"
                    value={formHorarioId}
                    onChange={(e) => setFormHorarioId(e.target.value)}
                    required
                    aria-required="true"
                    className="h-11 w-full rounded-md border border-[var(--color-borde)] bg-white px-3 text-sm text-[var(--color-texto)] outline-none focus:ring-2 focus:ring-[var(--color-primario)]"
                  >
                    <option value="">— Seleccione horario —</option>
                    {horarios?.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Botón Guardar */}
              <div className="mt-4">
                <Button
                  type="submit"
                  disabled={crearMutation.isPending}
                  className="bg-[var(--color-primario)] hover:bg-[var(--color-primario)]/90 text-white font-semibold"
                >
                  {crearMutation.isPending ? 'Guardando...' : 'Guardar Asignación'}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {/* ── Tabla: Asignaciones del Día ───────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-3">
            <CardTitle className="text-sm">Asignaciones del Día</CardTitle>
            <div className="flex items-center gap-2 ml-auto">
              <label
                htmlFor="tabla-fecha"
                className="text-sm font-medium text-[var(--color-texto-suave)]"
              >
                Fecha:
              </label>
              <Input
                id="tabla-fecha"
                type="date"
                value={tablaFecha}
                onChange={(e) => setTablaFecha(e.target.value)}
                className="h-9 w-auto"
                aria-label="Fecha del listado"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleActualizar}
                disabled={loadingAsignaciones}
              >
                {loadingAsignaciones ? 'Cargando...' : 'Actualizar'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingAsignaciones ? (
            <div className="flex justify-center py-6">
              <LoadingSpinner size="md" />
            </div>
          ) : !asignaciones?.length ? (
            <p className="text-sm italic text-[var(--color-texto-suave)]">
              No hay asignaciones para esta fecha.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-[var(--color-borde)]">
              <table className="w-full text-sm" aria-label="Listado de asignaciones médico-día">
                <thead>
                  <tr className="bg-[var(--color-primario)]">
                    <th className="px-3 py-2 text-left font-semibold text-white text-xs whitespace-nowrap">
                      Médico
                    </th>
                    <th className="px-3 py-2 text-left font-semibold text-white text-xs whitespace-nowrap">
                      Lugar de Estudio
                    </th>
                    <th className="px-3 py-2 text-left font-semibold text-white text-xs whitespace-nowrap">
                      Horario
                    </th>
                    <th className="px-3 py-2 text-left font-semibold text-white text-xs whitespace-nowrap">
                      Fecha
                    </th>
                    <th className="px-3 py-2 text-center font-semibold text-white text-xs whitespace-nowrap">
                      Eliminar
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {asignaciones.map((asig, idx) => (
                    <tr
                      key={asig.id}
                      className={
                        idx % 2 === 0
                          ? 'bg-[var(--color-fondo)]'
                          : 'bg-[var(--color-fondo-card)]'
                      }
                    >
                      <td className="px-3 py-2 border-b border-[var(--color-borde)] whitespace-nowrap">
                        {asig.medicoLetra ? (
                          <>
                            <span className="font-bold text-[var(--color-primario)] mr-1">{asig.medicoLetra}</span>
                            {asig.medicoNombre}
                          </>
                        ) : (
                          asig.medicoNombre
                        )}
                      </td>
                      <td className="px-3 py-2 border-b border-[var(--color-borde)] whitespace-nowrap">
                        {asig.lugarNombre}
                      </td>
                      <td className="px-3 py-2 border-b border-[var(--color-borde)] whitespace-nowrap">
                        {asig.horarioNombre}
                      </td>
                      <td className="px-3 py-2 border-b border-[var(--color-borde)] whitespace-nowrap">
                        {asig.fecha}
                      </td>
                      <td className="px-3 py-2 border-b border-[var(--color-borde)] text-center">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleEliminar(asig.id, asig.medicoNombre)}
                          disabled={eliminarMutation.isPending}
                          aria-label={`Eliminar asignación de ${asig.medicoNombre}`}
                        >
                          Eliminar
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
