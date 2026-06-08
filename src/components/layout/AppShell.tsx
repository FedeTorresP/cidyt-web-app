import { useState } from 'react'
import { Outlet } from '@tanstack/react-router'
import { Menu, LogOut } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { useMenu } from '@/hooks/use-menu'
import { logout } from '@/services/auth'
import { SidebarNav } from './SidebarNav'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { AlertBanner } from '@/components/shared/AlertBanner'
import { cn } from '@/lib/utils'

export function AppShell() {
  const { user } = useAuth()
  const { data: menuItems, isLoading: menuLoading, error: menuError } = useMenu()
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const handleLogout = async () => {
    await logout()
  }

  return (
    <div className="flex flex-row min-h-screen min-h-[100dvh]">
      {/* Overlay (mobile/portrait) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-[rgba(10,31,92,0.4)] z-[199] lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'w-[200px] min-w-[200px] bg-[var(--color-primario)] flex flex-col fixed top-0 left-0 h-screen h-[100dvh] z-[200] overflow-y-auto overflow-x-hidden transition-transform duration-250 ease-in-out',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-label="Menú de navegación"
      >
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-white/10 flex flex-col gap-1">
          <span className="font-bold text-base tracking-wide text-white">IPadCIDyT</span>
          {user?.email && (
            <span className="text-[0.7rem] text-white/60 truncate">{user.email}</span>
          )}
        </div>

        {/* Menu */}
        {menuLoading ? (
          <div className="flex items-center justify-center py-6">
            <LoadingSpinner size="sm" className="border-white/30 border-t-white" />
          </div>
        ) : menuError ? (
          <div className="m-3">
            <AlertBanner variant="error">No se pudo cargar el menú.</AlertBanner>
          </div>
        ) : (
          <SidebarNav items={menuItems ?? []} />
        )}

        {/* Footer: Logout */}
        <div className="mt-auto px-3 py-3 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-[12px] text-white/70 hover:bg-white/8 hover:text-white transition-all bg-transparent"
          >
            <LogOut size={14} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main
        className={cn(
          'flex-1 min-h-screen min-h-[100dvh] bg-[var(--color-fondo)] p-3 lg:p-4 transition-[margin-left] duration-250 ease-in-out',
          sidebarOpen ? 'lg:ml-[200px]' : 'ml-0',
        )}
      >
        {/* Hamburger */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="fixed top-3 left-3 z-[201] w-9 h-9 rounded-lg bg-[var(--color-primario)] text-white flex items-center justify-center shadow-md lg:relative lg:top-0 lg:left-0 lg:mb-3"
          aria-label={sidebarOpen ? 'Cerrar menú' : 'Abrir menú'}
        >
          <Menu size={18} />
        </button>

        <Outlet />
      </main>
    </div>
  )
}
