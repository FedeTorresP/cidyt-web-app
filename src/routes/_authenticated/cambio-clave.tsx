import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { changePassword } from '@/services/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { AlertBanner } from '@/components/shared/AlertBanner'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'

export const Route = createFileRoute('/_authenticated/cambio-clave')({
  component: CambioClavePage,
})

function CambioClavePage() {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const newPassword = (formData.get('newPassword') as string) || ''
    const confirmPassword = (formData.get('confirmPassword') as string) || ''

    if (newPassword.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      setLoading(false)
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden.')
      setLoading(false)
      return
    }

    try {
      await changePassword(newPassword)
      setSuccess(true)
      ;(e.target as HTMLFormElement).reset()
    } catch {
      setError('Error al cambiar la contraseña. Intente cerrar sesión y volver a iniciar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md">
      <h1 className="text-xl font-bold mb-4 text-[var(--color-texto)]">Cambiar Contraseña</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Nueva contraseña</CardTitle>
        </CardHeader>
        <CardContent>
          {success && (
            <AlertBanner variant="success" className="mb-3">
              Contraseña actualizada exitosamente.
            </AlertBanner>
          )}
          {error && (
            <AlertBanner variant="error" className="mb-3">
              {error}
            </AlertBanner>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="newPassword" className="text-xs font-medium text-[var(--color-texto-suave)]">
                Nueva contraseña
              </label>
              <Input id="newPassword" name="newPassword" type="password" required disabled={loading} />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="confirmPassword" className="text-xs font-medium text-[var(--color-texto-suave)]">
                Confirmar contraseña
              </label>
              <Input id="confirmPassword" name="confirmPassword" type="password" required disabled={loading} />
            </div>
            <Button type="submit" disabled={loading} className="mt-2">
              {loading ? <LoadingSpinner size="sm" className="border-white/35 border-t-white" /> : null}
              Cambiar contraseña
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
