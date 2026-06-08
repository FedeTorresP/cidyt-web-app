import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'w-full min-h-[38px] px-2.5 border border-[var(--color-borde)] rounded-[var(--radius-default)] bg-white text-[var(--color-texto)] text-[13px] outline-none transition-all duration-200 focus:border-[var(--color-primario)] focus:ring-3 focus:ring-[rgba(10,31,92,0.12)] disabled:bg-[var(--color-fondo)] disabled:text-[var(--color-texto-suave)] disabled:cursor-not-allowed disabled:opacity-70',
          className,
        )}
        ref={ref}
        {...props}
      />
    )
  },
)
Input.displayName = 'Input'

export { Input }
