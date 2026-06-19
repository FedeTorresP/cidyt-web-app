import { useEffect, useState } from 'react'

function detectTouchPrimary(): boolean {
  if (typeof window === 'undefined') return false
  const coarse = window.matchMedia('(pointer: coarse)').matches
  const hasTouch = navigator.maxTouchPoints > 0
  return coarse || hasTouch
}

/** True on landscape iPad and other touch-primary devices */
export function useTouchPrimary(): boolean {
  const [touchPrimary, setTouchPrimary] = useState(detectTouchPrimary)

  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)')
    const update = () => setTouchPrimary(detectTouchPrimary())
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  return touchPrimary
}

/** True on macOS / fine-pointer desktop */
export function useIsMacDesktop(): boolean {
  return !useTouchPrimary()
}
