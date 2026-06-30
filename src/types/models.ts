import type { Timestamp } from 'firebase/firestore'

/** Elemento del menú lateral (colección `menu_items`). */
export interface MenuItem {
  id: string
  label: string
  route: string
  displayOrder: number
  requiredPermissionId: string | null
  activo: boolean
}

/** Paciente (colección `pacientes`). */
export interface Paciente {
  id: string
  nombre1: string
  nombre2?: string
  apePaterno: string
  apeMaterno?: string
  fechaNacimiento?: Timestamp
  sexo?: string
  /** Número de historia clínica (legacy: Historia). */
  historia?: string
  telefono?: string
  email?: string
  activo: boolean
}

/** Seguimiento / Check-up (colección `seguimientos`). */
export interface Seguimiento {
  id: string
  pacienteId: string
  empresaId?: string
  /** Paquete asignado (doc id en `paquetes`). */
  paqueteId?: string
  /** Turno de atención del día. */
  turno?: number
  fechaIngresoUtc: Timestamp
  estatusSeguimiento: string
  observaciones?: string
  activo: boolean
  // ─── Campos operacionales (editados en la pantalla de Detalle) ──────────────
  desayuno?: 0 | 1 | 2
  estatusValpac?: 0 | 1 | 2
  padecimientoId?: number
  /** Médico internista asignado (doc id en `medicos`). */
  medicoInternistaId?: string | null
  fechaEntrega?: string | null
  horaEntrega?: string | null
  fechaEnvio?: string | null
  horaEnvio?: string | null
  tarjetaEntRes?: 0 | 1 | 2
  createdBy: string
  updatedBy: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

/** Valoración corporal del paciente (colección `val_corporal`). */
export interface ValCorporal {
  id: string
  seguimientoId: string
  peso: number
  talla: number
  activo: boolean
}

/** Factura / Movimiento de caja (colección `facturas`). */
export interface Factura {
  id: string
  seguimientoId: string
  empresaId: string
  promotorId?: string | null
  facturaNo?: number | null
  fechaIngresoUtc: Timestamp
  descripcion1?: string | null
  observaciones?: string | null
  activo: boolean
  createdBy: string
  updatedBy: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

/** Cubículo (colección `cubiculos`). */
export interface Cubiculo {
  id: string
  nombre: string | null
  descripcion?: string | null
  entidadId?: string | null
  /** ID en catálogo `estatus_cubiculo_medico` (campo Firestore: estatusCubiculoId). */
  estatusCubiculoId?: string | null
  /** Legacy — algunos docs antiguos usan este nombre de campo. */
  estatusCubiculo?: string
  ordenMostrar: number | null
  activo: boolean
}

/** Sesión médico-cubículo (colección `sesiones_cubiculo`). */
export interface SesionCubiculo {
  id: string
  cubiculoId: string
  medicoId: string
  estatusCubiculoMedicoId: string
  createdAt: Timestamp
}

/** Médico (colección `medicos`). */
export interface Medico {
  id: string
  nombreCompleto: string | null
  /** Identificador corto mostrado en celdas de la matriz (legacy: Nombre_Corto). */
  letra: string | null
  activo: boolean
}

/** Empresa (colección `empresas`). */
export interface Empresa {
  id: string
  nombre: string
  descripcion?: string | null
  alias?: string | null
  ordenMostrar?: number | null
  activo: boolean
}

/** Especialidad médica (colección `especialidades`). */
export interface Especialidad {
  id: string
  nombre: string
  descripcion?: string | null
  activo: boolean
}

/** Colecciones editables en Mantenimiento de Catálogos (Fase 2). */
export type CatalogMaintenanceCollection = 'cubiculos' | 'empresas' | 'especialidades'

/** Estudio (colección `estudios`). */
export interface Estudio {
  id: string
  nombre: string
  abreviatura?: string
  estudioTipoId?: string
  /** Área/rama (`lugar_estudio`) donde se asigna médico; null si no aplica. */
  lugarEstudioId?: string | null
  activo: boolean
  ordenMostrar?: number
}

/** Estudio asignado a un paciente (colección `estudios_paciente`). */
export interface EstudioPaciente {
  id: string
  seguimientoId: string
  estudioId: string
  estudioTipoId?: string | null
  estatusEstudioId: string
  medicoId?: string | null
  /** Letra del médico asignado (legacy: Letra_Est_Adic). */
  letraMedico?: string | null
  activo: boolean
}

/** Estatus de estudio (colección `estatus_estudio`). */
export interface EstatusEstudio {
  id: string
  nombre: string
  abreviatura: string
  color: string
  activo: boolean
  ordenMostrar?: number
}

/** Entidad organizativa (colección `entidades`). */
export interface Entidad {
  id: string
  nombre: string
  activo: boolean
}

/** Rol (colección `roles`). */
export interface Rol {
  id: string
  nombre: string
  descripcion?: string
  activo: boolean
}

/** Permiso (colección `permisos`). */
export interface Permiso {
  id: string
  nombre: string
  clave: string
  activo: boolean
}

/** Horario (colección `horarios`). */
export interface Horario {
  id: string
  nombre: string
  horaInicio: string
  horaFin: string
  activo: boolean
}

/** Área/rama de estudio (colección `lugar_estudio`). */
export interface LugarEstudio {
  id: string
  nombre: string
  descripcion?: string | null
  activo: boolean
}

/** @deprecated Usar `LugarEstudio` — alias conservado por compatibilidad. */
export type Lugar = LugarEstudio

/** Relación médico ↔ área de estudio (colección `medico_lugar_estudio`). */
export interface MedicoLugarEstudio {
  id: string
  medicoId: string
  lugarEstudioId: string
  activo: boolean
}

/** Paquete de estudios (colección `paquetes`). */
export interface Paquete {
  id: string
  nombre: string
  descripcion?: string
  estudios: string[]
  activo: boolean
}

/** Asistencia diaria médico ↔ área (colección `medico_lugar_dia`). */
export interface MedicoLugarDia {
  id: string
  medicoId: string
  /** ID del documento en `lugar_estudio`. */
  lugarEstudioId: string
  horarioId: string
  fecha: string
  activo: boolean
  creadoPor?: string
  fechaCreacion?: Date
}
