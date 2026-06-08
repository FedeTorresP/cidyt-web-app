import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  getDoc,
  Timestamp,
} from 'firebase/firestore'
import { getFirebaseFirestore } from '@/lib/firebase'
import { getDayRangeUtc, getTodayLocalDate } from '@/services/time'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { AlertBanner } from '@/components/shared/AlertBanner'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/_authenticated/lista-dia')({
  component: ListaDiaPage,
})

interface FilaListaDia {
  seguimientoId: string
  pacienteNombre: string
  turno: number
  estudios: Array<{
    id: string
    estudioId: string
    abreviatura: string
    estatusColor: string
    estatusAbrev: string
  }>
}

function buildPacienteNombre(data: Record<string, unknown>): string {
  const parts: string[] = []
  if (data.nombre1) parts.push(String(data.nombre1))
  if (data.nombre2) parts.push(String(data.nombre2))
  if (data.apePaterno) parts.push(String(data.apePaterno))
  if (data.apeMaterno) parts.push(String(data.apeMaterno))
  return parts.join(' ')
}

async function fetchListaDia(fecha: string): Promise<{ filas: FilaListaDia[]; estudiosUnicos: string[] }> {
  const db = getFirebaseFirestore()
  const rango = getDayRangeUtc(fecha)

  // Obtener seguimientos del día
  const segSnap = await getDocs(
    query(
      collection(db, 'seguimientos'),
      where('activo', '==', true),
      where('fechaIngresoUtc', '>=', Timestamp.fromDate(rango.startUtc)),
      where('fechaIngresoUtc', '<=', Timestamp.fromDate(rango.endUtc)),
      orderBy('fechaIngresoUtc', 'asc'),
    ),
  )

  if (segSnap.empty) return { filas: [], estudiosUnicos: [] }

  // Obtener catálogo de estudios y estatus
  const [estudiosSnap, estatusSnap] = await Promise.all([
    getDocs(query(collection(db, 'estudios'), where('activo', '==', true))),
    getDocs(query(collection(db, 'estatus_estudio'), where('activo', '==', true))),
  ])

  const estudiosMap = new Map<string, { nombre: string; abreviatura: string }>()
  for (const d of estudiosSnap.docs) {
    const data = d.data()
    estudiosMap.set(d.id, { nombre: data.nombre ?? '', abreviatura: data.abreviatura ?? '' })
  }

  const estatusMap = new Map<string, { color: string; abreviatura: string }>()
  for (const d of estatusSnap.docs) {
    const data = d.data()
    estatusMap.set(d.id, { color: data.color ?? '#666', abreviatura: data.abreviatura ?? '' })
  }

  const estudiosUnicosSet = new Set<string>()
  const filas: FilaListaDia[] = []

  let turno = 1
  for (const segDoc of segSnap.docs) {
    const segData = segDoc.data()

    // Nombre paciente
    let pacienteNombre = ''
    if (segData.pacienteId) {
      const pacDoc = await getDoc(doc(db, 'pacientes', segData.pacienteId))
      if (pacDoc.exists()) {
        pacienteNombre = buildPacienteNombre(pacDoc.data()!)
      }
    }

    // Estudios del seguimiento
    const epSnap = await getDocs(
      query(
        collection(db, 'estudios_paciente'),
        where('seguimientoId', '==', segDoc.id),
        where('activo', '==', true),
      ),
    )

    const estudios = epSnap.docs.map((epDoc) => {
      const epData = epDoc.data()
      const estudio = estudiosMap.get(epData.estudioId) ?? { nombre: '', abreviatura: '?' }
      const estatus = estatusMap.get(epData.estatusEstudioId) ?? { color: '#666', abreviatura: '' }
      estudiosUnicosSet.add(estudio.abreviatura)
      return {
        id: epDoc.id,
        estudioId: epData.estudioId as string,
        abreviatura: estudio.abreviatura,
        estatusColor: estatus.color,
        estatusAbrev: estatus.abreviatura,
      }
    })

    filas.push({
      seguimientoId: segDoc.id,
      pacienteNombre,
      turno: turno++,
      estudios,
    })
  }

  return { filas, estudiosUnicos: Array.from(estudiosUnicosSet).sort() }
}

