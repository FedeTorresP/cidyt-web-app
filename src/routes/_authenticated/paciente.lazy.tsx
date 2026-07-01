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
  useSetTurno,
} from '@/hooks/use-registro-pacientes'
import type { PacienteFormData, PacienteRegistro } from '@/hooks/use-registro-pacientes'

export const Route = createLazyFileRoute('/_authenticated/paciente')({
  component: RegistroPacientesPage,
})

/**
 * Alta manual de pacientes. Se habilitó para la versión alpha (sin sap-pipeline).
 * Con sap-pipeline en producción los pacientes provienen de SAP, por lo que el
 * botón "+ Nuevo Paciente" queda oculto. Poner `true` para reactivarlo.
 */
const ALTA_MANUAL_HABILITADA = false

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
   ALERTA — Turno duplicado
   ═══════════════════════════════════════════════════════════════════════════ */

interface TurnoConflict {
  kind: 'inline' | 'form'
  turno: number
  conflictName: string
  seguimientoId?: string
}

function TurnoConflictDialog({
  state,
  onConfirm,
  onCancel,
}: {
  state: TurnoConflict | null
  onConfirm: () => void
  onCancel: () => void
}) {
  if (!state) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onCancel}
    >
      <div
        className="bg-[var(--color-fondo-card)] rounded-xl shadow-xl w-[90vw] max-w-[420px]"
        style={{ padding: '24px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-texto)', marginBottom: '8px' }}>
          Turno en uso
        </h2>
        <p style={{ fontSize: '0.9rem', color: 'var(--color-texto)', marginBottom: '20px', lineHeight: 1.5 }}>
          El turno <strong>{state.turno}</strong> está asignado a: <strong>{state.conflictName}</strong>.
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button
            onClick={onCancel}
            style={{
              minHeight: '40px', padding: '0 18px', fontWeight: 600, fontSize: '0.875rem',
              color: 'var(--color-texto)', backgroundColor: 'transparent',
              border: '1px solid var(--color-borde)', borderRadius: 'var(--radius-default)', cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            style={{
              minHeight: '40px', padding: '0 18px', fontWeight: 600, fontSize: '0.875rem',
              color: '#ffffff', backgroundColor: 'var(--color-primario)',
              border: 'none', borderRadius: 'var(--radius-default)', cursor: 'pointer',
            }}
          >
            Continuar
          </button>
        </div>
      </div>
    </div>
  )
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
  const [turnoConflict, setTurnoConflict] = useState<TurnoConflict | null>(null)

  // Queries
  const { data: activos = [], refetch: refetchActivos } = usePacientesDelDia(fecha, true)
  const { data: cancelados = [], refetch: refetchCancelados } = usePacientesDelDia(fecha, false)
  const { data: catalogos } = useCatalogos()
  const { data: detalle } = usePacienteDetalle(editandoId)

  // Mutations
  const crearMut = useCrearPaciente()
  const editarMut = useEditarPaciente()
  const toggleMut = useToggleActivo()
  const setTurnoMut = useSetTurno()

  const paquetes = catalogos?.paquetes ?? []
  const empresas = catalogos?.empresas ?? []
  // Orden automático por turno ascendente (re-ordena al cambiar el turno)
  const pacientes = [...(tabActivo ? activos : cancelados)].sort((a, b) => a.turno - b.turno)

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
      } else {
        await crearMut.mutateAsync({
          primerNombre: form.primerNombre,
          segundoNombre: form.segundoNombre,
          apellidoPaterno: form.apellidoPaterno,
          apellidoMaterno: form.apellidoMaterno,
          fechaNac: form.fechaNac,
          genero: form.genero,
          historia: form.historia,
          paqueteId: form.paqueteId,
          empresaId: form.empresaId,
          turno: Number(form.turno),
          fecha,
        })
        setSuccessMsg('Paciente registrado correctamente.')
      }
      setVista('lista')
      setEditandoId(null)
      setForm(EMPTY_FORM)
    } catch {
      setErrorMsg(editandoId ? 'Error al actualizar paciente.' : 'Error al registrar paciente.')
    }
  }, [editandoId, form, fecha, editarMut, crearMut])

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

  // Busca otro paciente activo con el mismo turno
  const findTurnoConflict = useCallback((turno: number, excludeId: string | null) => {
    return activos.find((p) => p.seguimientoId !== excludeId && p.turno === turno) ?? null
  }, [activos])

  const persistTurno = useCallback((seguimientoId: string, turno: number) => {
    setTurnoMut.mutate(
      { seguimientoId, turno },
      { onError: () => setErrorMsg('Error al cambiar el turno.') },
    )
  }, [setTurnoMut])

  // Cambio inline (tabla): valida turno duplicado antes de guardar
  const handleTurnoChange = useCallback((seguimientoId: string, turno: number) => {
    const conflicto = findTurnoConflict(turno, seguimientoId)
    if (conflicto) {
      setTurnoConflict({ kind: 'inline', turno, conflictName: conflicto.nombre, seguimientoId })
      return
    }
    persistTurno(seguimientoId, turno)
  }, [findTurnoConflict, persistTurno])

  // Cambio en el formulario de edición: valida turno duplicado antes de aplicar
  const handleFormTurnoChange = useCallback((value: string) => {
    const turno = Number(value)
    const conflicto = findTurnoConflict(turno, editandoId)
    if (conflicto) {
      setTurnoConflict({ kind: 'form', turno, conflictName: conflicto.nombre })
      return
    }
    updateField('turno', value)
  }, [findTurnoConflict, editandoId, updateField])

  const handleTurnoConfirm = useCallback(() => {
    if (!turnoConflict) return
    if (turnoConflict.kind === 'inline' && turnoConflict.seguimientoId) {
      persistTurno(turnoConflict.seguimientoId, turnoConflict.turno)
    } else if (turnoConflict.kind === 'form') {
      updateField('turno', String(turnoConflict.turno))
    }
    setTurnoConflict(null)
  }, [turnoConflict, persistTurno, updateField])

  const turnoDialog = (
    <TurnoConflictDialog
      state={turnoConflict}
      onConfirm={handleTurnoConfirm}
      onCancel={() => setTurnoConflict(null)}
    />
  )

  /* ═══════════════════════════════════════════════════════════════════════
     RENDER — VISTA LISTA
     ═══════════════════════════════════════════════════════════════════════ */

  if (vista === 'lista') {
    return (
      <div>
        <h1 className="page-title">Registro de Pacientes</h1>

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
              {/* Alta manual de pacientes deshabilitada: los pacientes ahora
                  provienen de sap-pipeline. El formulario (`handleNuevo`) se
                  conserva intacto para edición y por si se reactiva
                  (poner ALTA_MANUAL_HABILITADA = true). */}
              {ALTA_MANUAL_HABILITADA && (
                <button
                  onClick={handleNuevo}
                  style={{
                    minHeight: '36px',
                    padding: '0 14px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: 'var(--color-acento)',
                    color: '#ffffff',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                  title="Registrar nuevo paciente"
                >
                  + Nuevo Paciente
                </button>
              )}
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                style={{
                  minHeight: '36px',
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
                        {tabActivo ? (
                          <select
                            value={pac.turno}
                            onChange={(e) => handleTurnoChange(pac.seguimientoId, Number(e.target.value))}
                            aria-label={`Turno de ${pac.nombre}`}
                            title="Cambiar turno"
                            style={{
                              minHeight: '32px', padding: '0 6px', borderRadius: '6px',
                              border: '1px solid var(--color-borde)', backgroundColor: '#ffffff',
                              color: 'var(--color-primario)', fontWeight: 700, fontSize: '0.8rem',
                              cursor: 'pointer', textAlign: 'center',
                            }}
                          >
                            {Array.from({ length: 99 }, (_, i) => i + 1).map((n) => (
                              <option key={n} value={n}>{n}</option>
                            ))}
                          </select>
                        ) : (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: '18px', height: '18px', borderRadius: '50%',
                            backgroundColor: 'rgba(10,31,92,0.08)', color: 'var(--color-primario)',
                            fontWeight: 700, fontSize: '0.7rem',
                          }}>
                            {pac.turno}
                          </span>
                        )}
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
        {turnoDialog}
      </div>
    )
  }

  /* ═══════════════════════════════════════════════════════════════════════
     RENDER — VISTA FORMULARIO
     ═══════════════════════════════════════════════════════════════════════ */

  const isSubmitting = editarMut.isPending || crearMut.isPending

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
            minHeight: '38px',
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
                style={{ width: '100%', minHeight: '38px', padding: '0 12px', border: '1px solid var(--color-borde)', borderRadius: 'var(--radius-default)', fontSize: '1rem' }}
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
                style={{ width: '100%', minHeight: '38px', padding: '0 12px', border: '1px solid var(--color-borde)', borderRadius: 'var(--radius-default)', fontSize: '1rem' }}
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
                style={{ width: '100%', minHeight: '38px', padding: '0 12px', border: '1px solid var(--color-borde)', borderRadius: 'var(--radius-default)', fontSize: '1rem' }}
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
                style={{ width: '100%', minHeight: '38px', padding: '0 12px', border: '1px solid var(--color-borde)', borderRadius: 'var(--radius-default)', fontSize: '1rem' }}
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
                style={{ width: '100%', minHeight: '38px', padding: '0 12px', border: '1px solid var(--color-borde)', borderRadius: 'var(--radius-default)', fontSize: '1rem' }}
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
                style={{ width: '100%', minHeight: '38px', padding: '0 12px', border: '1px solid var(--color-borde)', borderRadius: 'var(--radius-default)', fontSize: '1rem', backgroundColor: '#ffffff' }}
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
                style={{ width: '100%', minHeight: '38px', padding: '0 12px', border: '1px solid var(--color-borde)', borderRadius: 'var(--radius-default)', fontSize: '1rem' }}
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
                style={{ width: '100%', minHeight: '38px', padding: '0 12px', border: '1px solid var(--color-borde)', borderRadius: 'var(--radius-default)', fontSize: '1rem', backgroundColor: '#ffffff' }}
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
                style={{ width: '100%', minHeight: '38px', padding: '0 12px', border: '1px solid var(--color-borde)', borderRadius: 'var(--radius-default)', fontSize: '1rem', backgroundColor: '#ffffff' }}
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
                onChange={(e) => handleFormTurnoChange(e.target.value)}
                style={{ width: '100%', minHeight: '38px', padding: '0 12px', border: '1px solid var(--color-borde)', borderRadius: 'var(--radius-default)', fontSize: '1rem', backgroundColor: '#ffffff' }}
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
              backgroundColor: 'var(--color-primario)',
              borderRadius: 'var(--radius-default)',
              border: 'none',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              opacity: isSubmitting ? 0.6 : 1,
            }}
          >
            {isSubmitting ? 'Procesando...' : editandoId ? 'Guardar Cambios' : 'Registrar Paciente'}
          </button>
        </form>
      </div>
      {turnoDialog}
    </div>
  )
}
