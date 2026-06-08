export interface NavMenuItem {
  id: string
  label: string
  route: string
  displayOrder: number
}

export interface NavigationState {
  items: NavMenuItem[]
  loading: boolean
  error: string | null
}
