import { motion, useReducedMotion, type HTMLMotionProps } from 'framer-motion'
import { forwardRef } from 'react'
import { cn } from '@/lib/utils'
import { springPress } from '@/lib/motion'

type PressableProps = HTMLMotionProps<'button'>

const Pressable = forwardRef<HTMLButtonElement, PressableProps>(
  ({ className, children, ...props }, ref) => {
    const reduced = useReducedMotion()

    return (
      <motion.button
        ref={ref}
        type="button"
        className={cn('touch-manipulation inline-flex items-center justify-center', className)}
        whileTap={reduced ? undefined : { scale: 0.97 }}
        transition={reduced ? { duration: 0 } : springPress}
        {...props}
      >
        {children}
      </motion.button>
    )
  },
)
Pressable.displayName = 'Pressable'

export { Pressable }
