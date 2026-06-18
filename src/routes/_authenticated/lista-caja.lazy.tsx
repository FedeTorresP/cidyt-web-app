import { createLazyFileRoute, Link } from '@tanstack/react-router'
import { useState, useCallback, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { nowMX, formatDateMX } from '@/lib/timezone'
import { useListaCaja } from '@/hooks/use-lista-caja'

export const Route = createLazyFileRoute('/_authenticated/lista-caja')({
  component: ListaCajaPage,
})

/* ═══════════════════════════════════════════════════════════════════════════
   CONSTANTES — Estudios, Estatus, Desayuno, Colores
   ═══════════════════════════════════════════════════════════════════════════ */

/** Los 20 estudios del sistema en orden de columna. */
const ESTUDIOS_COLUMNAS = [
  { id: 1, abrev: 'LAB', nombre: 'Laboratorios' },
  { id: 2, abrev: 'TOR', nombre: 'Torax' },
  { id: 3, abrev: 'ABD', nombre: 'US. Abdomen' },
  { id: 4, abrev: 'MAM', nombre: 'US. Mamario' },
  { id: 5, abrev: 'MAS', nombre: 'Mastografía' },
  { id: 6, abrev: 'CT', nombre: 'CT' },
  { id: 7, abrev: 'ORT', nombre: 'Ortopantomografía' },
  { id: 8, abrev: 'DEN', nombre: 'Densitometría' },
  { id: 9, abrev: 'ESP', nombre: 'Espirometría' },
  { id: 19, abrev: 'EKG', nombre: 'Electrocardiograma' },
  { id: 10, abrev: 'E+P', nombre: 'Ecocardiograma + Prueba' },
  { id: 11, abrev: 'COL', nombre: 'Colposcopía' },
  { id: 12, abrev: 'PAP', nombre: 'Papanicolaou' },
  { id: 13, abrev: 'AUD', nombre: 'Audiometría' },
  { id: 14, abrev: 'DNT', nombre: 'Dental' },
  { id: 15, abrev: 'OFT', nombre: 'Oftalmología' },
  { id: 16, abrev: 'NUT', nombre: 'Nutrición' },
  { id: 17, abrev: 'OTP', nombre: 'Otorrinolaringología' },
  { id: 18, abrev: 'PRO', nombre: 'Proctología' },
  { id: 20, abrev: 'FIB', nombre: 'Fibroscopía' },
] as const

/** Estatus de estudio — colores y letra para cuadro sólido (READ-ONLY). */
const ESTATUS_ESTUDIO = [
  { id: 0, nombre: 'Sin Estatus', color: '#9ca3af', letra: '', esBorde: false },
  { id: 1, nombre: 'No Incluido', color: '#374151', letra: '', esBorde: false },
  { id: 2, nombre: 'En Espera', color: '#1976D2', letra: 'E', esBorde: false },
  { id: 3, nombre: 'En Proceso', color: '#facc15', letra: '', esBorde: false },
  { id: 4, nombre: 'Completo', color: '#00A651', letra: 'C', esBorde: false },
  { id: 5, nombre: 'Pendiente', color: '#7B1FA2', letra: 'P', esBorde: false },
  { id: 6, nombre: 'No Acepta', color: '#D32F2F', letra: 'N', esBorde: false },
  { id: 7, nombre: 'Cambio Estudio', color: '#0288D1', letra: 'C', esBorde: false },
  { id: 8, nombre: 'Estudio Combinado', color: '#873600', letra: '', esBorde: false },
] as const

/** Desayuno — texto coloreado read-only. */
const DESAYUNO_MAP = [
  { value: 0, label: 'No', color: '#D32F2F' },
  { value: 1, label: 'En', color: '#F57C00' },
  { value: 2, label: 'Sí', color: '#00A651' },
] as const

/** Tarjeta Entrega Resultados — texto coloreado read-only. */
const TARJETA_MAP: Record<number, { label: string; color: string }> = {
  0: { label: 'No', color: '#D32F2F' },
  1: { label: 'Sí', color: '#00A651' },
  2: { label: 'Env', color: '#1976D2' },
}

/* ═══════════════════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL — ListaCajaPage
   ═══════════════════════════════════════════════════════════════════════════ */

function ListaCajaPage() {
  const hoy = formatDateMX(nowMX())
  const [fecha, setFecha] = useState(() => hoy)
  const { data: pacientes = [], refetch } = useListaCaja(fecha)
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

  const handleActualizar = useCallback(() => {
    refetch()
  }, [refetch])

  const handleFechaChange = useCallback((newFecha: string) => {
    setFecha(newFecha)
  }, [])

  return (
    <div className="text-[0.8rem]">
      <h1 className="page-title">Lista de Estudios — Caja</h1>

      {/* ── Toolbar ── */}
      <div
        ref={toolbarRef}
        className="sticky top-0 z-20"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '6px 16px',
          marginBottom: '6px',
          backgroundColor: 'var(--color-fondo-card)',
          border: '1px solid var(--color-borde)',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(10,31,92,0.06)',
        }}
      >
        <span style={{ fontWeight: 500, color: 'var(--color-texto-suave)', fontSize: '0.875rem', flexShrink: 0 }}>
          Fecha:
        </span>
        <input
          type="date"
          value={fecha}
          onChange={(e) => handleFechaChange(e.target.value)}
          style={{
            width: '160px',
            minHeight: '38px',
            height: '38px',
            fontSize: '0.875rem',
            padding: '0 10px',
            border: '1px solid var(--color-borde)',
            borderRadius: '8px',
            backgroundColor: 'var(--color-fondo-card)',
            color: 'var(--color-texto)',
            flexShrink: 0,
          }}
        />
        <Button
          size="sm"
          onClick={handleActualizar}
          style={{ flexShrink: 0, minHeight: '38px', padding: '0 16px', fontWeight: 600, fontSize: '0.875rem' }}
        >
          ↻ Actualizar
        </Button>
        <span
          style={{
            color: '#1976D2',
            fontSize: '0.8125rem',
            fontWeight: 600,
            flexShrink: 0,
            backgroundColor: 'rgba(25,118,210,0.1)',
            borderRadius: '20px',
            padding: '4px 12px',
          }}
        >
          {pacientes.length} pacientes
        </span>
      </div>

      {/* ── Tabla ── */}
      {pacientes.length === 0 ? (
        <div className="bg-[var(--color-fondo-card)] rounded-[var(--radius-default)] shadow-[var(--shadow-card)] p-10 text-center text-[var(--color-texto-suave)] text-sm">
          No hay pacientes para esta fecha.
        </div>
      ) : (
        <div style={{ borderRadius: '10px' }}>
          <table className="border-collapse bg-[var(--color-fondo-card)]" style={{ minWidth: '100%', tableLayout: 'fixed' }}>
            <thead className="z-10" style={{ position: 'sticky', top: `${toolbarHeight}px`, backgroundColor: 'var(--color-primario)' }}>
              <tr>
                {/* Turno — sticky */}
                <th
                  className="sticky left-0 z-[11] py-1.5 text-center text-[0.7rem] font-semibold text-white border-b-2 border-b-white/12"
                  style={{ width: '40px', backgroundColor: 'var(--color-primario)', borderTopLeftRadius: '10px' }}
                >
                  T
                </th>
                {/* Nombre — sticky */}
                <th
                  className="sticky z-[11] py-1.5 text-left text-[0.7rem] font-semibold text-white border-b-2 border-b-white/12"
                  style={{ left: '40px', width: '160px', paddingLeft: '6px', backgroundColor: 'var(--color-primario)' }}
                >
                  Nombre del Paciente
                </th>
                {/* Edad */}
                <th className="py-1.5 text-center text-[0.7rem] font-semibold text-white border-b-2 border-b-white/12" style={{ width: '38px' }}>
                  Edad
                </th>
                {/* Paquete */}
                <th className="py-1.5 text-left text-[0.7rem] font-semibold text-white border-b-2 border-b-white/12" style={{ width: '180px', paddingLeft: '6px' }}>
                  Paquete
                </th>
                {/* Peso */}
                <th className="py-1.5 text-center text-[0.7rem] font-semibold text-white border-b-2 border-b-white/12" style={{ width: '48px' }}>
                  Peso
                </th>
                {/* Talla */}
                <th className="py-1.5 text-center text-[0.7rem] font-semibold text-white border-b-2 border-b-white/12" style={{ width: '48px' }}>
                  Talla
                </th>
                {/* Desayuno */}
                <th className="py-1.5 text-center text-[0.7rem] font-semibold text-white border-b-2 border-b-white/12" style={{ width: '40px' }}>
                  <div className="flex flex-col items-center justify-center h-[32px]">
                    <span className="inline-block whitespace-nowrap text-[0.65rem] font-bold tracking-wide -rotate-45 origin-center leading-none">
                      Des
                    </span>
                  </div>
                </th>
                {/* Tarjeta */}
                <th className="py-1.5 text-center text-[0.7rem] font-semibold text-white border-b-2 border-b-white/12" style={{ width: '40px' }}>
                  <div className="flex flex-col items-center justify-center h-[32px]">
                    <span className="inline-block whitespace-nowrap text-[0.65rem] font-bold tracking-wide -rotate-45 origin-center leading-none">
                      Tar
                    </span>
                  </div>
                </th>
                {/* Columnas de estudios */}
                {ESTUDIOS_COLUMNAS.map((est) => (
                  <th
                    key={est.id}
                    className="px-0 py-1.5 text-center font-semibold text-white border-b-2 border-b-white/12 align-middle"
                    style={{ width: '32px' }}
                    title={est.nombre}
                  >
                    <div className="flex flex-col items-center justify-center h-[32px]">
                      <span className="inline-block whitespace-nowrap text-[0.65rem] font-bold tracking-wide -rotate-45 origin-center leading-none">
                        {est.abrev}
                      </span>
                    </div>
                  </th>
                ))}
                {/* Médico Internista */}
                <th
                  className="py-1.5 text-left text-[0.7rem] font-semibold text-white border-b-2 border-b-white/12"
                  style={{ width: '160px', paddingLeft: '6px', borderTopRightRadius: '10px' }}
                >
                  Médico Internista
                </th>
              </tr>
            </thead>
            <tbody>
              {pacientes.map((pac, idx) => {
                const completo = pac.estatusValpac === 2
                const listoParaSalir = pac.estatusValpac === 1
                const rowBgBase = idx % 2 === 0 ? 'var(--color-fondo)' : 'var(--color-fondo-card)'

                // Color de celda Turno
                const turnoBg = completo ? 'rgba(0, 130, 180, 0.30)' : rowBgBase

                // Color de celda Nombre
                const nombreBg = (completo || listoParaSalir)
                  ? 'rgba(0, 166, 81, 0.28)'
                  : rowBgBase

                return (
                  <tr key={pac.seguimientoId} style={{ backgroundColor: rowBgBase }}>
                    {/* Turno — sticky */}
                    <td
                      className="sticky left-0 z-[9] px-0 py-[2px] text-center border-b border-b-[var(--color-borde)]"
                      style={{ backgroundColor: turnoBg }}
                    >
                      <span className="inline-flex items-center justify-center w-[18px] h-[18px] rounded-full bg-[rgba(10,31,92,0.08)] text-[var(--color-primario)] font-bold text-[0.7rem]">
                        {pac.turno}
                      </span>
                    </td>
                    {/* Nombre — sticky, link a /caja/$seguimientoId */}
                    <td
                      className="sticky z-[9] py-[2px] border-b border-b-[var(--color-borde)] text-[0.7rem] leading-tight whitespace-normal break-words overflow-hidden"
                      style={{ left: '40px', backgroundColor: nombreBg, paddingLeft: '5px' }}
                    >
                      <Link
                        to="/caja/$seguimientoId"
                        params={{ seguimientoId: pac.seguimientoId }}
                        className="font-medium text-[#1976D2] hover:underline"
                        title={pac.nombre}
                      >
                        {pac.nombre}
                      </Link>
                    </td>
                    {/* Edad */}
                    <td className="px-0 py-[2px] text-center border-b border-b-[var(--color-borde)] text-[0.7rem]">
                      {pac.edad ?? '—'}
                    </td>
                    {/* Paquete */}
                    <td className="py-[2px] border-b border-b-[var(--color-borde)] text-[0.7rem] leading-tight whitespace-normal break-words overflow-hidden" style={{ paddingLeft: '6px' }}>
                      {pac.paqueteNombre ?? '—'}
                    </td>
                    {/* Peso */}
                    <td className="px-0 py-[2px] text-center border-b border-b-[var(--color-borde)] text-[0.7rem]">
                      {(pac.peso ?? 0).toFixed(2)}
                    </td>
                    {/* Talla */}
                    <td className="px-0 py-[2px] text-center border-b border-b-[var(--color-borde)] text-[0.7rem]">
                      {(pac.talla ?? 0).toFixed(2)}
                    </td>
                    {/* Desayuno — badge read-only */}
                    <td className="px-0 py-[2px] text-center border-b border-b-[var(--color-borde)] align-middle">
                      <span
                        style={{
                          color: DESAYUNO_MAP[pac.desayuno].color,
                          fontSize: '0.7rem',
                          fontWeight: 700,
                        }}
                      >
                        {DESAYUNO_MAP[pac.desayuno].label}
                      </span>
                    </td>
                    {/* Tarjeta Ent. Res. — badge read-only */}
                    <td className="px-0 py-[2px] text-center border-b border-b-[var(--color-borde)] align-middle">
                      {pac.tarjetaEntRes != null ? (
                        <span
                          style={{
                            color: (TARJETA_MAP[pac.tarjetaEntRes] ?? TARJETA_MAP[0]).color,
                            fontSize: '0.7rem',
                            fontWeight: 700,
                          }}
                        >
                          {(TARJETA_MAP[pac.tarjetaEntRes] ?? TARJETA_MAP[0]).label}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--color-texto-suave)', fontSize: '0.7rem' }}>—</span>
                      )}
                    </td>
                    {/* Celdas de estudios — cuadros sólidos READ-ONLY */}
                    {ESTUDIOS_COLUMNAS.map((est) => {
                      const estatusId = pac.estudios[est.id] ?? 0
                      const estatus = ESTATUS_ESTUDIO.find((e) => e.id === estatusId) ?? ESTATUS_ESTUDIO[0]
                      return (
                        <td
                          key={est.id}
                          style={{ padding: '0px', textAlign: 'center', borderBottom: '1px solid var(--color-borde)', verticalAlign: 'middle' }}
                        >
                          <span
                            className="flex items-center justify-center text-[0.55rem] font-bold select-none"
                            style={{
                              width: '22px',
                              height: '22px',
                              margin: '0 auto',
                              backgroundColor: estatus.esBorde ? 'transparent' : estatus.color,
                              border: estatus.esBorde ? '1.5px solid #d1d5db' : 'none',
                              borderRadius: '4px',
                              color: estatus.esBorde ? 'transparent' : '#ffffff',
                            }}
                            title={`${est.nombre}: ${estatus.nombre}`}
                            aria-label={`${est.nombre}: ${estatus.nombre}`}
                          >
                            {estatus.letra}
                          </span>
                        </td>
                      )
                    })}
                    {/* Médico Internista */}
                    <td className="py-[2px] border-b border-b-[var(--color-borde)] whitespace-normal break-words text-[0.7rem] leading-tight overflow-hidden" style={{ paddingLeft: '6px' }}>
                      {pac.medicoInternista ?? <span className="text-[var(--color-texto-suave)]">SIN ASIGNAR</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
