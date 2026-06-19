import { createFileRoute } from '@tanstack/react-router'
import { TableSkeleton } from '@/components/shared/TableSkeleton'

export const Route = createFileRoute('/_authenticated/lista-dia')({
  pendingComponent: () => <TableSkeleton rows={10} cols={8} />,
})
