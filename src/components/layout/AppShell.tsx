import { useState, useEffect, useCallback } from 'react'
import { Outlet, useNavigate, useLocation } from '@tanstack/react-router'
import { motion, useReducedMotion } from 'framer-motion'
import { useAuth } from '@/hooks/use-auth'
import { useMenu } from '@/hooks/use-menu'
import { useOnline } from '@/hooks/use-online'
import { useTouchPrimary } from '@/hooks/use-touch-primary'
import { useSidebarGesture, SIDEBAR_EDGE_ZONE } from '@/hooks/use-sidebar-gesture'
import { logout } from '@/services/auth'
import { SidebarNav } from './SidebarNav'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { AlertBanner } from '@/components/shared/AlertBanner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { SIDEBAR_WIDTH, springSheet } from '@/lib/motion'

const SIDEBAR_STORAGE_KEY = 'cidyt_sidebar_open'

function readStoredSidebarOpen(fallback: boolean): boolean {
  if (typeof sessionStorage === 'undefined') return fallback
  const stored = sessionStorage.getItem(SIDEBAR_STORAGE_KEY)
  if (stored === null) return fallback
  return stored === 'true'
}

export function AppShell() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, firebaseUser } = useAuth()
  const online = useOnline()
  const touchPrimary = useTouchPrimary()
  const overlayMode = touchPrimary
  const reduced = useReducedMotion()
  const isCubiculos = location.pathname === '/cubiculo/listado'
  const { data: menuItems, isLoading: menuLoading, error: menuError } = useMenu()

  const defaultOpen = !touchPrimary
  const [sidebarOpen, setSidebarOpen] = useState(() => readStoredSidebarOpen(defaultOpen))
  const [logoutOpen, setLogoutOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  const handleSidebarOpenChange = useCallback((open: boolean) => {
    setSidebarOpen(open)
    sessionStorage.setItem(SIDEBAR_STORAGE_KEY, String(open))
  }, [])

  const {
    sidebarX,
    overlayOpacity,
    isDragging,
    showOverlay,
    handleSidebarDrag,
    handleSidebarDragEnd,
    handleEdgePointerDown,
    handleEdgePointerMove,
    handleEdgePointerUp,
    handleEdgePointerCancel,
    resetDrag,
    acquireLock,
  } = useSidebarGesture({
    overlayMode,
    open: sidebarOpen,
    onOpenChange: handleSidebarOpenChange,
  })

  useEffect(() => {
    if (!overlayMode) return
    if (sidebarOpen || showOverlay) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [overlayMode, sidebarOpen, showOverlay])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && sidebarOpen) {
        handleSidebarOpenChange(false)
        resetDrag()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [sidebarOpen, handleSidebarOpenChange, resetDrag])

  const toggleSidebar = useCallback(() => {
    acquireLock()
    resetDrag()
    handleSidebarOpenChange(!sidebarOpen)
  }, [acquireLock, resetDrag, handleSidebarOpenChange, sidebarOpen])

  const closeSidebar = useCallback(() => {
    resetDrag()
    handleSidebarOpenChange(false)
  }, [resetDrag, handleSidebarOpenChange])

  const userName = (
    firebaseUser?.displayName ||
    user?.email?.split('@')[0] ||
    'Usuario'
  ).toUpperCase()

  const turno = typeof window !== 'undefined'
    ? sessionStorage.getItem('cidyt_turno')
    : null

  const handleLogoutConfirm = async () => {
    setLoggingOut(true)
    try {
      await logout()
    } finally {
      sessionStorage.removeItem('cidyt_turno')
      setLogoutOpen(false)
      navigate({ to: '/login' })
    }
  }

  const mainMarginLeft = !overlayMode && sidebarOpen ? SIDEBAR_WIDTH : 0
  const hamburgerTranslateX = sidebarOpen ? SIDEBAR_WIDTH - 44 - 8 : 0
  const sidebarClosed = !sidebarOpen && !isDragging

  const asideAnimateX = isDragging && !sidebarOpen
    ? sidebarX
    : sidebarOpen
      ? 0
      : -SIDEBAR_WIDTH

  return (
    <div className="flex flex-row" style={{ minHeight: '100dvh' }}>
      {overlayMode && showOverlay && (
        <motion.div
          className="fixed inset-0 z-[199]"
          style={{
            backgroundColor: 'rgba(10,31,92,0.4)',
            opacity: overlayOpacity,
            pointerEvents: overlayOpacity > 0.1 ? 'auto' : 'none',
          }}
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}

      {overlayMode && !sidebarOpen && (
        <div
          className="fixed top-0 bottom-0 z-[198]"
          style={{
            left: 'env(safe-area-inset-left)',
            width: SIDEBAR_EDGE_ZONE,
            touchAction: 'none',
          }}
          onPointerDown={handleEdgePointerDown}
          onPointerMove={handleEdgePointerMove}
          onPointerUp={handleEdgePointerUp}
          onPointerCancel={handleEdgePointerCancel}
          aria-hidden="true"
        />
      )}

      <motion.aside
        className="fixed top-0 left-0 z-[200] flex flex-col overflow-hidden gpu-layer"
        style={{
          width: SIDEBAR_WIDTH,
          minWidth: SIDEBAR_WIDTH,
          height: '100dvh',
          backgroundColor: 'var(--color-primario)',
          overflowY: 'auto',
          overflowX: 'hidden',
          paddingBottom: 'env(safe-area-inset-bottom)',
          paddingLeft: 'max(0px, env(safe-area-inset-left))',
          paddingRight: 'max(0px, env(safe-area-inset-right))',
          touchAction: isDragging ? 'none' : 'auto',
          pointerEvents: overlayMode && sidebarClosed ? 'none' : 'auto',
        }}
        initial={false}
        animate={
          isDragging && sidebarOpen
            ? false
            : { x: asideAnimateX }
        }
        drag={overlayMode && !reduced && sidebarOpen ? 'x' : false}
        dragConstraints={{ left: -SIDEBAR_WIDTH, right: 0 }}
        dragElastic={0}
        dragMomentum={false}
        onDrag={handleSidebarDrag}
        onDragEnd={handleSidebarDragEnd}
        transition={reduced ? { duration: 0 } : springSheet}
        aria-label="Panel de navegación"
        aria-hidden={overlayMode && sidebarClosed}
      >
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
            onNavigate={overlayMode ? closeSidebar : undefined}
          />
        )}

        <div
          className="shrink-0"
          style={{
            padding: '8px 12px calc(10px + env(safe-area-inset-bottom))',
            borderTop: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <motion.button
            onClick={() => setLogoutOpen(true)}
            className="flex items-center justify-center gap-2 w-full interactive"
            style={{
              minHeight: 44,
              padding: '0 12px',
              backgroundColor: 'rgba(255,255,255,0.07)',
              color: 'rgba(255,255,255,0.65)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 'var(--radius-default)',
              fontSize: '0.8125rem',
              fontWeight: 500,
            }}
            whileTap={reduced ? undefined : { scale: 0.97 }}
            aria-label="Cerrar sesión"
          >
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
          </motion.button>
        </div>
      </motion.aside>

      <main
        className="flex-1 flex flex-col bg-[var(--color-fondo)] min-h-0"
        style={{
          minHeight: '100dvh',
          marginLeft: mainMarginLeft,
          paddingTop: 'env(safe-area-inset-top)',
          transition: reduced ? 'none' : 'margin-left 250ms ease-in-out',
        }}
      >
        {!online && (
          <div
            className="text-center text-xs font-semibold text-white shrink-0"
            style={{
              backgroundColor: 'var(--color-warning)',
              padding: '6px 12px',
            }}
          >
            Sin conexión — los cambios se sincronizarán al reconectar
          </div>
        )}

        <motion.button
          onClick={toggleSidebar}
          className="interactive gpu-layer"
          style={{
            position: 'fixed',
            top: 'calc(8px + env(safe-area-inset-top))',
            left: 'calc(8px + env(safe-area-inset-left))',
            zIndex: 201,
            width: 44,
            height: 44,
            minHeight: 44,
            maxHeight: 44,
            minWidth: 44,
            maxWidth: 44,
            padding: 0,
            backgroundColor: isCubiculos ? 'transparent' : 'var(--color-primario)',
            color: isCubiculos ? '#e2e8f0' : '#fff',
            border: 'none',
            borderRadius: isCubiculos ? '0' : '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: 'none',
          }}
          animate={{ x: hamburgerTranslateX }}
          transition={reduced ? { duration: 0 } : springSheet}
          whileTap={reduced ? undefined : { scale: 0.93 }}
          aria-label={sidebarOpen ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={sidebarOpen}
        >
          {sidebarOpen ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <line x1="4" y1="6" x2="20" y2="6" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="18" x2="20" y2="18" />
            </svg>
          )}
        </motion.button>

        <div
          className="flex-1 min-h-0 overflow-y-auto scroll-touch"
          style={{
            padding: sidebarOpen && !overlayMode
              ? '12px 24px calc(24px + env(safe-area-inset-bottom)) 24px'
              : '12px 24px calc(24px + env(safe-area-inset-bottom)) 50px',
          }}
        >
          <Outlet />
        </div>

        <footer className="text-center text-[11px] text-[var(--color-texto-suave)] py-6 mt-auto shrink-0">
          Desarrollado por: Médica Sur – Sistemas y T.I. · Copyright © {new Date().getFullYear()}. All rights reserved.
        </footer>
      </main>

      <Dialog open={logoutOpen} onOpenChange={setLogoutOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>¿Cerrar sesión?</DialogTitle>
            <DialogDescription>
              Se cerrará tu sesión en IPadCIDyT. Deberás volver a iniciar sesión para continuar.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 justify-end mt-2">
            <Button variant="outline" onClick={() => setLogoutOpen(false)} disabled={loggingOut}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleLogoutConfirm} disabled={loggingOut}>
              {loggingOut ? 'Saliendo...' : 'Cerrar sesión'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
