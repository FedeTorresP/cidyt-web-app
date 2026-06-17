import { createLazyFileRoute } from '@tanstack/react-router'
import { useState, useCallback, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import {
  useCajaDetalle,
  useGuardarFactura,
  useEliminarFactura,
  useConfirmarEgreso,
} from '@/hooks/use-caja-detalle'
import type { FacturaCaja } from '@/hooks/use-caja-detalle'

export const Route = createLazyFileRoute('/_authenticated/caja_/$seguimientoId')({
  component: CajaDetallePage,
})

/* ═══════════════════════════════════════════════════════════════════════════
   CONSTANTES DE ESTATUS (para estudios adicionales)
   ═══════════════════════════════════════════════════════════════════════════ */

const ESTATUS_NOMBRES: Record<number, string> = {
  0: 'Sin Estatus',
  1: 'No Incluido',
  2: 'En Espera',
  3: 'En Proceso',
  4: 'Completo',
  5: 'Pendiente',
  6: 'No Acepta',
  7: 'Cambio Estudio',
  8: 'Estudio Combinado',
}

/* ═══════════════════════════════════════════════════════════════════════════
   ESTILOS REUTILIZABLES
   ═══════════════════════════════════════════════════════════════════════════ */

const cardStyle: React.CSSProperties = {
  background: '#f9fafb',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  padding: '1rem 1.25rem',
  marginBottom: '1.5rem',
}

const sectionTitleStyle: React.CSSProperties = {
  fontSize: '1rem',
  fontWeight: 700,
  color: '#1f2937',
  marginBottom: '0.75rem',
  paddingBottom: '0.5rem',
  borderBottom: '2px solid var(--color-primario, #0b2340)',
}

const labelStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  fontWeight: 600,
  color: '#374151',
  display: 'block',
  marginBottom: '4px',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  fontSize: '0.875rem',
  padding: '0.4rem 0.6rem',
  border: '1px solid #d1d5db',
  borderRadius: '4px',
  backgroundColor: '#ffffff',
  color: '#1f2937',
}

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: 'pointer',
}

const gridRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '140px 1fr',
  gap: '0.5rem',
  alignItems: 'center',
  marginBottom: '0.5rem',
}

