import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchUsuarios,
  updateNombreCompleto,
  updateUsuario,
  createUsuario,
  deactivateUsuario,
  sendPasswordResetLink,
  type UsuarioFirestore,
  type CreateUsuarioPayload,
} from '@/services/users'

const USUARIOS_KEY = ['admin-usuarios'] as const

/**
 * Hook para listar todos los usuarios (panel admin).
 */
export function useUsuarios() {
  return useQuery({
    queryKey: USUARIOS_KEY,
    queryFn: fetchUsuarios,
  })
}

/**
 * Hook para actualizar el nombre del usuario logueado (Mi Perfil).
 * Escribe nombreCompleto (fuente de verdad) + campos aditivos desglosados.
 */
export function useUpdateNombreCompleto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      userId,
      nombreCompleto,
      nombre,
      apellidoPaterno,
      apellidoMaterno,
    }: {
      userId: string
      nombreCompleto: string
      nombre: string
      apellidoPaterno: string
      apellidoMaterno: string
    }) => updateNombreCompleto(userId, nombreCompleto, { nombre, apellidoPaterno, apellidoMaterno }),
    onSuccess: () => qc.invalidateQueries({ queryKey: USUARIOS_KEY }),
  })
}

/**
 * Hook para actualizar un usuario desde admin.
 */
export function useUpdateUsuario() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      userId,
      data,
    }: {
      userId: string
      data: Partial<Pick<UsuarioFirestore, 'nombreCompleto' | 'noEmpleado' | 'perfilId' | 'perfilNombre' | 'activo' | 'nombre' | 'apellidoPaterno' | 'apellidoMaterno'>>
    }) => updateUsuario(userId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: USUARIOS_KEY }),
  })
}

/**
 * Hook para crear un nuevo usuario.
 */
export function useCreateUsuario() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateUsuarioPayload) => createUsuario(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: USUARIOS_KEY }),
  })
}

/**
 * Hook para desactivar un usuario (soft delete).
 */
export function useDeactivateUsuario() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) => deactivateUsuario(userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: USUARIOS_KEY }),
  })
}

/**
 * Hook para enviar enlace de restablecimiento de contraseña.
 */
export function useSendPasswordReset() {
  return useMutation({
    mutationFn: (email: string) => sendPasswordResetLink(email),
  })
}
