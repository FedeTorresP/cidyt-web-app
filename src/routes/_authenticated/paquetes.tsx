import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore'
import { getFirebaseFirestore } from '@/lib/firebase'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'

export const Route = createFileRoute('/_authenticated/paquetes')({
  component: PaquetesPage,
})

async function fetchPaquetes() {
  const db = getFirebaseFirestore()
  const snap = await getDocs(
    query(collection(db, 'paquetes'), where('activo', '==', true), orderBy('nombre', 'asc')),
  )
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Array<{
    id: string
    nombre: string
    descripcion?: string
  }>
}

function PaquetesPage() {
  const { data: paquetes, isLoading } = useQuery({
    queryKey: ['paquetes'],
    queryFn: fetchPaquetes,
  })

  return (
    <div>
      <h1 className="text-xl font-bold mb-4 text-[var(--color-texto)]">Paquetes</h1>

      {isLoading ? (
        <div className="flex justify-center py-8"><LoadingSpinner size="md" /></div>
      ) : !paquetes?.length ? (
        <p className="text-[var(--color-texto-suave)] italic text-sm">No hay paquetes registrados.</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
          {paquetes.map((p) => (
            <Card key={p.id}>
              <CardHeader>
                <CardTitle className="text-sm">{p.nombre}</CardTitle>
              </CardHeader>
              {p.descripcion && (
                <CardContent>
                  <p className="text-[0.8rem] text-[var(--color-texto-suave)]">{p.descripcion}</p>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
