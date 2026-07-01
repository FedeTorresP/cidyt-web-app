/**
 * Auditoría (solo lectura) de la cobertura de `paquete_detalle`.
 *
 * El grid de estudios de la app y la ingesta SAP (patient_service._estudios_de_paquete)
 * leen `paquete_detalle` filtrando por `paqueteId` + `activo == true`. SAP crea el
 * `paquetes/{id}` pero NO crea `paquete_detalle`, así que un paquete sin renglones
 * de detalle produce un grid de estudios vacío.
 *
 * Este script NO escribe nada. Reporta:
 *   - Paquetes activos SIN ningún renglón de detalle activo.
 *   - Verificación puntual de uno o más paqueteId (por defecto DT0007).
 *
 * Uso:
 *   node scripts/audit-paquete-detalle.mjs
 *   node scripts/audit-paquete-detalle.mjs --check=DT0007,DT0001
 *
 * Credenciales (mismo esquema que seed-catalogos.mjs):
 *   - FIREBASE_SERVICE_ACCOUNT_KEY (JSON en env), o
 *   - service-account.json en la raíz, o
 *   - gcloud auth (Application Default Credentials).
 */

import { initializeApp, cert, applicationDefault } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { execSync } from 'child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const PROJECT_ID = 'ipad-cidyt'

const args = process.argv.slice(2)
const CHECK_IDS = (args.find((a) => a.startsWith('--check='))?.split('=')[1] ?? 'DT0007')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

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
    process.env.GCLOUD_PROJECT = PROJECT_ID
    return { credential: applicationDefault(), projectId: PROJECT_ID }
  } catch {
    console.error('❌ No se encontró FIREBASE_SERVICE_ACCOUNT_KEY, service-account.json, ni gcloud auth activo')
    process.exit(1)
  }
}

const app = initializeApp(getCredentials())
const db = getFirestore(app)

/** Set de paqueteId distintos con al menos un renglón activo en paquete_detalle. */
async function fetchPaqueteIdsConDetalle() {
  const snap = await db.collection('paquete_detalle').where('activo', '==', true).get()
  const counts = new Map()
  for (const d of snap.docs) {
    const pid = d.data().paqueteId
    if (pid == null) continue
    const key = String(pid)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return counts
}

async function main() {
  console.log('═══════════════════════════════════════════════════════')
  console.log('  AUDITORÍA paquete_detalle (solo lectura)')
  console.log(`  Proyecto: ${PROJECT_ID}`)
  console.log('═══════════════════════════════════════════════════════')

  const detalleCounts = await fetchPaqueteIdsConDetalle()
  console.log(`\npaquete_detalle: ${detalleCounts.size} paqueteId distintos con detalle activo.`)

  // 1) Paquetes activos sin detalle
  const paquetesSnap = await db.collection('paquetes').where('activo', '==', true).get()
  const sinDetalle = []
  for (const d of paquetesSnap.docs) {
    const data = d.data()
    // El detalle se busca por el doc id del paquete (== paqueteId que envía SAP).
    if (!detalleCounts.has(d.id)) {
      sinDetalle.push({ id: d.id, nombre: data.nombre ?? '' })
    }
  }

  console.log(`\npaquetes activos: ${paquetesSnap.size}`)
  if (sinDetalle.length === 0) {
    console.log('✅ Todos los paquetes activos tienen renglones en paquete_detalle.')
  } else {
    console.log(`⚠️  ${sinDetalle.length} paquete(s) activo(s) SIN detalle (grid vacío):`)
    for (const p of sinDetalle) console.log(`   - ${p.id}  ${p.nombre}`)
  }

  // 2) Verificación puntual de los paqueteId indicados
  console.log('\n── Verificación puntual ──')
  for (const id of CHECK_IDS) {
    const n = detalleCounts.get(id) ?? 0
    const paqExiste = paquetesSnap.docs.some((d) => d.id === id)
    const marca = n > 0 ? '✅' : '❌'
    console.log(
      `${marca} ${id}: ${n} renglón(es) de detalle activo` +
        (paqExiste ? '' : '  (⚠️ paquete no existe o inactivo en `paquetes`)'),
    )
  }

  console.log('\n═══════════════════════════════════════════════════════')
  console.log('  Fin auditoría')
  console.log('═══════════════════════════════════════════════════════')
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Error:', err)
    process.exit(1)
  })
