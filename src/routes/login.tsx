import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useRef } from 'react'
import { loginWithEmail, GENERIC_AUTH_ERROR } from '@/services/auth'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AlertBanner } from '@/components/shared/AlertBanner'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

function LoginPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const emailRef = useRef<HTMLInputElement>(null)

  // Si ya está autenticado, redirigir
  if (user) {
    navigate({ to: '/' })
    return null
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const email = (formData.get('username') as string || '').trim()
    const password = (formData.get('password') as string) || ''

    try {
      await loginWithEmail(email, password)
      navigate({ to: '/' })
    } catch (err) {
      console.error('[Login] Error de autenticación:', err)
      setError(GENERIC_AUTH_ERROR)
      emailRef.current?.focus()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-[var(--color-primario)]">
      <div className="w-full max-w-sm bg-[var(--color-fondo-card)] rounded-[var(--radius-default)] shadow-[var(--shadow-hover)] p-8">
        {/* Logo / Título */}
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-[var(--color-primario)]">IPadCIDyT</h1>
          <p className="text-[var(--color-texto-suave)] text-sm mt-1">Iniciar sesión</p>
        </div>

        {error && (
          <AlertBanner variant="error" className="mb-4">
            {error}
          </AlertBanner>
        )}

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="username" className="text-xs font-medium text-[var(--color-texto-suave)]">
              Usuario
            </label>
            <Input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              required
              ref={emailRef}
              disabled={loading}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-xs font-medium text-[var(--color-texto-suave)]">
              Contraseña
            </label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              disabled={loading}
            />
          </div>

          <Button type="submit" disabled={loading} className="w-full mt-2">
            {loading ? (
              <>
                <LoadingSpinner size="sm" className="border-white/35 border-t-white" />
                Iniciando sesión...
              </>
            ) : (
              'Entrar'
            )}
          </Button>
        </form>
      </div>
    </div>
  )
}
