import { createLazyFileRoute, useRouter } from '@tanstack/react-router'
import { useState, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { getFirebaseAuth } from '@/lib/firebase'
import { useUpdatePacienteCache } from '@/hooks/use-lista-dia'
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
  Medico_id: number | null
  Letra_Est_Adic: string | null
  Activo: number
}

interface MedicoEsp {
  Medico_id: number
  Nombre_Completo: string
  Especialidad_id: number
}

interface Padecimiento {
  id: number
  nombre: string
}

interface MedicoInternista {
  Medico_id: number
  Nombre_Completo: string
}

interface SeguimientoData {
  Seguimiento_id: number
  Nombre_Completo: string
  Edad: number
  Nombre_Paquete: string
  Desayuno: 0 | 1 | 2
  Padecimiento_id: number
  Medico_id: number | null
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
  medicos_internistas: MedicoInternista[]
  medico_esp: MedicoEsp[]
}

/* ═══════════════════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */

const API_BASE = import.meta.env.VITE_API_URL ?? ''

async function authHeaders(): Promise<HeadersInit> {
  const user = getFirebaseAuth().currentUser
  if (!user) return { 'Content-Type': 'application/json' }
  const token = await user.getIdToken()
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
}

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
   DATOS HARDCODEADOS (para desarrollo sin backend)
   ═══════════════════════════════════════════════════════════════════════════ */

const MOCK_CATALOGOS: Catalogos = {
  padecimientos: [
    { id: 1, nombre: 'Diabetes' },
    { id: 2, nombre: 'Hipertensión' },
    { id: 3, nombre: 'Asma' },
  ],
  medicos_internistas: [
    { Medico_id: 1, Nombre_Completo: 'NEGREROS BALVANERA FABIOLA' },
    { Medico_id: 2, Nombre_Completo: 'GARCIA LOPEZ ROBERTO' },
    { Medico_id: 3, Nombre_Completo: 'MARTINEZ SOTO ANA' },
  ],
  medico_esp: [
    { Medico_id: 10, Nombre_Completo: 'DR. LABORATORIOS A', Especialidad_id: 1 },
    { Medico_id: 11, Nombre_Completo: 'DR. TORAX A', Especialidad_id: 2 },
    { Medico_id: 12, Nombre_Completo: 'DR. ABDOMEN A', Especialidad_id: 3 },
    { Medico_id: 13, Nombre_Completo: 'DR. MAMARIO A', Especialidad_id: 4 },
    { Medico_id: 14, Nombre_Completo: 'DR. MASTOGRAFIA A', Especialidad_id: 5 },
    { Medico_id: 15, Nombre_Completo: 'DR. OFTALMOLOGIA A', Especialidad_id: 15 },
  ],
}

