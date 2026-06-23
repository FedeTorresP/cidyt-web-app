import { queryClient } from '@/lib/query-client'
import { logout } from '@/services/auth'

export const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000

const TURNO_STORAGE_KEY = 'cidyt_turno'

/**
 * Cierra la sesión por completo: Firebase signOut, turno en sessionStorage
 * y caché de React Query (evita datos del usuario anterior en iPads compartidos).
 */
export async function endSession(): Promise<void> {
  try {
    await logout()
  } finally {
    sessionStorage.removeItem(TURNO_STORAGE_KEY)
    queryClient.clear()
  }
}
