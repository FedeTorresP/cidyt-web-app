import {
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore'
import { getFirebaseFirestore } from '@/lib/firebase'
import type { NavMenuItem } from '@/types/menu'
import type { MenuItem } from '@/types/models'

/**
 * Obtiene los IDs de permisos concedidos a un rol.
 */
export async function getRolePermissionIds(roleId: string): Promise<string[]> {
  const db = getFirebaseFirestore()
  const rpQuery = query(
    collection(db, 'rol_permisos'),
    where('roleId', '==', roleId),
  )
  const snapshot = await getDocs(rpQuery)
  return snapshot.docs.map((doc) => doc.data().permisoId as string)
}

/** Rutas restringidas a administradores (mantenimiento de catálogos, etc.). */
const ADMIN_ONLY_ROUTES = new Set(['/catalogos'])

export function isAdminRole(roleId: string, isSuperAdmin: boolean): boolean {
  return isSuperAdmin || roleId === 'admin'
}

/**
 * Filtra los elementos del menú según los permisos del rol.
 * SUPER_ADMIN ve todo. Los demás ven solo items sin permiso requerido
 * o con permiso explícitamente concedido.
 */
export function filterMenuByPermissions(
  items: MenuItem[],
  grantedPermissionIds: string[],
  isSuperAdmin: boolean,
  roleId = '',
): NavMenuItem[] {
  const granted = new Set(grantedPermissionIds)
  const isAdmin = isAdminRole(roleId, isSuperAdmin)

  const filtered = isSuperAdmin
    ? items
    : items.filter(
        (item) => {
          if (ADMIN_ONLY_ROUTES.has(item.route) && !isAdmin) return false
          if (item.requiredPermissionId === 'admin') return isAdmin
          return (
            item.requiredPermissionId === null ||
            granted.has(item.requiredPermissionId)
          )
        },
      )

  return filtered.map((item) => ({
    id: item.id,
    label: item.label,
    route: item.route,
    displayOrder: item.displayOrder,
  }))
}
