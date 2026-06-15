import { createFileRoute } from '@tanstack/react-router'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

export const Route = createFileRoute('/_authenticated/cubiculo_/listado')({
  component: CubiculoListadoPage,
})

function CubiculoListadoPage() {
  return (
    <div>
      <h1 className="page-title">Lista Cubículos</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Cubículos y Sesiones</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[var(--color-texto-suave)]">
            Listado completo de cubículos y gestión de sesiones médico-cubículo.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
