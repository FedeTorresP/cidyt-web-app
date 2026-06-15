import { createFileRoute } from '@tanstack/react-router'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

export const Route = createFileRoute('/_authenticated/externos')({
  component: ExternosPage,
})

function ExternosPage() {
  return (
    <div>
      <h1 className="page-title">Externos</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Pacientes Externos</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[var(--color-texto-suave)]">
            Módulo de gestión de pacientes externos. Funcionalidad en desarrollo.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
