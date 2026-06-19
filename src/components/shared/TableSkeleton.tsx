import { Skeleton } from '@/components/ui/skeleton'

interface TableSkeletonProps {
  rows?: number
  cols?: number
  className?: string
}

export function TableSkeleton({ rows = 6, cols = 5, className }: TableSkeletonProps) {
  return (
    <div
      className={className}
      style={{
        borderRadius: 'var(--radius-default)',
        border: '1px solid var(--color-borde)',
        backgroundColor: 'var(--color-fondo-card)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gap: '8px',
          padding: '12px 16px',
          backgroundColor: 'var(--color-primario)',
        }}
      >
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={`h-${i}`} className="h-4 bg-white/20" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, row) => (
        <div
          key={`r-${row}`}
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gap: '8px',
            padding: '10px 16px',
            backgroundColor: row % 2 === 0 ? 'var(--color-fondo)' : 'var(--color-fondo-card)',
            borderBottom: '1px solid var(--color-borde)',
          }}
        >
          {Array.from({ length: cols }).map((_, col) => (
            <Skeleton key={`c-${row}-${col}`} className="h-4" />
          ))}
        </div>
      ))}
    </div>
  )
}
