import { createFileRoute } from '@tanstack/react-router'
import { useMedicosActivos } from '@/hooks/use-medicos'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'

export const Route = createFileRoute('/_authenticated/medico-dia')({
  component: MedicoDiaPage,
})

function MedicoDiaPage() {
  const { data: medicos, isLoading } = useMedicosActivos()

  return (
    <div>
      <h1 className="text-xl font-bold mb-4 text-[var(--color-texto)]">Médico del Día</h1>

      {isLoading ? (
        <div className="flex justify-center py-8"><LoadingSpinner size="md" /></div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Médicos Activos</CardTitle>
          </CardHeader>
          <CardContent>
            {!medicos?.length ? (
              <p className="text-[var(--color-texto-suave)] text-sm italic">No hay médicos activos.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {medicos.map((m) => (
                  <li key={m.id} className="text-sm py-1 border-b border-[var(--color-borde)] last:border-0">
                    {m.nombreCompleto ?? `Médico #${m.id}`}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
