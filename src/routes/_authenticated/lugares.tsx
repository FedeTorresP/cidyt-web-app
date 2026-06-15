import { createFileRoute } from '@tanstack/react-router'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

export const Route = createFileRoute('/_authenticated/lugares')({
  component: LugaresPage,
})

function LugaresPage() {
  return (
    <div>
      <h1 className="page-title">Lugares</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Catálogo de Lugares</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[var(--color-texto-suave)]">
            Gestión de lugares del CIDyT.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
