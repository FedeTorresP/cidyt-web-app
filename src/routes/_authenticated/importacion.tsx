import { createFileRoute } from '@tanstack/react-router'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

export const Route = createFileRoute('/_authenticated/importacion')({
  component: ImportacionPage,
})

function ImportacionPage() {
  return (
    <div>
      <h1 className="page-title">Importación</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Importación Masiva de Datos</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[var(--color-texto-suave)]">
            Módulo de importación CSV/Excel para carga masiva de pacientes y estudios.
            Funcionalidad en desarrollo.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