function getMockSeguimiento(id: string): SeguimientoData {
  return {
    Seguimiento_id: Number(id),
    Nombre_Completo: 'ALFREDO CANO JAUREGUI SEGURA MILLAN',
    Edad: 41,
    Nombre_Paquete: 'CHECK UP CIDYT D',
    Desayuno: 0,
    Padecimiento_id: 0,
    Medico_id: 1,
    Estatus_Valpac_id: 0,
    Fecha_Ent_Resultados: '2025-12-31',
    Hora_Ent_Resultados: '10:30:00',
    Fecha_Envio_Resultados: null,
    Hora_Envio_Resultados: null,
    Observaciones: '',
    estudios: [
      { Estudio_Realizar_id: 1001, Estudio_id: 1, Nombre: 'Laboratorios', Estatus_Est_id: 4, Observaciones: '', Medico_id: 10, Letra_Est_Adic: null, Activo: 1 },
      { Estudio_Realizar_id: 1002, Estudio_id: 2, Nombre: 'Torax', Estatus_Est_id: 4, Observaciones: '', Medico_id: 11, Letra_Est_Adic: null, Activo: 1 },
      { Estudio_Realizar_id: 1003, Estudio_id: 3, Nombre: 'US. Abdomen', Estatus_Est_id: 2, Observaciones: '', Medico_id: null, Letra_Est_Adic: null, Activo: 1 },
      { Estudio_Realizar_id: 1004, Estudio_id: 7, Nombre: 'Ortopantomografía', Estatus_Est_id: 4, Observaciones: '', Medico_id: null, Letra_Est_Adic: null, Activo: 1 },
      { Estudio_Realizar_id: 1005, Estudio_id: 15, Nombre: 'Oftalmología', Estatus_Est_id: 4, Observaciones: 'Sin observaciones', Medico_id: 15, Letra_Est_Adic: null, Activo: 1 },
      { Estudio_Realizar_id: 1006, Estudio_id: 100, Nombre: 'VIT. B 12, VITA D', Estatus_Est_id: 2, Observaciones: '', Medico_id: null, Letra_Est_Adic: 'A', Activo: 1 },
    ],
    val_corporal: { Peso: 0, Talla: 0 },
  }
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

  // Estado principal
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [seguimiento, setSeguimiento] = useState<SeguimientoData | null>(null)
  const [catalogos, setCatalogos] = useState<Catalogos>(MOCK_CATALOGOS)

  // Formulario state
  const [desayuno, setDesayuno] = useState<number>(0)
  const [padecimientoId, setPadecimientoId] = useState<number>(0)
  const [medicoId, setMedicoId] = useState<number | null>(null)
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

  // Estudios state
  const [estudios, setEstudios] = useState<EstudioRealizar[]>([])

  // Estudios adicionales form
  const [nuevaLetra, setNuevaLetra] = useState('A')
  const [nuevoNombre, setNuevoNombre] = useState('')

  // Cargar datos
  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const headers = await authHeaders()
        const res = await fetch(`${API_BASE}/api/seguimiento/${seguimientoId}`, { headers })
        if (res.ok) {
          const data = await res.json()
          applyData(data.seguimiento, data.catalogos)
        } else {
          // Fallback a mock
          applyData(getMockSeguimiento(seguimientoId), MOCK_CATALOGOS)
        }
      } catch {
        // Fallback a mock
        applyData(getMockSeguimiento(seguimientoId), MOCK_CATALOGOS)
      }
      setLoading(false)
    }
    load()
  }, [seguimientoId])

  function applyData(seg: SeguimientoData, cats: Catalogos) {
    setSeguimiento(seg)
    setCatalogos(cats)
    setDesayuno(seg.Desayuno)
    setPadecimientoId(seg.Padecimiento_id)
    setMedicoId(seg.Medico_id)
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
    setEstudios(seg.estudios.filter((e) => e.Activo === 1))
  }

  // Guardar seguimiento
  const handleGuardar = useCallback(async () => {
    setSaving(true)
    try {
      const headers = await authHeaders()
      const body = {
        Desayuno: desayuno,
        Padecimiento_id: padecimientoId,
        Medico_id: medicoId,
        Estatus_Valpac_id: estatusValpac,
        Fecha_Ent_Resultados: fechaEntrega || null,
        Hora_Ent_Resultados: horaEntrega ? `${horaEntrega}:00` : null,
        EntregaRes: entregados ? 1 : 0,
        EnviaRes: enviar ? 1 : 0,
        Fecha_Envio_Resultados: fechaEnvio || null,
        Hora_Envio_Resultados: horaEnvio ? `${horaEnvio}:00` : null,
        Observaciones: observaciones,
        Peso: parseFloat(peso) || 0,
        Talla: parseFloat(talla) || 0,
      }
      const res = await fetch(`${API_BASE}/api/seguimiento/${seguimientoId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(body),
      })
      if (res.ok) {
        showToast('Seguimiento guardado exitosamente', 'success')
        setTimeout(() => router.history.back(), 1500)
      } else {
        showToast('Error al guardar seguimiento', 'error')
      }
    } catch {
      showToast('Error de conexión', 'error')
    }
    setSaving(false)
  }, [seguimientoId, desayuno, padecimientoId, medicoId, estatusValpac, fechaEntrega, horaEntrega, entregados, enviar, fechaEnvio, horaEnvio, observaciones, peso, talla, router])

  // Guardar estudio individual (médico + observaciones)
  const handleEstudioSave = useCallback(async (estudioRealizarId: number, medId: number | null, obs: string) => {
    try {
      const headers = await authHeaders()
      await fetch(`${API_BASE}/api/estudios/${estudioRealizarId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ Observaciones: obs, Medico_id: medId }),
      })
    } catch {
      // silently fail for now
    }
  }, [])

  // Agregar estudio adicional
  const handleAgregarAdicional = useCallback(async () => {
    if (!nuevoNombre.trim()) return
    try {
      const headers = await authHeaders()
      const res = await fetch(`${API_BASE}/api/seguimiento/${seguimientoId}/estudios-adicionales`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ Letra_Est_Adic: nuevaLetra, Nombre: nuevoNombre.trim() }),
      })
      if (res.ok) {
        const created = await res.json()
        setEstudios((prev) => [...prev, { ...created, Activo: 1, Estudio_id: 100 }])
        setNuevoNombre('')
        showToast('Estudio adicional agregado', 'success')
      }
    } catch {
      // Optimistic add for mock
      const mockId = Date.now()
      setEstudios((prev) => [...prev, {
        Estudio_Realizar_id: mockId,
        Estudio_id: 100,
        Nombre: nuevoNombre.trim(),
        Estatus_Est_id: 2,
        Observaciones: '',
        Medico_id: null,
        Letra_Est_Adic: nuevaLetra,
        Activo: 1,
      }])
      setNuevoNombre('')
      showToast('Estudio adicional agregado (local)', 'success')
    }
  }, [seguimientoId, nuevaLetra, nuevoNombre])

  // Eliminar estudio adicional
  const handleEliminarAdicional = useCallback(async (estudioRealizarId: number) => {
    try {
      const headers = await authHeaders()
      await fetch(`${API_BASE}/api/seguimiento/${seguimientoId}/estudios-adicionales?estudio_realizar_id=${estudioRealizarId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ Activo: 0 }),
      })
    } catch {
      // continue
    }
    setEstudios((prev) => prev.filter((e) => e.Estudio_Realizar_id !== estudioRealizarId))
  }, [seguimientoId])

  // Update estudio local state
  const updateEstudioLocal = useCallback((id: number, field: 'Medico_id' | 'Observaciones', value: number | string | null) => {
    setEstudios((prev) => prev.map((e) => e.Estudio_Realizar_id === id ? { ...e, [field]: value } : e))
  }, [])

  // Derivados
  const estudiosRegulares = estudios.filter((e) => e.Estudio_id !== 100)
  const estudiosAdicionales = estudios.filter((e) => e.Estudio_id === 100)

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
              onChange={(e) => setMedicoId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">-- Sin asignar --</option>
              {catalogos.medicos_internistas.map((m) => (
                <option key={m.Medico_id} value={m.Medico_id}>{m.Nombre_Completo}</option>
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
                <div key={ea.Estudio_Realizar_id} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f3f4f6', borderRadius: '4px', padding: '4px 8px' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.75rem', color: 'var(--color-primario)' }}>{ea.Letra_Est_Adic}</span>
                  <span style={{ flex: 1, fontSize: '0.75rem' }}>{ea.Nombre}</span>
                  <button
                    onClick={() => handleEliminarAdicional(ea.Estudio_Realizar_id)}
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
                <th style={{ padding: '10px 12px', textAlign: 'left', color: '#fff', fontWeight: 600, fontSize: '0.75rem' }}>Médico Internista</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: '#fff', fontWeight: 600, fontSize: '0.75rem', width: '240px' }}>Observaciones</th>
              </tr>
            </thead>
            <tbody>
              {ESTUDIOS_PAQUETE.map((estCol, idx) => {
                // Buscar si hay un estudio_realizar para este Estudio_id
                const estData = estudiosRegulares.find((e) => e.Estudio_id === estCol.id)
                // Filtrar médicos por especialidad (Especialidad_id = Estudio_id)
                const medicosEsp = catalogos.medico_esp.filter((m) => m.Especialidad_id === estCol.id)
                const medicosDisponibles = medicosEsp.length > 0 ? medicosEsp : catalogos.medico_esp

                return (
                  <tr key={estCol.id} style={{ background: idx % 2 === 0 ? 'var(--color-fondo)' : 'var(--color-fondo-card)' }}>
                    <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--color-borde)', fontWeight: 500 }}>
                      {estCol.nombre}
                    </td>
                    <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--color-borde)' }}>
                      <select
                        style={{ ...selectStyle, fontSize: '0.75rem' }}
                        value={estData?.Medico_id ?? ''}
                        onChange={(e) => {
                          const val = e.target.value ? Number(e.target.value) : null
                          if (estData) {
                            updateEstudioLocal(estData.Estudio_Realizar_id, 'Medico_id', val)
                            handleEstudioSave(estData.Estudio_Realizar_id, val, estData.Observaciones)
                          }
                        }}
                      >
                        <option value="">—</option>
                        {medicosDisponibles.map((m) => (
                          <option key={m.Medico_id} value={m.Medico_id}>{m.Nombre_Completo}</option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--color-borde)' }}>
                      <input
                        type="text"
                        style={{ ...inputStyle, fontSize: '0.75rem' }}
                        value={estData?.Observaciones ?? ''}
                        placeholder=""
                        onChange={(e) => {
                          if (estData) updateEstudioLocal(estData.Estudio_Realizar_id, 'Observaciones', e.target.value)
                        }}
                        onBlur={() => {
                          if (estData) handleEstudioSave(estData.Estudio_Realizar_id, estData.Medico_id, estData.Observaciones)
                        }}
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
