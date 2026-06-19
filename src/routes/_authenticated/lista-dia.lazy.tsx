import { createLazyFileRoute, Link } from '@tanstack/react-router'
import { useState, useCallback, useRef, useEffect, memo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Sheet } from '@/components/ui/sheet'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Pressable } from '@/components/ui/pressable'
import { hapticFeedback } from '@/lib/motion'
import { nowMX, formatDateMX } from '@/lib/timezone'
import { useListaDia, useUpdatePacienteCache, LISTA_DIA_QUERY_KEY } from '@/hooks/use-lista-dia'
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
  open,
  onClose,
}: {
  paciente: PacienteListaDia
  open: boolean
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
    <Sheet open={open} onOpenChange={(v) => !v && onClose()} title="Datos del Paciente">
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

        <div style={{ borderTop: '1px solid var(--color-borde)', paddingTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
          <Button onClick={onClose}>Cerrar</Button>
        </div>
    </Sheet>
  )
}

type EstatusOption = (typeof ESTATUS_ESTUDIO)[number]

function EstatusCellPicker({
  value,
  options,
  label,
  onChange,
}: {
  value: number
  options: readonly EstatusOption[]
  label: string
  onChange: (id: number) => void
}) {
  const estatus = options.find((e) => e.id === value) ?? options[0]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Pressable
          variant="lite"
          className="estatus-cell"
          style={{
            backgroundColor: estatus.esBorde ? 'transparent' : estatus.color,
            border: estatus.esBorde ? '1.5px solid #d1d5db' : 'none',
            color: estatus.esBorde ? 'transparent' : '#ffffff',
            fontSize: '0.65rem',
          }}
          aria-label={`${label}: ${estatus.nombre}`}
        >
          {estatus.letra}
        </Pressable>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center">
        {options.map((opt) => (
          <DropdownMenuItem
            key={opt.id}
            onClick={() => {
              onChange(opt.id)
              hapticFeedback()
              toast.success(`${label}: ${opt.nombre}`)
            }}
          >
            <span
              style={{
                width: 14,
                height: 14,
                borderRadius: 3,
                backgroundColor: opt.esBorde ? 'transparent' : opt.color,
                border: opt.esBorde ? '1.5px solid #d1d5db' : 'none',
                flexShrink: 0,
              }}
            />
            {opt.nombre}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function DesayunoPicker({
  value,
  onChange,
}: {
  value: 0 | 1 | 2
  onChange: (v: 0 | 1 | 2) => void
}) {
  const opt = DESAYUNO_OPCIONES.find((d) => d.value === value)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Pressable
          variant="lite"
          className="touch-target"
          style={{
            backgroundColor: opt?.color ?? '#666',
            color: value === 1 ? '#1a1a1a' : '#ffffff',
            fontSize: '0.65rem',
            fontWeight: 700,
            width: 50,
            minWidth: 50,
            minHeight: 44,
            borderRadius: 4,
          }}
          aria-label="Desayuno"
        >
          {opt?.label ?? '—'}
        </Pressable>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center">
        {DESAYUNO_OPCIONES.map((o) => (
          <DropdownMenuItem
            key={o.value}
            onClick={() => {
              onChange(o.value as 0 | 1 | 2)
              hapticFeedback()
              toast.success(`Desayuno: ${o.label}`)
            }}
          >
            <span style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: o.color }} />
            {o.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   COMPONENTE — Fila de paciente (memoizada)
   ═══════════════════════════════════════════════════════════════════════════ */

interface PacienteRowProps {
  pac: PacienteListaDia
  idx: number
  onDesayunoChange: (seguimientoId: string, value: 0 | 1 | 2) => void
  onEstudioChange: (seguimientoId: string, estudioId: number, estatusId: number) => void
  onOpenModal: (paciente: PacienteListaDia) => void
}

const PacienteRow = memo(function PacienteRow({
  pac,
  idx,
  onDesayunoChange,
  onEstudioChange,
  onOpenModal,
}: PacienteRowProps) {
  const completo = pac.estatusValpac === 2
  const listoParaSalir = pac.estatusValpac === 1
  const tienePadecimiento = pac.padecimientoId > 0
  const rowBgBase = idx % 2 === 0 ? 'var(--color-fondo)' : 'var(--color-fondo-card)'

  const turnoBg = completo
    ? 'rgba(0, 130, 180, 0.30)'
    : tienePadecimiento
      ? 'rgba(245, 180, 50, 0.30)'
      : rowBgBase

  const nombreBg = (completo || listoParaSalir)
    ? 'rgba(0, 166, 81, 0.28)'
    : tienePadecimiento
      ? 'rgba(245, 180, 50, 0.30)'
      : rowBgBase

  return (
    <tr style={{ backgroundColor: rowBgBase }}>
      <td
        className="sticky left-0 z-[9] px-0 py-[4px] text-center border-b border-b-[var(--color-borde)]"
        style={{ backgroundColor: turnoBg }}
      >
        <span className="inline-flex items-center justify-center w-[18px] h-[18px] rounded-full bg-[rgba(10,31,92,0.08)] text-[var(--color-primario)] font-bold text-[0.7rem]">
          {pac.turno}
        </span>
      </td>
      <td
        className="sticky left-[40px] z-[9] py-[4px] border-b border-b-[var(--color-borde)] text-[0.7rem] leading-tight whitespace-normal break-words overflow-hidden"
        style={{ backgroundColor: nombreBg, paddingLeft: '5px' }}
      >
        <div className="flex items-center gap-0.5">
          <span className={`font-medium ${tienePadecimiento && !completo ? 'text-[#F57C00]' : 'text-[var(--color-texto)]'}`}>
            {pac.nombre}
          </span>
          {tienePadecimiento && !completo && (
            <svg className="w-4 h-4 shrink-0 text-[#F57C00] mr-1" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
          )}
        </div>
      </td>
      <td className="px-0 py-[4px] text-center border-b border-b-[var(--color-borde)] align-middle">
        <DesayunoPicker
          value={pac.desayuno}
          onChange={(v) => onDesayunoChange(pac.seguimientoId, v)}
        />
      </td>
      {ESTUDIOS_COLUMNAS.map((est) => {
        const estatusId = pac.estudios[est.id] ?? 0
        return (
          <td
            key={est.id}
            className="interactive"
            style={{ padding: '2px', textAlign: 'center', borderBottom: '1px solid var(--color-borde)', verticalAlign: 'middle' }}
          >
            <div className="flex items-center justify-center mx-auto">
              <EstatusCellPicker
                value={estatusId}
                options={ESTATUS_ESTUDIO}
                label={est.nombre}
                onChange={(id) => onEstudioChange(pac.seguimientoId, est.id, id)}
              />
            </div>
          </td>
        )
      })}
      <td style={{ padding: '2px 2px', borderBottom: '1px solid var(--color-borde)', textAlign: 'center', verticalAlign: 'middle', overflow: 'visible' }}>
        <Pressable
          variant="lite"
          onClick={() => onOpenModal(pac)}
          className={`touch-target ${pac.tieneAdicionales ? 'animate-[obsPulse_2s_ease-in-out_1]' : ''}`}
          style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}
          aria-label={`Ver datos de ${pac.nombre}`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" stroke={pac.tieneAdicionales ? '#FF8C00' : '#0b2340'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="12" cy="12" r="3" stroke={pac.tieneAdicionales ? '#FF8C00' : '#0b2340'} strokeWidth="1.5" />
          </svg>
        </Pressable>
      </td>
      <td className="px-0.5 py-[4px] border-b border-b-[var(--color-borde)] whitespace-normal break-words text-[0.7rem] leading-tight overflow-hidden">
        {pac.medicoInternista ?? <span className="text-[var(--color-texto-suave)] text-[0.7rem]">SIN ASIGNAR</span>}
      </td>
      <td style={{ padding: '2px 2px', borderBottom: '1px solid var(--color-borde)', textAlign: 'center', verticalAlign: 'middle', overflow: 'visible' }}>
        <Link
          to="/paciente/$seguimientoId"
          params={{ seguimientoId: pac.seguimientoId }}
          className="touch-target inline-flex items-center justify-center interactive"
          title={`Detalle seguimiento #${pac.seguimientoId}`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" stroke="#0b2340" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="#0b2340" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </td>
    </tr>
  )
})

/* ═══════════════════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL — ListaDiaPage
   ═══════════════════════════════════════════════════════════════════════════ */

function ListaDiaPage() {
  const hoy = formatDateMX(nowMX())
  const [fecha, setFecha] = useState(() => hoy)
  const { data: pacientes = [], refetch } = useListaDia(fecha)
  const updateCache = useUpdatePacienteCache()
  const queryClient = useQueryClient()
  const [modalPaciente, setModalPaciente] = useState<PacienteListaDia | null>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const [toolbarHeight, setToolbarHeight] = useState(0)

  useEffect(() => {
    if (toolbarRef.current) {
      const ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          setToolbarHeight(entry.borderBoxSize[0]?.blockSize ?? entry.target.getBoundingClientRect().height)
        }
      })
      ro.observe(toolbarRef.current)
      return () => ro.disconnect()
    }
  }, [])

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
    queryClient.setQueryData<PacienteListaDia[]>(
      [...LISTA_DIA_QUERY_KEY, fecha],
      (old) => {
        if (!old) return old
        return old.map((p) =>
          p.seguimientoId === seguimientoId
            ? { ...p, estudios: { ...p.estudios, [estudioId]: estatusId } }
            : p,
        )
      },
    )
  }, [fecha, queryClient])

  const handleOpenModal = useCallback((paciente: PacienteListaDia) => {
    setModalPaciente(paciente)
  }, [])

  return (
    <div className="text-[0.8rem]">
      <h1 className="page-title">Lista de Pacientes</h1>

      {/* Toolbar */}
      <div
        ref={toolbarRef}
        className="sticky top-0 z-20"
        style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '6px 16px', marginBottom: '6px', backgroundColor: 'var(--color-fondo-card)', border: '1px solid var(--color-borde)', borderRadius: '8px', boxShadow: '0 2px 8px rgba(10,31,92,0.06)' }}
      >
        <span style={{ fontWeight: 500, color: 'var(--color-texto-suave)', fontSize: '0.875rem', flexShrink: 0 }}>Fecha:</span>
        <input
          type="date"
          value={fecha}
          onChange={(e) => handleFechaChange(e.target.value)}
          style={{ width: '160px', minHeight: '44px', height: '44px', fontSize: '0.875rem', padding: '0 10px', border: '1px solid var(--color-borde)', borderRadius: '8px', backgroundColor: 'var(--color-fondo-card)', color: 'var(--color-texto)', flexShrink: 0 }}
        />
        <button
          onClick={handleActualizar}
          className="interactive"
          style={{ flexShrink: 0, minHeight: '44px', padding: '0 16px', fontWeight: 600, fontSize: '0.875rem', color: '#ffffff', backgroundColor: '#0b2340', borderRadius: '8px', border: 'none', cursor: 'pointer' }}
        >
          ↻ Actualizar
        </button>
        <span style={{ color: '#1976D2', fontSize: '0.8125rem', fontWeight: 600, flexShrink: 0, backgroundColor: 'rgba(25,118,210,0.1)', borderRadius: '20px', padding: '4px 12px' }}>
          {pacientes.length} pacientes
        </span>
      </div>

      {/* Leyenda de colores */}
      <div
        style={{ backgroundColor: 'var(--color-fondo-card)', border: '1px solid var(--color-borde)', borderRadius: '8px', padding: '6px 16px', marginBottom: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}
      >
        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-texto)' }}>Código de Colores</span>
        <div className="scroll-x scroll-touch" style={{ display: 'flex', flexWrap: 'nowrap', gap: '10px', alignItems: 'center', paddingBottom: '4px' }}>
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
        <div className="scroll-x scroll-touch rounded-[10px] shadow-[var(--shadow-card)] border border-[var(--color-borde)]">
          <table className="border-collapse w-full bg-[var(--color-fondo-card)] table-fixed min-w-[1100px]">
            <thead className="bg-[var(--color-primario)] z-10" style={{ position: 'sticky', top: `${toolbarHeight}px` }}>
              <tr>
                <th className="sticky left-0 z-[11] bg-[var(--color-primario)] py-1.5 text-center text-[0.7rem] font-semibold text-white border-b-2 border-b-white/12 w-[40px]" style={{ paddingLeft: '1px', borderTopLeftRadius: '10px' }}>
                  Turno
                </th>
                <th className="sticky left-[40px] z-[11] bg-[var(--color-primario)] py-1.5 text-left text-[0.7rem] font-semibold text-white border-b-2 border-b-white/12 w-[160px]" style={{ paddingLeft: '10px' }}>
                  Nombre del Paciente
                </th>
                {/* Desayuno */}
                <th className="px-0 py-1.5 text-center text-[0.7rem] font-semibold text-white border-b-2 border-b-white/12 w-[55px]">
                  Desayuno
                </th>
                {/* Columnas de estudios */}
                {ESTUDIOS_COLUMNAS.map((est) => (
                  <th
                    key={est.id}
                    className="px-0 py-1.5 text-center font-semibold text-white border-b-2 border-b-white/12 align-middle w-[32px]"
                    title={est.nombre}
                  >
                    <div className="flex flex-col items-center justify-center h-[32px]">
                      <span className="inline-block whitespace-nowrap text-[0.65rem] font-bold tracking-wide -rotate-45 origin-center leading-none">
                        {est.abrev}
                      </span>
                    </div>
                  </th>
                ))}
                {/* Obs */}
                <th className="px-0 py-1.5 text-center text-[0.7rem] font-semibold text-white border-b-2 border-b-white/12 w-[36px]">
                  Obs
                </th>
                {/* Médico Internista */}
                <th className="px-1 py-1.5 text-left text-[0.7rem] font-semibold text-white border-b-2 border-b-white/12 w-[90px]">
                  Médico Internista
                </th>
                {/* Vínculos */}
                <th className="px-0 py-1.5 text-center text-[0.7rem] font-semibold text-white border-b-2 border-b-white/12 w-[50px] overflow-visible" style={{ borderTopRightRadius: '10px' }}>
                  <span style={{ position: 'relative', left: '-6px' }}>Vínculos</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {pacientes.map((pac, idx) => (
                <PacienteRow
                  key={pac.seguimientoId}
                  pac={pac}
                  idx={idx}
                  onDesayunoChange={handleDesayunoChange}
                  onEstudioChange={handleEstudioChange}
                  onOpenModal={handleOpenModal}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Datos del Paciente */}
      {modalPaciente && (
        <ModalDatosPaciente
          paciente={modalPaciente}
          open={!!modalPaciente}
          onClose={() => setModalPaciente(null)}
        />
      )}
    </div>
  )
}
