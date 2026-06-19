/**
 * Script para poblar catálogos iniciales en Firestore.
 *
 * Uso:
 *   node scripts/seed-catalogos.mjs
 *
 * Flags opcionales:
 *   --dry-run        Solo muestra lo que haría sin escribir en Firestore
 *   --collection=X   Solo sube la colección indicada (ej. --collection=estudios)
 *
 * Catálogos pequeños van inline en este archivo.
 * Catálogos grandes se leen de scripts/data/<coleccion>.json
 *
 * Formato de JSON externo:
 *   Un array de objetos, cada uno con un campo "_id" (string) para el document ID.
 *   Ejemplo: [{ "_id": "1", "nombre": "BANDAI", "activo": true }, ...]
 *
 * Requiere:
 *   - Variable de entorno FIREBASE_SERVICE_ACCOUNT_KEY con el JSON de la service account
 *   - O bien un archivo service-account.json en la raíz del proyecto
 */

import { initializeApp, cert, applicationDefault } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { execSync } from 'child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const DATA_DIR = join(__dirname, 'data')

// ─── CLI Flags ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const ONLY_COLLECTION = args.find((a) => a.startsWith('--collection='))?.split('=')[1] ?? null

// ─── Firebase Admin Init ─────────────────────────────────────────────────────

function getCredentials() {
  // 1. Variable de entorno explícita
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
  if (raw && raw.trim() !== '') {
    try {
      return { credential: cert(JSON.parse(raw)) }
    } catch {
      console.error('❌ FIREBASE_SERVICE_ACCOUNT_KEY no es JSON válido')
      process.exit(1)
    }
  }

  // 2. Archivo service-account.json local
  const saPath = join(__dirname, '..', 'service-account.json')
  if (existsSync(saPath)) {
    try {
      return { credential: cert(JSON.parse(readFileSync(saPath, 'utf-8'))) }
    } catch {
      console.error('❌ service-account.json no es JSON válido')
      process.exit(1)
    }
  }

  // 3. Google Cloud CLI (gcloud) — usa Application Default Credentials
  //    Esto funciona si tienes gcloud auth login activo.
  try {
    execSync('gcloud auth print-access-token', { stdio: 'pipe' })
    console.log('🔑 Usando credenciales de Google Cloud CLI (gcloud)')
    // Seteamos GOOGLE_APPLICATION_CREDENTIALS bypass via ADC con project
    process.env.GCLOUD_PROJECT = 'ipad-cidyt'
    return { credential: applicationDefault(), projectId: 'ipad-cidyt' }
  } catch {
    console.error('❌ No se encontró FIREBASE_SERVICE_ACCOUNT_KEY, service-account.json, ni gcloud auth activo')
    process.exit(1)
  }
}

const credConfig = getCredentials()
const app = initializeApp(credConfig)
const db = getFirestore(app)

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Carga un JSON desde scripts/data/<nombre>.json.
 * Retorna array vacío si no existe.
 */
function loadDataFile(filename) {
  const filePath = join(DATA_DIR, filename)
  if (!existsSync(filePath)) return []
  const raw = readFileSync(filePath, 'utf-8')
  const parsed = JSON.parse(raw)
  // Soporta tanto array directo como { "key": [...] }
  if (Array.isArray(parsed)) return parsed
  const keys = Object.keys(parsed)
  if (keys.length === 1 && Array.isArray(parsed[keys[0]])) return parsed[keys[0]]
  return []
}

/**
 * Sube un array de documentos a una colección.
 * Si el objeto tiene campo `_id`, se usa como document ID (y se elimina del payload).
 * De lo contrario se usa addDoc (ID autogenerado).
 */
async function seedCollection(collectionName, documents) {
  if (ONLY_COLLECTION && ONLY_COLLECTION !== collectionName) return
  if (documents.length === 0) {
    console.log(`⏭️  ${collectionName}: vacío, saltando.`)
    return
  }

  console.log(`\n📦 ${collectionName} — ${documents.length} documento(s)`)

  for (const item of documents) {
    const { _id, ...data } = item
    const docId = _id != null ? String(_id) : null

    if (DRY_RUN) {
      console.log(`   [dry-run] ${docId ?? '(auto)'} →`, JSON.stringify(data).substring(0, 120))
    } else {
      if (docId) {
        await db.collection(collectionName).doc(docId).set(data, { merge: true })
      } else {
        await db.collection(collectionName).add(data)
      }
      console.log(`   ✓ ${docId ?? '(auto)'}`)
    }
  }
}

