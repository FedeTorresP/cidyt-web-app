import { createLazyFileRoute, Link } from '@tanstack/react-router'
import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { nowMX, formatDateMX } from '@/lib/timezone'
import { useListaDia, useUpdatePacienteCache } from '@/hooks/use-lista-dia'
import type { PacienteListaDia } from '@/hooks/use-lista-dia'

export const Route = createLazyFileRoute('/_authenticated/lista-dia')({
  component: ListaDiaPage,
})

/* ═══════════════════════════════════════════════════════════════════════════
   CONSTANTES — Estudios, Estatus, Desayuno, Colores
   ═══════════════════════════════════════════════════════════════════════════ */

/** Los 20 estudios del sistema en orden de columna (Orden_Est). */
const ESTUDIOS_COLUMNAS = [
  { id: 1, abrev: 'LAB', nombre: 'Laboratorios', orden: 1 },
  { id: 2, abrev: 'TOR', nombre: 'Torax', orden: 2 },
  { id: 3, abrev: 'ABD', nombre: 'US. Abdomen', orden: 3 },
  { id: 4, abrev: 'MAM', nombre: 'US. Mamario', orden: 4 },
  { id: 5, abrev: 'MAS', nombre: 'Mastografía', orden: 5 },
  { id: 6, abrev: 'CT', nombre: 'CT', orden: 6 },
  { id: 7, abrev: 'ORT', nombre: 'Ortopantomografía', orden: 7 },
  { id: 8, abrev: 'DEN', nombre: 'Densitometría', orden: 8 },
  { id: 9, abrev: 'ESP', nombre: 'Espirometría', orden: 9 },
  { id: 19, abrev: 'EKG', nombre: 'Electrocardiograma', orden: 10 },
  { id: 10, abrev: 'E+P', nombre: 'Ecocardiograma + Prueba', orden: 11 },
  { id: 11, abrev: 'COL', nombre: 'Colposcopía', orden: 12 },
  { id: 12, abrev: 'PAP', nombre: 'Papanicolaou', orden: 13 },
  { id: 13, abrev: 'AUD', nombre: 'Audiometría', orden: 14 },
  { id: 14, abrev: 'DNT', nombre: 'Dental', orden: 15 },
  { id: 15, abrev: 'OFT', nombre: 'Oftalmología', orden: 16 },
  { id: 16, abrev: 'NUT', nombre: 'Nutrición', orden: 17 },
  { id: 17, abrev: 'OTP', nombre: 'Otorrinolaringología', orden: 18 },
  { id: 18, abrev: 'PRO', nombre: 'Proctología', orden: 19 },
  { id: 20, abrev: 'FIB', nombre: 'Fibroscopía', orden: 20 },
] as const

/** Estatus de estudio — colores y letra para cuadro sólido. */
const ESTATUS_ESTUDIO = [
  { id: 0, nombre: 'Sin Estatus', color: 'transparent', letra: '', esBorde: true },
  { id: 1, nombre: 'No Incluido', color: 'transparent', letra: '', esBorde: true },
  { id: 2, nombre: 'En Espera', color: '#1976D2', letra: 'E', esBorde: false },
  { id: 3, nombre: 'En Proceso', color: '#facc15', letra: '', esBorde: false },
  { id: 4, nombre: 'Completo', color: '#00A651', letra: 'C', esBorde: false },
  { id: 5, nombre: 'Pendiente', color: '#7B1FA2', letra: 'P', esBorde: false },
  { id: 6, nombre: 'No Acepta', color: '#D32F2F', letra: 'N', esBorde: false },
  { id: 7, nombre: 'Cambio Estudio', color: '#0288D1', letra: 'C', esBorde: false },
  { id: 8, nombre: 'Estudio Combinado', color: '#873600', letra: '', esBorde: false },
] as const

/** Opciones de desayuno. */
const DESAYUNO_OPCIONES = [
  { value: 0, label: 'No', color: '#D32F2F' },
  { value: 1, label: 'En Proceso', color: '#facc15' },
  { value: 2, label: 'Sí', color: '#00A651' },
] as const

