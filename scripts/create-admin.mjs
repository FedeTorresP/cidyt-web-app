/**
 * Script para crear el super usuario admin en Firebase Auth.
 * 
 * Uso:
 *   node scripts/create-admin.mjs
 * 
 * Requiere:
 *   - Variable de entorno FIREBASE_SERVICE_ACCOUNT_KEY con el JSON de la service account
 *   - O bien un archivo service-account.json en la raíz del proyecto
 */

import { initializeApp, cert } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

// ─── Config ──────────────────────────────────────────────────────────────────

const ADMIN_EMAIL = 'admin@ipad-cidyt.com'
const ADMIN_PASSWORD = 'jklñ{}'
const SUPER_ADMIN_ROLE_ID = 'super_admin' // ajustar si tu Firestore usa otro ID

// ─── Inicializar Firebase Admin ──────────────────────────────────────────────

function getCredentials() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
  if (raw && raw.trim() !== '') {
    try {
      return JSON.parse(raw)
    } catch {
      console.error('FIREBASE_SERVICE_ACCOUNT_KEY no es JSON válido')
      process.exit(1)
    }
  }

  // Fallback: intentar leer archivo local
  try {
    const fs = await import('fs')
    const path = new URL('../service-account.json', import.meta.url)
    const content = fs.readFileSync(path, 'utf-8')
    return JSON.parse(content)
  } catch {
    console.error('No se encontró FIREBASE_SERVICE_ACCOUNT_KEY ni service-account.json')
    console.error('')
    console.error('Opciones:')
    console.error('  1. export FIREBASE_SERVICE_ACCOUNT_KEY=\'{"type":"service_account",...}\'')
    console.error('  2. Colocar service-account.json en la raíz del proyecto')
    process.exit(1)
  }
}

const credentials = getCredentials()
const app = initializeApp({ credential: cert(credentials) })
const auth = getAuth(app)

// ─── Crear o actualizar usuario ──────────────────────────────────────────────

async function main() {
  try {
    // Verificar si ya existe
    let user
    try {
      user = await auth.getUserByEmail(ADMIN_EMAIL)
      console.log(`✓ Usuario existente encontrado: ${user.uid}`)
      
      // Actualizar contraseña
      await auth.updateUser(user.uid, { password: ADMIN_PASSWORD })
      console.log('✓ Contraseña actualizada')
    } catch (err) {
      if (err.code === 'auth/user-not-found') {
        // Crear nuevo usuario
        user = await auth.createUser({
          email: ADMIN_EMAIL,
          password: ADMIN_PASSWORD,
          displayName: 'Administrador',
        })
        console.log(`✓ Usuario creado: ${user.uid}`)
      } else {
        throw err
      }
    }

    // Establecer custom claims (SUPER_ADMIN)
    await auth.setCustomUserClaims(user.uid, {
      roleId: SUPER_ADMIN_ROLE_ID,
      permissions: ['*'], // Wildcard = super admin
    })
    console.log('✓ Custom claims establecidos: roleId=super_admin, permissions=[*]')

    console.log('')
    console.log('═══════════════════════════════════════')
    console.log('  Super usuario creado exitosamente')
    console.log('═══════════════════════════════════════')
    console.log(`  Email:    ${ADMIN_EMAIL}`)
    console.log(`  Password: ${ADMIN_PASSWORD}`)
    console.log(`  Role:     SUPER_ADMIN`)
    console.log('═══════════════════════════════════════')

  } catch (err) {
    console.error('Error:', err.message)
    process.exit(1)
  }

  process.exit(0)
}

main()