// ═════════════════════════════════════════════════════════════════════════════
//  CATÁLOGOS
//
//  Catálogos pequeños → inline aquí.
//  Catálogos grandes  → se leen de scripts/data/<coleccion>.json
//
//  Para agregar un catálogo grande:
//    1. Exporta de IPADCK como JSON
//    2. Colócalo en scripts/data/<coleccion>.json
//    3. El script lo levanta automáticamente
// ═════════════════════════════════════════════════════════════════════════════

/**
 * estudios — Catálogo de estudios (de IPADCK).
 * Abreviaturas agregadas manualmente para la UI.
 */
const ESTUDIOS = [
  { _id: '1', nombre: 'Laboratorios', descripcion: 'Laboratorios', abreviatura: 'LAB', estudioTipoId: '1', lugarEstudioId: null, ordenMostrar: 1, mostrarInterface: true, activo: true },
  { _id: '2', nombre: 'Torax', descripcion: 'Torax', abreviatura: 'TOR', estudioTipoId: '1', lugarEstudioId: null, ordenMostrar: 2, mostrarInterface: true, activo: true },
  { _id: '3', nombre: 'US.Abdomen', descripcion: 'US.Abdomen', abreviatura: 'ABD', estudioTipoId: '1', lugarEstudioId: null, ordenMostrar: 3, mostrarInterface: true, activo: true },
  { _id: '4', nombre: 'US. Mamario', descripcion: 'US. Mamario', abreviatura: 'MAM', estudioTipoId: '1', lugarEstudioId: null, ordenMostrar: 4, mostrarInterface: true, activo: true },
  { _id: '5', nombre: 'Mastografia', descripcion: 'Mastografia', abreviatura: 'MAS', estudioTipoId: '1', lugarEstudioId: null, ordenMostrar: 5, mostrarInterface: true, activo: true },
  { _id: '6', nombre: 'CT', descripcion: 'CT', abreviatura: 'CT', estudioTipoId: '1', lugarEstudioId: null, ordenMostrar: 6, mostrarInterface: true, activo: true },
  { _id: '7', nombre: 'Ortopanto', descripcion: 'Ortopanto', abreviatura: 'ORT', estudioTipoId: '1', lugarEstudioId: '4', ordenMostrar: 7, mostrarInterface: true, activo: true },
  { _id: '8', nombre: 'Densitometria', descripcion: 'Densitometria', abreviatura: 'DEN', estudioTipoId: '1', lugarEstudioId: null, ordenMostrar: 8, mostrarInterface: true, activo: true },
  { _id: '9', nombre: 'Espirometria', descripcion: 'Espirometria', abreviatura: 'ESP', estudioTipoId: '1', lugarEstudioId: null, ordenMostrar: 9, mostrarInterface: true, activo: true },
  { _id: '19', nombre: 'EKG', descripcion: 'EKG', abreviatura: 'EKG', estudioTipoId: '1', lugarEstudioId: null, ordenMostrar: 10, mostrarInterface: true, activo: true },
  { _id: '10', nombre: 'ECG Y PE', descripcion: 'ECG Y PE', abreviatura: 'E+P', estudioTipoId: '1', lugarEstudioId: '2', ordenMostrar: 11, mostrarInterface: true, activo: true },
  { _id: '11', nombre: 'Colposcopia', descripcion: 'Colposcopia', abreviatura: 'COL', estudioTipoId: '1', lugarEstudioId: '6', ordenMostrar: 12, mostrarInterface: true, activo: true },
  { _id: '12', nombre: 'PaP', descripcion: 'PaP', abreviatura: 'PAP', estudioTipoId: '1', lugarEstudioId: '12', ordenMostrar: 13, mostrarInterface: true, activo: true },
  { _id: '13', nombre: 'Audio', descripcion: 'Audio', abreviatura: 'AUD', estudioTipoId: '1', lugarEstudioId: '7', ordenMostrar: 14, mostrarInterface: true, activo: true },
  { _id: '14', nombre: 'Dental', descripcion: 'Dental', abreviatura: 'DNT', estudioTipoId: '1', lugarEstudioId: '8', ordenMostrar: 15, mostrarInterface: true, activo: true },
  { _id: '15', nombre: 'Oftalmologia', descripcion: 'Oftalmologia', abreviatura: 'OFT', estudioTipoId: '1', lugarEstudioId: '9', ordenMostrar: 16, mostrarInterface: true, activo: true },
  { _id: '16', nombre: 'Nutricion', descripcion: 'Nutricion', abreviatura: 'NUT', estudioTipoId: '1', lugarEstudioId: '1', ordenMostrar: 17, mostrarInterface: true, activo: true },
  { _id: '17', nombre: 'Ortopedia', descripcion: 'Ortopedia', abreviatura: 'OTP', estudioTipoId: '1', lugarEstudioId: '3', ordenMostrar: 18, mostrarInterface: true, activo: true },
  { _id: '18', nombre: 'Proctologia', descripcion: 'Proctologia', abreviatura: 'PRO', estudioTipoId: '1', lugarEstudioId: '5', ordenMostrar: 19, mostrarInterface: true, activo: true },
  { _id: '20', nombre: 'Fibroscan', descripcion: 'Fibroscan', abreviatura: 'FIB', estudioTipoId: '1', lugarEstudioId: null, ordenMostrar: 20, mostrarInterface: true, activo: true },
  { _id: '100', nombre: 'Estudio Adicional', descripcion: 'Estudio Adicional', abreviatura: 'ADIC', estudioTipoId: '2', lugarEstudioId: null, ordenMostrar: 0, mostrarInterface: false, activo: false },
]

