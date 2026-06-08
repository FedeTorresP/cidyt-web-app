import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { User } from 'firebase/auth'
import { onAuthStateChanged, extractAuthUser } from '@/services/auth'
import type { AuthState } from '@/types/auth'

interface AuthContextValue extends AuthState {
  firebaseUser: User | null
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  error: null,
  firebaseUser: null,
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  })
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(async (fbUser) => {
      if (fbUser) {
        try {
          const authUser = await extractAuthUser(fbUser)
          setFirebaseUser(fbUser)
          setState({ user: authUser, loading: false, error: null })
        } catch {
          setState({ user: null, loading: false, error: 'Error al cargar sesión.' })
          setFirebaseUser(null)
        }
      } else {
        setFirebaseUser(null)
        setState({ user: null, loading: false, error: null })
      }
    })

    return unsubscribe
  }, [])

  return (
    <AuthContext.Provider value={{ ...state, firebaseUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext)
}
