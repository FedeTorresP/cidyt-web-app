/**
 * Limpieza SEGURA de datos de prueba / legacy en Firestore.
 *
 * Motivo: el dedup de la ingesta SAP usa `interface_ipad/{noCita}` como doc id;
 * mientras exista ese documento, reenviar el mismo No_Cita se omite. Para volver
 * a probar hay que borrar la cita de prueba y todos sus documentos vinculados.
 *
 * Modo por defecto: DRY-RUN (no borra nada, solo reporta).
 * Para borrar de verdad hay que pasar EXPLÍCITAMENTE: --apply --yes
 *
 * ─── Modos ───────────────────────────────────────────────────────────────────
 * 1) Targeted por No_Cita (recomendado para re-probar citas puntuales):
 *      node scripts/cleanup-legacy.mjs --project ipad-cidyt --nocita=0000211420,0000900001
 *      node scripts/cleanup-legacy.mjs --project ipad-cidyt --nocita=0000211420 --apply --yes
 *
 *    Por cada No_Cita borra: interface_ipad/{noCita} + su paciente, seguimiento,
 *    val_corporal, estudios_paciente y estudios_realizar (por seguimientoId).
 *
 * 2) Barrido legacy (opt-in, separado para evitar borrados accidentales):
 *      node scripts/cleanup-legacy.mjs --project ipad-cidyt --legacy-scan
 *      node scripts/cleanup-legacy.mjs --project ipad-cidyt --legacy-scan --apply --yes
 *
 *    Detecta y borra:
 *      - pacientes con esquema snake_case viejo (apellido_paterno, apellido_materno,
 *        genero, fecha_nac, nombre_completo, user_crea, fecha_crea) — cualquiera de esos campos.
 *      - seguimientos SIN campo `fechaIngresoUtc` (escritos por la versión vieja).
 *      - la colección deprecada `estudios_realizar` (completa).
 *
 * Salvaguardas:
 *   - Exige --project ipad-cidyt explícito.
 *   - DRY-RUN por defecto; escritura solo con --apply Y --yes.
 *   - Nunca toca catálogos (paquetes, paquete_detalle, estudios, etc.).
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
const LEGACY_SCAN = args.includes('--legacy-scan')
const PROJECT = args.find((a) => a.startsWith('--project'))?.split(/[=\s]/)[1] ?? processProjectFlag()
const NOCITAS = (args.find((a) => a.startsWith('--nocita='))?.split('=')[1] ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

function processProjectFlag() {
  // Soporta "--project ipad-cidyt" (con espacio).
  const i = args.indexOf('--project')
  return i >= 0 && args[i + 1] ? args[i + 1] : null
}

const DRY_RUN = !APPLY

// Campos que delatan el esquema snake_case viejo en `pacientes`.
const LEGACY_PACIENTE_FIELDS = [
  'apellido_paterno',
  'apellido_materno',
  'genero',
  'fecha_nac',
  'nombre_completo',
  'user_crea',
  'fecha_crea',
]

// ─── Salvaguardas de proyecto ───────────────────────────────────────────────

if (PROJECT !== EXPECTED_PROJECT) {
  console.error(
    `❌ Debes pasar el proyecto explícito: --project ${EXPECTED_PROJECT} (recibido: ${PROJECT ?? '(ninguno)'})`,
  )
  process.exit(1)
}

if (NOCITAS.length === 0 && !LEGACY_SCAN) {
  console.error('❌ Nada que hacer. Usa --nocita=... y/o --legacy-scan.')
  console.error('   Ej: node scripts/cleanup-legacy.mjs --project ipad-cidyt --nocita=0000211420,0000900001')
  process.exit(1)
}

// ─── Credenciales ────────────────────────────────────────────────────────────

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

const app = initializeApp(getCredentials())
const db = getFirestore(app)

// ─── Acumulador de refs a borrar (dedup por path) ─────────────────────────────

const toDelete = new Map() // path -> DocumentReference
function queueDelete(ref) {
  if (ref) toDelete.set(ref.path, ref)
}

/** Consulta docs por igualdad y encola sus refs. Devuelve el conteo. */
async function queueByEquality(collection, field, value) {
  const snap = await db.collection(collection).where(field, '==', value).get()
  for (const d of snap.docs) queueDelete(d.ref)
  return snap.size
}

// ─── Modo 1: targeted por No_Cita ─────────────────────────────────────────────

