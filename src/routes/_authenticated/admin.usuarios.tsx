import { createFileRoute } from '@tanstack/react-router'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

export const Route = createFileRoute('/_authenticated/admin/usuarios')({
  component: UsuariosPage,
})

function UsuariosPage() {
  return (
    <div>
      <h1 className="page-title">Gestión de Usuarios</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Administración de Usuarios</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[var(--color-texto-suave)]">
            Módulo de gestión de usuarios con Firebase Auth.
            Permite crear, editar y desactivar cuentas de usuario.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
