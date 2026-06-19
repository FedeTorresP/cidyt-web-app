import { createFileRoute } from '@tanstack/react-router'
import { TableSkeleton } from '@/components/shared/TableSkeleton'

export const Route = createFileRoute('/_authenticated/lista-caja')({
  pendingComponent: () => <TableSkeleton rows={8} cols={6} />,
})

