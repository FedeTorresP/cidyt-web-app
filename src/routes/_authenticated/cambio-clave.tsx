import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { changePassword } from '@/services/auth'
import { clearMustChangePassword } from '@/services/users'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { AlertBanner } from '@/components/shared/AlertBanner'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'

export const Route = createFileRoute('/_authenticated/cambio-clave')({
  component: CambioClavePage,
})

/**
 * Valida que la contraseña sea suficientemente fuerte.
 * Mínimo 8 caracteres con al menos una minúscula, una mayúscula y un dígito.
 */
function validatePasswordStrength(password: string): string | null {
  if (password.length < 8) return 'La contraseña debe tener al menos 8 caracteres.'
  if (!/[a-z]/.test(password)) return 'Incluya al menos una letra minúscula.'
  if (!/[A-Z]/.test(password)) return 'Incluya al menos una letra mayúscula.'
  if (!/[0-9]/.test(password)) return 'Incluya al menos un número.'
  return null
}

function CambioClavePage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
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

    const strengthError = validatePasswordStrength(newPassword)
    if (strengthError) {
      setError(strengthError)
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
      if (user?.uid) {
        await clearMustChangePassword(user.uid)
        await queryClient.invalidateQueries({ queryKey: ['must-change-pw', user.uid] })
      }
      setSuccess(true)
      ;(e.target as HTMLFormElement).reset()
      navigate({ to: '/', replace: true })
    } catch {
      setError('Error al cambiar la contraseña. Intente cerrar sesión y volver a iniciar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md">
      <h1 className="page-title">Cambiar Contraseña</h1>

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
