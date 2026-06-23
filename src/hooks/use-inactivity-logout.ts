import { useEffect, useRef, useCallback } from 'react'
import { INACTIVITY_TIMEOUT_MS } from '@/services/session'

const ACTIVITY_THROTTLE_MS = 1000

const ACTIVITY_EVENTS = [
  'pointerdown',
  'keydown',
  'touchstart',
  'click',
  'scroll',
] as const

/**
 * Cierra sesión tras INACTIVITY_TIMEOUT_MS sin interacción del usuario.
 * Solo debe montarse en rutas autenticadas (AppShell).
 */
export function useInactivityLogout(onTimeout: () => void | Promise<void>) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastResetRef = useRef(0)
  const onTimeoutRef = useRef(onTimeout)
  onTimeoutRef.current = onTimeout

  const scheduleLogout = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      void onTimeoutRef.current()
    }, INACTIVITY_TIMEOUT_MS)
  }, [])

  const resetTimer = useCallback(() => {
    const now = Date.now()
    if (now - lastResetRef.current < ACTIVITY_THROTTLE_MS) return
    lastResetRef.current = now
    scheduleLogout()
  }, [scheduleLogout])

  useEffect(() => {
    scheduleLogout()

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, resetTimer, { passive: true })
    }

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, resetTimer)
      }
    }
  }, [resetTimer, scheduleLogout])
}
