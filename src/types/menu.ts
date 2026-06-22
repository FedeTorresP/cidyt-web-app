export interface NavMenuItem {
  id: string
  label: string
  route: string
  displayOrder: number
  /** Solo visible para admin / super admin (menú de fallback). */
  adminOnly?: boolean
}

export interface NavigationState {
  items: NavMenuItem[]
  loading: boolean
  error: string | null
}
