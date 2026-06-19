import { createRootRoute, Outlet } from '@tanstack/react-router'
import { Toaster } from 'sonner'
import { TooltipProvider } from '@/components/ui/tooltip'

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  return (
    <TooltipProvider delayDuration={400}>
      <Outlet />
      <Toaster position="top-center" richColors closeButton />
    </TooltipProvider>
  )
}
