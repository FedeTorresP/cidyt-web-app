/**
 * Generación de archivos Excel (.xlsx) para los 4 reportes del CIDyT.
 * Usa ExcelJS para crear workbooks en el navegador y trigger descarga como Blob.
 */

import ExcelJS from 'exceljs'
import type {
  FilaGeneral,
  FilaCheckup,
  FilaEstadistica,
  FilaConsultasEspecialista,
} from '@/hooks/use-reportes'

// ─── Tipos para Reporte de Caja (placeholder) ────────────────────────────────

export interface FilaCaja {
  pacienteNombre: string
  empresa: string | null
  folio: string | null
  total: number
  fechaRegistro: Date
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(d: Date): string {
  return d.toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City' })
}

function formatDateTime(d: Date): string {
  return d.toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })
}

function applyHeaderStyle(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF16A34A' },
    }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'FF000000' } },
    }
  })
}

function autoWidth(worksheet: ExcelJS.Worksheet) {
  worksheet.columns.forEach((col) => {
    let maxLength = 12
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const len = String(cell.value ?? '').length
      if (len > maxLength) maxLength = len
    })
    col.width = Math.min(maxLength + 2, 50)
  })
}

async function downloadWorkbook(workbook: ExcelJS.Workbook, filename: string) {
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ─── Exportadores ────────────────────────────────────────────────────────────

/**
 * Reporte General — columnas: Paciente, Fecha Ingreso, Estatus, Empresa, Estudios
 */
export async function exportReporteGeneral(data: FilaGeneral[], fecha: string) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'CIDyT'
  workbook.created = new Date()

  const ws = workbook.addWorksheet('Reporte General')

  ws.columns = [
    { header: 'Paciente', key: 'paciente', width: 30 },
    { header: 'Fecha Ingreso', key: 'fechaIngreso', width: 20 },
    { header: 'Estatus', key: 'estatus', width: 18 },
    { header: 'Empresa', key: 'empresa', width: 25 },
    { header: 'Estudios', key: 'estudios', width: 50 },
  ]

  applyHeaderStyle(ws.getRow(1))

  for (const fila of data) {
    ws.addRow({
      paciente: fila.pacienteNombre,
      fechaIngreso: formatDateTime(fila.fechaIngresoLocal),
      estatus: fila.estatusSeguimientoNombre,
      empresa: fila.empresaNombre ?? '—',
      estudios: fila.estudios,
    })
  }

  autoWidth(ws)
  await downloadWorkbook(workbook, `reporte-general-${fecha}.xlsx`)
}

/**
 * Reporte de Caja — columnas: Paciente, Empresa, Folio, Total, Fecha Registro
 * (Placeholder — se completará cuando se defina la fuente de datos real)
 */
export async function exportReporteCaja(data: FilaCaja[], fechaInicio: string, fechaFin: string) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'CIDyT'
  workbook.created = new Date()

  const ws = workbook.addWorksheet('Reporte de Caja')

  ws.columns = [
    { header: 'Paciente', key: 'paciente', width: 30 },
    { header: 'Empresa', key: 'empresa', width: 25 },
    { header: 'Folio', key: 'folio', width: 15 },
    { header: 'Total', key: 'total', width: 12 },
    { header: 'Fecha Registro', key: 'fechaRegistro', width: 20 },
  ]

  applyHeaderStyle(ws.getRow(1))

  for (const fila of data) {
    ws.addRow({
      paciente: fila.pacienteNombre,
      empresa: fila.empresa ?? '—',
      folio: fila.folio ?? '—',
      total: fila.total,
      fechaRegistro: formatDate(fila.fechaRegistro),
    })
  }

  autoWidth(ws)
  await downloadWorkbook(workbook, `reporte-caja-${fechaInicio}-${fechaFin}.xlsx`)
}

/**
 * Estadística por Consultorio — columnas: Estudio, Tipo, Total
 */
export async function exportReporteEstadistica(
  data: FilaEstadistica[],
  cubiculoNombre: string,
  fechaInicio: string,
  fechaFin: string,
) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'CIDyT'
  workbook.created = new Date()

  const ws = workbook.addWorksheet('Estadística por Consultorio')

  // Encabezado informativo
  ws.mergeCells('A1:C1')
  const titleCell = ws.getCell('A1')
  titleCell.value = `Cubículo: ${cubiculoNombre} | ${fechaInicio} a ${fechaFin}`
  titleCell.font = { bold: true, size: 12 }
  ws.addRow([]) // fila vacía

  // Columnas de datos a partir de fila 3
  const headerRow = ws.addRow(['Estudio', 'Tipo', 'Total'])
  applyHeaderStyle(headerRow)

  for (const fila of data) {
    ws.addRow([fila.estudioNombre, fila.estudioTipoNombre ?? '—', fila.total])
  }

  autoWidth(ws)
  await downloadWorkbook(
    workbook,
    `reporte-estadistica-${cubiculoNombre}-${fechaInicio}-${fechaFin}.xlsx`,
  )
}

/**
 * Consultas por Especialista — columnas: Médico (Letra), Médico, Total Consultas
 */
export async function exportReporteConsultasEspecialista(
  data: FilaConsultasEspecialista[],
  fechaInicio: string,
  fechaFin: string,
) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'CIDyT'
  workbook.created = new Date()

  const ws = workbook.addWorksheet('Consultas por Especialista')

  ws.mergeCells('A1:C1')
  const titleCell = ws.getCell('A1')
  titleCell.value = `Consultas por especialista | ${fechaInicio} a ${fechaFin}`
  titleCell.font = { bold: true, size: 12 }
  ws.addRow([])

  const headerRow = ws.addRow(['Letra', 'Médico', 'Total Consultas'])
  applyHeaderStyle(headerRow)

  for (const fila of data) {
    ws.addRow([fila.letra, fila.medicoNombre ?? '—', fila.total])
  }

  autoWidth(ws)
  await downloadWorkbook(
    workbook,
    `reporte-consultas-especialista-${fechaInicio}-${fechaFin}.xlsx`,
  )
}

/**
 * Control CheckUp — columnas: Paciente, Fecha Ingreso, Estatus, Total Estudios
 */
export async function exportReporteCheckup(data: FilaCheckup[], fecha: string) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'CIDyT'
  workbook.created = new Date()

  const ws = workbook.addWorksheet('Control CheckUp')

  ws.columns = [
    { header: 'Paciente', key: 'paciente', width: 30 },
    { header: 'Fecha Ingreso', key: 'fechaIngreso', width: 20 },
    { header: 'Estatus', key: 'estatus', width: 18 },
    { header: 'Total Estudios', key: 'totalEstudios', width: 14 },
  ]

  applyHeaderStyle(ws.getRow(1))

  for (const fila of data) {
    ws.addRow({
      paciente: fila.pacienteNombre,
      fechaIngreso: formatDateTime(fila.fechaIngresoLocal),
      estatus: fila.estatusSeguimientoNombre,
      totalEstudios: fila.totalEstudios,
    })
  }

  autoWidth(ws)
  await downloadWorkbook(workbook, `reporte-checkup-${fecha}.xlsx`)
}
