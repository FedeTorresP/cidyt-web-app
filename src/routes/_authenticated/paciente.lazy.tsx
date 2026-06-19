import { createLazyFileRoute } from '@tanstack/react-router'
import { useState, useCallback, useEffect } from 'react'
import { nowMX, formatDateMX } from '@/lib/timezone'
import {
  usePacientesDelDia,
  useCatalogos,
  usePacienteDetalle,
  useCrearPaciente,
  useEditarPaciente,
  useToggleActivo,
} from '@/hooks/use-registro-pacientes'
import type { PacienteFormData, PacienteRegistro } from '@/hooks/use-registro-pacientes'

export const Route = createLazyFileRoute('/_authenticated/paciente')({
  component: RegistroPacientesPage,
})

/* ═══════════════════════════════════════════════════════════════════════════
   FORM VACÍO
   ═══════════════════════════════════════════════════════════════════════════ */

const EMPTY_FORM: PacienteFormData = {
  primerNombre: '',
  segundoNombre: '',
  apellidoPaterno: '',
  apellidoMaterno: '',
  fechaNac: '',
  genero: '',
  historia: '',
  paqueteId: '',
  empresaId: '',
  turno: '',
}

/* ═══════════════════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
   ═══════════════════════════════════════════════════════════════════════════ */

