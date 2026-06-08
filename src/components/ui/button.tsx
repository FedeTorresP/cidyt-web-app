import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[var(--radius-default)] font-semibold text-[13px] min-h-[38px] px-4 transition-all duration-200 disabled:opacity-55 disabled:cursor-not-allowed cursor-pointer',
  {
    variants: {
      variant: {
        default: 'bg-[var(--color-primario)] text-white hover:bg-[var(--color-primario-hover)]',
        accent: 'bg-[var(--color-acento)] text-white hover:bg-[var(--color-acento-hover)]',
        destructive: 'bg-[var(--color-error)] text-white hover:opacity-90',
        outline: 'border border-[var(--color-borde)] bg-white text-[var(--color-texto)] hover:bg-[var(--color-fondo)]',
        ghost: 'bg-transparent text-[var(--color-texto)] hover:bg-[var(--color-fondo)]',
        link: 'bg-transparent text-[var(--color-info)] underline-offset-4 hover:underline p-0 min-h-0',
      },
      size: {
        default: 'px-4 min-h-[38px]',
        sm: 'px-3 min-h-[32px] text-xs',
        lg: 'px-6 min-h-[44px] text-sm',
        icon: 'w-[38px] min-h-[38px] p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  },
)
Button.displayName = 'Button'

export { Button, buttonVariants }
