import {
  collection,
  query,
  getDocs,
  doc,
  updateDoc,
  addDoc,
  Timestamp,
  orderBy,
} from 'firebase/firestore'
import { sendPasswordResetEmail } from 'firebase/auth'
import { getFirebaseFirestore, getFirebaseAuth } from '@/lib/firebase'

/* ═══════════════════════════════════════════════════════════════════════════
   Users Service — Operaciones CRUD sobre la colección `usuarios` de Firestore
   ═══════════════════════════════════════════════════════════════════════════ */

export interface UsuarioFirestore {
  id: string
  correoInstitucional: string
  nombreCompleto: string
  noEmpleado: string
  perfilId: string
  perfilNombre: string
  activo: number
  /** Campos aditivos (pueden no existir en docs legacy) */
  nombre?: string
  apellidoPaterno?: string
  apellidoMaterno?: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface CreateUsuarioPayload {
  correoInstitucional: string
  nombreCompleto: string
  noEmpleado: string
  perfilId: string
  perfilNombre: string
  /** Campos aditivos desglosados */
  nombre: string
  apellidoPaterno: string
  apellidoMaterno: string
}

/**
 * Normaliza una cadena de texto a formato NFC (Canonical Decomposition + Canonical Composition).
 * Garantiza consistencia de caracteres Unicode (acentos, ñ, etc.) en Firestore.
 */
export function normalizeNFC(value: string): string {
  return value.normalize('NFC')
}

/**
 * Obtiene todos los usuarios de Firestore (activos e inactivos para gestión).
 */
export async function fetchUsuarios(): Promise<UsuarioFirestore[]> {
  const db = getFirebaseFirestore()
  const snap = await getDocs(
    query(collection(db, 'usuarios'), orderBy('nombreCompleto', 'asc')),
  )
  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<UsuarioFirestore, 'id'>),
  }))
}

/**
 * Construye el string `nombreCompleto` a partir de los 3 campos desglosados.
 * Limpia espacios dobles y aplica normalización NFC.
 */
export function buildNombreCompleto(nombre: string, apellidoPaterno: string, apellidoMaterno: string): string {
  return normalizeNFC(
    [nombre, apellidoPaterno, apellidoMaterno]
      .map((s) => s.trim())
      .filter(Boolean)
      .join(' ')
      .replace(/\s{2,}/g, ' '),
  )
}

/**
 * Actualiza el nombre completo de un usuario + campos aditivos (normalización NFC obligatoria).
 */
export async function updateNombreCompleto(
  userId: string,
  nombreCompleto: string,
  aditivos: { nombre: string; apellidoPaterno: string; apellidoMaterno: string },
): Promise<void> {
  const db = getFirebaseFirestore()
  await updateDoc(doc(db, 'usuarios', userId), {
    nombreCompleto: normalizeNFC(nombreCompleto),
    nombre: normalizeNFC(aditivos.nombre),
    apellidoPaterno: normalizeNFC(aditivos.apellidoPaterno),
    apellidoMaterno: normalizeNFC(aditivos.apellidoMaterno),
    updatedAt: Timestamp.now(),
  })
}

/**
 * Actualiza campos de un usuario desde el panel de administración.
 */
export async function updateUsuario(
  userId: string,
  data: Partial<Pick<UsuarioFirestore, 'nombreCompleto' | 'noEmpleado' | 'perfilId' | 'perfilNombre' | 'activo' | 'nombre' | 'apellidoPaterno' | 'apellidoMaterno'>>,
): Promise<void> {
  const db = getFirebaseFirestore()
  const payload: { [key: string]: string | number | Timestamp } = { updatedAt: Timestamp.now() }

  // Copiar campos y normalizar texto libre
  if (data.nombreCompleto != null) payload.nombreCompleto = normalizeNFC(data.nombreCompleto)
  if (data.noEmpleado != null) payload.noEmpleado = normalizeNFC(data.noEmpleado)
  if (data.perfilId != null) payload.perfilId = data.perfilId
  if (data.perfilNombre != null) payload.perfilNombre = data.perfilNombre
  if (data.activo != null) payload.activo = data.activo
  if (data.nombre != null) payload.nombre = normalizeNFC(data.nombre)
  if (data.apellidoPaterno != null) payload.apellidoPaterno = normalizeNFC(data.apellidoPaterno)
  if (data.apellidoMaterno != null) payload.apellidoMaterno = normalizeNFC(data.apellidoMaterno)

  await updateDoc(doc(db, 'usuarios', userId), payload)
}

/**
 * Crea un nuevo documento de usuario en Firestore.
 * La cuenta en Firebase Auth se crea desde Cloud Functions o Admin SDK (server-side).
 */
export async function createUsuario(data: CreateUsuarioPayload): Promise<string> {
  const db = getFirebaseFirestore()
  const payload = {
    correoInstitucional: data.correoInstitucional.trim().toLowerCase(),
    nombreCompleto: normalizeNFC(data.nombreCompleto),
    nombre: normalizeNFC(data.nombre),
    apellidoPaterno: normalizeNFC(data.apellidoPaterno),
    apellidoMaterno: normalizeNFC(data.apellidoMaterno),
    noEmpleado: normalizeNFC(data.noEmpleado),
    perfilId: data.perfilId,
    perfilNombre: data.perfilNombre,
    activo: 1,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  }
  const docRef = await addDoc(collection(db, 'usuarios'), payload)
  return docRef.id
}

/**
 * Soft-delete: marca al usuario como inactivo (activo: 0).
 */
export async function deactivateUsuario(userId: string): Promise<void> {
  const db = getFirebaseFirestore()
  await updateDoc(doc(db, 'usuarios', userId), {
    activo: 0,
    updatedAt: Timestamp.now(),
  })
}

/**
 * Envía el enlace de restablecimiento de contraseña al usuario.
 * Usa sendPasswordResetEmail del Firebase Client SDK.
 */
export async function sendPasswordResetLink(email: string): Promise<void> {
  await sendPasswordResetEmail(getFirebaseAuth(), email)
}
