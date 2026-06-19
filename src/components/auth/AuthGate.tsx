import { useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useAuth } from '@/hooks/use-auth'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'

interface AuthGateProps {
  children: React.ReactNode
}

export function AuthGate({ children }: AuthGateProps) {
  const { user, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: '/login' })
    }
  }, [loading, user, navigate])

  if (loading) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-4"
        style={{
          minHeight: '100dvh',
          background: 'linear-gradient(135deg, #0A1F5C 0%, #0d2870 100%)',
        }}
      >
        <LoadingSpinner size="lg" className="border-white/30 border-t-white" />
        <p className="text-white/70 text-sm font-medium">Cargando sesión...</p>
      </div>
    )
  }

  if (!user) return null

  return <>{children}</>
}
