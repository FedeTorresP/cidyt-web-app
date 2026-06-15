import { useState } from 'react'
import { Outlet, useNavigate } from '@tanstack/react-router'
import { useAuth } from '@/hooks/use-auth'
import { useMenu } from '@/hooks/use-menu'
import { logout } from '@/services/auth'
import { SidebarNav } from './SidebarNav'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { AlertBanner } from '@/components/shared/AlertBanner'

export function AppShell() {
  const navigate = useNavigate()
  const { user, firebaseUser } = useAuth()
  const { data: menuItems, isLoading: menuLoading, error: menuError } = useMenu()
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // Derivar nombre de usuario (mayúsculas como legacy)
  const userName = (
    firebaseUser?.displayName ||
    user?.email?.split('@')[0] ||
    'Usuario'
  ).toUpperCase()

  // Turno almacenado en sessionStorage desde el login
  const turno = typeof window !== 'undefined'
    ? sessionStorage.getItem('cidyt_turno')
    : null

  const handleLogout = async () => {
    try {
      await logout()
    } finally {
      sessionStorage.removeItem('cidyt_turno')
      navigate({ to: '/login' })
    }
  }

  return (
    <div className="flex flex-row" style={{ minHeight: '100dvh' }}>
      {/* Overlay (portrait / mobile) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-[199] lg:hidden"
          style={{ backgroundColor: 'rgba(10,31,92,0.4)' }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={[
          'fixed top-0 left-0 z-[200] flex flex-col overflow-hidden',
          'transition-transform duration-[250ms] ease-in-out',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
        style={{
          width: 200,
          minWidth: 200,
          height: '100dvh',
          backgroundColor: 'var(--color-primario)',
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
        aria-label="Panel de navegación"
      >
        {/* Nav content */}
        {menuLoading ? (
          <div className="flex items-center justify-center py-6 flex-1">
            <LoadingSpinner size="sm" className="border-white/30 border-t-white" />
          </div>
        ) : menuError ? (
          <div className="m-3">
            <AlertBanner variant="error">No se pudo cargar el menú.</AlertBanner>
          </div>
        ) : (
          <SidebarNav
            items={menuItems ?? []}
            userName={userName}
            turno={turno}
          />
        )}

        {/* Footer: Botón Salir */}
        <div
          className="shrink-0"
          style={{
            padding: '8px 12px 10px',
            borderTop: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <button
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 w-full"
            style={{
              minHeight: 44,
              padding: '0 12px',
              backgroundColor: 'rgba(255,255,255,0.07)',
              color: 'rgba(255,255,255,0.65)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 'var(--radius-default)',
              fontSize: '0.8125rem',
              fontWeight: 500,
              touchAction: 'manipulation',
              transition: 'background-color 0.2s ease',
            }}
            aria-label="Cerrar sesión"
          >
            {/* Ícono de salida (logout arrow) */}
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>Salir</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main
        className="flex-1 flex flex-col bg-[var(--color-fondo)] p-3 lg:p-4 transition-[margin-left] duration-[250ms] ease-in-out"
        style={{
          minHeight: '100dvh',
          marginLeft: sidebarOpen ? 200 : 0,
        }}
      >
        {/* Hamburger toggle */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="fixed top-2 z-[201] flex items-center justify-center"
          style={{
            left: sidebarOpen ? 156 : 8,
            width: 44,
            height: 44,
            backgroundColor: 'var(--color-primario)',
            color: '#fff',
            border: 'none',
            borderRadius: 'var(--radius-default)',
            touchAction: 'manipulation',
            transition: 'left 0.25s ease',
            boxShadow: '0 2px 8px rgba(10,31,92,0.25)',
          }}
          aria-label={sidebarOpen ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={sidebarOpen}
        >
          {sidebarOpen ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <line x1="4" y1="6" x2="20" y2="6" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="18" x2="20" y2="18" />
            </svg>
          )}
        </button>

        <div className="flex-1" style={{ paddingTop: 44 }}>
          <Outlet />
        </div>

        {/* Footer corporativo */}
        <footer className="text-center text-[11px] text-[var(--color-texto-suave)] py-6 mt-auto">
          Desarrollado por: Médica Sur – Sistemas y T.I. · Copyright © {new Date().getFullYear()}. All rights reserved.
        </footer>
      </main>
    </div>
  )
}
