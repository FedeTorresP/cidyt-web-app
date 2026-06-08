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
  { id: 'fb-3', label: 'Lista de Pacientes Caja', route: '/caja', displayOrder: 3 },
  { id: 'fb-4', label: 'Lugares', route: '/lugares', displayOrder: 4 },
  { id: 'fb-5', label: 'Registro Estudios Externos', route: '/externos', displayOrder: 5 },
  { id: 'fb-6', label: 'Reportería', route: '/reportes', displayOrder: 6 },
  { id: 'fb-7', label: 'Cambio de Clave', route: '/cambio-clave', displayOrder: 7 },
  { id: 'fb-8', label: 'Conf Perfiles/Usuario', route: '/admin/usuarios', displayOrder: 8 },
  { id: 'fb-9', label: 'Lista Cubículos', route: '/cubiculo/listado', displayOrder: 9 },
  { id: 'fb-10', label: 'Médico por Día', route: '/medico-dia', displayOrder: 10 },
  { id: 'fb-11', label: 'Crear Paquetes', route: '/paquetes', displayOrder: 11 },
  { id: 'fb-12', label: 'Importar Citas', route: '/importacion', displayOrder: 12 },
]

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
      return FALLBACK_MENU
    }

    const items: MenuItem[] = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as MenuItem[]

    const permissionIds = isSuperAdmin ? [] : await getRolePermissionIds(roleId)
    return filterMenuByPermissions(items, permissionIds, isSuperAdmin)
  } catch (err) {
    // Si falla la lectura (permisos, índices, etc.), usar fallback
    console.error('[Menu] Error al cargar menu_items desde Firestore:', err)
    console.warn('[Menu] Usando menú de fallback.')
    return FALLBACK_MENU
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
