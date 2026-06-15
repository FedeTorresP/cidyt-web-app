import { createFileRoute } from '@tanstack/react-router'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

export const Route = createFileRoute('/_authenticated/paciente')({
  component: PacientePage,
})

function PacientePage() {
  return (
    <div>
      <h1 className="page-title">Registro de Pacientes</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Búsqueda y Registro</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[var(--color-texto-suave)]">
            Módulo de registro y búsqueda de pacientes.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