/**
 * estudio_tipo — Tipos de estudio (Checkup vs Adicional).
 */
const ESTUDIO_TIPO = [
  { _id: '1', nombre: 'Checkup', descripcion: '', activo: true },
  { _id: '2', nombre: 'Adicional', descripcion: '', activo: true },
]

/**
 * estatus_estudio — Los 9 posibles estatus de un estudio.
 */
const ESTATUS_ESTUDIO = [
  { _id: '0', nombre: 'Sin Estatus', abreviatura: '', color: 'transparent', ordenMostrar: 0, activo: true },
  { _id: '1', nombre: 'No Incluido', abreviatura: '', color: 'transparent', ordenMostrar: 1, activo: true },
  { _id: '2', nombre: 'En Espera', abreviatura: 'E', color: '#1976D2', ordenMostrar: 2, activo: true },
  { _id: '3', nombre: 'En Proceso', abreviatura: '', color: '#facc15', ordenMostrar: 3, activo: true },
  { _id: '4', nombre: 'Completo', abreviatura: 'C', color: '#00A651', ordenMostrar: 4, activo: true },
  { _id: '5', nombre: 'Pendiente', abreviatura: 'P', color: '#7B1FA2', ordenMostrar: 5, activo: true },
  { _id: '6', nombre: 'No Acepta', abreviatura: 'N', color: '#D32F2F', ordenMostrar: 6, activo: true },
  { _id: '7', nombre: 'Cambio Estudio', abreviatura: 'C', color: '#0288D1', ordenMostrar: 7, activo: true },
  { _id: '8', nombre: 'Estudio Combinado', abreviatura: '', color: '#873600', ordenMostrar: 8, activo: true },
]

/**
 * estatus_cubiculo_medico — Estatus para sesiones en cubículos (de IPADCK).
 */
const ESTATUS_CUBICULO_MEDICO = [
  { _id: '1', nombre: 'Disponible', descripcion: 'D', visible: true, activo: true },
  { _id: '2', nombre: 'Ocupado', descripcion: 'O', visible: true, activo: true },
  { _id: '3', nombre: 'No Disponible', descripcion: 'N', visible: false, activo: false },
  { _id: '4', nombre: 'Conectado', descripcion: '-', visible: false, activo: true },
  { _id: '5', nombre: 'Desconectado', descripcion: '', visible: false, activo: true },
]

/**
 * estatus_val_pac — Estatus del seguimiento/valoración del paciente.
 */
const ESTATUS_VAL_PAC = [
  { _id: '0', nombre: 'Ingreso', descripcion: 'Ingreso del Paciente', activo: true },
  { _id: '1', nombre: 'Egreso Enf', descripcion: 'Egreso de Enfermeria', activo: true },
  { _id: '2', nombre: 'Egreso Area', descripcion: 'Egreso de Cidyt', activo: true },
  { _id: '3', nombre: 'Cancelado', descripcion: '', activo: true },
]

/**
 * especialidades — Especialidades médicas.
 */
