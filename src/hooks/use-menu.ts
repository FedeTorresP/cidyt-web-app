import { useQuery } from '@tanstack/react-query'
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
} from 'firebase/firestore'
import { getFirebaseFirestore } from '@/lib/firebase'
import { getRolePermissionIds, filterMenuByPermissions } from '@/services/rbac'
import { useAuth } from './use-auth'
import type { MenuItem } from '@/types/models'
import type { NavMenuItem } from '@/types/menu'

/**
 * Menú estático de fallback — replica los menu_items reales de Firestore.
 * Se usa cuando la colección está vacía o no es accesible.
 */
const FALLBACK_MENU: NavMenuItem[] = [
  { id: 'fb-1', label: 'Registro de Pacientes', route: '/paciente', displayOrder: 1 },
  { id: 'fb-2', label: 'Lista de Pacientes', route: '/lista-dia', displayOrder: 2 },
  { id: 'fb-3', label: 'Lista de Pacientes Caja', route: '/lista-caja', displayOrder: 3 },
  { id: 'fb-4', label: 'Lugares', route: '/lugares', displayOrder: 4 },
  { id: 'fb-5', label: 'Registro Estudios Externos', route: '/externos', displayOrder: 5 },
  { id: 'fb-6', label: 'Reportería', route: '/reportes', displayOrder: 6 },
  { id: 'fb-7', label: 'Mi Perfil y Accesos', route: '/mi-perfil', displayOrder: 7 },
  { id: 'fb-9', label: 'Lista Cubículos', route: '/cubiculo/listado', displayOrder: 8 },
  { id: 'fb-11', label: 'Crear Paquetes', route: '/paquetes', displayOrder: 9 },
  { id: 'fb-12', label: 'Mantenimiento Catálogos', route: '/catalogos', displayOrder: 10 },
]

function filterCatalogMenuForRole(
  items: NavMenuItem[],
  roleId: string,
  isSuperAdmin: boolean,
): NavMenuItem[] {
  if (isSuperAdmin || roleId === 'admin') return items
  return items.filter((item) => item.route !== '/catalogos')
}

async function fetchMenu(roleId: string, isSuperAdmin: boolean): Promise<NavMenuItem[]> {
  try {
    const db = getFirebaseFirestore()
    const menuQuery = query(
      collection(db, 'menu_items'),
      where('activo', '==', true),
      orderBy('displayOrder', 'asc'),
    )
    const snapshot = await getDocs(menuQuery)

    // Si no hay menu_items en Firestore, usar fallback
    if (snapshot.empty) {
      console.warn('[Menu] Colección menu_items vacía — usando menú de fallback.')
      return filterCatalogMenuForRole(FALLBACK_MENU, roleId, isSuperAdmin)
    }

    const items: MenuItem[] = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as MenuItem[]

    const permissionIds = isSuperAdmin ? [] : await getRolePermissionIds(roleId)
    const filtered = filterMenuByPermissions(items, permissionIds, isSuperAdmin, roleId)
    return filterCatalogMenuForRole(filtered, roleId, isSuperAdmin)
  } catch (err) {
    // Si falla la lectura (permisos, índices, etc.), usar fallback
    console.error('[Menu] Error al cargar menu_items desde Firestore:', err)
    console.warn('[Menu] Usando menú de fallback.')
    return filterCatalogMenuForRole(FALLBACK_MENU, roleId, isSuperAdmin)
  }
}

export function useMenu() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['menu', user?.roleId],
    queryFn: () => fetchMenu(user!.roleId, user!.isSuperAdmin),
    enabled: !!user,
  })
}
