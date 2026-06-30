import { createLazyFileRoute, useRouter } from '@tanstack/react-router'
import { useState, useCallback, useEffect, useMemo } from 'react'
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore'
import { Button } from '@/components/ui/button'
import { getFirebaseAuth, getFirebaseFirestore } from '@/lib/firebase'
import { buildPacienteNombre, calcEdad, ESTUDIO_ADICIONAL_ID } from '@/lib/pacientes-firestore'
import { useUpdatePacienteCache, useListaDia } from '@/hooks/use-lista-dia'
import { useMedicosActivos, esMedicoInternista } from '@/hooks/use-medicos'
import { useEstudiosActivos } from '@/hooks/use-estudios'
import { useMedicosPorLugarEstudioMap } from '@/hooks/use-medico-lugar-estudio'
import { getMedicosPorLugar } from '@/lib/medico-resolver'
import { formatDateMX, nowMX } from '@/lib/timezone'

export const Route = createLazyFileRoute('/_authenticated/paciente_/$seguimientoId')({
  component: SeguimientoPacientePage,
})

/* ═══════════════════════════════════════════════════════════════════════════
   TIPOS
   ═══════════════════════════════════════════════════════════════════════════ */

interface EstudioRealizar {
  Estudio_Realizar_id: number
  Estudio_id: number
  Nombre: string
  Estatus_Est_id: number
  Observaciones: string
  Medico_id: string | null
  Letra_Est_Adic: string | null
  Activo: number
}

interface MedicoEsp {
  Medico_id: string
  Nombre_Completo: string
  Letra: string | null
}

interface Padecimiento {
  id: number
  nombre: string
}

interface MedicoInternista {
  Medico_id: string
  Nombre_Completo: string
  Letra: string | null
}

interface SeguimientoData {
  Seguimiento_id: number
  Nombre_Completo: string
  Edad: number
  Nombre_Paquete: string
  Desayuno: 0 | 1 | 2
  Padecimiento_id: number
  Medico_id: string | null
  Estatus_Valpac_id: number
  Fecha_Ent_Resultados: string | null
  Hora_Ent_Resultados: string | null
  Fecha_Envio_Resultados: string | null
  Hora_Envio_Resultados: string | null
  Observaciones: string
  estudios: EstudioRealizar[]
  val_corporal: { Peso: number; Talla: number } | null
}

interface Catalogos {
  padecimientos: Padecimiento[]
}

/** Celda de estudio del paquete respaldada por Firestore `estudios_paciente`. */
interface EpCell {
  docId: string | null
  estatusId: number
  medicoId: string | null
  letraMedico: string | null
  observaciones: string
}

/* ═══════════════════════════════════════════════════════════════════════════
   FIRESTORE — estudios_paciente (tabla del paquete)
   ═══════════════════════════════════════════════════════════════════════════ */

async function loadEstudiosPaciente(seguimientoId: string): Promise<Record<number, EpCell>> {
  const db = getFirebaseFirestore()
  const snap = await getDocs(
    query(
      collection(db, 'estudios_paciente'),
      where('seguimientoId', '==', seguimientoId),
      where('activo', '==', true),
    ),
  )
  const out: Record<number, EpCell> = {}
  for (const d of snap.docs) {
    const data = d.data()
    const eid = Number(data.estudioId)
    if (!Number.isFinite(eid)) continue
    out[eid] = {
      docId: d.id,
      estatusId: Number(data.estatusEstudioId) || 0,
      medicoId: data.medicoId != null ? String(data.medicoId) : null,
      letraMedico:
        typeof data.letraMedico === 'string' && data.letraMedico.trim() !== ''
          ? data.letraMedico.trim()
          : null,
      observaciones: typeof data.observaciones === 'string' ? data.observaciones : '',
    }
  }
  return out
}

