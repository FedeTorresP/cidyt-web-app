import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { getFirebaseFirestore } from '@/lib/firebase'
import { type ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/shared/DataTable'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'

export const Route = createFileRoute('/_authenticated/admin/perfiles')({
  component: PerfilesPage,
})

interface RolRow {
  id: string
  nombre: string
  descripcion: string
}

async function fetchRoles(): Promise<RolRow[]> {
  const db = getFirebaseFirestore()
  const snap = await getDocs(query(collection(db, 'roles'), where('activo', '==', true)))
  return snap.docs.map((d) => ({
    id: d.id,
    nombre: (d.data().nombre as string) ?? '',
    descripcion: (d.data().descripcion as string) ?? '',
  }))
}

const columns: ColumnDef<RolRow, unknown>[] = [
  { accessorKey: 'nombre', header: 'Nombre' },
  { accessorKey: 'descripcion', header: 'Descripción' },
]

function PerfilesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-roles'],
    queryFn: fetchRoles,
  })

  return (
    <div>
      <h1 className="text-xl font-bold mb-4 text-[var(--color-texto)]">Gestión de Perfiles</h1>

      {isLoading ? (
        <div className="flex justify-center py-8"><LoadingSpinner size="md" /></div>
      ) : (
        <DataTable columns={columns} data={data ?? []} />
      )}
    </div>
  )
}
