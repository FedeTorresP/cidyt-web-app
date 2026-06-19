import { motion, useReducedMotion, type HTMLMotionProps } from 'framer-motion'
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { springPress } from '@/lib/motion'

type PressableProps = HTMLMotionProps<'button'> & {
  variant?: 'default' | 'lite'
}

const Pressable = forwardRef<HTMLButtonElement, PressableProps>(
  ({ className, children, variant = 'default', ...props }, ref) => {
    const reduced = useReducedMotion()

    if (variant === 'lite') {
      const liteProps = props as ButtonHTMLAttributes<HTMLButtonElement>
      return (
        <button
          ref={ref}
          type="button"
          className={cn(
            'touch-manipulation inline-flex items-center justify-center pressable-lite interactive',
            className,
          )}
          {...liteProps}
        >
          {children as ReactNode}
        </button>
      )
    }

    return (
      <motion.button
        ref={ref}
        type="button"
        className={cn('touch-manipulation inline-flex items-center justify-center interactive', className)}
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