/** Escribe parcialmente una celda; crea el doc si no existe. Devuelve el docId. */
async function persistEpField(
  seguimientoId: string,
  estudioId: number,
  current: EpCell | undefined,
  patch: Partial<{ medicoId: string | null; letraMedico: string | null; observaciones: string }>,
): Promise<string> {
  const db = getFirebaseFirestore()
  if (current?.docId) {
    await updateDoc(doc(db, 'estudios_paciente', current.docId), patch)
    return current.docId
  }
  const snap = await getDocs(
    query(
      collection(db, 'estudios_paciente'),
      where('seguimientoId', '==', seguimientoId),
      where('estudioId', '==', String(estudioId)),
      where('activo', '==', true),
    ),
  )
  if (!snap.empty) {
    await updateDoc(doc(db, 'estudios_paciente', snap.docs[0].id), patch)
    return snap.docs[0].id
  }
  const ref = await addDoc(collection(db, 'estudios_paciente'), {
    seguimientoId,
    estudioId: String(estudioId),
    estatusEstudioId: String(current?.estatusId ?? 0),
    medicoId: null,
    letraMedico: null,
    observaciones: '',
    activo: true,
    ...patch,
  })
  return ref.id
}

/* ═══════════════════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */

/** Fechas inválidas de BD → null */
function cleanDate(val: string | null): string {
  if (!val || val === '0000-00-00' || val.startsWith('0000')) return ''
  return val
}
function cleanTime(val: string | null): string {
  if (!val || val === '00:00:00' || val === '00:00') return ''
  return val.substring(0, 5) // HH:mm
}

/* ═══════════════════════════════════════════════════════════════════════════
   FIRESTORE — carga del seguimiento (sin SAP / sin REST)
   ═══════════════════════════════════════════════════════════════════════════ */

interface AdicionalItem {
  docId: string
  nombre: string
  letra: string | null
}

interface ValCorporalDoc {
  docId: string | null
  peso: number
  talla: number
}

async function fetchPadecimientos(): Promise<Padecimiento[]> {
  const db = getFirebaseFirestore()
  const snap = await getDocs(query(collection(db, 'padecimientos'), where('activo', '==', true)))
  return snap.docs
    .map((d) => ({ id: Number(d.id) || 0, nombre: (d.data().nombre as string) ?? '' }))
    .filter((p) => p.id > 0)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}

/** Lee `val_corporal` (activo) del seguimiento. */
async function fetchValCorporal(seguimientoId: string): Promise<ValCorporalDoc> {
  const db = getFirebaseFirestore()
  const snap = await getDocs(
    query(
      collection(db, 'val_corporal'),
      where('seguimientoId', '==', seguimientoId),
      where('activo', '==', true),
    ),
  )
  if (snap.empty) return { docId: null, peso: 0, talla: 0 }
  const d = snap.docs[0]
  const data = d.data()
  return { docId: d.id, peso: Number(data.peso) || 0, talla: Number(data.talla) || 0 }
}

/** Carga estudios adicionales (estudios_paciente con estudioId '100', activo). */
async function fetchAdicionales(seguimientoId: string): Promise<AdicionalItem[]> {
  const db = getFirebaseFirestore()
  const snap = await getDocs(
    query(
      collection(db, 'estudios_paciente'),
      where('seguimientoId', '==', seguimientoId),
      where('estudioId', '==', ESTUDIO_ADICIONAL_ID),
      where('activo', '==', true),
    ),
  )
  return snap.docs.map((d) => {
    const data = d.data()
    return {
      docId: d.id,
      nombre: typeof data.nombre === 'string' ? data.nombre : '',
      letra:
        typeof data.letraMedico === 'string' && data.letraMedico.trim() !== ''
          ? data.letraMedico.trim()
          : null,
    }
  })
}

/* ═══════════════════════════════════════════════════════════════════════════
   ESTILOS REUTILIZABLES
   ═══════════════════════════════════════════════════════════════════════════ */

const labelStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: 'var(--color-texto-suave)',
  display: 'block',
  marginBottom: '4px',
  fontWeight: 500,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  fontSize: '0.8rem',
  padding: '6px 10px',
  border: '1px solid var(--color-borde)',
  borderRadius: '6px',
  backgroundColor: 'var(--color-fondo-card)',
  color: 'var(--color-texto)',
}

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: 'pointer',
}

const cardStyle: React.CSSProperties = {
  background: 'var(--color-fondo-card)',
  border: '1px solid var(--color-borde)',
  borderRadius: '8px',
  padding: '0.75rem',
}

