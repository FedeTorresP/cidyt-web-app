import { createLazyFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { useCubiculosListado } from '@/hooks/use-cubiculos'
import type { CubiculoItem } from '@/hooks/use-cubiculos'

export const Route = createLazyFileRoute('/_authenticated/cubiculo_/listado')({
  component: CubiculosPage,
})

function useClock(): string {
  const [time, setTime] = useState(() => formatClock())

  useEffect(() => {
    const id = setInterval(() => setTime(formatClock()), 5000)
    return () => clearInterval(id)
  }, [])

  return time
}

function formatClock(): string {
  return new Intl.DateTimeFormat('es-MX', {
    timeZone: 'America/Mexico_City',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(new Date())
}

export function CubiculosPage() {
  const { data: cubiculos } = useCubiculosListado()
  const clock = useClock()

  return (
    <div className="fixed inset-0 z-[150] bg-[#0f172a] text-[#f1f5f9] flex flex-col overflow-hidden font-sans select-none">
      
      {/* Header */}
      <header className="flex items-center justify-between px-3.5 pt-2 pb-1.5 border-b border-white/5 min-h-[42px] shrink-0">
        <span className="text-[1.05rem] font-bold text-[#e2e8f0] pl-10">
          Lista de Cubículos
        </span>
        <div className="font-mono text-[1.3rem] font-semibold text-[#e2e8f0] bg-white/5 px-2.5 py-0.5 rounded-[5px] tabular-nums">
          {clock}
        </div>
      </header>

      {/* Grid — Alineado arriba, 7 columnas estables y padding perimetral */}
      <main className="flex-1 p-3 gap-2 grid grid-cols-7 content-start overflow-y-auto min-h-0">
        {cubiculos?.map((c) => (
          <CubiculoCard key={c.cubiculoId} item={c} />
        ))}
      </main>

      {/* Footer: copyright izq + leyenda der */}
      <footer className="flex items-center justify-between px-4 py-1 border-t border-white/5 shrink-0 min-h-[36px]">
        <span className="text-[11px] text-slate-400">
          Desarrollado por: Médica Sur – Sistemas y T.I. · Copyright © {new Date().getFullYear()}. All rights reserved.
        </span>
        <div className="flex items-center gap-4">
          <LegendItem bgColor="bg-[#10b981]" label="Disponible" />
          <LegendItem bgColor="bg-[#f59e0b]" label="Ocupado" />
          <LegendItem bgColor="bg-[#eab308]" label="Terminado" />
          <LegendItem bgColor="bg-[#3b82f6]" label="Conectado" />
          <span className="text-[#475569] text-sm font-medium">|</span>
          <LegendItem bgColor="bg-[#f59e0b]" label="≥20 min" />
          <LegendItem bgColor="bg-[#ef4444]" label="≥45 min" />
        </div>
      </footer>
    </div>
  )
}

function CubiculoCard({ item }: { item: CubiculoItem }) {
  const { nombre, estatusId, medicoNombre, minTranscurridos } = item

  const showTimer = estatusId === 2 || estatusId === 3
  const showMedico = estatusId === 2 || estatusId === 3 || estatusId === 4
  const isInactive = estatusId === 5

  // Mapeo base de clases según estatus
  let borderClass = 'border-l-[#64748b]'
  let dotBgClass = 'bg-[#64748b]'

  if (!isInactive) {
    if (estatusId === 1) { borderClass = 'border-l-[#10b981]'; dotBgClass = 'bg-[#10b981]' }
    else if (estatusId === 2) { borderClass = 'border-l-[#f59e0b]'; dotBgClass = 'bg-[#f59e0b]' }
    else if (estatusId === 3) { borderClass = 'border-l-[#eab308]'; dotBgClass = 'bg-[#eab308]' }
    else if (estatusId === 4) { borderClass = 'border-l-[#3b82f6]'; dotBgClass = 'bg-[#3b82f6]' }
  } else {
    borderClass = 'border-l-[#475569]'
  }

  // Color del timer y borde según tiempo transcurrido (unificados)
  // 0-15 min: verde, 16-30 min: naranja, 31+ min: rojo + parpadeo
  let timerColorClass = 'text-[#10b981]'
  let unitColorClass = 'text-[#10b981]'
  if (showTimer && minTranscurridos != null) {
    if (minTranscurridos >= 31) {
      timerColorClass = 'text-[#ef4444] animate-cubiculos-pulse'
      unitColorClass = 'text-[#ef4444]'
      borderClass = 'border-l-[#ef4444]'
      dotBgClass = 'bg-[#ef4444]'
    } else if (minTranscurridos >= 16) {
      timerColorClass = 'text-[#f59e0b]'
      unitColorClass = 'text-[#f59e0b]'
      borderClass = 'border-l-[#f59e0b]'
      dotBgClass = 'bg-[#f59e0b]'
    } else {
      timerColorClass = 'text-[#10b981]'
      unitColorClass = 'text-[#10b981]'
      borderClass = 'border-l-[#10b981]'
      dotBgClass = 'bg-[#10b981]'
    }
  }

  return (
    <div className={`bg-[#1e293b] rounded-md border-l-[5px] p-2.5 flex flex-col justify-between overflow-hidden hover:bg-[#263548] transition-colors duration-150 h-[190px] ${borderClass}`}>
      
      {/* Header Card */}
      <div className="flex items-center justify-between gap-1.5 shrink-0">
        <span className="text-[1.1rem] font-bold text-[#f1f5f9] flex-1 leading-tight">
          {nombre}
        </span>
        {!isInactive && (
          <span className={`w-[11px] h-[11px] rounded-full shrink-0 ${dotBgClass}`} />
        )}
      </div>

      {/* Timer / Centro */}
      <div className="flex-1 flex items-center justify-center min-h-0 overflow-hidden">
        {showTimer && minTranscurridos != null && (
          <div className="flex items-baseline leading-none">
            <span className={`font-mono text-[4.5rem] font-extrabold tabular-nums tracking-tighter ${timerColorClass}`}>
              {minTranscurridos}
            </span>
            <span className={`font-mono text-[1.2rem] font-semibold ml-[3px] ${unitColorClass}`}>
              min
            </span>
          </div>
        )}
      </div>

      {/* Footer Card */}
      <div className="min-h-[1.4rem] flex items-center shrink-0 w-full overflow-hidden">
        {showMedico && medicoNombre ? (
          <span className="text-[1.35rem] font-bold text-white truncate block w-full">
            {medicoNombre}
          </span>
        ) : null}
      </div>
    </div>
  )
}

function LegendItem({ bgColor, label }: { bgColor: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[1.25rem] font-medium text-[#cbd5e1]">
      <span className={`w-3 h-3 rounded-full shrink-0 ${bgColor}`} />
      <span>{label}</span>
    </span>
  )
}