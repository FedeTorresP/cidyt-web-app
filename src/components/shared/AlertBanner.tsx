import { cn } from '@/lib/utils'

interface AlertBannerProps {
  variant: 'error' | 'success' | 'warning' | 'info'
  children: React.ReactNode
  className?: string
}

const variantClasses = {
  error: 'bg-[rgba(211,47,47,0.08)] border-[var(--color-error)] text-[var(--color-error)]',
  success: 'bg-[rgba(0,166,81,0.08)] border-[var(--color-success)] text-[var(--color-success)]',
  warning: 'bg-[rgba(245,124,0,0.08)] border-[var(--color-warning)] text-[var(--color-warning)]',
  info: 'bg-[rgba(25,118,210,0.06)] border-[var(--color-info)] text-[var(--color-info)]',
}

export function AlertBanner({ variant, children, className }: AlertBannerProps) {
  return (
    <div
      role="alert"
      className={cn(
        'border rounded-[var(--radius-default)] px-3.5 py-2.5 text-sm',
        variantClasses[variant],
        className,
      )}
    >
      {children}
    </div>
  )
}
