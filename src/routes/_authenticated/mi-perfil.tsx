import { createFileRoute } from '@tanstack/react-router'
import { useState, useMemo } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import { MoreHorizontal, ArrowUpDown, Plus, Search } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import {
  useUsuarios,
  useUpdateNombreCompleto,
  useCreateUsuario,
  useDeactivateUsuario,
  useSendPasswordReset,
  useUpdateUsuario,
} from '@/hooks/use-usuarios'
import { changePassword } from '@/services/auth'
import { sendPasswordResetLink, buildNombreCompleto, type UsuarioFirestore } from '@/services/users'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { AlertBanner } from '@/components/shared/AlertBanner'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/_authenticated/mi-perfil')({
  component: MiPerfilPage,
})

/* ═══════════════════════════════════════════════════════════════════════════
   PERFIL_COLORS — Formas geométricas para badges de roles
   ═══════════════════════════════════════════════════════════════════════════ */

const PERFIL_COLORS: Record<string, { shape: 'diamond' | 'triangle' | 'circle'; color: string; label: string }> = {
  admin: { shape: 'diamond', color: '#D32F2F', label: 'Administrador' },
  medico: { shape: 'circle', color: '#1976D2', label: 'Médico' },
  enfermeria: { shape: 'circle', color: '#00A651', label: 'Enfermería' },
  recepcion: { shape: 'triangle', color: '#F57C00', label: 'Recepción' },
  laboratorio: { shape: 'triangle', color: '#7B1FA2', label: 'Laboratorio' },
  caja: { shape: 'diamond', color: '#00838F', label: 'Caja' },
  rayos_x: { shape: 'circle', color: '#5D4037', label: 'Rayos X' },
  sistemas: { shape: 'diamond', color: '#0A1F5C', label: 'Sistemas' },
}

