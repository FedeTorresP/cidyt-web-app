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

/**
 * Filtra los elementos del menú según los permisos del rol.
 * SUPER_ADMIN ve todo. Los demás ven solo items sin permiso requerido
 * o con permiso explícitamente concedido.
 */
export function filterMenuByPermissions(
  items: MenuItem[],
  grantedPermissionIds: string[],
  isSuperAdmin: boolean,
): NavMenuItem[] {
  const granted = new Set(grantedPermissionIds)

  const filtered = isSuperAdmin
    ? items
    : items.filter(
        (item) =>
          item.requiredPermissionId === null ||
          granted.has(item.requiredPermissionId),
      )

  return filtered.map((item) => ({
    id: item.id,
    label: item.label,
    route: item.route,
    displayOrder: item.displayOrder,
  }))
}