async function collectByNoCita(noCita) {
  const ifaceRef = db.collection('interface_ipad').doc(noCita)
  const snap = await ifaceRef.get()
  if (!snap.exists) {
    console.log(`   ⏭️  interface_ipad/${noCita}: no existe (nada que borrar).`)
    return
  }
  const data = snap.data() || {}
  const pacienteId = data.paciente_id ?? null
  const seguimientoId = data.seguimiento_id ?? null

  console.log(
    `   • ${noCita} → pacienteId=${pacienteId ?? '—'} seguimientoId=${seguimientoId ?? '—'}`,
  )

  queueDelete(ifaceRef)
  if (pacienteId) queueDelete(db.collection('pacientes').doc(String(pacienteId)))
  if (seguimientoId) {
    queueDelete(db.collection('seguimientos').doc(String(seguimientoId)))
    const vc = await queueByEquality('val_corporal', 'seguimientoId', String(seguimientoId))
    const ep = await queueByEquality('estudios_paciente', 'seguimientoId', String(seguimientoId))
    const er = await queueByEquality('estudios_realizar', 'seguimientoId', String(seguimientoId))
    console.log(`     val_corporal=${vc} estudios_paciente=${ep} estudios_realizar=${er}`)
  }
}

// ─── Modo 2: barrido legacy ───────────────────────────────────────────────────

async function collectLegacyScan() {
  // 2a) pacientes snake_case: no hay un solo campo canónico, escaneamos todo.
  const pacSnap = await db.collection('pacientes').get()
  let legacyPac = 0
  for (const d of pacSnap.docs) {
    const data = d.data() || {}
    if (LEGACY_PACIENTE_FIELDS.some((f) => f in data)) {
      queueDelete(d.ref)
      legacyPac++
    }
  }
  console.log(`   • pacientes legacy snake_case: ${legacyPac} (de ${pacSnap.size} totales)`)

  // 2b) seguimientos SIN fechaIngresoUtc.
  const segSnap = await db.collection('seguimientos').get()
  let legacySeg = 0
  for (const d of segSnap.docs) {
    const data = d.data() || {}
    if (!('fechaIngresoUtc' in data) || data.fechaIngresoUtc == null) {
      queueDelete(d.ref)
      legacySeg++
    }
  }
  console.log(`   • seguimientos sin fechaIngresoUtc: ${legacySeg} (de ${segSnap.size} totales)`)

  // 2c) estudios_realizar (colección deprecada, completa).
  const erSnap = await db.collection('estudios_realizar').get()
  for (const d of erSnap.docs) queueDelete(d.ref)
  console.log(`   • estudios_realizar (deprecada): ${erSnap.size}`)
}

// ─── Borrado en batches ───────────────────────────────────────────────────────

async function applyDeletes() {
  const refs = [...toDelete.values()]
  const BATCH = 450
  let done = 0
  for (let i = 0; i < refs.length; i += BATCH) {
    const chunk = refs.slice(i, i + BATCH)
    const batch = db.batch()
    for (const ref of chunk) batch.delete(ref)
    await batch.commit()
    done += chunk.length
    console.log(`   ✓ lote ${Math.floor(i / BATCH) + 1}: ${chunk.length} docs (total: ${done})`)
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════════')
  console.log('  CLEANUP LEGACY — Firestore')
  console.log(`  Proyecto: ${PROJECT}`)
  console.log(`  Modo: ${DRY_RUN ? '🧪 DRY RUN (no borra nada)' : '🔥 BORRADO REAL'}`)
  if (NOCITAS.length) console.log(`  No_Cita objetivo: ${NOCITAS.join(', ')}`)
  if (LEGACY_SCAN) console.log('  Barrido legacy: ON')
  console.log('═══════════════════════════════════════════════════════')

  if (NOCITAS.length) {
    console.log('\n── Targeted por No_Cita ──')
    for (const nc of NOCITAS) await collectByNoCita(nc)
  }

  if (LEGACY_SCAN) {
    console.log('\n── Barrido legacy ──')
    await collectLegacyScan()
  }

  const total = toDelete.size
  console.log(`\n📊 Documentos a borrar: ${total}`)

  if (total === 0) {
    console.log('✅ Nada que borrar.')
    return
  }

  // Listado agrupado por colección (primer segmento del path).
  const porColeccion = new Map()
  for (const path of toDelete.keys()) {
    const col = path.split('/')[0]
    porColeccion.set(col, (porColeccion.get(col) ?? 0) + 1)
  }
  for (const [col, n] of porColeccion) console.log(`   - ${col}: ${n}`)

  if (DRY_RUN) {
    console.log('\n🧪 DRY RUN: no se borró nada. Para aplicar: agrega --apply --yes')
    return
  }

  if (!YES) {
    console.error('\n❌ --apply requiere confirmación explícita: agrega también --yes')
    process.exit(1)
  }

  console.log('\n🔥 Borrando…')
  await applyDeletes()
  console.log('✅ Limpieza completada.')
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Error:', err)
    process.exit(1)
  })
