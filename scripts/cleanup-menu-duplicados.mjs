/**
 * Limpieza SEGURA de menu_items duplicados en Firestore.
 *
 * Contexto: existía un juego legacy de menu_items con ids `m1..m11`. El seed
 * (seed-catalogos.mjs) siembra el juego canónico con ids `1..10` e incluye
 * `requiredPermissionId` para el RBAC. Al coexistir ambos, el menú se duplica.
 *
 * Este script conserva SOLO los ids canónicos (1..10) y borra cualquier otro
 * documento de la colección `menu_items`.
 *
 * Modo por defecto: DRY-RUN (no borra nada, solo reporta).
 * Para borrar de verdad: --apply --yes  (y --project ipad-cidyt explícito)
 *
 *   node scripts/cleanup-menu-duplicados.mjs --project ipad-cidyt
 *   node scripts/cleanup-menu-duplicados.mjs --project ipad-cidyt --apply --yes
 *
 * Credenciales: mismo esquema que seed-catalogos.mjs
 *   (FIREBASE_SERVICE_ACCOUNT_KEY | service-account.json | gcloud ADC).
 */

import { initializeApp, cert, applicationDefault } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { execSync } from 'child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const EXPECTED_PROJECT = 'ipad-cidyt'

// ─── CLI Flags ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const APPLY = args.includes('--apply')
const YES = args.includes('--yes')
const PROJECT = args.find((a) => a.startsWith('--project'))?.split(/[=\s]/)[1]
  ?? args[args.indexOf('--project') + 1]

// IDs canónicos del seed que se DEBEN conservar.
const CANONICAL_IDS = new Set(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'])

// ─── Salvaguarda de proyecto ───────────────────────────────────────────────────

if (PROJECT !== EXPECTED_PROJECT) {
  console.error(`❌ Debes pasar --project ${EXPECTED_PROJECT} explícitamente.`)
  process.exit(1)
}

// ─── Credenciales (idéntico a seed-catalogos.mjs) ──────────────────────────────

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
    process.env.GCLOUD_PROJECT = EXPECTED_PROJECT
    return { credential: applicationDefault(), projectId: EXPECTED_PROJECT }
  } catch {
    console.error('❌ No se encontró FIREBASE_SERVICE_ACCOUNT_KEY, service-account.json, ni gcloud auth activo')
    process.exit(1)
  }
}

// ─── Ejecución ─────────────────────────────────────────────────────────────────

async function main() {
  const app = initializeApp(getCredentials())
  const db = getFirestore(app)

  const DRY_RUN = !(APPLY && YES)

  console.log('═══════════════════════════════════════════════════════')
  console.log('  LIMPIEZA menu_items duplicados')
  console.log(`  Modo: ${DRY_RUN ? '🧪 DRY RUN (no borra nada)' : '🔥 BORRADO REAL'}`)
  console.log('═══════════════════════════════════════════════════════')

  const snap = await db.collection('menu_items').get()
  const toDelete = snap.docs.filter((d) => !CANONICAL_IDS.has(d.id))
  const toKeep = snap.docs.filter((d) => CANONICAL_IDS.has(d.id))

  console.log(`\nTotal docs: ${snap.size} — conservar: ${toKeep.length}, borrar: ${toDelete.length}\n`)

  for (const d of toDelete) {
    const { route, label } = d.data()
    console.log(`   ${DRY_RUN ? '[dry-run] borraría' : '✓ borrado'} ${d.id} → ${label} (${route})`)
    if (!DRY_RUN) await d.ref.delete()
  }

  console.log('\n═══════════════════════════════════════════════════════')
  if (DRY_RUN) {
    console.log('  Nada borrado (DRY-RUN). Para aplicar:')
    console.log(`    node scripts/cleanup-menu-duplicados.mjs --project ${EXPECTED_PROJECT} --apply --yes`)
  } else {
    console.log(`  ✅ Listo — ${toDelete.length} doc(s) borrado(s).`)
  }
  console.log('═══════════════════════════════════════════════════════')
  process.exit(0)
}

main().catch((err) => {
  console.error('❌ Error fatal:', err)
  process.exit(1)
})
