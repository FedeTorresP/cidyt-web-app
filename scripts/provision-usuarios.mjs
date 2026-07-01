/**
 * Provisión de usuarios (Firebase Auth + custom claims + doc Firestore usuarios/{uid}).
 *
 * Uso:
 *   CIDYT_INIT_PASSWORD='********' node scripts/provision-usuarios.mjs --dry-run
 *   CIDYT_INIT_PASSWORD='********' node scripts/provision-usuarios.mjs
 *
 * Flags:
 *   --dry-run   Solo muestra lo que haría sin escribir en Auth ni Firestore.
 *
 * Input:
 *   scripts/data/usuarios-nuevos.json  (gitignored, contiene PII)
 *   Formato: { "usuarios": [ { correo, nombreCompleto, noEmpleado, perfil }, ... ] }
 *   perfil ∈ { ADMIN, CIDYT, CAJA, MEDICO }
 *
 * Seguridad:
 *   - La contraseña inicial NUNCA se versiona: se lee de la env var CIDYT_INIT_PASSWORD.
 *   - No se envían correos de reseteo (la clave se comunica fuera de banda).
 *   - Idempotente: si el usuario existe se actualiza la contraseña; si no, se crea.
 *
 * Requiere credenciales (igual que seed-catalogos.mjs):
 *   - FIREBASE_SERVICE_ACCOUNT_KEY, o service-account.json, o gcloud ADC (project ipad-cidyt).
 */

import { initializeApp, cert, applicationDefault } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { execSync } from 'child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const DATA_DIR = join(__dirname, 'data')
const INPUT_FILE = join(DATA_DIR, 'usuarios-nuevos.json')

// ─── CLI Flags ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')

// ─── Contraseña inicial (solo desde env var) ─────────────────────────────────

const INIT_PASSWORD = process.env.CIDYT_INIT_PASSWORD
if (!INIT_PASSWORD || INIT_PASSWORD.length < 6) {
  console.error('❌ Falta CIDYT_INIT_PASSWORD (mínimo 6 caracteres).')
  console.error("   Ejemplo: CIDYT_INIT_PASSWORD='********' node scripts/provision-usuarios.mjs --dry-run")
  process.exit(1)
}

// ─── Mapa perfil → claims + metadatos del doc usuarios ───────────────────────

const PERFIL_MAP = {
  ADMIN:  { roleId: 'admin',  nivel: 10, permissions: ['*'], perfilId: '1', perfilNombre: 'ADMINISTRADOR' },
  CIDYT:  { roleId: 'cidyt',  nivel: 20, permissions: [],    perfilId: '2', perfilNombre: 'CAJA Y CONTROL' },
  CAJA:   { roleId: 'caja',   nivel: 30, permissions: [],    perfilId: '3', perfilNombre: 'CAJA' },
  MEDICO: { roleId: 'medico', nivel: 40, permissions: [],    perfilId: '4', perfilNombre: 'MEDICO' },
}

// ─── Credenciales (idéntico a seed-catalogos.mjs) ────────────────────────────

function getCredentials() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
  if (raw && raw.trim() !== '') {
    try {
      return { credential: cert(JSON.parse(raw)) }
    } catch {
      console.error('❌ FIREBASE_SERVICE_ACCOUNT_KEY no es JSON válido')
      process.exit(1)
    }
  }

  const saPath = join(__dirname, '..', 'service-account.json')
  if (existsSync(saPath)) {
    try {
      return { credential: cert(JSON.parse(readFileSync(saPath, 'utf-8'))) }
    } catch {
      console.error('❌ service-account.json no es JSON válido')
      process.exit(1)
    }
  }

  try {
    execSync('gcloud auth print-access-token', { stdio: 'pipe' })
    console.log('🔑 Usando credenciales de Google Cloud CLI (gcloud)')
    process.env.GCLOUD_PROJECT = 'ipad-cidyt'
    return { credential: applicationDefault(), projectId: 'ipad-cidyt' }
  } catch {
    console.error('❌ No se encontró FIREBASE_SERVICE_ACCOUNT_KEY, service-account.json, ni gcloud auth activo')
    process.exit(1)
  }
}

// ─── Carga y validación del input ────────────────────────────────────────────