const ESPECIALIDADES = [
  { _id: '1', nombre: 'CARDIOLOGO', descripcion: 'CARDIOLOGO', activo: true },
  { _id: '2', nombre: 'GINECOLOGO', descripcion: 'GINECOLOGO', activo: true },
  { _id: '3', nombre: 'MEDICO INTERNISTA', descripcion: 'MEDICO INTERNISTA', activo: true },
  { _id: '4', nombre: 'MEDICO ONCOLOGO', descripcion: 'MEDICO ONCOLOGO', activo: true },
  { _id: '5', nombre: 'MEDICO PEDIATRA', descripcion: 'MEDICO PEDIATRA', activo: true },
  { _id: '6', nombre: 'NUTRIOLOGA', descripcion: 'NUTRIOLOGA', activo: true },
  { _id: '7', nombre: 'ODONTOLOGO', descripcion: 'ODONTOLOGO', activo: true },
  { _id: '8', nombre: 'OFTALMOLOGA', descripcion: 'OFTALMOLOGA', activo: true },
  { _id: '9', nombre: 'ORTOPEDISTA', descripcion: 'ORTOPEDISTA', activo: true },
  { _id: '10', nombre: 'OTORRINOLARINGOLOGO', descripcion: 'OTORRINOLARINGOLOGO', activo: true },
  { _id: '11', nombre: 'PROCTOLOGO', descripcion: 'PROCTOLOGO', activo: true },
  { _id: '12', nombre: 'REHABILITADORA', descripcion: 'REHABILITADORA', activo: true },
  { _id: '13', nombre: 'SIN ESPECIALIDAD', descripcion: 'SIN ESPECIALIDAD', activo: true },
]

/**
 * lugar_estudio — Áreas/ramas donde se realizan estudios.
 */
const LUGAR_ESTUDIO = [
  { _id: '1', nombre: 'Nutricion', descripcion: 'Nutricion', activo: true },
  { _id: '2', nombre: 'P.E.', descripcion: 'Pruebas de Esfuerzo', activo: true },
  { _id: '3', nombre: 'Orto', descripcion: 'Ortopedia', activo: true },
  { _id: '4', nombre: 'Ortopanto', descripcion: 'Ortopanto', activo: true },
  { _id: '5', nombre: 'Proctol.', descripcion: 'Proctología', activo: true },
  { _id: '6', nombre: 'Colposco', descripcion: 'Colposcopia', activo: true },
  { _id: '7', nombre: 'Audio', descripcion: 'Audio', activo: true },
  { _id: '8', nombre: 'Dental', descripcion: 'Dental', activo: true },
  { _id: '9', nombre: 'Oftalmo', descripcion: 'Oftalmología', activo: true },
  { _id: '10', nombre: 'Internista', descripcion: 'Internista', activo: true },
  { _id: '11', nombre: 'Onco', descripcion: 'Oncología', activo: true },
  { _id: '12', nombre: 'PaP', descripcion: 'Papanicolaou', activo: true },
  { _id: '13', nombre: 'NA', descripcion: 'No Aplica', activo: true },
]

/**
 * padecimientos — Padecimientos conocidos.
 */
const PADECIMIENTOS = [
  { _id: '0', nombre: 'Ninguno', descripcion: 'N', activo: true },
  { _id: '1', nombre: 'Hipertension', descripcion: 'HT', activo: true },
  { _id: '2', nombre: 'Diabetes', descripcion: 'DB', activo: true },
]

/**
 * horarios — Turnos de atención.
 */
const HORARIOS = [
  { _id: '1', nombre: 'MATUTINO', descripcion: 'MATUTINO', horaInicio: '00:00', horaFin: '16:00', activo: true },
  { _id: '2', nombre: 'VESPERTINO', descripcion: 'VESPERTINO', horaInicio: '16:00', horaFin: '23:59', activo: true },
]

// ─── Catálogos grandes (se leen de scripts/data/*.json) ──────────────────────
//
// Coloca el JSON exportado de IPADCK en scripts/data/ con estos nombres:
//   empresas.json, medicos.json, lugares.json, horarios.json,
//   cubiculos.json, entidades.json, roles.json, permisos.json
//
// Formato esperado: array de objetos con campo "_id" (string).
// Si tu export no tiene _id, el script usa el ID original del objeto
// (ej. "Empresa_id") — ver transformadores abajo.

/**
 * Transforma un registro de IPADCK al formato Firestore.
 * Cada función mapea los campos legacy a la estructura normalizada.
 */