function ListaDiaPage() {
  const [fecha, setFecha] = useState(getTodayLocalDate())
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['lista-dia', fecha],
    queryFn: () => fetchListaDia(fecha),
  })

  const filas = data?.filas ?? []
  const estudiosUnicos = data?.estudiosUnicos ?? []

  return (
    <div className="text-[0.8rem]">
      <h1 className="text-lg font-bold mb-1.5 text-[var(--color-texto)]">Lista del Día</h1>

      {/* Toolbar */}
      <div className="sticky top-0 z-20 flex items-center gap-1.5 flex-wrap p-1.5 px-2.5 mb-1.5 bg-[var(--color-fondo-card)] border border-[var(--color-borde)] rounded-[var(--radius-default)] shadow-[0_2px_8px_rgba(10,31,92,0.06)]">
        <span className="text-[var(--color-texto-suave)] font-medium text-[0.8rem]">Fecha:</span>
        <Input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          className="w-auto min-h-[32px] h-8 text-[0.85rem] px-2"
        />
        <Button size="sm" onClick={() => refetch()} disabled={isLoading}>
          {isLoading ? <LoadingSpinner size="sm" className="border-white/35 border-t-white" /> : null}
          Actualizar
        </Button>
        {data && (
          <span className="bg-[rgba(25,118,210,0.1)] text-[var(--color-info)] rounded-full px-2.5 py-0.5 text-[0.75rem] font-semibold">
            {filas.length} pacientes
          </span>
        )}
      </div>

      {error && (
        <AlertBanner variant="error" className="mb-2">Error al cargar lista del día.</AlertBanner>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8"><LoadingSpinner size="md" /></div>
      ) : filas.length === 0 ? (
        <div className="bg-[var(--color-fondo-card)] rounded-[var(--radius-default)] shadow-[var(--shadow-card)] p-8 text-center text-[var(--color-texto-suave)] text-sm">
          No hay pacientes para esta fecha.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-default)] shadow-[var(--shadow-card)] border border-[var(--color-borde)]">
          <table className="w-full border-collapse bg-[var(--color-fondo-card)] min-w-[900px]">
            <thead className="bg-[var(--color-primario)] sticky top-0 z-10">
              <tr>
                <th className="px-1 py-0.5 text-[0.65rem] font-semibold text-white border-b-2 border-b-white/12 border-r border-r-white/8 w-9 min-w-9">
                  #
                </th>
                <th className="px-2 py-0.5 text-[0.65rem] font-semibold text-white border-b-2 border-b-white/12 border-r border-r-white/8 text-left min-w-[140px]">
                  Paciente
                </th>
                {estudiosUnicos.map((abrev) => (
                  <th
                    key={abrev}
                    className="border-b-2 border-b-white/12 border-r border-r-white/8 w-[30px] min-w-[30px] max-w-[30px] text-center align-middle"
                  >
                    <div className="flex flex-col items-center justify-center min-h-[48px]">
                      <span className="inline-block whitespace-nowrap text-[0.575rem] font-bold tracking-wide text-white -rotate-45 origin-center leading-none max-w-9 overflow-hidden">
                        {abrev}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.map((fila, idx) => (
                <tr
                  key={fila.seguimientoId}
                  className={idx % 2 === 0 ? 'bg-[var(--color-fondo)]' : 'bg-[var(--color-fondo-card)]'}
                >
                  <td className="px-1 py-0 border-b border-b-[var(--color-borde)] border-r border-r-[var(--color-borde)] text-center">
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[rgba(10,31,92,0.08)] text-[var(--color-primario)] font-bold text-[0.9rem]">
                      {fila.turno}
                    </span>
                  </td>
                  <td className="px-1 py-0 border-b border-b-[var(--color-borde)] border-r border-r-[var(--color-borde)] text-left text-[0.75rem] whitespace-nowrap cursor-pointer hover:underline hover:text-[var(--color-info)]">
                    {fila.pacienteNombre}
                  </td>
                  {estudiosUnicos.map((abrev) => {
                    const estudio = fila.estudios.find((e) => e.abreviatura === abrev)
                    return (
                      <td
                        key={abrev}
                        className="px-0.5 py-0.5 border-b border-b-[var(--color-borde)] border-r border-r-[var(--color-borde)] w-7 min-w-7 max-w-7 h-7 text-center align-middle"
                      >
                        {estudio ? (
                          <div
                            className={cn(
                              'flex items-center justify-center w-[26px] h-[26px] rounded text-[0.6rem] font-bold text-white mx-auto',
                            )}
                            style={{ backgroundColor: estudio.estatusColor }}
                          >
                            {estudio.estatusAbrev}
                          </div>
                        ) : (
                          <div className="flex items-center justify-center w-[26px] h-[26px] rounded border-2 border-[rgba(15,23,42,0.08)] mx-auto" />
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