function loadUsuarios() {
  if (!existsSync(INPUT_FILE)) {
    console.error(`❌ No existe ${INPUT_FILE}`)
    process.exit(1)
  }
  const parsed = JSON.parse(readFileSync(INPUT_FILE, 'utf-8'))
  const list = Array.isArray(parsed) ? parsed : parsed.usuarios
  if (!Array.isArray(list) || list.length === 0) {
    console.error('❌ usuarios-nuevos.json vacío o con formato inesperado')
    process.exit(1)
  }

  const correos = new Set()
  for (const [i, u] of list.entries()) {
    if (!u.correo || !u.nombreCompleto || !u.noEmpleado || !u.perfil) {
      console.error(`❌ Registro #${i + 1} incompleto:`, JSON.stringify(u))
      process.exit(1)
    }
    if (!PERFIL_MAP[u.perfil]) {
      console.error(`❌ Registro #${i + 1} perfil inválido "${u.perfil}" (válidos: ${Object.keys(PERFIL_MAP).join(', ')})`)
      process.exit(1)
    }
    const correo = u.correo.trim().toLowerCase()
    if (correos.has(correo)) {
      console.error(`❌ Correo duplicado en input: ${correo}`)
      process.exit(1)
    }
    correos.add(correo)
  }
  return list
}

// ─── Provisión por usuario ───────────────────────────────────────────────────

async function provisionUsuario(auth, db, u) {
  const email = u.correo.trim().toLowerCase()
  const nombreCompleto = String(u.nombreCompleto).normalize('NFC')
  const noEmpleado = String(u.noEmpleado)
  const perfil = PERFIL_MAP[u.perfil]

  // 1. Auth: crear o actualizar contraseña
  let uid
  let action
  let existing = null
  try {
    existing = await auth.getUserByEmail(email)
    uid = existing.uid
    action = 'update'
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      action = 'create'
    } else {
      throw err
    }
  }

  if (DRY_RUN) {
    console.log(`   [dry-run] ${action.toUpperCase()} ${email} (${u.perfil} → roleId=${perfil.roleId}, uid=${uid ?? '(nuevo)'})`)
    return
  }

  if (action === 'create') {
    const created = await auth.createUser({
      email,
      password: INIT_PASSWORD,
      displayName: nombreCompleto,
    })
    uid = created.uid
    console.log(`   ✓ Auth creado ${email} → ${uid}`)
  } else {
    await auth.updateUser(uid, { password: INIT_PASSWORD, displayName: nombreCompleto })
    console.log(`   ✓ Auth actualizado (password reset) ${email} → ${uid}`)
  }

  // 2. Custom claims según perfil
  await auth.setCustomUserClaims(uid, {
    roleId: perfil.roleId,
    nivel: perfil.nivel,
    permissions: perfil.permissions,
  })
  console.log(`     claims: roleId=${perfil.roleId}, nivel=${perfil.nivel}, permissions=${JSON.stringify(perfil.permissions)}`)

  // 3. Upsert Firestore usuarios/{uid} (merge). createdAt solo si es nuevo doc.
  const ref = db.collection('usuarios').doc(uid)
  const snap = await ref.get()
  const now = FieldValue.serverTimestamp()
  const payload = {
    correoInstitucional: email,
    nombreCompleto,
    nombre: '',
    apellidoPaterno: '',
    apellidoMaterno: '',
    noEmpleado,
    perfilId: perfil.perfilId,
    perfilNombre: perfil.perfilNombre,
    activo: 1,
    mustChangePassword: true,
    updatedAt: now,
  }
  if (!snap.exists) payload.createdAt = now

  await ref.set(payload, { merge: true })
  console.log(`     ✓ Firestore usuarios/${uid} (${snap.exists ? 'merge' : 'nuevo'})`)
}

// ═════════════════════════════════════════════════════════════════════════════
//  EJECUCIÓN
// ═════════════════════════════════════════════════════════════════════════════

async function main() {
  const usuarios = loadUsuarios()
  const credConfig = getCredentials()
  const app = initializeApp(credConfig)
  const auth = getAuth(app)
  const db = getFirestore(app)

  console.log('═══════════════════════════════════════════════════════')
  console.log('  PROVISIÓN DE USUARIOS — Firebase Auth + Firestore')
  console.log(`  Modo: ${DRY_RUN ? '🧪 DRY RUN (no escribe nada)' : '🔥 ESCRITURA REAL'}`)
  console.log(`  Usuarios: ${usuarios.length}`)
  console.log('═══════════════════════════════════════════════════════')

  let ok = 0
  let fail = 0
  for (const u of usuarios) {
    try {
      await provisionUsuario(auth, db, u)
      ok++
    } catch (err) {
      fail++
      console.error(`   ✗ ${u.correo}: ${err.message}`)
    }
  }

  console.log('\n═══════════════════════════════════════════════════════')
  console.log(`  ${DRY_RUN ? 'Dry-run' : 'Provisión'} completada — ok: ${ok}, fallos: ${fail}`)
  console.log('═══════════════════════════════════════════════════════')

  process.exit(fail > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error('❌ Error fatal:', err)
  process.exit(1)
})
