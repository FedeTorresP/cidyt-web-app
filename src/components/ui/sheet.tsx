import { AnimatePresence, motion, useReducedMotion, type PanInfo } from 'framer-motion'
import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { overlayFade, sheetSlideUp } from '@/lib/motion'
import { cn } from '@/lib/utils'

interface SheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
  title?: string
  className?: string
}

export function Sheet({ open, onOpenChange, children, title, className }: SheetProps) {
  const reduced = useReducedMotion()

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 100 || info.velocity.y > 500) {
      onOpenChange(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[300]">
          <motion.div
            className="sheet-overlay"
            variants={overlayFade}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={() => onOpenChange(false)}
          />
          <motion.div
            className={cn('sheet', className)}
            variants={sheetSlideUp}
            initial="hidden"
            animate="visible"
            exit="exit"
            drag={reduced ? false : 'y'}
            dragConstraints={{ top: 0 }}
            dragElastic={0.15}
            onDragEnd={handleDragEnd}
            onClick={(e) => e.stopPropagation()}
            style={{ position: 'fixed', bottom: 0, left: 0, right: 0, margin: '0 auto' }}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[var(--color-borde)]" aria-hidden="true" />
            {title && (
              <div className="mb-4 flex items-start justify-between">
                <h2 className="text-base font-bold text-[var(--color-texto)]">{title}</h2>
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="touch-target rounded-[calc(var(--radius-default)-4px)] p-2 text-[var(--color-texto-suave)] hover:text-[var(--color-texto)] hover:bg-[var(--color-fondo)] transition-colors"
                  aria-label="Cerrar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            )}
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
