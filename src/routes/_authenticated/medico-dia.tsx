import { createFileRoute, Navigate } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/medico-dia')({
  component: () => <Navigate to="/lugares" />,
})