/** Leyenda de colores (se muestra arriba de la tabla). */
const LEYENDA = [
  { nombre: 'No Incluido', color: '#374151' },
  { nombre: 'En Espera', color: '#1976D2' },
  { nombre: 'En Proceso', color: '#facc15' },
  { nombre: 'Completo', color: '#00A651' },
  { nombre: 'Pendiente', color: '#7B1FA2' },
  { nombre: 'No Acepta', color: '#D32F2F' },
  { nombre: 'Estudio Combinado', color: '#873600' },
  { nombre: 'Estudios Adicionales', color: '#E65100' },
] as const

/* ═══════════════════════════════════════════════════════════════════════════
   COMPONENTE — Modal Datos del Paciente
   ═══════════════════════════════════════════════════════════════════════════ */

function ModalDatosPaciente({
  paciente,
  onClose,
}: {
  paciente: PacienteListaDia
  onClose: () => void
}) {
  const desayunoOpt = DESAYUNO_OPCIONES.find((d) => d.value === paciente.desayuno)
  const tarjetaLabel = paciente.tarjetaEntRes === 0 ? 'No' : paciente.tarjetaEntRes === 1 ? 'Sí' : 'Enviado'
  const tarjetaColor = paciente.tarjetaEntRes === 0 ? '#D32F2F' : '#00A651'

  /** Estilo reutilizable para labels encima del valor */
  const labelStyle: React.CSSProperties = {
    fontSize: '0.75rem',
    color: 'var(--color-texto-suave)',
    display: 'block',
    marginBottom: '4px',
  }

  /** Estilo reutilizable para los contenedores de valor (simula input disabled) */
  const valorStyle: React.CSSProperties = {
    background: '#f3f4f6',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    padding: '8px 12px',
    fontSize: '0.85rem',
    fontWeight: 500,
    color: 'var(--color-texto)',
    display: 'block',
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-[var(--color-fondo-card)] rounded-xl shadow-xl w-[90vw] max-w-[580px] max-h-[85vh] overflow-y-auto relative"
        style={{ padding: '24px' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between" style={{ marginBottom: '8px' }}>
          <h2 className="text-[0.9rem] font-semibold text-[var(--color-texto)]">Datos del Paciente</h2>
          <button
            onClick={onClose}
            className="text-[var(--color-texto-suave)] hover:text-[var(--color-texto)] text-xl leading-none p-1"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <h3 className="text-[1.15rem] font-bold text-[var(--color-texto)]" style={{ marginBottom: '20px' }}>{paciente.nombre}</h3>

        {/* Fila 1: ID Paquete (20%) | Paquete (60%) | Desayuno (20%) */}
        <div style={{ display: 'grid', gridTemplateColumns: '20% 1fr 20%', gap: '12px', marginBottom: '20px' }}>
          <div>
            <span style={labelStyle}>ID Paquete</span>
            <span style={valorStyle}>{paciente.paqueteId}</span>
          </div>
          <div>
            <span style={labelStyle}>Paquete</span>
            <span style={valorStyle}>{paciente.paqueteNombre}</span>
          </div>
          <div>
            <span style={labelStyle}>Desayuno</span>
            <span
              style={{ backgroundColor: desayunoOpt?.color ?? '#666', width: '32px', height: '32px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: '#ffffff' }}
            >
              {desayunoOpt?.label === 'Sí' ? 'Sí' : desayunoOpt?.label === 'No' ? '✕' : '…'}
            </span>
          </div>
        </div>

        {/* Fila 2: Médico Internista (100%) */}
        <div style={{ marginBottom: '20px' }}>
          <span style={labelStyle}>Médico Internista</span>
          <span style={valorStyle}>
            {paciente.medicoInternista ?? '—'}
          </span>
        </div>

        {/* Fila 3: Edad (33%) | Peso (33%) | Talla (33%) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '20px' }}>
          <div>
            <span style={labelStyle}>Edad</span>
            <span style={valorStyle}>{paciente.edad}</span>
          </div>
          <div>
            <span style={labelStyle}>Peso</span>
            <span style={valorStyle}>{paciente.peso.toFixed(2)} Kg</span>
          </div>
          <div>
            <span style={labelStyle}>Talla</span>
            <span style={valorStyle}>{paciente.talla.toFixed(2)} cm</span>
          </div>
        </div>

        {/* Fila 4: Padecimientos (100%) */}
        <div style={{ marginBottom: '20px' }}>
          <span style={labelStyle}>Padecimientos</span>
          <span style={{ ...valorStyle, display: 'inline-block', borderRadius: '20px' }}>
            {paciente.padecimientoId > 0 ? `Padecimiento #${paciente.padecimientoId}` : 'Ninguno'}
          </span>
        </div>

        {/* Fila 5: Fecha Entrega (33%) | Hora Entrega (33%) | Tarjeta (33%) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '20px' }}>
          <div>
            <span style={labelStyle}>Fecha Entrega</span>
            <span style={{ ...valorStyle, textAlign: 'center', borderRadius: '20px' }}>{paciente.fechaEntrega ?? '—'}</span>
          </div>
          <div>
            <span style={labelStyle}>Hora Entrega</span>
            <span style={{ ...valorStyle, textAlign: 'center', borderRadius: '20px' }}>{paciente.horaEntrega ?? '—'}</span>
          </div>
          <div>
            <span style={labelStyle}>Tarjeta Entrega de Resultados</span>
            <span
              style={{ backgroundColor: tarjetaColor, borderRadius: '9999px', padding: '4px 12px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: '#ffffff' }}
            >
              {tarjetaLabel}
            </span>
          </div>
        </div>

        {/* Fila 6: Estudios Adicionales (100%) */}
        <div style={{ marginBottom: '20px' }}>
          <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-texto)', marginBottom: '8px' }}>Estudios Adicionales</h4>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-texto-suave)', background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '12px', textAlign: 'center' }}>
            No se encontró ningún resultado
          </p>
        </div>

        {/* Botón cerrar */}
        <div style={{ borderTop: '1px solid var(--color-borde)', paddingTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
          <Button size="sm" onClick={onClose}>Cerrar</Button>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL — ListaDiaPage
   ═══════════════════════════════════════════════════════════════════════════ */

function ListaDiaPage() {
  const hoy = formatDateMX(nowMX())
  const [fecha, setFecha] = useState(() => hoy)
  const { data: pacientes = [], refetch } = useListaDia(fecha)
  const updateCache = useUpdatePacienteCache()
  const [modalPaciente, setModalPaciente] = useState<PacienteListaDia | null>(null)

  // Actualizar manualmente
  const handleActualizar = useCallback(() => {
    refetch()
  }, [refetch])

  // Auto-actualizar al cambiar fecha
  const handleFechaChange = useCallback((newFecha: string) => {
    setFecha(newFecha)
  }, [])

  // Cambio de desayuno (optimistic via cache)
  const handleDesayunoChange = useCallback((seguimientoId: string, value: 0 | 1 | 2) => {
    updateCache(fecha, seguimientoId, { desayuno: value })
  }, [fecha, updateCache])

  // Cambio de estatus de estudio (optimistic via cache)
  const handleEstudioChange = useCallback((seguimientoId: string, estudioId: number, estatusId: number) => {
    const pac = pacientes.find((p) => p.seguimientoId === seguimientoId)
    if (pac) {
      updateCache(fecha, seguimientoId, { estudios: { ...pac.estudios, [estudioId]: estatusId } })
    }
  }, [fecha, updateCache, pacientes])

  return (
    <div className="text-[0.8rem]">
      <h1 className="page-title">Lista de Pacientes</h1>

      {/* Toolbar */}
      <div
        className="sticky top-0 z-20"
        style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px', marginBottom: '12px', backgroundColor: 'var(--color-fondo-card)', border: '1px solid var(--color-borde)', borderRadius: '8px', boxShadow: '0 2px 8px rgba(10,31,92,0.06)' }}
      >
        <span style={{ fontWeight: 500, color: 'var(--color-texto-suave)', fontSize: '0.875rem', flexShrink: 0 }}>Fecha:</span>
        <input
          type="date"
          value={fecha}
          onChange={(e) => handleFechaChange(e.target.value)}
          style={{ width: '160px', minHeight: '38px', height: '38px', fontSize: '0.875rem', padding: '0 10px', border: '1px solid var(--color-borde)', borderRadius: '8px', backgroundColor: 'var(--color-fondo-card)', color: 'var(--color-texto)', flexShrink: 0 }}
        />
        <button
          onClick={handleActualizar}
          style={{ flexShrink: 0, minHeight: '38px', padding: '0 16px', fontWeight: 600, fontSize: '0.875rem', color: '#ffffff', backgroundColor: '#0b2340', borderRadius: '8px', border: 'none', cursor: 'pointer' }}
        >
          ↻ Actualizar
        </button>
        <span style={{ color: '#1976D2', fontSize: '0.8125rem', fontWeight: 600, flexShrink: 0, backgroundColor: 'rgba(25,118,210,0.1)', borderRadius: '20px', padding: '4px 12px' }}>
          {pacientes.length} pacientes
        </span>
      </div>

      {/* Leyenda de colores */}
      <div
        style={{ backgroundColor: 'var(--color-fondo-card)', border: '1px solid var(--color-borde)', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}
      >
        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-texto)' }}>Código de Colores</span>
        <div style={{ display: 'flex', flexWrap: 'nowrap', gap: '10px', alignItems: 'center', overflowX: 'auto', paddingBottom: '4px' }}>
          {LEYENDA.map((item) => (
            <div key={item.nombre} style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
              <span style={{ width: '14px', height: '14px', borderRadius: '3px', flexShrink: 0, backgroundColor: item.color }} />
              <span style={{ fontSize: '0.75rem', color: 'var(--color-texto-suave)', whiteSpace: 'nowrap' }}>{item.nombre}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tabla */}
      {pacientes.length === 0 ? (
        <div className="bg-[var(--color-fondo-card)] rounded-[var(--radius-default)] shadow-[var(--shadow-card)] p-10 text-center text-[var(--color-texto-suave)] text-sm">
          No hay pacientes para esta fecha.
        </div>
      ) : (
        <div style={{ borderRadius: '10px', overflow: 'hidden' }}>
          <table className="border-collapse w-full bg-[var(--color-fondo-card)] table-fixed">
            <thead className="bg-[var(--color-primario)] sticky top-0 z-10">
              <tr>
                {/* Turno — sticky */}
                <th className="sticky left-0 z-[11] bg-[var(--color-primario)] py-4 text-center text-[0.7rem] font-semibold text-white border-b-2 border-b-white/12 w-[40px]" style={{ paddingLeft: '1px', borderTopLeftRadius: '10px' }}>
                  Turno
                </th>
                {/* Nombre — sticky */}
                <th className="sticky left-[20px] z-[11] bg-[var(--color-primario)] py-4 text-left text-[0.7rem] font-semibold text-white border-b-2 border-b-white/12 w-[160px]" style={{ paddingLeft: '10px' }}>
                  Nombre del Paciente
                </th>
                {/* Desayuno */}
                <th className="px-0 py-4 text-center text-[0.7rem] font-semibold text-white border-b-2 border-b-white/12 w-[55px]">
                  Desayuno
                </th>
                {/* Columnas de estudios */}
                {ESTUDIOS_COLUMNAS.map((est) => (
                  <th
                    key={est.id}
                    className="px-0 py-4 text-center font-semibold text-white border-b-2 border-b-white/12 align-middle w-[32px]"
                    title={est.nombre}
                  >
                    <div className="flex flex-col items-center justify-center h-[46px]">
                      <span className="inline-block whitespace-nowrap text-[0.65rem] font-bold tracking-wide -rotate-45 origin-center leading-none">
                        {est.abrev}
                      </span>
                    </div>
                  </th>
                ))}
                {/* Obs */}
                <th className="px-0 py-4 text-center text-[0.7rem] font-semibold text-white border-b-2 border-b-white/12 w-[36px]">
                  Obs
                </th>
                {/* Médico Internista */}
                <th className="px-0 py-4 text-left text-[0.7rem] font-semibold text-white border-b-2 border-b-white/12 w-[80px]">
                  Médico Internista
                </th>
                {/* Vínculos */}
                <th className="px-0 py-4 text-center text-[0.7rem] font-semibold text-white border-b-2 border-b-white/12 w-[60px]" style={{ borderTopRightRadius: '10px' }}>
                  Vínculos
                </th>
              </tr>
            </thead>
            <tbody>
              {pacientes.map((pac, idx) => {
                const completo = pac.estatusValpac === 2
                const listoParaSalir = pac.estatusValpac === 1
                const tienePadecimiento = pac.padecimientoId > 0
                const rowBgBase = idx % 2 === 0 ? 'var(--color-fondo)' : 'var(--color-fondo-card)'

                // Color de celda Turno
                const turnoBg = completo
                  ? 'rgba(0, 130, 180, 0.30)'
                  : tienePadecimiento
                    ? 'rgba(245, 180, 50, 0.30)'
                    : rowBgBase

                // Color de celda Nombre
                const nombreBg = (completo || listoParaSalir)
                  ? 'rgba(0, 166, 81, 0.28)'
                  : tienePadecimiento
                    ? 'rgba(245, 180, 50, 0.30)'
                    : rowBgBase

                return (
                  <tr key={pac.seguimientoId} style={{ backgroundColor: rowBgBase }}>
                    {/* Turno — sticky */}
                    <td
                      className="sticky left-0 z-[9] px-0 py-[14px] text-center border-b border-b-[var(--color-borde)]"
                      style={{ backgroundColor: turnoBg }}
                    >
                      <span className="inline-flex items-center justify-center w-[18px] h-[18px] rounded-full bg-[rgba(10,31,92,0.08)] text-[var(--color-primario)] font-bold text-[0.7rem]">
                        {pac.turno}
                      </span>
                    </td>
                    {/* Nombre — sticky */}
                    <td
                      className="sticky left-[40px] z-[9] py-[14px] border-b border-b-[var(--color-borde)] text-[0.7rem] leading-tight whitespace-normal break-words overflow-hidden"
                      style={{ backgroundColor: nombreBg, paddingLeft: '5px' }}
                    >
                      <div className="flex items-center gap-0.5">
                        <span className={`font-medium ${tienePadecimiento && !completo ? 'text-[#F57C00]' : 'text-[var(--color-texto)]'}`}>
                          {pac.nombre}
                        </span>
                        {tienePadecimiento && !completo && (
                          <svg className="w-2.5 h-2.5 shrink-0 text-[#F57C00]" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </td>
                    {/* Desayuno — pill badge */}
                    <td className="px-0 py-[14px] text-center border-b border-b-[var(--color-borde)] align-middle">
                      <div className="relative inline-flex items-center justify-center">
                        <select
                          value={pac.desayuno}
                          onChange={(e) => handleDesayunoChange(pac.seguimientoId, Number(e.target.value) as 0 | 1 | 2)}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-[1]"
                          aria-label="Desayuno"
                        >
                          {DESAYUNO_OPCIONES.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                        <span
                          className="select-none pointer-events-none"
                          style={{
                            backgroundColor: DESAYUNO_OPCIONES.find((d) => d.value === pac.desayuno)?.color ?? '#666',
                            color: pac.desayuno === 1 ? '#1a1a1a' : '#ffffff',
                            fontSize: '0.6rem',
                            fontWeight: 700,
                            width: '57px',
                            height: '28px',
                            borderRadius: '4px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {DESAYUNO_OPCIONES.find((d) => d.value === pac.desayuno)?.label ?? '—'}
                        </span>
                      </div>
                    </td>

                    {/* Celdas de estudios — cuadros sólidos con letra */}
                    {ESTUDIOS_COLUMNAS.map((est) => {
                      const estatusId = pac.estudios[est.id] ?? 0
                      const estatus = ESTATUS_ESTUDIO.find((e) => e.id === estatusId) ?? ESTATUS_ESTUDIO[0]
                      return (
                        <td
                          key={est.id}
                          style={{ padding: '2px', textAlign: 'center', borderBottom: '1px solid var(--color-borde)', verticalAlign: 'middle' }}
                        >
                          <div className="relative" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', margin: '0 auto' }}>
                            <select
                              value={estatusId}
                              onChange={(e) => handleEstudioChange(pac.seguimientoId, est.id, Number(e.target.value))}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-[1]"
                              title={`${est.nombre}: ${estatus.nombre}`}
                              aria-label={`${est.nombre}: ${estatus.nombre}`}
                            >
                              {ESTATUS_ESTUDIO.map((s) => (
                                <option key={s.id} value={s.id}>{s.nombre}</option>
                              ))}
                            </select>
                            <span
                              className="flex items-center justify-center w-[28px] h-[28px] text-[0.6rem] font-bold select-none pointer-events-none"
                              style={{
                                backgroundColor: estatus.esBorde ? 'transparent' : estatus.color,
                                border: estatus.esBorde ? '1.5px solid #d1d5db' : 'none',
                                borderRadius: '4px',
                                color: estatus.esBorde ? 'transparent' : '#ffffff',
                              }}
                            >
                              {estatus.letra}
                            </span>
                          </div>
                        </td>
                      )
                    })}

                    {/* Obs — botón ojo → modal */}
                    <td style={{ padding: '7px 2px', borderBottom: '1px solid var(--color-borde)', textAlign: 'center', verticalAlign: 'middle', overflow: 'visible' }}>
                      <button
                        onClick={() => setModalPaciente(pac)}
                        className={pac.tieneAdicionales ? 'animate-[obsPulse_2s_ease-in-out_1]' : ''}
                        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: '24px', minHeight: '24px', border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}
                        title={pac.tieneAdicionales ? 'Estudios adicionales — ver datos' : 'Ver datos del paciente'}
                        aria-label={`Ver datos de ${pac.nombre}`}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" stroke={pac.tieneAdicionales ? '#FF8C00' : '#0b2340'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          <circle cx="12" cy="12" r="3" stroke={pac.tieneAdicionales ? '#FF8C00' : '#0b2340'} strokeWidth="1.5" />
                        </svg>
                      </button>
                    </td>

                    {/* Médico Internista */}
                    <td className="px-0.5 py-[14px] border-b border-b-[var(--color-borde)] whitespace-normal break-words text-[0.7rem] leading-tight overflow-hidden">
                      {pac.medicoInternista ?? <span className="text-[var(--color-texto-suave)] text-[0.7rem]">SIN ASIGNAR</span>}
                    </td>

                    {/* Vínculos */}
                    <td style={{ padding: '7px 2px', borderBottom: '1px solid var(--color-borde)', textAlign: 'center', verticalAlign: 'middle', overflow: 'visible' }}>
                      <Link
                        to="/paciente/$seguimientoId"
                        params={{ seguimientoId: pac.seguimientoId }}
                        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: '24px', minHeight: '24px' }}
                        title={`Detalle seguimiento #${pac.seguimientoId}`}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" stroke="#0b2340" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="#0b2340" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Datos del Paciente */}
      {modalPaciente && (
        <ModalDatosPaciente paciente={modalPaciente} onClose={() => setModalPaciente(null)} />
      )}
    </div>
  )
}