function RegistroPacientesPage() {
  const hoy = formatDateMX(nowMX())
  const [fecha, setFecha] = useState(() => hoy)
  const [tabActivo, setTabActivo] = useState(true) // true = Activos, false = Cancelados
  const [vista, setVista] = useState<'lista' | 'formulario'>('lista')
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [form, setForm] = useState<PacienteFormData>(EMPTY_FORM)

  // Queries
  const { data: activos = [], refetch: refetchActivos } = usePacientesDelDia(fecha, true)
  const { data: cancelados = [], refetch: refetchCancelados } = usePacientesDelDia(fecha, false)
  const { data: catalogos } = useCatalogos()
  const { data: detalle } = usePacienteDetalle(editandoId)

  // Mutations
  const crearMut = useCrearPaciente()
  const editarMut = useEditarPaciente()
  const toggleMut = useToggleActivo()

  const paquetes = catalogos?.paquetes ?? []
  const empresas = catalogos?.empresas ?? []
  const pacientes = tabActivo ? activos : cancelados

  // Cargar detalle cuando se edita
  useEffect(() => {
    if (detalle && editandoId) {
      setForm({
        primerNombre: detalle.primerNombre,
        segundoNombre: detalle.segundoNombre,
        apellidoPaterno: detalle.apellidoPaterno,
        apellidoMaterno: detalle.apellidoMaterno,
        fechaNac: detalle.fechaNac,
        genero: detalle.genero,
        historia: detalle.historia,
        paqueteId: detalle.paqueteId,
        empresaId: detalle.empresaId,
        turno: detalle.turno,
      })
    }
  }, [detalle, editandoId])

  // Limpiar mensajes después de 4 segundos
  useEffect(() => {
    if (successMsg || errorMsg) {
      const t = setTimeout(() => { setSuccessMsg(''); setErrorMsg('') }, 4000)
      return () => clearTimeout(t)
    }
  }, [successMsg, errorMsg])

  // Handlers
  const handleNuevo = useCallback(() => {
    setEditandoId(null)
    setForm(EMPTY_FORM)
    setVista('formulario')
    setSuccessMsg('')
    setErrorMsg('')
  }, [])

  const handleEditar = useCallback((pac: PacienteRegistro) => {
    setEditandoId(pac.seguimientoId)
    setVista('formulario')
    setSuccessMsg('')
    setErrorMsg('')
  }, [])

  const handleVolver = useCallback(() => {
    setVista('lista')
    setEditandoId(null)
    setForm(EMPTY_FORM)
    setSuccessMsg('')
    setErrorMsg('')
  }, [])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setSuccessMsg('')
    setErrorMsg('')

    try {
      if (editandoId) {
        await editarMut.mutateAsync({ seguimientoId: editandoId, data: form })
        setSuccessMsg('Paciente actualizado correctamente.')
        setVista('lista')
        setEditandoId(null)
        setForm(EMPTY_FORM)
      } else {
        await crearMut.mutateAsync(form)
        setSuccessMsg('Paciente registrado correctamente.')
        setForm(EMPTY_FORM)
      }
    } catch {
      setErrorMsg(editandoId ? 'Error al actualizar paciente.' : 'Error al registrar paciente.')
    }
  }, [editandoId, form, crearMut, editarMut])

  const handleCancelar = useCallback(async (seguimientoId: string) => {
    try {
      await toggleMut.mutateAsync({ seguimientoId, activo: 0 })
      setConfirmandoId(null)
      refetchActivos()
      refetchCancelados()
    } catch {
      setErrorMsg('Error al cancelar paciente.')
    }
  }, [toggleMut, refetchActivos, refetchCancelados])

  const handleRestaurar = useCallback(async (seguimientoId: string) => {
    try {
      await toggleMut.mutateAsync({ seguimientoId, activo: 1 })
      refetchActivos()
      refetchCancelados()
    } catch {
      setErrorMsg('Error al restaurar paciente.')
    }
  }, [toggleMut, refetchActivos, refetchCancelados])

  const handleActualizar = useCallback(() => {
    refetchActivos()
    refetchCancelados()
  }, [refetchActivos, refetchCancelados])

  const updateField = useCallback((field: keyof PacienteFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }, [])

  /* ═══════════════════════════════════════════════════════════════════════
     RENDER — VISTA LISTA
     ═══════════════════════════════════════════════════════════════════════ */

  if (vista === 'lista') {
    return (
      <div>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h1 className="page-title" style={{ marginBottom: 0 }}>Registro de Pacientes</h1>
          <button
            onClick={handleNuevo}
            style={{
              backgroundColor: 'var(--color-acento)',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: '0.875rem',
              padding: '0 20px',
              minHeight: '44px',
              borderRadius: 'var(--radius-default)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            + Nuevo Paciente
          </button>
        </div>

        {/* Toast mensajes */}
        {successMsg && (
          <div style={{ backgroundColor: '#d4edda', color: '#155724', padding: '10px 16px', borderRadius: '8px', marginBottom: '12px', fontSize: '0.875rem', fontWeight: 500 }}>
            {successMsg}
          </div>
        )}
        {errorMsg && (
          <div style={{ backgroundColor: '#f8d7da', color: '#721c24', padding: '10px 16px', borderRadius: '8px', marginBottom: '12px', fontSize: '0.875rem', fontWeight: 500 }}>
            {errorMsg}
          </div>
        )}

        {/* Card azul oscuro */}
        <div style={{ backgroundColor: 'var(--color-primario)', borderRadius: 'var(--radius-default)', overflow: 'hidden', boxShadow: 'var(--shadow-card)' }}>
          {/* Header de la card */}
          <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ color: '#ffffff', fontSize: '1rem', fontWeight: 600, margin: 0 }}>Lista de Pacientes</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                style={{
                  minHeight: '44px',
                  padding: '0 12px',
                  fontSize: '0.875rem',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.2)',
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  color: '#ffffff',
                  outline: 'none',
                }}
              />
              <button
                onClick={handleActualizar}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.2)',
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  color: '#ffffff',
                  fontSize: '1rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="Actualizar"
              >
                ↺
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', backgroundColor: '#ffffff' }}>
            <button
              onClick={() => setTabActivo(true)}
              style={{
                flex: 1,
                padding: '12px 0',
                fontSize: '0.875rem',
                fontWeight: 600,
                border: 'none',
                borderBottom: tabActivo ? '3px solid var(--color-acento)' : '3px solid transparent',
                backgroundColor: '#ffffff',
                color: tabActivo ? 'var(--color-texto)' : 'var(--color-texto-suave)',
                cursor: 'pointer',
              }}
            >
              Activos ({activos.length})
            </button>
            <button
              onClick={() => setTabActivo(false)}
              style={{
                flex: 1,
                padding: '12px 0',
                fontSize: '0.875rem',
                fontWeight: 600,
                border: 'none',
                borderBottom: !tabActivo ? '3px solid var(--color-warning)' : '3px solid transparent',
                backgroundColor: '#ffffff',
                color: !tabActivo ? 'var(--color-texto)' : 'var(--color-texto-suave)',
                cursor: 'pointer',
              }}
            >
              Cancelados ({cancelados.length})
            </button>
          </div>

          {/* Tabla */}
          <div style={{ backgroundColor: '#ffffff' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--color-primario)' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'center', color: '#ffffff', fontSize: '0.8rem', fontWeight: 600, width: '60px' }}>Turno</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: '#ffffff', fontSize: '0.8rem', fontWeight: 600 }}>Nombre del Paciente</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: '#ffffff', fontSize: '0.8rem', fontWeight: 600 }}>Paquete</th>
                  {tabActivo && <th style={{ padding: '12px 16px', textAlign: 'center', color: '#ffffff', fontSize: '0.8rem', fontWeight: 600, width: '60px' }}>Editar</th>}
                  <th style={{ padding: '12px 16px', textAlign: 'center', color: '#ffffff', fontSize: '0.8rem', fontWeight: 600, width: tabActivo ? '80px' : '120px' }}>
                    {tabActivo ? 'Cancelar' : 'Restaurar'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {pacientes.length === 0 ? (
                  <tr>
                    <td colSpan={tabActivo ? 5 : 4} style={{ padding: '32px', textAlign: 'center', color: 'var(--color-texto-suave)', fontSize: '0.875rem' }}>
                      No hay pacientes {tabActivo ? 'activos' : 'cancelados'} para esta fecha.
                    </td>
                  </tr>
                ) : (
                  pacientes.map((pac, idx) => (
                    <tr key={pac.seguimientoId} style={{ backgroundColor: idx % 2 === 0 ? 'var(--color-fondo)' : 'var(--color-fondo-card)' }}>
                      <td style={{ padding: '14px 16px', textAlign: 'center', borderBottom: '1px solid var(--color-borde)' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          width: '18px', height: '18px', borderRadius: '50%',
                          backgroundColor: 'rgba(10,31,92,0.08)', color: 'var(--color-primario)',
                          fontWeight: 700, fontSize: '0.7rem',
                        }}>
                          {pac.turno}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-borde)', fontSize: '0.85rem', fontWeight: 500, color: 'var(--color-texto)' }}>
                        {pac.nombre}
                      </td>
                      <td style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-borde)', fontSize: '0.85rem', color: 'var(--color-texto-suave)' }}>
                        {pac.paqueteNombre ?? pac.paqueteId}
                      </td>

                      {/* Botón Editar (solo tab activos) */}
                      {tabActivo && (
                        <td style={{ padding: '14px 16px', textAlign: 'center', borderBottom: '1px solid var(--color-borde)' }}>
                          <button
                            onClick={() => handleEditar(pac)}
                            style={{
                              width: '32px', height: '32px', borderRadius: '6px',
                              backgroundColor: 'var(--color-info)', color: '#ffffff',
                              border: 'none', cursor: 'pointer', fontSize: '0.9rem',
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            }}
                            title={`Editar paciente #${pac.seguimientoId}`}
                            aria-label={`Editar ${pac.nombre}`}
                          >
                            ✎
                          </button>
                        </td>
                      )}

                      {/* Botón Cancelar / Restaurar */}
                      <td style={{ padding: '14px 16px', textAlign: 'center', borderBottom: '1px solid var(--color-borde)' }}>
                        {tabActivo ? (
                          confirmandoId === pac.seguimientoId ? (
                            <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                              <button
                                onClick={() => handleCancelar(pac.seguimientoId)}
                                style={{
                                  fontSize: '0.7rem', fontWeight: 600,
                                  padding: '4px 8px', borderRadius: '6px',
                                  backgroundColor: 'var(--color-error)', color: '#ffffff',
                                  border: 'none', cursor: 'pointer',
                                }}
                              >
                                ¿Confirmar?
                              </button>
                              <button
                                onClick={() => setConfirmandoId(null)}
                                style={{
                                  fontSize: '0.7rem', fontWeight: 600,
                                  padding: '4px 8px', borderRadius: '6px',
                                  backgroundColor: '#6b7280', color: '#ffffff',
                                  border: 'none', cursor: 'pointer',
                                }}
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmandoId(pac.seguimientoId)}
                              style={{
                                width: '32px', height: '32px', borderRadius: '6px',
                                backgroundColor: 'transparent', color: 'var(--color-error)',
                                border: '1.5px solid var(--color-error)', cursor: 'pointer',
                                fontSize: '0.9rem', display: 'inline-flex',
                                alignItems: 'center', justifyContent: 'center',
                              }}
                              title="Cancelar paciente"
                              aria-label={`Cancelar ${pac.nombre}`}
                            >
                              ✕
                            </button>
                          )
                        ) : (
                          <button
                            onClick={() => handleRestaurar(pac.seguimientoId)}
                            style={{
                              fontSize: '0.8rem', fontWeight: 600,
                              padding: '6px 12px', borderRadius: '6px',
                              backgroundColor: 'var(--color-acento)', color: '#ffffff',
                              border: 'none', cursor: 'pointer',
                            }}
                          >
                            ↩ Restaurar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* Footer contador */}
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--color-borde)', fontSize: '0.75rem', color: 'var(--color-texto-suave)' }}>
              {pacientes.length} pacientes registrados
            </div>
          </div>
        </div>
      </div>
    )
  }

  /* ═══════════════════════════════════════════════════════════════════════
     RENDER — VISTA FORMULARIO
     ═══════════════════════════════════════════════════════════════════════ */

  const isSubmitting = crearMut.isPending || editarMut.isPending

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>
          {editandoId ? `Editando Paciente #${editandoId}` : 'Nuevo Paciente'}
        </h1>
        <button
          onClick={handleVolver}
          style={{
            backgroundColor: 'transparent',
            color: 'var(--color-texto)',
            fontWeight: 500,
            fontSize: '0.875rem',
            padding: '0 16px',
            minHeight: '44px',
            borderRadius: 'var(--radius-default)',
            border: '1px solid var(--color-borde)',
            cursor: 'pointer',
          }}
        >
          ← Volver a la lista
        </button>
      </div>

      {/* Toast mensajes */}
      {successMsg && (
        <div style={{ backgroundColor: '#d4edda', color: '#155724', padding: '10px 16px', borderRadius: '8px', marginBottom: '12px', fontSize: '0.875rem', fontWeight: 500 }}>
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div style={{ backgroundColor: '#f8d7da', color: '#721c24', padding: '10px 16px', borderRadius: '8px', marginBottom: '12px', fontSize: '0.875rem', fontWeight: 500 }}>
          {errorMsg}
        </div>
      )}

      {/* Card formulario */}
      <div style={{
        backgroundColor: 'var(--color-fondo-card)',
        borderRadius: 'var(--radius-default)',
        padding: '24px',
        boxShadow: 'var(--shadow-card)',
      }}>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem 0.75rem' }}>
            {/* Primer Nombre */}
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-texto-suave)', marginBottom: '4px' }}>
                Primer Nombre <span style={{ color: 'var(--color-error)' }}>*</span>
              </label>
              <input
                type="text"
                required
                value={form.primerNombre}
                onChange={(e) => updateField('primerNombre', e.target.value)}
                style={{ width: '100%', minHeight: '44px', padding: '0 12px', border: '1px solid var(--color-borde)', borderRadius: 'var(--radius-default)', fontSize: '1rem' }}
              />
            </div>

            {/* Segundo Nombre */}
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-texto-suave)', marginBottom: '4px' }}>
                Segundo Nombre
              </label>
              <input
                type="text"
                value={form.segundoNombre}
                onChange={(e) => updateField('segundoNombre', e.target.value)}
                style={{ width: '100%', minHeight: '44px', padding: '0 12px', border: '1px solid var(--color-borde)', borderRadius: 'var(--radius-default)', fontSize: '1rem' }}
              />
            </div>

            {/* Apellido Paterno */}
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-texto-suave)', marginBottom: '4px' }}>
                Apellido Paterno <span style={{ color: 'var(--color-error)' }}>*</span>
              </label>
              <input
                type="text"
                required
                value={form.apellidoPaterno}
                onChange={(e) => updateField('apellidoPaterno', e.target.value)}
                style={{ width: '100%', minHeight: '44px', padding: '0 12px', border: '1px solid var(--color-borde)', borderRadius: 'var(--radius-default)', fontSize: '1rem' }}
              />
            </div>

            {/* Apellido Materno */}
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-texto-suave)', marginBottom: '4px' }}>
                Apellido Materno
              </label>
              <input
                type="text"
                value={form.apellidoMaterno}
                onChange={(e) => updateField('apellidoMaterno', e.target.value)}
                style={{ width: '100%', minHeight: '44px', padding: '0 12px', border: '1px solid var(--color-borde)', borderRadius: 'var(--radius-default)', fontSize: '1rem' }}
              />
            </div>

            {/* Fecha de Nacimiento */}
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-texto-suave)', marginBottom: '4px' }}>
                Fecha de Nacimiento <span style={{ color: 'var(--color-error)' }}>*</span>
              </label>
              <input
                type="date"
                required
                value={form.fechaNac}
                onChange={(e) => updateField('fechaNac', e.target.value)}
                style={{ width: '100%', minHeight: '44px', padding: '0 12px', border: '1px solid var(--color-borde)', borderRadius: 'var(--radius-default)', fontSize: '1rem' }}
              />
            </div>

            {/* Género */}
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-texto-suave)', marginBottom: '4px' }}>
                Género <span style={{ color: 'var(--color-error)' }}>*</span>
              </label>
              <select
                required
                value={form.genero}
                onChange={(e) => updateField('genero', e.target.value)}
                style={{ width: '100%', minHeight: '44px', padding: '0 12px', border: '1px solid var(--color-borde)', borderRadius: 'var(--radius-default)', fontSize: '1rem', backgroundColor: '#ffffff' }}
              >
                <option value="">-- Seleccionar --</option>
                <option value="M">Masculino (M)</option>
                <option value="F">Femenino (F)</option>
              </select>
            </div>

            {/* Historia */}
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-texto-suave)', marginBottom: '4px' }}>
                Historia
              </label>
              <input
                type="text"
                value={form.historia}
                onChange={(e) => updateField('historia', e.target.value)}
                style={{ width: '100%', minHeight: '44px', padding: '0 12px', border: '1px solid var(--color-borde)', borderRadius: 'var(--radius-default)', fontSize: '1rem' }}
              />
            </div>

            {/* Paquete */}
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-texto-suave)', marginBottom: '4px' }}>
                Paquete <span style={{ color: 'var(--color-error)' }}>*</span>
              </label>
              <select
                required
                value={form.paqueteId}
                onChange={(e) => updateField('paqueteId', e.target.value)}
                style={{ width: '100%', minHeight: '44px', padding: '0 12px', border: '1px solid var(--color-borde)', borderRadius: 'var(--radius-default)', fontSize: '1rem', backgroundColor: '#ffffff' }}
              >
                <option value="">-- Seleccionar --</option>
                {paquetes.map((p) => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
            </div>

            {/* Empresa */}
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-texto-suave)', marginBottom: '4px' }}>
                Empresa <span style={{ color: 'var(--color-error)' }}>*</span>
              </label>
              <select
                required
                value={form.empresaId}
                onChange={(e) => updateField('empresaId', e.target.value)}
                style={{ width: '100%', minHeight: '44px', padding: '0 12px', border: '1px solid var(--color-borde)', borderRadius: 'var(--radius-default)', fontSize: '1rem', backgroundColor: '#ffffff' }}
              >
                <option value="">-- Seleccionar --</option>
                {empresas.map((e) => (
                  <option key={e.id} value={e.id}>{e.nombre}</option>
                ))}
              </select>
            </div>

            {/* Turno */}
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-texto-suave)', marginBottom: '4px' }}>
                Turno <span style={{ color: 'var(--color-error)' }}>*</span>
              </label>
              <select
                required
                value={form.turno}
                onChange={(e) => updateField('turno', e.target.value)}
                style={{ width: '100%', minHeight: '44px', padding: '0 12px', border: '1px solid var(--color-borde)', borderRadius: 'var(--radius-default)', fontSize: '1rem', backgroundColor: '#ffffff' }}
              >
                <option value="">-- Seleccionar --</option>
                {Array.from({ length: 99 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Botón Submit */}
          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              width: '100%',
              minHeight: '48px',
              marginTop: '24px',
              fontSize: '1rem',
              fontWeight: 600,
              color: '#ffffff',
              backgroundColor: editandoId ? 'var(--color-primario)' : 'var(--color-acento)',
              borderRadius: 'var(--radius-default)',
              border: 'none',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              opacity: isSubmitting ? 0.6 : 1,
            }}
          >
            {isSubmitting
              ? 'Procesando...'
              : editandoId
                ? 'Guardar Cambios'
                : 'Registrar Paciente'
            }
          </button>
        </form>
      </div>
    </div>
  )
}
