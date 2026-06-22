import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { canManageCatalogs } from '@/services/auth'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { AlertBanner } from '@/components/shared/AlertBanner'
import type { CatalogMaintenanceItem } from '@/lib/firestore-catalog-crud'
import { CatalogMaintenanceTab } from '@/components/catalog-maintenance/CatalogMaintenanceTab'
import { CATALOG_TAB_CONFIGS, type CatalogTabConfig, type CatalogTabId } from '@/components/catalog-maintenance/catalog-tab-config'

export const Route = createFileRoute('/_authenticated/catalogos')({
  component: CatalogosPage,
})

const TAB_ORDER: CatalogTabId[] = ['cubiculos', 'empresas', 'especialidades']

function CatalogosPage() {
  const { user } = useAuth()
  const canManage = canManageCatalogs(user)
  const [activeTab, setActiveTab] = useState<CatalogTabId>('cubiculos')

  if (!canManage) {
    return (
      <div style={{ width: '100%' }}>
        <h1 className="page-title">Mantenimiento de Catálogos</h1>
        <AlertBanner variant="warning">
          No tiene permisos para acceder a esta sección. Solo administradores pueden mantener catálogos.
        </AlertBanner>
      </div>
    )
  }

  return (
    <div style={{ width: '100%' }}>
      <h1 className="page-title">Mantenimiento de Catálogos</h1>

      <Tabs>
        <TabsList style={{ marginBottom: 24 }}>
          {TAB_ORDER.map((tabId) => (
            <TabsTrigger
              key={tabId}
              active={activeTab === tabId}
              onClick={() => setActiveTab(tabId)}
            >
              {CATALOG_TAB_CONFIGS[tabId].label}
            </TabsTrigger>
          ))}
        </TabsList>

        {TAB_ORDER.map((tabId) => (
          <TabsContent key={tabId} active={activeTab === tabId}>
            <CatalogMaintenanceTab
              config={CATALOG_TAB_CONFIGS[tabId] as CatalogTabConfig<CatalogMaintenanceItem>}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