/** Los 20 estudios fijos del paquete (mismos que en la tabla principal). */
const ESTUDIOS_PAQUETE = [
  { id: 1, nombre: 'Laboratorios' },
  { id: 2, nombre: 'Torax' },
  { id: 3, nombre: 'US. Abdomen' },
  { id: 4, nombre: 'US. Mamario' },
  { id: 5, nombre: 'Mastografía' },
  { id: 6, nombre: 'CT' },
  { id: 7, nombre: 'Ortopanto' },
  { id: 8, nombre: 'Densitometría' },
  { id: 9, nombre: 'Espirometría' },
  { id: 19, nombre: 'ECG Y PE' },
  { id: 10, nombre: 'Colposcopía' },
  { id: 11, nombre: 'PaP' },
  { id: 12, nombre: 'Audio' },
  { id: 13, nombre: 'Audiometría' },
  { id: 14, nombre: 'Dental' },
  { id: 15, nombre: 'Oftalmología' },
  { id: 16, nombre: 'Nutrición' },
  { id: 17, nombre: 'Ortopedia' },
  { id: 18, nombre: 'Proctología' },
  { id: 20, nombre: 'Fibroscopía' },
] as const

/* ═══════════════════════════════════════════════════════════════════════════
   TOAST SIMPLE (sin dependencia externa)
   ═══════════════════════════════════════════════════════════════════════════ */

function showToast(message: string, type: 'success' | 'error' = 'success') {
  const el = document.createElement('div')
  el.textContent = message
  Object.assign(el.style, {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    zIndex: '9999',
    padding: '12px 20px',
    borderRadius: '8px',
    fontSize: '0.85rem',
    fontWeight: '600',
    color: '#fff',
    backgroundColor: type === 'success' ? '#00A651' : '#D32F2F',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    transition: 'opacity 0.3s',
  })
  document.body.appendChild(el)
  setTimeout(() => {
    el.style.opacity = '0'
    setTimeout(() => el.remove(), 300)
  }, 3000)
}

/* ═══════════════════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
   ═══════════════════════════════════════════════════════════════════════════ */