/** Formatea fecha YYYY-MM-DD → "dd de MMMM de yyyy" (es-MX) */
function formatFechaNac(fecha: string | null): string {
  if (!fecha) return '—'
  try {
    const d = new Date(fecha + 'T00:00:00')
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })
  } catch {
    return fecha
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   FORM STATE — Factura
   ═══════════════════════════════════════════════════════════════════════════ */

interface FacturaFormState {
  facturaId: string | null // null = nueva, string = editando
  facturaNo: string
  ctaPac: string
  tipoServicioId: string
  tipoFactura: string
  empresa: string
  empresaId: string
  promotorId: string
  descripcion1: string
  observaciones: string
}

const EMPTY_FORM: FacturaFormState = {
  facturaId: null,
  facturaNo: '',
  ctaPac: '',
  tipoServicioId: '1',
  tipoFactura: '0',
  empresa: '',
  empresaId: '',
  promotorId: '',
  descripcion1: '',
  observaciones: '',
}

function facturaToForm(f: FacturaCaja): FacturaFormState {
  return {
    facturaId: f.facturaId,
    facturaNo: f.facturaNo?.toString() ?? '',
    ctaPac: '',
    tipoServicioId: f.tipoServicioId?.toString() ?? '1',
    tipoFactura: f.tipoFactura?.toString() ?? '0',
    empresa: f.empresa ?? '',
    empresaId: f.empresaId?.toString() ?? '',
    promotorId: f.promotorId ?? '',
    descripcion1: f.descripcion1 ?? '',
    observaciones: f.observaciones ?? '',
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL — CajaDetallePage
   ═══════════════════════════════════════════════════════════════════════════ */

function CajaDetallePage() {
  const { seguimientoId } = Route.useParams()
  const { data, isLoading, error } = useCajaDetalle(seguimientoId)
  const guardarFactura = useGuardarFactura()
  const eliminarFactura = useEliminarFactura()
  const confirmarEgreso = useConfirmarEgreso()

  const topRef = useRef<HTMLDivElement>(null)

  // Form state
  const [form, setForm] = useState<FacturaFormState>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Feedback banners
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Auto-load first factura on initial mount
  const didAutoLoad = useRef(false)
  useEffect(() => {
    if (data && data.facturas.length > 0 && !didAutoLoad.current) {
      didAutoLoad.current = true
      const first = data.facturas[0]
      setForm(facturaToForm(first))
      setEditingId(first.facturaId)
    }
  }, [data])

  // Clear messages after timeout
  useEffect(() => {
    if (successMsg) {
      const t = setTimeout(() => setSuccessMsg(null), 4000)
      return () => clearTimeout(t)
    }
  }, [successMsg])
  useEffect(() => {
    if (errorMsg) {
      const t = setTimeout(() => setErrorMsg(null), 5000)
      return () => clearTimeout(t)
    }
  }, [errorMsg])

  // Handlers
  const updateField = useCallback(<K extends keyof FacturaFormState>(key: K, value: FacturaFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }, [])

  const handleGuardar = useCallback(async () => {
    setErrorMsg(null)
    setSuccessMsg(null)
    try {
      await guardarFactura.mutateAsync({
        seguimientoId,
        facturaId: form.facturaId ?? undefined,
        facturaNo: form.facturaNo ? Number(form.facturaNo) : null,
        ctaPac: form.ctaPac ? Number(form.ctaPac) : null,
        tipoServicioId: form.tipoServicioId ? Number(form.tipoServicioId) : null,
        tipoFactura: form.tipoFactura ? Number(form.tipoFactura) : null,
        empresa: form.empresa || null,
        empresaId: form.empresaId ? Number(form.empresaId) : null,
        promotorId: form.promotorId || null,
        descripcion1: form.descripcion1 || null,
        observaciones: form.observaciones || null,
      })
      setSuccessMsg(form.facturaId ? 'Factura actualizada exitosamente.' : 'Factura guardada exitosamente.')
      setForm(EMPTY_FORM)
      setEditingId(null)
    } catch {
      setErrorMsg('Error al guardar la factura. Intente nuevamente.')
    }
  }, [form, seguimientoId, guardarFactura])

  const handleCancelEdit = useCallback(() => {
    setForm(EMPTY_FORM)
    setEditingId(null)
  }, [])

  const handleEditFactura = useCallback((f: FacturaCaja) => {
    setForm(facturaToForm(f))
    setEditingId(f.facturaId)
    topRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  const handleEliminar = useCallback(async (facturaId: string) => {
    if (!confirm('¿Está seguro que desea eliminar esta factura?')) return
    setErrorMsg(null)
    try {
      await eliminarFactura.mutateAsync({ seguimientoId, facturaId })
      setSuccessMsg('Factura eliminada.')
      if (editingId === facturaId) {
        setForm(EMPTY_FORM)
        setEditingId(null)
      }
    } catch {
      setErrorMsg('Error al eliminar la factura.')
    }
  }, [seguimientoId, eliminarFactura, editingId])

  const handleConfirmarEgreso = useCallback(async () => {
    if (!confirm('¿Confirmar el retiro del paciente? Esta acción no se puede deshacer.')) return
    setErrorMsg(null)
    try {
      await confirmarEgreso.mutateAsync({ seguimientoId })
      setSuccessMsg('Paciente egresado exitosamente.')
    } catch {
      setErrorMsg('Error al confirmar egreso.')
    }
  }, [seguimientoId, confirmarEgreso])

  // Loading / Error states
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="text-[var(--color-texto-suave)] text-sm">Cargando detalle de caja...</span>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="text-[#D32F2F] text-sm">Error al cargar los datos del seguimiento.</span>
      </div>
    )
  }

  const { seguimiento: seg, estudiosAdicionales, facturas, promotores } = data

  return (
    <div ref={topRef} style={{ maxWidth: '900px', margin: '0 auto', fontSize: '0.875rem' }}>
      {/* ── Header ── */}
      <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1f2937', marginBottom: '0.25rem' }}>
        Caja y Facturación
      </h1>
      <p style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
        Paciente: <strong style={{ color: '#1f2937' }}>{seg.nombre}</strong> | Seguimiento #{seg.seguimientoId}
      </p>

      {/* ── Feedback Banners ── */}
      {successMsg && (
        <div role="status" style={{ padding: '0.75rem 1rem', marginBottom: '1rem', borderRadius: '6px', backgroundColor: '#f0fdf4', border: '1px solid #86efac', color: '#166534', fontSize: '0.85rem', fontWeight: 500 }}>
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div role="alert" style={{ padding: '0.75rem 1rem', marginBottom: '1rem', borderRadius: '6px', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b', fontSize: '0.85rem', fontWeight: 500 }}>
          {errorMsg}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
         SECCIÓN: Información del Paciente
         ═══════════════════════════════════════════════════════════════════ */}
      <div style={cardStyle}>
        <h2 style={sectionTitleStyle}>Información del Paciente</h2>
        <div style={gridRowStyle}>
          <span style={labelStyle}>Historia:</span>
          <span>{seg.historia ?? '—'}</span>
        </div>
        <div style={gridRowStyle}>
          <span style={labelStyle}>Nombre Completo:</span>
          <span style={{ fontWeight: 600 }}>{seg.nombre}</span>
        </div>
        <div style={gridRowStyle}>
          <span style={labelStyle}>Fecha de Nacimiento:</span>
          <span>{formatFechaNac(seg.fechaNac)}</span>
        </div>
        <div style={gridRowStyle}>
          <span style={labelStyle}>Género:</span>
          <span>{seg.genero === 'm' ? 'Masculino' : seg.genero === 'f' ? 'Femenino' : '—'}</span>
        </div>
        <div style={gridRowStyle}>
          <span style={labelStyle}>Paquete:</span>
          <span>{seg.paqueteNombre ?? '—'}</span>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
         SECCIÓN 1: Datos Factura (Formulario)
         ═══════════════════════════════════════════════════════════════════ */}
      <div style={cardStyle}>
        <h2 style={sectionTitleStyle}>1. Datos Factura</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          {/* Factura No. */}
          <div>
            <label style={labelStyle}>Factura No.</label>
            <input
              type="number"
              placeholder="Ej: 12345"
              style={inputStyle}
              value={form.facturaNo}
              onChange={(e) => updateField('facturaNo', e.target.value)}
            />
          </div>
          {/* Cta. Paciente */}
          <div>
            <label style={labelStyle}>Cta. Paciente</label>
            <input
              type="number"
              placeholder="Numero de cuenta"
              style={inputStyle}
              value={form.ctaPac}
              onChange={(e) => updateField('ctaPac', e.target.value)}
            />
          </div>
          {/* Tipo de Servicio */}
          <div>
            <label style={labelStyle}>Tipo de Servicio</label>
            <select style={selectStyle} value={form.tipoServicioId} onChange={(e) => updateField('tipoServicioId', e.target.value)}>
              <option value="1">Particular</option>
              <option value="2">Empresa</option>
            </select>
          </div>
          {/* Tipo de Factura */}
          <div>
            <label style={labelStyle}>Tipo de Factura</label>
            <select style={selectStyle} value={form.tipoFactura} onChange={(e) => updateField('tipoFactura', e.target.value)}>
              <option value="0">Sin Asignar</option>
              <option value="1">Check Up</option>
              <option value="2">Estudio Adicional</option>
            </select>
          </div>

          {/* Empresa (nombre) */}
          <div>
            <label style={labelStyle}>Empresa (nombre)</label>
            <input
              type="text"
              maxLength={50}
              style={inputStyle}
              value={form.empresa}
              onChange={(e) => updateField('empresa', e.target.value)}
            />
          </div>
          {/* Empresa ID */}
          <div>
            <label style={labelStyle}>Empresa ID</label>
            <input
              type="number"
              style={inputStyle}
              value={form.empresaId}
              onChange={(e) => updateField('empresaId', e.target.value)}
            />
          </div>
          {/* Promotor */}
          <div>
            <label style={labelStyle}>Promotor</label>
            <select style={selectStyle} value={form.promotorId} onChange={(e) => updateField('promotorId', e.target.value)}>
              <option value="">-- Sin promotor --</option>
              {promotores.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </div>
          {/* Descripcion */}
          <div>
            <label style={labelStyle}>Descripción</label>
            <input
              type="text"
              maxLength={80}
              style={inputStyle}
              value={form.descripcion1}
              onChange={(e) => updateField('descripcion1', e.target.value)}
            />
          </div>
        </div>

        {/* Observaciones — full width */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={labelStyle}>Observaciones</label>
          <textarea
            rows={3}
            maxLength={300}
            style={{ ...inputStyle, resize: 'vertical' }}
            value={form.observaciones}
            onChange={(e) => updateField('observaciones', e.target.value)}
          />
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Button
            onClick={handleGuardar}
            disabled={guardarFactura.isPending}
            style={{ backgroundColor: '#2563eb', color: '#fff', fontWeight: 600, borderRadius: '4px', padding: '0.5rem 1.25rem', fontSize: '0.875rem', border: 'none', cursor: guardarFactura.isPending ? 'wait' : 'pointer', opacity: guardarFactura.isPending ? 0.7 : 1 }}
          >
            {guardarFactura.isPending ? 'Guardando...' : editingId ? 'Actualizar Factura' : 'Guardar Factura'}
          </Button>
          {editingId && (
            <button
              onClick={handleCancelEdit}
              style={{ backgroundColor: '#6b7280', color: '#fff', fontWeight: 600, borderRadius: '4px', padding: '0.5rem 1.25rem', fontSize: '0.875rem', border: 'none', cursor: 'pointer' }}
            >
              Cancelar
            </button>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
         SECCIÓN 2: Estudios Adicionales
         ═══════════════════════════════════════════════════════════════════ */}
      <div style={cardStyle}>
        <h2 style={sectionTitleStyle}>2. Estudios Adicionales</h2>
        {estudiosAdicionales.length === 0 ? (
          <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>No hay estudios adicionales registrados.</p>
        ) : (
          <div style={{ borderRadius: '6px', overflow: 'hidden', border: '1px solid #e5e7eb' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f3f4f6' }}>
                  <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #e5e7eb', width: '50px' }}>Letra</th>
                  <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #e5e7eb' }}>Nombre</th>
                  <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #e5e7eb', width: '120px' }}>Estatus</th>
                  <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #e5e7eb' }}>Observaciones</th>
                </tr>
              </thead>
              <tbody>
                {estudiosAdicionales.map((ea, idx) => (
                  <tr key={ea.id} style={{ backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                    <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #e5e7eb', fontWeight: 700 }}>{ea.letraEstAdic ?? '—'}</td>
                    <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #e5e7eb' }}>{ea.nombre}</td>
                    <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #e5e7eb' }}>{ESTATUS_NOMBRES[ea.estatusEstId] ?? '—'}</td>
                    <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #e5e7eb', color: '#6b7280' }}>{ea.observaciones ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
         SECCIÓN 3: Facturas
         ═══════════════════════════════════════════════════════════════════ */}
      <div style={cardStyle}>
        <h2 style={sectionTitleStyle}>3. Facturas</h2>
        {facturas.length === 0 ? (
          <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>No hay facturas registradas para este seguimiento.</p>
        ) : (
          <div style={{ borderRadius: '6px', overflow: 'auto', border: '1px solid #e5e7eb' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', minWidth: '800px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f3f4f6' }}>
                  <th style={{ padding: '0.5rem 0.5rem', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>ID</th>
                  <th style={{ padding: '0.5rem 0.5rem', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>Factura No.</th>
                  <th style={{ padding: '0.5rem 0.5rem', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>Tipo Servicio</th>
                  <th style={{ padding: '0.5rem 0.5rem', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>Tipo Factura</th>
                  <th style={{ padding: '0.5rem 0.5rem', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #e5e7eb' }}>Empresa</th>
                  <th style={{ padding: '0.5rem 0.5rem', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #e5e7eb' }}>Promotor</th>
                  <th style={{ padding: '0.5rem 0.5rem', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #e5e7eb' }}>Descripción</th>
                  <th style={{ padding: '0.5rem 0.5rem', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>Fecha</th>
                  <th style={{ padding: '0.5rem 0.5rem', textAlign: 'center', fontWeight: 600, borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {facturas.map((f, idx) => {
                  const isEditing = editingId === f.facturaId
                  const rowBg = isEditing ? '#eff6ff' : idx % 2 === 0 ? '#ffffff' : '#f9fafb'
                  const tipoServ = f.tipoServicioId === 1 ? 'Particular' : f.tipoServicioId === 2 ? 'Empresa' : '—'
                  const tipoFact = f.tipoFactura === 0 ? 'Sin Asignar' : f.tipoFactura === 1 ? 'Check Up' : f.tipoFactura === 2 ? 'Est. Adicional' : '—'
                  return (
                    <tr key={f.facturaId} style={{ backgroundColor: rowBg }}>
                      <td style={{ padding: '0.5rem 0.5rem', borderBottom: '1px solid #e5e7eb', fontSize: '0.8rem' }}>{f.facturaId}</td>
                      <td style={{ padding: '0.5rem 0.5rem', borderBottom: '1px solid #e5e7eb' }}>{f.facturaNo ?? '—'}</td>
                      <td style={{ padding: '0.5rem 0.5rem', borderBottom: '1px solid #e5e7eb' }}>{tipoServ}</td>
                      <td style={{ padding: '0.5rem 0.5rem', borderBottom: '1px solid #e5e7eb' }}>{tipoFact}</td>
                      <td style={{ padding: '0.5rem 0.5rem', borderBottom: '1px solid #e5e7eb' }}>{f.empresa ?? '—'}</td>
                      <td style={{ padding: '0.5rem 0.5rem', borderBottom: '1px solid #e5e7eb' }}>{f.promotorNombre ?? '—'}</td>
                      <td style={{ padding: '0.5rem 0.5rem', borderBottom: '1px solid #e5e7eb', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.descripcion1 ?? '—'}</td>
                      <td style={{ padding: '0.5rem 0.5rem', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap', fontSize: '0.8rem' }}>{f.fechaIngreso ?? '—'}</td>
                      <td style={{ padding: '0.5rem 0.5rem', borderBottom: '1px solid #e5e7eb', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <button
                          onClick={() => handleEditFactura(f)}
                          style={{ fontSize: '0.8rem', fontWeight: 600, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', marginRight: '8px' }}
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleEliminar(f.facturaId)}
                          disabled={eliminarFactura.isPending}
                          style={{ fontSize: '0.8rem', fontWeight: 600, color: '#D32F2F', background: 'none', border: 'none', cursor: 'pointer' }}
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
         SECCIÓN 4: Paciente se Retira
         Ciclo: 0 (No listo) → 1 (Enfermería marcó listo) → 2 (Caja confirmó egreso)
         ═══════════════════════════════════════════════════════════════════ */}
      {(() => {
        // Estado C — Ya egresado (estatusValpac === 2 O tiene fechaEgreso válida)
        const tieneEgresoValido = !!seg.fechaEgreso && seg.fechaEgreso !== '0000-00-00'
        const yaEgresado = seg.estatusValpac === 2 || tieneEgresoValido
        // Estado B — Listo para salir (enfermería lo marcó)
        const listoParaSalir = seg.estatusValpac === 1

        if (yaEgresado) {
          // Detectar si es un registro migrado del sistema anterior
          const esMigrado = !seg.fechaEgreso || seg.fechaEgreso === '0000-00-00'
          const fechaTexto = esMigrado ? '(registrado desde sistema anterior)' : seg.fechaEgreso
          const horaTexto = esMigrado ? '—' : (seg.horaEgreso ?? '—')

          return (
            <div style={{ ...cardStyle, backgroundColor: '#f0fdf4', borderColor: '#86efac' }}>
              <h2 style={{ ...sectionTitleStyle, borderBottomColor: '#16a34a' }}>4. Paciente se Retira</h2>
              <p style={{ color: '#166534', fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.75rem' }}>
                Egreso registrado — Paciente terminó su visita
              </p>
              <p style={{ color: '#374151', fontSize: '0.85rem' }}>
                Fecha: <strong>{fechaTexto}</strong> | Hora: <strong>{horaTexto}</strong> | Registrado por: <strong>{seg.userEgresoArea ?? '—'}</strong>
              </p>
            </div>
          )
        }

        if (listoParaSalir) {
          return (
            <div style={{ ...cardStyle, backgroundColor: '#fff7ed', borderColor: '#fed7aa' }}>
              <h2 style={{ ...sectionTitleStyle, borderBottomColor: '#f97316' }}>4. Paciente se Retira</h2>
              <p style={{ color: '#9a3412', fontSize: '0.875rem', marginBottom: '1rem' }}>
                Enfermería marcó al paciente como listo para salir. Al confirmar, se registrará el egreso y se cambiará el estado a &quot;Paciente terminó su visita&quot;.
              </p>
              <Button
                onClick={handleConfirmarEgreso}
                disabled={confirmarEgreso.isPending}
                style={{ backgroundColor: '#16a34a', color: '#fff', fontWeight: 600, borderRadius: '4px', padding: '0.5rem 1.25rem', fontSize: '0.875rem', border: 'none', cursor: confirmarEgreso.isPending ? 'wait' : 'pointer', opacity: confirmarEgreso.isPending ? 0.7 : 1 }}
              >
                {confirmarEgreso.isPending ? 'Registrando...' : 'Confirmar Retiro del Paciente'}
              </Button>
            </div>
          )
        }

        // Estado A — Default (no listo, estatusValpac === 0)
        return (
          <div style={{ ...cardStyle, backgroundColor: '#f3f4f6', borderColor: '#d1d5db' }}>
            <h2 style={{ ...sectionTitleStyle, borderBottomColor: '#6b7280' }}>4. Paciente se Retira</h2>
            <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '1rem' }}>
              El botón se habilitará cuando Enfermería marque al paciente como &quot;Listo para salir&quot; en Datos del Paciente.
            </p>
            <button
              disabled
              style={{ backgroundColor: '#9ca3af', color: '#fff', fontWeight: 600, borderRadius: '4px', padding: '0.5rem 1.25rem', fontSize: '0.875rem', border: 'none', cursor: 'not-allowed', opacity: 0.55 }}
            >
              Confirmar Retiro del Paciente
            </button>
          </div>
        )
      })()}
    </div>
  )
}
