import { createFileRoute, Link } from '@tanstack/react-router'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

export const Route = createFileRoute('/_authenticated/catalogos')({
  component: CatalogosPage,
})

const catalogos = [
  { label: 'Empresas', route: '/catalogos/empresas', descripcion: 'Gestión de empresas clientes' },
  { label: 'Médicos', route: '/catalogos/medicos', descripcion: 'Catálogo de médicos' },
  { label: 'Cubículos', route: '/catalogos/cubiculos', descripcion: 'Configuración de cubículos' },
  { label: 'Horarios', route: '/catalogos/horarios', descripcion: 'Horarios laborales' },
  { label: 'Lugares', route: '/catalogos/lugares', descripcion: 'Catálogo de lugares' },
  { label: 'Paquetes', route: '/catalogos/paquetes', descripcion: 'Paquetes de estudios' },
  { label: 'Aplicaciones Menú', route: '/catalogos/aplicaciones-menu', descripcion: 'Elementos del menú' },
]

function CatalogosPage() {
  return (
    <div>
      <h1 className="text-xl font-bold mb-4 text-[var(--color-texto)]">Catálogos</h1>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
        {catalogos.map((cat) => (
          <Link key={cat.route} to={cat.route} className="no-underline">
            <Card className="hover:shadow-[var(--shadow-hover)] transition-shadow cursor-pointer h-full">
              <CardHeader>
                <CardTitle className="text-sm">{cat.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-[0.8rem] text-[var(--color-texto-suave)]">{cat.descripcion}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
