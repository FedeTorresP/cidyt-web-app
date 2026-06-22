import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AlertBanner } from '@/components/shared/AlertBanner'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { fetchActiveCatalog, sortByNombre } from '@/lib/firestore-catalog'
import type { Entidad } from '@/types/models'
import type { CatalogMaintenanceItem } from '@/lib/firestore-catalog-crud'
import type { CatalogFormField, CatalogTabConfig } from './catalog-tab-config'

const SELECT_CLASS =
  'w-full min-h-[38px] px-2.5 border border-[var(--color-borde)] rounded-[var(--radius-default)] bg-white text-[var(--color-texto)] text-[13px] outline-none transition-all duration-200 focus:border-[var(--color-primario)] focus:ring-3 focus:ring-[rgba(10,31,92,0.12)]'

interface CatalogFormDialogProps<T extends CatalogMaintenanceItem> {
  open: boolean
  onOpenChange: (open: boolean) => void
  config: CatalogTabConfig<T>
  item?: T | null
  onSubmit: (values: Record<string, string>) => Promise<void>
}

function useEntidadesOptions(enabled: boolean) {
  return useQuery({
    queryKey: ['entidades-select'],
    queryFn: () =>
      fetchActiveCatalog<Entidad>(
        'entidades',
        (id, data) => ({ id, nombre: data.nombre ?? '', activo: data.activo !== false }),
        sortByNombre,
      ),
    enabled,
    staleTime: 5 * 60_000,
  })
}

function itemToFormValues(
  item: CatalogMaintenanceItem | null | undefined,
  fields: CatalogFormField[],
): Record<string, string> {
  const values: Record<string, string> = {}
  for (const field of fields) {
    if (item && field.name in item) {
      const raw = (item as unknown as Record<string, unknown>)[field.name]
      values[field.name] = raw == null ? '' : String(raw)
    } else {
      values[field.name] = field.defaultValue != null ? String(field.defaultValue) : ''
    }
  }
  return values
}

export function CatalogFormDialog<T extends CatalogMaintenanceItem>({
  open,
  onOpenChange,
  config,
  item,
  onSubmit,
}: CatalogFormDialogProps<T>) {
  const isEdit = !!item
  const needsEntidades = config.formFields.some((f) => f.optionsFrom === 'entidades')
  const { data: entidades } = useEntidadesOptions(open && needsEntidades)

  const [values, setValues] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      setValues(itemToFormValues(item, config.formFields))
      setError(null)
    }
  }, [open, item, config.formFields])

  function setField(name: string, value: string) {
    setValues((prev) => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    for (const field of config.formFields) {
      if (field.required && !values[field.name]?.trim()) {
        setError(`El campo "${field.label}" es obligatorio.`)
        return
      }
    }

    setLoading(true)
    try {
      await onSubmit(values)
      onOpenChange(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar el registro.')
    } finally {
      setLoading(false)
    }
  }

  function renderField(field: CatalogFormField) {
    const id = `catalog-${config.id}-${field.name}`
    const disabled = loading

    if (field.type === 'textarea') {
      return (
        <textarea
          id={id}
          value={values[field.name] ?? ''}
          onChange={(e) => setField(field.name, e.target.value)}
          disabled={disabled}
          rows={3}
          placeholder={field.placeholder}
          className={SELECT_CLASS}
        />
      )
    }

    if (field.type === 'select') {
      const options =
        field.optionsFrom === 'entidades'
          ? (entidades ?? []).map((e) => ({ value: e.id, label: e.nombre }))
          : (field.options ?? [])

      return (
        <select
          id={id}
          value={values[field.name] ?? ''}
          onChange={(e) => setField(field.name, e.target.value)}
          disabled={disabled}
          className={SELECT_CLASS}
        >
          <option value="">— Sin entidad —</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )
    }

    return (
      <Input
        id={id}
        type={field.type === 'number' ? 'number' : 'text'}
        value={values[field.name] ?? ''}
        onChange={(e) => setField(field.name, e.target.value)}
        disabled={disabled}
        placeholder={field.placeholder}
        required={field.required}
      />
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar' : 'Nuevo'} — {config.label}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Modifique los campos y guarde los cambios.'
              : 'Complete los campos para crear un nuevo registro.'}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <AlertBanner variant="error" className="mb-3">
            {error}
          </AlertBanner>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {config.formFields.map((field) => (
            <div key={field.name} className="flex flex-col gap-1">
              <label htmlFor={`catalog-${config.id}-${field.name}`} className="text-xs font-medium text-[var(--color-texto-suave)]">
                {field.label}
                {field.required ? ' *' : ''}
              </label>
              {renderField(field)}
            </div>
          ))}

          <div className="flex justify-end gap-2 mt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? <LoadingSpinner size="sm" className="border-white/35 border-t-white" /> : null}
              {isEdit ? 'Guardar' : 'Crear'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