function SeguimientoPacientePage() {
  const { seguimientoId } = Route.useParams()
  const router = useRouter()
  const updateListaDiaCache = useUpdatePacienteCache()
  const fechaHoy = formatDateMX(nowMX())
  const { data: pacientesDia = [] } = useListaDia(fechaHoy)

  const { data: medicosFirestore = [] } = useMedicosActivos()
  const { data: estudiosCatalog = [] } = useEstudiosActivos()
  const { map: medicosPorLugar } = useMedicosPorLugarEstudioMap()

  const medicoResolverCtx = useMemo(
    () => ({
      medicosPorLugar,
      medicosCatalog: new Map(
        medicosFirestore.map((m) => [m.id, { id: m.id, letra: m.letra, nombreCompleto: m.nombreCompleto }]),
      ),
    }),
    [medicosPorLugar, medicosFirestore],
  )

  // Médicos Internistas = segundo conjunto (letra vacía o "INTERNISTA")
  const medicosInternistas = useMemo((): MedicoInternista[] => {
    return medicosFirestore
      .filter((m) => esMedicoInternista(m))
      .map((m) => ({
        Medico_id: m.id,
        Nombre_Completo: m.nombreCompleto ?? `Médico #${m.id}`,
        Letra: m.letra,
      }))
  }, [medicosFirestore])

  // Médicos de área con letra real (para estudios fuera del área, p. ej. Lab/CT)
  const medicosConLetra = useMemo((): MedicoEsp[] => {
    return medicosFirestore
      .filter((m) => !esMedicoInternista(m))
      .map((m) => ({
        Medico_id: m.id,
        Nombre_Completo: m.nombreCompleto ?? `Médico #${m.id}`,
        Letra: m.letra,
      }))
  }, [medicosFirestore])

  const getMedicosForEstudioCol = useCallback((estudioColId: number): MedicoEsp[] => {
    const estudio = estudiosCatalog.find((e) => e.id === String(estudioColId))
    // Estudio fuera del área CIDyT: lo interpreta cualquier médico con letra
    if (!estudio?.lugarEstudioId) return medicosConLetra
    return getMedicosPorLugar(estudio.lugarEstudioId, medicoResolverCtx).map((m) => ({
      Medico_id: m.id,
      Nombre_Completo: m.nombreCompleto ?? `Médico #${m.id}`,
      Letra: m.letra,
    }))
  }, [estudiosCatalog, medicoResolverCtx, medicosConLetra])

  function formatMedicoOption(m: { Medico_id: string; Nombre_Completo: string; Letra: string | null }): string {
    return m.Letra ? `${m.Letra} — ${m.Nombre_Completo}` : m.Nombre_Completo
  }

  // Estado principal
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [seguimiento, setSeguimiento] = useState<SeguimientoData | null>(null)
  const [catalogos, setCatalogos] = useState<Catalogos>({ padecimientos: [] })

  // Formulario state
  const [desayuno, setDesayuno] = useState<number>(0)
  const [padecimientoId, setPadecimientoId] = useState<number>(0)
  const [medicoId, setMedicoId] = useState<string | null>(null)
  const [estatusValpac, setEstatusValpac] = useState<number>(0)
  const [peso, setPeso] = useState<string>('')
  const [talla, setTalla] = useState<string>('')
  const [fechaEntrega, setFechaEntrega] = useState<string>('')
  const [horaEntrega, setHoraEntrega] = useState<string>('')
  const [entregados, setEntregados] = useState(false)
  const [enviar, setEnviar] = useState(false)
  const [fechaEnvio, setFechaEnvio] = useState<string>('')
  const [horaEnvio, setHoraEnvio] = useState<string>('')
  const [observaciones, setObservaciones] = useState('')

  // Estudios adicionales (Firestore estudios_paciente con estudioId '100')
  const [adicionales, setAdicionales] = useState<AdicionalItem[]>([])

  // Doc id de val_corporal (para upsert al guardar)
  const [valDocId, setValDocId] = useState<string | null>(null)

  // Estudios del paquete (Firestore estudios_paciente)
  const [epMap, setEpMap] = useState<Record<number, EpCell>>({})

  // Estudios adicionales form
  const [nuevaLetra, setNuevaLetra] = useState('A')
  const [nuevoNombre, setNuevoNombre] = useState('')

  // Cargar estudios del paquete desde Firestore
  useEffect(() => {
    let cancel = false
    loadEstudiosPaciente(seguimientoId)
      .then((map) => { if (!cancel) setEpMap(map) })
      .catch(() => { /* sin datos en Firestore */ })
    return () => { cancel = true }
  }, [seguimientoId])

  // Cargar datos desde Firestore (sin SAP / sin REST)
  useEffect(() => {
    let cancel = false
    async function load() {
      setLoading(true)
      try {
        const db = getFirebaseFirestore()
        const segSnap = await getDoc(doc(db, 'seguimientos', seguimientoId))
        if (!segSnap.exists()) {
          if (!cancel) setSeguimiento(null)
          return
        }
        const seg = segSnap.data()

        const [pacSnap, paqSnap, val, padecimientos, ads] = await Promise.all([
          seg.pacienteId
            ? getDoc(doc(db, 'pacientes', String(seg.pacienteId)))
            : Promise.resolve(null),
          seg.paqueteId
            ? getDoc(doc(db, 'paquetes', String(seg.paqueteId)))
            : Promise.resolve(null),
          fetchValCorporal(seguimientoId),
          fetchPadecimientos(),
          fetchAdicionales(seguimientoId),
        ])
        if (cancel) return

        const pac = pacSnap?.exists() ? pacSnap.data() : undefined
        const data: SeguimientoData = {
          Seguimiento_id: Number(seguimientoId) || 0,
          Nombre_Completo: buildPacienteNombre(pac),
          Edad: calcEdad(pac?.fechaNacimiento) ?? 0,
          Nombre_Paquete: (paqSnap?.exists() ? (paqSnap.data().nombre as string) : '') ?? '',
          Desayuno: (Number(seg.desayuno) || 0) as 0 | 1 | 2,
          Padecimiento_id: Number(seg.padecimientoId) || 0,
          Medico_id: seg.medicoInternistaId != null ? String(seg.medicoInternistaId) : null,
          Estatus_Valpac_id: Number(seg.estatusValpac) || 0,
          Fecha_Ent_Resultados: seg.fechaEntrega ?? null,
          Hora_Ent_Resultados: seg.horaEntrega ?? null,
          Fecha_Envio_Resultados: seg.fechaEnvio ?? null,
          Hora_Envio_Resultados: seg.horaEnvio ?? null,
          Observaciones: seg.observaciones ?? '',
          estudios: [],
          val_corporal: { Peso: val.peso, Talla: val.talla },
        }
        applyData(data, { padecimientos })
        setValDocId(val.docId)
        setAdicionales(ads)
      } catch {
        if (!cancel) setSeguimiento(null)
      } finally {
        if (!cancel) setLoading(false)
      }
    }
    load()
    return () => { cancel = true }
  }, [seguimientoId])

  function applyData(seg: SeguimientoData, cats: Catalogos) {
    setSeguimiento(seg)
    setCatalogos(cats)
    setDesayuno(seg.Desayuno)
    setPadecimientoId(seg.Padecimiento_id)
    setMedicoId(seg.Medico_id != null ? String(seg.Medico_id) : null)
    setEstatusValpac(seg.Estatus_Valpac_id)
    setPeso(seg.val_corporal?.Peso?.toString() ?? '0')
    setTalla(seg.val_corporal?.Talla?.toString() ?? '0')
    setFechaEntrega(cleanDate(seg.Fecha_Ent_Resultados))
    setHoraEntrega(cleanTime(seg.Hora_Ent_Resultados))
    setEntregados(!!seg.Fecha_Ent_Resultados && seg.Fecha_Ent_Resultados !== '0000-00-00')
    setFechaEnvio(cleanDate(seg.Fecha_Envio_Resultados))
    setHoraEnvio(cleanTime(seg.Hora_Envio_Resultados))
    setEnviar(!!seg.Fecha_Envio_Resultados && seg.Fecha_Envio_Resultados !== '0000-00-00')
    setObservaciones(seg.Observaciones ?? '')
  }

  // Guardar seguimiento en Firestore
  const handleGuardar = useCallback(async () => {
    setSaving(true)
    try {
      const db = getFirebaseFirestore()
      const uid = getFirebaseAuth().currentUser?.uid ?? 'system'

      await updateDoc(doc(db, 'seguimientos', seguimientoId), {
        desayuno,
        padecimientoId,
        medicoInternistaId: medicoId,
        estatusValpac,
        fechaEntrega: entregados ? (fechaEntrega || null) : null,
        horaEntrega: entregados && horaEntrega ? `${horaEntrega}:00` : null,
        tarjetaEntRes: entregados ? 1 : 0,
        fechaEnvio: enviar ? (fechaEnvio || null) : null,
        horaEnvio: enviar && horaEnvio ? `${horaEnvio}:00` : null,
        observaciones,
        updatedBy: uid,
        updatedAt: serverTimestamp(),
      })

      const pesoNum = parseFloat(peso) || 0
      const tallaNum = parseFloat(talla) || 0
      if (valDocId) {
        await updateDoc(doc(db, 'val_corporal', valDocId), { peso: pesoNum, talla: tallaNum })
      } else {
        const ref = await addDoc(collection(db, 'val_corporal'), {
          seguimientoId,
          peso: pesoNum,
          talla: tallaNum,
          activo: true,
        })
        setValDocId(ref.id)
      }

      // Reflejar cambios operativos en la cache de Lista del Día
      updateListaDiaCache(fechaHoy, seguimientoId, {
        desayuno: desayuno as 0 | 1 | 2,
        estatusValpac: estatusValpac as 0 | 1 | 2,
        peso: pesoNum,
        talla: tallaNum,
      })

      showToast('Seguimiento guardado exitosamente', 'success')
      setTimeout(() => router.history.back(), 1500)
    } catch {
      showToast('Error al guardar seguimiento', 'error')
    }
    setSaving(false)
  }, [seguimientoId, desayuno, padecimientoId, medicoId, estatusValpac, fechaEntrega, horaEntrega, entregados, enviar, fechaEnvio, horaEnvio, observaciones, peso, talla, valDocId, updateListaDiaCache, fechaHoy, router])

  // Asignar médico al estudio del paquete (Firestore estudios_paciente)
  const handleMedicoEstudioChange = useCallback((estudioColId: number, medicoId: string | null) => {
    const opciones = getMedicosForEstudioCol(estudioColId)
    const letra = medicoId ? (opciones.find((m) => m.Medico_id === medicoId)?.Letra ?? null) : null
    setEpMap((prev) => {
      const current = prev[estudioColId]
      return {
        ...prev,
        [estudioColId]: {
          docId: current?.docId ?? null,
          estatusId: current?.estatusId ?? 0,
          observaciones: current?.observaciones ?? '',
          medicoId,
          letraMedico: letra,
        },
      }
    })
    persistEpField(seguimientoId, estudioColId, epMap[estudioColId], { medicoId, letraMedico: letra })
      .then((docId) => setEpMap((prev) => ({ ...prev, [estudioColId]: { ...prev[estudioColId], docId } })))
      .catch(() => showToast('Error al asignar médico', 'error'))
  }, [seguimientoId, epMap, getMedicosForEstudioCol])

  // Editar observaciones locales del estudio del paquete
  const handleObsEstudioLocal = useCallback((estudioColId: number, value: string) => {
    setEpMap((prev) => {
      const current = prev[estudioColId]
      return {
        ...prev,
        [estudioColId]: {
          docId: current?.docId ?? null,
          estatusId: current?.estatusId ?? 0,
          medicoId: current?.medicoId ?? null,
          letraMedico: current?.letraMedico ?? null,
          observaciones: value,
        },
      }
    })
  }, [])

  // Guardar observaciones del estudio del paquete (onBlur)
  const handleObsEstudioSave = useCallback((estudioColId: number) => {
    const current = epMap[estudioColId]
    persistEpField(seguimientoId, estudioColId, current, { observaciones: current?.observaciones ?? '' })
      .then((docId) => setEpMap((prev) => ({ ...prev, [estudioColId]: { ...prev[estudioColId], docId } })))
      .catch(() => showToast('Error al guardar observaciones', 'error'))
  }, [seguimientoId, epMap])

  // Agregar estudio adicional (Firestore estudios_paciente, estudioId '100')
  const handleAgregarAdicional = useCallback(async () => {
    if (!nuevoNombre.trim()) return

    // La letra de un estudio adicional no puede repetirse entre pacientes el mismo día
    const letrasUsadas = new Set<string>()
    for (const p of pacientesDia) {
      if (p.seguimientoId === seguimientoId) continue
      for (const ea of p.estudiosAdicionales ?? []) {
        if (ea.letraEstAdic) letrasUsadas.add(ea.letraEstAdic.trim().toUpperCase())
      }
    }
    if (letrasUsadas.has(nuevaLetra.trim().toUpperCase())) {
      showToast(`La letra ${nuevaLetra} ya está asignada a otro paciente hoy.`, 'error')
      return
    }

    try {
      const db = getFirebaseFirestore()
      const ref = await addDoc(collection(db, 'estudios_paciente'), {
        seguimientoId,
        estudioId: ESTUDIO_ADICIONAL_ID,
        estatusEstudioId: '2',
        medicoId: null,
        letraMedico: nuevaLetra,
        observaciones: '',
        nombre: nuevoNombre.trim(),
        activo: true,
      })
      setAdicionales((prev) => [...prev, { docId: ref.id, nombre: nuevoNombre.trim(), letra: nuevaLetra }])
      setNuevoNombre('')
      showToast('Estudio adicional agregado', 'success')
    } catch {
      showToast('Error al agregar estudio adicional', 'error')
    }
  }, [seguimientoId, nuevaLetra, nuevoNombre, pacientesDia])

  // Eliminar estudio adicional (soft delete: activo = false)
  const handleEliminarAdicional = useCallback(async (docId: string) => {
    try {
      const db = getFirebaseFirestore()
      await updateDoc(doc(db, 'estudios_paciente', docId), { activo: false })
      setAdicionales((prev) => prev.filter((a) => a.docId !== docId))
    } catch {
      showToast('Error al eliminar estudio adicional', 'error')
    }
  }, [])

  const estudiosAdicionales = adicionales

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="text-[var(--color-texto-suave)] text-sm">Cargando seguimiento...</span>
      </div>
    )
  }

  if (!seguimiento) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="text-[var(--color-texto-suave)] text-sm">Seguimiento no encontrado.</span>
      </div>
    )
  }

  return (
    <div style={{ fontSize: '0.8rem' }}>
      <h1 className="page-title">Paciente — Seguimiento #{seguimientoId}</h1>

      {/* Card azul oscura del paciente (header) */}
      <div style={{
        background: 'var(--color-primario)',
        border: '2px solid var(--color-acento)',
        borderRadius: '8px',
        padding: '1rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1.25rem',
      }}>
        <div>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: '1.1rem' }}>
            {seguimiento.Nombre_Completo}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.92)', fontSize: '0.8rem', marginTop: '2px' }}>
            {seguimiento.Edad} años • {seguimiento.Nombre_Paquete}
          </div>
        </div>
        <Button
          onClick={handleGuardar}
          disabled={saving}
          style={{
            backgroundColor: 'var(--color-acento)',
            color: '#fff',
            fontWeight: 700,
            borderRadius: '6px',
            padding: '8px 16px',
            fontSize: '0.8rem',
            boxShadow: '0 2px 8px rgba(0,166,81,0.3)',
            border: 'none',
            cursor: saving ? 'wait' : 'pointer',
            opacity: saving ? 0.7 : 1,
          }}
        >
          💾 {saving ? 'Guardando...' : 'Guardar Seguimiento'}
        </Button>
      </div>

      {/* Grid de 4 cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>

        {/* Card 1 — Estado General */}
        <div style={cardStyle}>
          <h3 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '12px', color: 'var(--color-texto)' }}>Estado General</h3>

          <div style={{ marginBottom: '12px' }}>
            <label style={labelStyle}>Paciente listo para salir</label>
            <select
              style={selectStyle}
              value={estatusValpac}
              onChange={(e) => {
                const val = Number(e.target.value)
                setEstatusValpac(val)
                updateListaDiaCache(fechaHoy, seguimientoId, { estatusValpac: val as 0 | 1 | 2 })
              }}
            >
              <option value={0}>No</option>
              <option value={1}>Si</option>
              <option value={2}>Paciente Terminó su visita</option>
            </select>
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={labelStyle}>Desayuno</label>
            <select
              style={selectStyle}
              value={desayuno}
              onChange={(e) => {
                const val = Number(e.target.value) as 0 | 1 | 2
                setDesayuno(val)
                updateListaDiaCache(fechaHoy, seguimientoId, { desayuno: val })
              }}
            >
              <option value={0}>NO</option>
              <option value={1}>EN PROCESO</option>
              <option value={2}>SÍ</option>
            </select>
          </div>

          <div>
            <label style={labelStyle}>Padecimiento</label>
            <select
              style={selectStyle}
              value={padecimientoId}
              onChange={(e) => setPadecimientoId(Number(e.target.value))}
            >
              <option value={0}>Ninguno</option>
              {catalogos.padecimientos.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Card 2 — Médico y Antropometría */}
        <div style={cardStyle}>
          <h3 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '12px', color: 'var(--color-texto)' }}>Médico y Antropometría</h3>

          <div style={{ marginBottom: '12px' }}>
            <label style={labelStyle}>Médico Internista</label>
            <select
              style={selectStyle}
              value={medicoId ?? ''}
              onChange={(e) => setMedicoId(e.target.value || null)}
            >
              <option value="">-- Sin asignar --</option>
              {medicosInternistas.map((m) => (
                <option key={m.Medico_id} value={m.Medico_id}>{formatMedicoOption(m)}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={labelStyle}>Peso (kg)</label>
            <input
              type="number"
              step="0.01"
              placeholder="72.5"
              style={inputStyle}
              value={peso}
              onChange={(e) => setPeso(e.target.value)}
            />
          </div>

          <div>
            <label style={labelStyle}>Talla (cm)</label>
            <input
              type="number"
              step="0.01"
              placeholder="170"
              style={inputStyle}
              value={talla}
              onChange={(e) => setTalla(e.target.value)}
            />
          </div>
        </div>

        {/* Card 3 — Resultados */}
        <div style={cardStyle}>
          <h3 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '12px', color: 'var(--color-texto)' }}>Resultados</h3>

          <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              id="chk-entregados"
              checked={entregados}
              onChange={(e) => setEntregados(e.target.checked)}
              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
            />
            <label htmlFor="chk-entregados" style={{ fontSize: '0.8rem', cursor: 'pointer' }}>Entregados</label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
            <div>
              <label style={labelStyle}>Fecha</label>
              <input type="date" style={inputStyle} value={fechaEntrega} onChange={(e) => setFechaEntrega(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Hora</label>
              <input type="time" style={inputStyle} value={horaEntrega} onChange={(e) => setHoraEntrega(e.target.value)} />
            </div>
          </div>

          <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              id="chk-enviar"
              checked={enviar}
              onChange={(e) => setEnviar(e.target.checked)}
              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
            />
            <label htmlFor="chk-enviar" style={{ fontSize: '0.8rem', cursor: 'pointer' }}>Enviar</label>
          </div>

          {enviar && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div>
                <label style={labelStyle}>Fecha</label>
                <input type="date" style={inputStyle} value={fechaEnvio} onChange={(e) => setFechaEnvio(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Hora</label>
                <input type="time" style={inputStyle} value={horaEnvio} onChange={(e) => setHoraEnvio(e.target.value)} />
              </div>
            </div>
          )}
        </div>

        {/* Card 4 — Est. Adicionales */}
        <div style={cardStyle}>
          <h3 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '12px', color: 'var(--color-texto)' }}>Est. Adicionales</h3>

          <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr', gap: '8px', marginBottom: '8px' }}>
            <div>
              <label style={labelStyle}>Letra</label>
              <select style={selectStyle} value={nuevaLetra} onChange={(e) => setNuevaLetra(e.target.value)}>
                {'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Nombre del Estudio</label>
              <input
                type="text"
                style={inputStyle}
                placeholder="VIT. B 12, VITA D..."
                value={nuevoNombre}
                onChange={(e) => setNuevoNombre(e.target.value)}
              />
            </div>
          </div>

          <button
            onClick={handleAgregarAdicional}
            style={{ width: '100%', padding: '6px', fontSize: '0.8rem', fontWeight: 600, color: '#fff', backgroundColor: '#00A651', borderRadius: '6px', border: 'none', cursor: 'pointer', marginBottom: '10px' }}
          >
            + Agregar
          </button>

          {/* Lista de adicionales existentes */}
          {estudiosAdicionales.length === 0 ? (
            <p style={{ fontSize: '0.75rem', color: 'var(--color-texto-suave)', textAlign: 'center' }}>Sin estudios adicionales</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {estudiosAdicionales.map((ea) => (
                <div key={ea.docId} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f3f4f6', borderRadius: '4px', padding: '4px 8px' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.75rem', color: 'var(--color-primario)' }}>{ea.letra}</span>
                  <span style={{ flex: 1, fontSize: '0.75rem' }}>{ea.nombre}</span>
                  <button
                    onClick={() => handleEliminarAdicional(ea.docId)}
                    style={{ background: 'none', border: 'none', color: '#D32F2F', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}
                    title="Eliminar"
                  >✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tabla "Estudios del Paquete" */}
      <div style={{ marginBottom: '1.25rem' }}>
        <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-texto)', marginBottom: '8px' }}>Estudios del Paquete</h3>
        <div style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--color-borde)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ background: 'var(--color-primario)' }}>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: '#fff', fontWeight: 600, fontSize: '0.75rem', width: '140px' }}>Estudio</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: '#fff', fontWeight: 600, fontSize: '0.75rem' }}>Médico</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: '#fff', fontWeight: 600, fontSize: '0.75rem', width: '240px' }}>Observaciones</th>
              </tr>
            </thead>
            <tbody>
              {ESTUDIOS_PAQUETE.map((estCol, idx) => {
                const cell = epMap[estCol.id]
                const medicosDisponibles = getMedicosForEstudioCol(estCol.id)

                return (
                  <tr key={estCol.id} style={{ background: idx % 2 === 0 ? 'var(--color-fondo)' : 'var(--color-fondo-card)' }}>
                    <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--color-borde)', fontWeight: 500 }}>
                      {estCol.nombre}
                    </td>
                    <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--color-borde)' }}>
                      <select
                        style={{ ...selectStyle, fontSize: '0.75rem' }}
                        value={cell?.medicoId ?? ''}
                        onChange={(e) => handleMedicoEstudioChange(estCol.id, e.target.value || null)}
                        disabled={medicosDisponibles.length === 0}
                      >
                        <option value="">—</option>
                        {medicosDisponibles.map((m) => (
                          <option key={m.Medico_id} value={m.Medico_id}>{formatMedicoOption(m)}</option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--color-borde)' }}>
                      <input
                        type="text"
                        style={{ ...inputStyle, fontSize: '0.75rem' }}
                        value={cell?.observaciones ?? ''}
                        placeholder=""
                        onChange={(e) => handleObsEstudioLocal(estCol.id, e.target.value)}
                        onBlur={() => handleObsEstudioSave(estCol.id)}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
