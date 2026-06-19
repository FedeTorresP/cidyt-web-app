import { createFileRoute } from '@tanstack/react-router'
import { TableSkeleton } from '@/components/shared/TableSkeleton'

export const Route = createFileRoute('/_authenticated/paciente')({
  pendingComponent: () => <TableSkeleton rows={6} cols={4} />,
})

