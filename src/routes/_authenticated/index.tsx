import { createFileRoute } from '@tanstack/react-router'
import { useAuth } from '@/hooks/use-auth'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

export const Route = createFileRoute('/_authenticated/')({
  component: HomePage,
})

function HomePage() {
  const { user } = useAuth()

  return (
    <div>
      <h1 className="page-title">
        Bienvenido a IPadCIDyT
      </h1>

      <Card>
        <CardHeader>
          <CardTitle>Panel Principal</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[var(--color-texto-suave)]">
            Sesión activa: <strong>{user?.email}</strong>
          </p>
          <p className="text-sm text-[var(--color-texto-suave)] mt-1">
            Rol ID: <code className="bg-[var(--color-fondo)] px-1 rounded">{user?.roleId || 'Sin rol'}</code>
          </p>
          <p className="text-sm text-[var(--color-texto-suave)] mt-3">
            Seleccione una opción del menú lateral para continuar.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
