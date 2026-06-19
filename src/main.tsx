import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AuthProvider } from '@/hooks/use-auth'
import { queryClient } from '@/lib/query-client'
import { App } from './App'
import './globals.css'
import { registerSW } from 'virtual:pwa-register'

registerSW({
  immediate: true,
  onNeedRefresh() {
    toast('Nueva versión disponible', {
      description: 'Actualiza para obtener las últimas mejoras.',
      duration: Infinity,
      action: {
        label: 'Actualizar',
        onClick: () => {
          window.location.reload()
        },
      },
    })
  },
  onOfflineReady() {
    toast.success('Listo para uso sin conexión')
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
