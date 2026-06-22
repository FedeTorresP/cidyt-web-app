import { cn } from '@/lib/utils'

type SFSymbolProps = {
  className?: string
}

const strokeProps = {
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

/** SF Symbol: checkmark.circle */
export function SFCheckmarkCircle({ className }: SFSymbolProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn('size-5 shrink-0', className)}
      aria-hidden="true"
      {...strokeProps}
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 12.2 10.8 14.5 15.8 9.5" />
    </svg>
  )
}

/** SF Symbol: minus.circle */
export function SFMinusCircle({ className }: SFSymbolProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn('size-5 shrink-0', className)}
      aria-hidden="true"
      {...strokeProps}
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12h8" />
    </svg>
  )
}

/** SF Symbol: square.and.pencil */
export function SFSquareAndPencil({ className }: SFSymbolProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn('size-5 shrink-0', className)}
      aria-hidden="true"
      {...strokeProps}
    >
      <path d="M14.25 3.75H7.5A2.25 2.25 0 0 0 5.25 6v10.5A2.25 2.25 0 0 0 7.5 18.75h9.75A2.25 2.25 0 0 0 19.5 16.5V9.75" />
      <path d="M19.5 3.75 15.75 7.5" />
      <path d="M9.75 14.25 15.75 8.25" />
      <path d="M6.75 19.5 4.5 21.75" />
    </svg>
  )
}

/** SF Symbol: ellipsis.vertical */
export function SFEllipsisVertical({ className }: SFSymbolProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={cn('size-5 shrink-0', className)}
      aria-hidden="true"
    >
      <circle cx="12" cy="5.25" r="1.75" />
      <circle cx="12" cy="12" r="1.75" />
      <circle cx="12" cy="18.75" r="1.75" />
    </svg>
  )
}
