export interface AuthUser {
  uid: string
  email: string | null
  roleId: string
  isSuperAdmin: boolean
}

export interface AuthState {
  user: AuthUser | null
  loading: boolean
  error: string | null
}