const TRANSFORMERS = {
  empresas: (row) => ({
    _id: String(row.Empresa_id),
    nombre: (row.Nombre ?? '').trim(),
    descripcion: (row.Descripcion ?? '').trim(),
    alias: (row.Alias_Empresa ?? '').trim(),
    ordenMostrar: row.Orden_Mostrar ?? null,
    activo: row.Activo === 1,
  }),
  medicos: (row) => ({
    _id: String(row.Medico_id),
    nombreCompleto: (row.NombreCompleto ?? '').trim(),
    nombre1: (row.Nombre1 ?? '').trim(),
    nombre2: (row.Nombre2 ?? '').trim(),
    apellidoPaterno: (row.Apellido_Paterno ?? '').trim(),
    apellidoMaterno: (row.Apellido_Materno ?? '').trim(),
    letra: (row.Nombre_Corto ?? '').trim() || null,
    activo: row.Activo === 1,
  }),
  cubiculos: (row) => ({
    _id: String(row.Cubiculo_id),
    nombre: (row.Nombre ?? '').trim(),
    descripcion: (row.Descripcion ?? '').trim(),
    entidadId: row.Entidad_id ? String(row.Entidad_id) : null,
    ordenMostrar: row.Orden_Mostrar ?? null,
    estatusCubiculoId: row.Estatus_Cubiculo_id ? String(row.Estatus_Cubiculo_id) : '1',
    activo: true, // Legacy no tiene campo Activo, todos se consideran activos
  }),
  paquetes: (row) => {
    if (!row.Paquete_id || row.Paquete_id === '') return null // Filtrar vacíos
    // Firestore no permite '/' en document IDs — reemplazar con '_'
    const safeId = String(row.Paquete_id).replace(/\//g, '_')
    return {
      _id: safeId,
      paqueteIdOriginal: String(row.Paquete_id), // Conservar el ID original para búsquedas
      nombre: (row.Nombre ?? '').trim(),
      descripcion: (row.Descripcion ?? '').trim(),
      nombreCorto: (row.Nombre_Corto ?? '').trim() || null,
      ordenMostrar: row.Orden_Mostrar ?? null,
      activo: row.Activo === 1,
    }
  },
  promotores: (row) => ({
    _id: String(row.Promotor_id),
    noEmpleado: String(row.No_Empleado ?? ''),
    nombreCompleto: (row.Nombre_Completo ?? '').trim(),
    primerNombre: (row.Primer_Nombre ?? '').trim(),
    segundoNombre: (row.Segundo_Nombre ?? '').trim(),
    apellidoPaterno: (row.Ape_Paterno ?? '').trim(),
    apellidoMaterno: (row.Ape_Materno ?? '').trim(),
    puesto: (row.Puesto ?? '').trim() || null,
    departamento: (row.Departamento ?? '').trim() || null,
    activo: row.Activo === 1,
  }),
  perfiles: (row) => ({
    _id: String(row.Perfil_id),
    nombre: (row.Nombre ?? '').trim(),
    descripcion: (row.Descripcion ?? '').trim(),
    nivel: row.Nivel ?? 0,
    activo: row.Activo === 1,
  }),
  medico_especialidad: (row) => ({
    _id: `${row.Medico_id}_${row.Especialidad_id}`,
    medicoId: String(row.Medico_id),
    especialidadId: String(row.Especialidad_id),
    activo: row.Activo === 1,
  }),
  medico_lugar_estudio: (row) => ({
    _id: `${row.Medico_id}_${row.Lugar_Estudio_id}`,
    medicoId: String(row.Medico_id),
    lugarEstudioId: String(row.Lugar_Estudio_id),
    activo: row.Activo === 1,
  }),
  paquete_detalle: (row) => {
    if (!row.Paquete_id || row.Paquete_id === '') return null
    const safePaqId = String(row.Paquete_id).replace(/\//g, '_')
    return {
      _id: `${safePaqId}_${row.Estudio_id}`,
      paqueteId: safePaqId,
      paqueteIdOriginal: String(row.Paquete_id),
      estudioId: String(row.Estudio_id),
      estatusInicial: row.Estatus_Inicial ?? 0,
      activo: row.Activo === 1,
    }
  },
}

function loadCatalog(name) {
  // Mapeo nombre colección Firestore → nombre archivo JSON de IPADCK
  const FILE_MAP = {
    empresas: 'empresa.json',
    medicos: 'medico.json',
    cubiculos: 'cubiculo.json',
    paquetes: 'paquetes.json',
    promotores: 'promotor.json',
    perfiles: 'perfiles.json',
    medico_especialidad: 'medico_esp.json',
    medico_lugar_estudio: 'lugar_estudio_medico.json',
    paquete_detalle: 'paquete_det.json',
  }
  const filename = FILE_MAP[name] ?? `${name}.json`
  const raw = loadDataFile(filename)
  if (raw.length === 0) return []
  const transformer = TRANSFORMERS[name]
  if (!transformer) return raw
  return raw.map(transformer).filter(Boolean)
}

// ═════════════════════════════════════════════════════════════════════════════
//  EJECUCIÓN
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Sube documentos en lotes (batched writes) para colecciones grandes.
 * Firestore permite máximo 500 operaciones por batch.
 */
async function seedCollectionBatched(collectionName, documents, batchSize = 450) {
  if (ONLY_COLLECTION && ONLY_COLLECTION !== collectionName) return
  if (documents.length === 0) {
    console.log(`⏭️  ${collectionName}: vacío, saltando.`)
    return
  }

  console.log(`\n📦 ${collectionName} — ${documents.length} documento(s) [batched, ${batchSize}/lote]`)

  let written = 0
  for (let i = 0; i < documents.length; i += batchSize) {
    const chunk = documents.slice(i, i + batchSize)

    if (DRY_RUN) {
      written += chunk.length
      console.log(`   [dry-run] lote ${Math.floor(i / batchSize) + 1}: ${chunk.length} docs`)
    } else {
      const batch = db.batch()
      for (const item of chunk) {
        const { _id, ...data } = item
        const docId = _id != null ? String(_id) : null
        if (docId) {
          batch.set(db.collection(collectionName).doc(docId), data, { merge: true })
        } else {
          batch.set(db.collection(collectionName).doc(), data)
        }
      }
      await batch.commit()
      written += chunk.length
      console.log(`   ✓ lote ${Math.floor(i / batchSize) + 1}: ${chunk.length} docs (total: ${written})`)
    }
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════')
  console.log('  SEED CATÁLOGOS — Firestore')
  console.log(`  Modo: ${DRY_RUN ? '🧪 DRY RUN (no escribe nada)' : '🔥 ESCRITURA REAL'}`)
  if (ONLY_COLLECTION) console.log(`  Filtro: solo "${ONLY_COLLECTION}"`)
  console.log(`  Data dir: ${DATA_DIR}`)
  console.log('═══════════════════════════════════════════════════════')

  // ─── Catálogos inline (pequeños) ─────────────────────────────────────────
  await seedCollection('estudios', ESTUDIOS)
  await seedCollection('estudio_tipo', ESTUDIO_TIPO)
  await seedCollection('estatus_estudio', ESTATUS_ESTUDIO)
  await seedCollection('estatus_cubiculo_medico', ESTATUS_CUBICULO_MEDICO)
  await seedCollection('estatus_val_pac', ESTATUS_VAL_PAC)
  await seedCollection('especialidades', ESPECIALIDADES)
  await seedCollection('lugar_estudio', LUGAR_ESTUDIO)
  await seedCollection('padecimientos', PADECIMIENTOS)
  await seedCollection('horarios', HORARIOS)

  // ─── Catálogos grandes (desde JSON) ──────────────────────────────────────
  await seedCollectionBatched('empresas', loadCatalog('empresas'))
  await seedCollectionBatched('medicos', loadCatalog('medicos'))
  await seedCollection('cubiculos', loadCatalog('cubiculos'))
  await seedCollectionBatched('paquetes', loadCatalog('paquetes'))
  await seedCollection('promotores', loadCatalog('promotores'))
  await seedCollection('perfiles', loadCatalog('perfiles'))

  // ─── Tablas puente (relaciones) ──────────────────────────────────────────
  await seedCollectionBatched('medico_especialidad', loadCatalog('medico_especialidad'))
  await seedCollectionBatched('medico_lugar_estudio', loadCatalog('medico_lugar_estudio'))
  await seedCollectionBatched('paquete_detalle', loadCatalog('paquete_detalle'))

  console.log('\n═══════════════════════════════════════════════════════')
  console.log('  ✅ Seed completado')
  console.log('═══════════════════════════════════════════════════════')

  process.exit(0)
}

main().catch((err) => {
  console.error('❌ Error fatal:', err)
  process.exit(1)
})
