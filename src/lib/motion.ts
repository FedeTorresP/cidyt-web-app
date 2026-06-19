import type { Transition, Variants } from 'framer-motion'

/** iOS-style spring for press interactions */
export const springPress: Transition = {
  type: 'spring',
  stiffness: 400,
  damping: 30,
}

/** iOS-style spring for sheet/drawer slides */
export const springSheet: Transition = {
  type: 'spring',
  stiffness: 400,
  damping: 25,
}

/** Standard fade + slide up */
export const fadeSlide: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] } },
  exit: { opacity: 0, y: 8, transition: { duration: 0.15 } },
}

/** Horizontal page push (login steps) */
export const pageSlide: Variants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 40 : -40,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
    transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] },
  },
  exit: (direction: number) => ({
    x: direction < 0 ? 40 : -40,
    opacity: 0,
    transition: { duration: 0.2 },
  }),
}

/** Scale press feedback */
export const scalePress = {
  whileTap: { scale: 0.97 },
  transition: springPress,
}

/** Bottom sheet slide up */
export const sheetSlideUp: Variants = {
  hidden: { y: '100%' },
  visible: { y: 0, transition: springSheet },
  exit: { y: '100%', transition: { duration: 0.2 } },
}

/** Overlay fade */
export const overlayFade: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
}

/** Dialog content scale */
export const dialogScale: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: springPress },
  exit: { opacity: 0, scale: 0.95, transition: { duration: 0.15 } },
}

/** Sidebar slide */
export const sidebarSlide: Variants = {
  open: { x: 0, transition: springSheet },
  closed: { x: '-100%', transition: springSheet },
}

/** Reduced-motion safe transition */
export function getMotionTransition(reduced: boolean, transition: Transition): Transition {
  return reduced ? { duration: 0 } : transition
}

/** Optional haptic feedback (progressive enhancement) */
export function hapticFeedback(duration = 10) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(duration)
  }
}
