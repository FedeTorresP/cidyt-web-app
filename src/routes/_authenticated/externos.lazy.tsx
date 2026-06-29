import { createLazyFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import {
  useRegistrarEstudioExterno,
  useEstudiosExternos,
  AREAS_EXTERNAS,
} from '@/hooks/use-estudios-externos'
import { nowMX, formatDateMX } from '@/lib/timezone'

export const Route = createLazyFileRoute('/_authenticated/externos')({
  component: EstudiosExternosPage,
})

function areaNombre(id: string): string {
  return AREAS_EXTERNAS.find((a) => a.id === id)?.nombre ?? id
}

/* ═══════════════════════════════════════════════════════════════════════════
   ESTILOS
   ═══════════════════════════════════════════════════════════════════════════ */

const labelStyle: React.CSSProperties = {
  fontSize: '0.8125rem',
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

/* ═══════════════════════════════════════════════════════════════════════════
   COMPONENTE — EstudiosExternosPage
   ═══════════════════════════════════════════════════════════════════════════ */

function EstudiosExternosPage() {
  const registrar = useRegistrarEstudioExterno()

  // Form state
  const [fecha, setFecha] = useState(() => formatDateMX(nowMX()))
  const [nombrePaciente, setNombrePaciente] = useState('')
  const [area, setArea] = useState<string>(AREAS_EXTERNAS[0].id)
  const [nombreEstudio, setNombreEstudio] = useState('')
  const [observaciones, setObservaciones] = useState('')

  // Listado del día seleccionado
  const { data: registros = [] } = useEstudiosExternos(fecha)

  // Feedback
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Auto-clear banners
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

  const handleSubmit = async () => {
    setErrorMsg(null)
    setSuccessMsg(null)

    // Validación frontend
    if (!fecha) {
      setErrorMsg('La fecha es obligatoria.')
      return
    }
    if (!nombrePaciente.trim()) {
      setErrorMsg('El nombre del paciente es obligatorio.')
      return
    }
    if (!nombreEstudio.trim()) {
      setErrorMsg('El nombre del estudio es obligatorio.')
      return
    }
    if (!area) {
      setErrorMsg('El área es obligatoria.')
      return
    }

    try {
      await registrar.mutateAsync({
        fecha,
        nombre_paciente: nombrePaciente.trim(),
        area,
        nombre_estudio: nombreEstudio.trim(),
        observaciones: observaciones.trim() || undefined,
      })
      setSuccessMsg('Estudio externo registrado exitosamente.')
      // Limpiar campos excepto fecha
      setNombrePaciente('')
      setNombreEstudio('')
      setObservaciones('')
    } catch {
      setErrorMsg('Error al registrar el estudio externo. Intente nuevamente.')
    }
  }

  return (
    <div style={{ maxWidth: '1000px' }}>
      {/* Título */}
      <h1
        style={{
          fontSize: '1.25rem',
          fontWeight: 700,
          color: '#1a3a5c',
          marginBottom: '1rem',
        }}
      >
        Estudios Externos
      </h1>

      {/* Card */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '6px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          padding: '1.25rem',
        }}
      >
        {/* Subtítulo */}
        <h2
          style={{
            fontSize: '1rem',
            fontWeight: 700,
            color: '#1a3a5c',
            marginBottom: '1rem',
          }}
        >
          Registrar Estudio Externo
        </h2>

        {/* Grid de campos */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '0.875rem',
            marginBottom: '0.875rem',
          }}
        >
          {/* Fecha */}
          <div>
            <label style={labelStyle}>Fecha</label>
            <input
              type="date"
              style={inputStyle}
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </div>

          {/* Nombre Paciente */}
          <div>
            <label style={labelStyle}>Nombre del Paciente</label>
            <input
              type="text"
              placeholder="Nombre completo del paciente"
              style={inputStyle}
              value={nombrePaciente}
              onChange={(e) => setNombrePaciente(e.target.value)}
            />
          </div>

          {/* Área */}
          <div>
            <label style={labelStyle}>Área</label>
            <select
              style={inputStyle}
              value={area}
              onChange={(e) => setArea(e.target.value)}
            >
              {AREAS_EXTERNAS.map((a) => (
                <option key={a.id} value={a.id}>{a.nombre}</option>
              ))}
            </select>
          </div>

          {/* Nombre Estudio */}
          <div>
            <label style={labelStyle}>Nombre del Estudio</label>
            <input
              type="text"
              placeholder="Tipo de estudio realizado"
              style={inputStyle}
              value={nombreEstudio}
              onChange={(e) => setNombreEstudio(e.target.value)}
            />
          </div>

          {/* Observaciones — full width */}
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Observaciones</label>
            <textarea
              rows={3}
              placeholder="Notas adicionales (opcional)"
              style={{ ...inputStyle, resize: 'vertical' }}
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
            />
          </div>
        </div>

        {/* Botón */}
        <button
          onClick={handleSubmit}
          disabled={registrar.isPending}
          style={{
            backgroundColor: '#1a3a5c',
            color: '#ffffff',
            borderRadius: '4px',
            padding: '0.5rem 1.25rem',
            fontWeight: 600,
            fontSize: '0.875rem',
            border: 'none',
            cursor: registrar.isPending ? 'wait' : 'pointer',
            opacity: registrar.isPending ? 0.7 : 1,
          }}
        >
          {registrar.isPending ? 'Guardando...' : 'Guardar Estudio Externo'}
        </button>

        {/* Banners */}
        {errorMsg && (
          <div
            role="alert"
            style={{
              marginTop: '0.75rem',
              padding: '0.5rem 0.875rem',
              borderRadius: '4px',
              backgroundColor: '#fee2e2',
              border: '1px solid #fca5a5',
              color: '#991b1b',
              fontSize: '0.8125rem',
            }}
          >
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div
            role="status"
            style={{
              marginTop: '0.75rem',
              padding: '0.5rem 0.875rem',
              borderRadius: '4px',
              backgroundColor: '#dcfce7',
              border: '1px solid #86efac',
              color: '#166534',
              fontSize: '0.8125rem',
            }}
          >
            {successMsg}
          </div>
        )}
      </div>

      {/* Listado del día */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '6px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          padding: '1.25rem',
          marginTop: '1rem',
        }}
      >
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#1a3a5c', marginBottom: '0.75rem' }}>
          Estudios Externos del {fecha} ({registros.length})
        </h2>

        {registros.length === 0 ? (
          <p style={{ fontSize: '0.85rem', color: '#6b7280' }}>
            No hay estudios externos registrados para esta fecha.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#1a3a5c' }}>
                  <th style={{ padding: '8px 10px', textAlign: 'left', color: '#fff', fontWeight: 600 }}>Paciente</th>
                  <th style={{ padding: '8px 10px', textAlign: 'left', color: '#fff', fontWeight: 600 }}>Área</th>
                  <th style={{ padding: '8px 10px', textAlign: 'left', color: '#fff', fontWeight: 600 }}>Estudio</th>
                  <th style={{ padding: '8px 10px', textAlign: 'left', color: '#fff', fontWeight: 600 }}>Observaciones</th>
                </tr>
              </thead>
              <tbody>
                {registros.map((r, idx) => (
                  <tr key={r.id} style={{ backgroundColor: idx % 2 === 0 ? '#f9fafb' : '#ffffff' }}>
                    <td style={{ padding: '8px 10px', borderBottom: '1px solid #e5e7eb', fontWeight: 500, color: '#1f2937' }}>{r.nombrePaciente}</td>
                    <td style={{ padding: '8px 10px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{areaNombre(r.area)}</td>
                    <td style={{ padding: '8px 10px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{r.nombreEstudio}</td>
                    <td style={{ padding: '8px 10px', borderBottom: '1px solid #e5e7eb', color: '#6b7280' }}>{r.observaciones || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
