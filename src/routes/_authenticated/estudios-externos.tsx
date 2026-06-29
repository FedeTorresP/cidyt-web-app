import { createFileRoute, redirect } from '@tanstack/react-router'

// Ruta consolidada: el registro de estudios externos vive en /externos
export const Route = createFileRoute('/_authenticated/estudios-externos')({
  beforeLoad: () => {
    throw redirect({ to: '/externos' })
  },
})
