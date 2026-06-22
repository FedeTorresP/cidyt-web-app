import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  updatePassword,
  type User,
  type Unsubscribe,
} from 'firebase/auth'
import { getFirebaseAuth } from '@/lib/firebase'
import type { AuthUser } from '@/types/auth'

/** Mensaje genérico de error (no revela causa específica). */
export const GENERIC_AUTH_ERROR =
  'Credenciales inválidas. Verifique su usuario y contraseña.'

/**
 * Login con email y contraseña usando Firebase Client SDK.
 */
export async function loginWithEmail(
  email: string,
  password: string,
): Promise<User> {
  const credential = await signInWithEmailAndPassword(
    getFirebaseAuth(),
    email,
    password,
  )
  return credential.user
}

/**
 * Cierra la sesión del usuario actual.
 */
export async function logout(): Promise<void> {
  await firebaseSignOut(getFirebaseAuth())
}

/**
 * Cambia la contraseña del usuario actualmente autenticado.
 */
export async function changePassword(newPassword: string): Promise<void> {
  const user = getFirebaseAuth().currentUser
  if (!user) throw new Error('No hay sesión activa.')
  await updatePassword(user, newPassword)
}

/**
 * Extrae AuthUser con custom claims del usuario de Firebase.
 * Si no hay custom claims (usuario recién creado sin configurar),
 * se asume acceso completo para desarrollo.
 */
export async function extractAuthUser(user: User): Promise<AuthUser> {
  const tokenResult = await user.getIdTokenResult()
  const claims = tokenResult.claims
  const roleId = (claims.roleId as string) ?? ''
  const permissions = (claims.permissions as string[]) ?? []
  const isSuperAdmin = permissions.includes('*')

  // Si no tiene roleId asignado, asumir admin con acceso total (dev mode)
  if (!roleId) {
    return {
      uid: user.uid,
      email: user.email,
      roleId: 'admin',
      isSuperAdmin: true,
    }
  }

  return {
    uid: user.uid,
    email: user.email,
    roleId,
    isSuperAdmin,
  }
}

/** Admin o super admin — acceso a Mantenimiento de Catálogos. */
export function canManageCatalogs(user: AuthUser | null | undefined): boolean {
  if (!user) return false
  return user.isSuperAdmin || user.roleId === 'admin'
}

/**
 * Suscripción al estado de autenticación.
 */
export function onAuthStateChanged(
  callback: (user: User | null) => void,
): Unsubscribe {
  return firebaseOnAuthStateChanged(getFirebaseAuth(), callback)
}
