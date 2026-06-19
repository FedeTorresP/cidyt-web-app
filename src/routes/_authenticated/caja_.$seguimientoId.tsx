import { createFileRoute } from '@tanstack/react-router'
import { TableSkeleton } from '@/components/shared/TableSkeleton'

export const Route = createFileRoute('/_authenticated/caja_/$seguimientoId')({
  pendingComponent: () => <TableSkeleton rows={6} cols={4} />,
})

