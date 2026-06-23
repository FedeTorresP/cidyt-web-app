import { createLazyFileRoute } from '@tanstack/react-router'
import { ListaCajaPage } from '@/components/caja/ListaCajaPage'

export const Route = createLazyFileRoute('/_authenticated/caja')({
  component: ListaCajaPage,
})
