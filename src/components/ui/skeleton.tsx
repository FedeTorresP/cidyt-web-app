import { cn } from '@/lib/utils'

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-[var(--radius-default)] bg-[var(--color-borde)]',
        className,
      )}
      {...props}
    />
  )
}

export { Skeleton }
