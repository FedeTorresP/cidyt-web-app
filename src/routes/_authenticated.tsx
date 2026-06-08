import { createFileRoute, redirect } from '@tanstack/react-router'
import { AppShell } from '@/components/layout/AppShell'
import { getFirebaseAuth } from '@/lib/firebase'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: () => {
    const auth = getFirebaseAuth()
    if (!auth.currentUser) {
      throw redirect({ to: '/login' })
    }
  },
  component: AppShell,
})