function PerfilBadge({ perfilId, perfilNombre }: { perfilId: string; perfilNombre: string }) {
  const config = PERFIL_COLORS[perfilId] ?? { shape: 'circle' as const, color: '#5A6478', label: perfilNombre }

  const shapeElement = (() => {
    switch (config.shape) {
      case 'diamond':
        return (
          <span
            className="inline-block w-3 h-3 rotate-45"
            style={{ backgroundColor: config.color }}
            aria-hidden="true"
          />
        )
      case 'triangle':
        return (
          <span
            className="inline-block w-0 h-0"
            style={{
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderBottom: `10px solid ${config.color}`,
            }}
            aria-hidden="true"
          />
        )
      case 'circle':
        return (
          <span
            className="inline-block w-3 h-3 rounded-full"
            style={{ backgroundColor: config.color }}
            aria-hidden="true"
          />
        )
    }
  })()

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium" title={config.label}>
      {shapeElement}
      <span style={{ color: config.color }}>{perfilNombre || config.label}</span>
    </span>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   Tab 1: Mi Perfil
   ═══════════════════════════════════════════════════════════════════════════ */

function TabMiPerfil() {
  const { user } = useAuth()
  const { data: usuarios } = useUsuarios()
  const updateNombre = useUpdateNombreCompleto()

  // Estado de edición de nombre — 3 campos independientes
  const [editingName, setEditingName] = useState(false)
  const [nombre, setNombre] = useState('')
  const [apePaterno, setApePaterno] = useState('')
  const [apeMaterno, setApeMaterno] = useState('')
  const [nameSuccess, setNameSuccess] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)

  // Estado de cambio de contraseña
  const [pwLoading, setPwLoading] = useState(false)
  const [pwSuccess, setPwSuccess] = useState(false)
  const [pwError, setPwError] = useState<string | null>(null)

  // Buscar el documento del usuario actual por UID o email
  const currentUsuario = useMemo(() => {
    if (!usuarios || !user) return null
    return usuarios.find(
      (u) => u.correoInstitucional === user.email,
    ) ?? null
  }, [usuarios, user])

  function handleStartEditName() {
    // Leer campos aditivos. Si es legacy (sin campos desglosados), dejar vacíos.
    setNombre(currentUsuario?.nombre ?? '')
    setApePaterno(currentUsuario?.apellidoPaterno ?? '')
    setApeMaterno(currentUsuario?.apellidoMaterno ?? '')
    setEditingName(true)
    setNameSuccess(false)
    setNameError(null)
  }

  async function handleSaveName() {
    if (!currentUsuario) return
    const trimNombre = nombre.trim()
    const trimPaterno = apePaterno.trim()

    if (!trimNombre) {
      setNameError('El campo Nombre(s) es obligatorio.')
      return
    }
    if (!trimPaterno) {
      setNameError('El campo Apellido Paterno es obligatorio.')
      return
    }

    const nombreCompleto = buildNombreCompleto(trimNombre, trimPaterno, apeMaterno.trim())

    try {
      await updateNombre.mutateAsync({
        userId: currentUsuario.id,
        nombreCompleto,
        nombre: trimNombre,
        apellidoPaterno: trimPaterno,
        apellidoMaterno: apeMaterno.trim(),
      })
      setEditingName(false)
      setNameSuccess(true)
      setNameError(null)
    } catch {
      setNameError('Error al actualizar el nombre.')
    }
  }

  async function handleChangePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPwError(null)
    setPwSuccess(false)
    setPwLoading(true)

    const formData = new FormData(e.currentTarget)
    const newPassword = (formData.get('newPassword') as string) || ''
    const confirmPassword = (formData.get('confirmPassword') as string) || ''

    if (newPassword.length < 6) {
      setPwError('La contraseña debe tener al menos 6 caracteres.')
      setPwLoading(false)
      return
    }
    if (newPassword !== confirmPassword) {
      setPwError('Las contraseñas no coinciden.')
      setPwLoading(false)
      return
    }

    try {
      await changePassword(newPassword)
      setPwSuccess(true)
      ;(e.target as HTMLFormElement).reset()
    } catch {
      setPwError('Error al cambiar la contraseña. Intente cerrar sesión y volver a iniciar.')
    } finally {
      setPwLoading(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      {/* ── Bloque: Información Personal ── */}
      <section
        className="rounded-2xl border border-[var(--color-borde)] bg-[var(--color-fondo-card)] p-6 mb-6 shadow-[var(--shadow-card)]"
      >
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-[var(--color-texto-suave)]">
              Correo Institucional
            </label>
            <Input
              value={user?.email ?? ''}
              disabled
              readOnly
              aria-label="Correo institucional"
              className="min-h-[44px] text-sm bg-[var(--color-fondo)]"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-[var(--color-texto-suave)]">
              No. Empleado
            </label>
            <Input
              value={currentUsuario?.noEmpleado ?? '—'}
              disabled
              readOnly
              aria-label="Número de empleado"
              className="min-h-[44px] text-sm bg-[var(--color-fondo)]"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-[var(--color-texto-suave)]">
              Nombre Completo
            </label>
            {editingName ? (
              <div className="flex flex-col gap-5">
                {/* Contenedor estético de 3 columnas para iPad */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[13px] font-medium text-[var(--color-texto-suave)]">Nombre(s)</label>
                    <Input 
                      value={nombre} 
                      onChange={(e) => setNombre(e.target.value)} 
                      autoFocus 
                      className="min-h-[44px] text-sm" 
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[13px] font-medium text-[var(--color-texto-suave)]">Apellido Paterno</label>
                    <Input 
                      value={apePaterno} 
                      onChange={(e) => setApePaterno(e.target.value)} 
                      className="min-h-[44px] text-sm" 
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[13px] font-medium text-[var(--color-texto-suave)]">Apellido Materno</label>
                    <Input 
                      value={apeMaterno} 
                      onChange={(e) => setApeMaterno(e.target.value)} 
                      className="min-h-[44px] text-sm" 
                    />
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <Button onClick={handleSaveName} disabled={updateNombre.isPending} className="flex-1 min-h-[48px] text-sm">
                    {updateNombre.isPending ? <LoadingSpinner size="sm" className="border-white/35 border-t-white" /> : null}
                    Guardar Nombre
                  </Button>
                  <Button variant="outline" onClick={() => setEditingName(false)} className="flex-1 min-h-[48px] text-sm">
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2 items-center">
                <Input
                  value={currentUsuario?.nombreCompleto ?? '—'}
                  disabled
                  readOnly
                  className="min-h-[44px] text-sm bg-[var(--color-fondo)] flex-1"
                />
                <Button variant="outline" onClick={handleStartEditName} className="shrink-0">
                  Editar
                </Button>
              </div>
            )}
          </div>

          {nameSuccess && (
            <AlertBanner variant="success">Nombre actualizado correctamente.</AlertBanner>
          )}
          {nameError && <AlertBanner variant="error">{nameError}</AlertBanner>}
        </div>
      </section>

      {/* ── Bloque: Cambiar Contraseña ── */}
      <section
        className="rounded-2xl border border-[var(--color-borde)] bg-[var(--color-fondo-card)] p-6 shadow-[var(--shadow-card)]"
      >
        {pwSuccess && (
          <AlertBanner variant="success" className="mb-4">
            Contraseña actualizada exitosamente.
          </AlertBanner>
        )}
        {pwError && (
          <AlertBanner variant="error" className="mb-4">
            {pwError}
          </AlertBanner>
        )}

        <form onSubmit={handleChangePassword} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="newPassword" className="text-[13px] font-medium text-[var(--color-texto-suave)]">
              Nueva contraseña
            </label>
            <Input
              id="newPassword"
              name="newPassword"
              type="password"
              required
              disabled={pwLoading}
              className="min-h-[44px] text-sm"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="confirmPassword" className="text-[13px] font-medium text-[var(--color-texto-suave)]">
              Confirmar nueva contraseña
            </label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              disabled={pwLoading}
              className="min-h-[44px] text-sm"
            />
          </div>

          <Button type="submit" disabled={pwLoading} className="w-full min-h-[48px] text-sm mt-1">
            {pwLoading ? <LoadingSpinner size="sm" className="border-white/35 border-t-white" /> : null}
            Guardar Cambios
          </Button>
        </form>
      </section>

    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   Tab 2: Gestión de Usuarios (Admin only)
   ═══════════════════════════════════════════════════════════════════════════ */

function TabGestionUsuarios() {
  const { data: usuarios, isLoading } = useUsuarios()
  const deactivate = useDeactivateUsuario()
  const resetPassword = useSendPasswordReset()

  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingUser, setEditingUser] = useState<UsuarioFirestore | null>(null)

  const columns = useMemo<ColumnDef<UsuarioFirestore, unknown>[]>(
    () => [
      {
        accessorKey: 'noEmpleado',
        header: ({ column }) => (
          <button
            className="inline-flex items-center gap-1 text-white font-semibold"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            No. Emp.
            <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        cell: ({ getValue }) => <span className="font-mono text-xs">{getValue() as string}</span>,
      },
      {
        accessorKey: 'nombreCompleto',
        header: ({ column }) => (
          <button
            className="inline-flex items-center gap-1 text-white font-semibold"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Nombre Completo
            <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
      },
      {
        accessorKey: 'correoInstitucional',
        header: ({ column }) => (
          <button
            className="inline-flex items-center gap-1 text-white font-semibold"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Correo
            <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        cell: ({ getValue }) => (
          <span className="text-xs text-[var(--color-texto-suave)]">{getValue() as string}</span>
        ),
      },
      {
        accessorKey: 'perfilNombre',
        header: 'Perfil',
        cell: ({ row }) => (
          <PerfilBadge perfilId={row.original.perfilId} perfilNombre={row.original.perfilNombre} />
        ),
      },
      {
        accessorKey: 'activo',
        header: 'Estatus',
        cell: ({ getValue }) => {
          const activo = getValue() as number
          return (
            <span
              className={cn(
                'inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold',
                activo === 1
                  ? 'bg-[var(--color-success)]/15 text-[var(--color-success)]'
                  : 'bg-[var(--color-error)]/15 text-[var(--color-error)]',
              )}
            >
              {activo === 1 ? 'Activo' : 'Inactivo'}
            </span>
          )
        },
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Acciones del usuario">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEditingUser(row.original)}>
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={async () => {
                  try {
                    await resetPassword.mutateAsync(row.original.correoInstitucional)
                    alert('Enlace de acceso enviado a ' + row.original.correoInstitucional)
                  } catch {
                    alert('Error al enviar el enlace.')
                  }
                }}
              >
                Enviar enlace de acceso
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                destructive
                onClick={async () => {
                  if (!confirm(`¿Desactivar a ${row.original.nombreCompleto}?`)) return
                  await deactivate.mutateAsync(row.original.id)
                }}
              >
                Desactivar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [deactivate, resetPassword],
  )

  const table = useReactTable({
    data: usuarios ?? [],
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: 'includesString',
  })

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner size="md" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-texto-suave)]" />
          <Input
            placeholder="Buscar por nombre o correo..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-8"
            aria-label="Buscar usuario"
          />
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4" />
          Nuevo Usuario
        </Button>
      </div>

      {/* Tabla TanStack */}
      <div className="overflow-x-auto rounded-[var(--radius-default)] shadow-[var(--shadow-card)] border border-[var(--color-borde)]">
        <table className="w-full border-collapse bg-[var(--color-fondo-card)] min-w-[800px]">
          <thead className="bg-[var(--color-primario)] sticky top-0 z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-2 py-1.5 text-xs text-center font-semibold text-white border-b-2 border-b-white/12 border-r border-r-white/8"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row, idx) => (
              <tr
                key={row.id}
                className={idx % 2 === 0 ? 'bg-[var(--color-fondo)]' : 'bg-[var(--color-fondo-card)]'}
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className="px-2 py-1.5 text-xs border-b border-b-[var(--color-borde)] border-r border-r-[var(--color-borde)] text-center align-middle whitespace-nowrap"
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {(usuarios?.length ?? 0) === 0 && (
          <div className="text-center py-8 text-[var(--color-texto-suave)] text-sm">
            No hay usuarios registrados.
          </div>
        )}
        {(usuarios?.length ?? 0) > 0 && table.getRowModel().rows.length === 0 && (
          <div className="text-center py-8 text-[var(--color-texto-suave)] text-sm">
            Sin resultados para "{globalFilter}".
          </div>
        )}
      </div>

      {/* Dialog Crear Usuario */}
      <CreateUserDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} />

      {/* Dialog Editar Usuario */}
      {editingUser && (
        <EditUserDialog
          usuario={editingUser}
          open={!!editingUser}
          onOpenChange={(open) => { if (!open) setEditingUser(null) }}
        />
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   Dialog: Crear Usuario (ABM)
   ═══════════════════════════════════════════════════════════════════════════ */

function CreateUserDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const createUsuario = useCreateUsuario()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const form = new FormData(e.currentTarget)
    const correo = (form.get('correo') as string).trim().toLowerCase()
    const nombre = (form.get('nombre') as string).trim()
    const paterno = (form.get('paterno') as string).trim()
    const materno = (form.get('materno') as string).trim()
    const noEmpleado = (form.get('noEmpleado') as string).trim()
    const perfilId = (form.get('perfilId') as string).trim()

    if (!correo || !nombre || !paterno || !noEmpleado || !perfilId) {
      setError('Todos los campos obligatorios deben completarse.')
      setLoading(false)
      return
    }

    const nombreCompleto = buildNombreCompleto(nombre, paterno, materno)
    const perfilNombre = PERFIL_COLORS[perfilId]?.label ?? perfilId

    try {
      // 1. Crear documento en Firestore (normalización NFC aplicada internamente)
      await createUsuario.mutateAsync({
        correoInstitucional: correo,
        nombreCompleto,
        nombre,
        apellidoPaterno: paterno,
        apellidoMaterno: materno,
        noEmpleado,
        perfilId,
        perfilNombre,
      })

      // 2. Disparar correo de establecimiento de contraseña
      await sendPasswordResetLink(correo)

      onOpenChange(false)
      ;(e.target as HTMLFormElement).reset()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al crear el usuario.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo Usuario</DialogTitle>
          <DialogDescription>
            Se enviará automáticamente un correo para establecer contraseña.
          </DialogDescription>
        </DialogHeader>

        {error && <AlertBanner variant="error" className="mb-3">{error}</AlertBanner>}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="create-correo" className="text-xs font-medium text-[var(--color-texto-suave)]">
              Correo Institucional
            </label>
            <Input id="create-correo" name="correo" type="email" required disabled={loading} placeholder="usuario@medicasur.com.mx" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="create-nombre" className="text-[13px] font-medium text-[var(--color-texto-suave)]">Nombre(s)</label>
              <Input id="create-nombre" name="nombre" required disabled={loading} className="min-h-[44px] text-sm" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="create-paterno" className="text-[13px] font-medium text-[var(--color-texto-suave)]">Apellido Paterno</label>
              <Input id="create-paterno" name="paterno" required disabled={loading} className="min-h-[44px] text-sm" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="create-materno" className="text-[13px] font-medium text-[var(--color-texto-suave)]">Apellido Materno</label>
              <Input id="create-materno" name="materno" disabled={loading} className="min-h-[44px] text-sm" />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="create-noEmpleado" className="text-xs font-medium text-[var(--color-texto-suave)]">
              No. Empleado
            </label>
            <Input id="create-noEmpleado" name="noEmpleado" required disabled={loading} />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="create-perfilId" className="text-xs font-medium text-[var(--color-texto-suave)]">
              Perfil
            </label>
            <select
              id="create-perfilId"
              name="perfilId"
              required
              disabled={loading}
              className="w-full min-h-[38px] px-2.5 border border-[var(--color-borde)] rounded-[var(--radius-default)] bg-white text-[var(--color-texto)] text-[13px] outline-none transition-all duration-200 focus:border-[var(--color-primario)] focus:ring-3 focus:ring-[rgba(10,31,92,0.12)]"
            >
              <option value="">Seleccionar perfil...</option>
              {Object.entries(PERFIL_COLORS).map(([key, config]) => (
                <option key={key} value={key}>
                  {config.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 mt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? <LoadingSpinner size="sm" className="border-white/35 border-t-white" /> : null}
              Crear Usuario
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   Dialog: Editar Usuario
   ═══════════════════════════════════════════════════════════════════════════ */

function EditUserDialog({
  usuario,
  open,
  onOpenChange,
}: {
  usuario: UsuarioFirestore
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const updateUsuario = useUpdateUsuario()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const form = new FormData(e.currentTarget)
    const nombre = (form.get('nombre') as string).trim()
    const paterno = (form.get('paterno') as string).trim()
    const materno = (form.get('materno') as string).trim()
    const noEmpleado = (form.get('noEmpleado') as string).trim()
    const perfilId = (form.get('perfilId') as string).trim()

    if (!nombre || !paterno || !noEmpleado || !perfilId) {
      setError('Todos los campos obligatorios deben completarse.')
      setLoading(false)
      return
    }

    const nombreCompleto = buildNombreCompleto(nombre, paterno, materno)
    const perfilNombre = PERFIL_COLORS[perfilId]?.label ?? perfilId

    try {
      await updateUsuario.mutateAsync({
        userId: usuario.id,
        data: {
          nombreCompleto,
          nombre,
          apellidoPaterno: paterno,
          apellidoMaterno: materno,
          noEmpleado,
          perfilId,
          perfilNombre,
        },
      })
      onOpenChange(false)
    } catch {
      setError('Error al actualizar el usuario.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Usuario</DialogTitle>
          <DialogDescription>{usuario.correoInstitucional}</DialogDescription>
        </DialogHeader>

        {error && <AlertBanner variant="error" className="mb-3">{error}</AlertBanner>}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="edit-nombre" className="text-[13px] font-medium text-[var(--color-texto-suave)]">Nombre(s)</label>
              <Input id="edit-nombre" name="nombre" defaultValue={usuario.nombre ?? ''} required disabled={loading} className="min-h-[44px] text-sm" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="edit-paterno" className="text-[13px] font-medium text-[var(--color-texto-suave)]">Apellido Paterno</label>
              <Input id="edit-paterno" name="paterno" defaultValue={usuario.apellidoPaterno ?? ''} required disabled={loading} className="min-h-[44px] text-sm" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="edit-materno" className="text-[13px] font-medium text-[var(--color-texto-suave)]">Apellido Materno</label>
              <Input id="edit-materno" name="materno" defaultValue={usuario.apellidoMaterno ?? ''} disabled={loading} className="min-h-[44px] text-sm" />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="edit-noEmpleado" className="text-xs font-medium text-[var(--color-texto-suave)]">
              No. Empleado
            </label>
            <Input id="edit-noEmpleado" name="noEmpleado" defaultValue={usuario.noEmpleado} required disabled={loading} />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="edit-perfilId" className="text-xs font-medium text-[var(--color-texto-suave)]">
              Perfil
            </label>
            <select
              id="edit-perfilId"
              name="perfilId"
              required
              disabled={loading}
              defaultValue={usuario.perfilId}
              className="w-full min-h-[38px] px-2.5 border border-[var(--color-borde)] rounded-[var(--radius-default)] bg-white text-[var(--color-texto)] text-[13px] outline-none transition-all duration-200 focus:border-[var(--color-primario)] focus:ring-3 focus:ring-[rgba(10,31,92,0.12)]"
            >
              <option value="">Seleccionar perfil...</option>
              {Object.entries(PERFIL_COLORS).map(([key, config]) => (
                <option key={key} value={key}>
                  {config.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 mt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? <LoadingSpinner size="sm" className="border-white/35 border-t-white" /> : null}
              Guardar Cambios
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   Página Principal: Mi Perfil y Accesos
   ═══════════════════════════════════════════════════════════════════════════ */

function MiPerfilPage() {
  const { user } = useAuth()
  const isAdmin = user?.isSuperAdmin || user?.roleId === 'admin'
  const [activeTab, setActiveTab] = useState<'perfil' | 'usuarios'>('perfil')

  return (
    <div className="w-full max-w-4xl">
      <h1 className="text-xl font-bold mb-5 text-[var(--color-texto)]">Mi Perfil y Accesos</h1>

      <Tabs>
        <TabsList className="mb-2">
          <TabsTrigger active={activeTab === 'perfil'} onClick={() => setActiveTab('perfil')}>
            Mi Perfil
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger active={activeTab === 'usuarios'} onClick={() => setActiveTab('usuarios')}>
              Gestión de Usuarios
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent active={activeTab === 'perfil'}>
          <TabMiPerfil />
        </TabsContent>

        {isAdmin && (
          <TabsContent active={activeTab === 'usuarios'}>
            <TabGestionUsuarios />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
