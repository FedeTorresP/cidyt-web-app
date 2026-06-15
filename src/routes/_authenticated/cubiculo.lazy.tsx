import { createLazyFileRoute } from '@tanstack/react-router'
import { useCubiculos, useSesionesCubiculo } from '@/hooks/use-cubiculos'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { AlertBanner } from '@/components/shared/AlertBanner'
import { cn } from '@/lib/utils'

export const Route = createLazyFileRoute('/_authenticated/cubiculo')({
  component: CubiculoPage,
})

function getBadgeColor(estatus: string): string {
  const lower = estatus.toLowerCase()
  if (lower.includes('activ') || lower.includes('ocup')) return 'bg-green-700'
  if (lower.includes('libre') || lower.includes('disponible')) return 'bg-sky-700'
  if (lower.includes('inactiv') || lower.includes('cerrad')) return 'bg-gray-500'
  return 'bg-gray-700'
}

function CubiculoPage() {
  const { data: cubiculos, isLoading: cubLoading, error: cubError } = useCubiculos()
  const { data: sesiones } = useSesionesCubiculo()

  const sesionesPorCubiculo = new Map<string, typeof sesiones>()
  if (sesiones) {
    for (const s of sesiones) {
      const arr = sesionesPorCubiculo.get(s.cubiculoId) ?? []
      arr.push(s)
      sesionesPorCubiculo.set(s.cubiculoId, arr)
    }
  }

  if (cubLoading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (cubError) {
    return <AlertBanner variant="error">Error al cargar cubículos.</AlertBanner>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h1 className="page-title">Cubículos</h1>
      </div>

      {!cubiculos?.length ? (
        <p className="text-[var(--color-texto-suave)] italic">No hay cubículos registrados.</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
          {cubiculos.map((c) => {
            const sesionesCubiculo = sesionesPorCubiculo.get(c.id) ?? []
            return (
              <Card key={c.id}>
                <CardHeader className="pb-1">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-sm">{c.nombre ?? `Cubículo ${c.id}`}</CardTitle>
                    <span
                      className={cn(
                        'text-white text-[0.7rem] px-2 py-0.5 rounded-full whitespace-nowrap',
                        getBadgeColor(c.estatusNombre),
                      )}
                    >
                      {c.estatusNombre}
                    </span>
                  </div>
                  {c.entidadNombre && (
                    <p className="text-[0.75rem] text-[var(--color-texto-suave)]">{c.entidadNombre}</p>
                  )}
                </CardHeader>
                <CardContent>
                  {c.descripcion && (
                    <p className="text-[0.8rem] text-[var(--color-texto-suave)] mb-2">{c.descripcion}</p>
                  )}

                  <div className="border-t border-[var(--color-borde)] pt-2 mt-1">
                    <span className="text-[0.75rem] font-semibold text-[var(--color-texto)]">
                      Sesiones ({sesionesCubiculo.length})
                    </span>
                    {sesionesCubiculo.length === 0 ? (
                      <p className="text-[0.75rem] text-[var(--color-texto-suave)] italic mt-0.5">
                        Sin sesiones activas.
                      </p>
                    ) : (
                      <ul className="mt-1 flex flex-col gap-1">
                        {sesionesCubiculo.map((s) => (
                          <li key={s.id} className="flex items-center justify-between gap-2 text-[0.8rem]">
                            <span className="truncate flex-1">
                              {s.medicoNombreCompleto ?? `Médico #${s.medicoId}`}
                            </span>
                            <span
                              className={cn(
                                'text-white text-[0.65rem] px-1.5 py-0.5 rounded-full whitespace-nowrap',
                                getBadgeColor(s.estatusNombre),
                              )}
                            >
                              {s.estatusNombre}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
