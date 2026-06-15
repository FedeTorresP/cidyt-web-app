import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

/* ═══════════════════════════════════════════════════════════════════════════
   Tabs — Control Segmentado estilo Apple HIG + shadcn/ui
   Tailwind CSS puro, sin Radix. Optimizado para iPad (44px touch target).
   ═══════════════════════════════════════════════════════════════════════════ */

const Tabs = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<'div'>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('w-full', className)} {...props} />
  ),
)
Tabs.displayName = 'Tabs'

const TabsList = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<'div'>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      role="tablist"
      className={cn(
        'inline-flex items-center gap-0.5 rounded-xl bg-gray-200 p-1',
        className,
      )}
      {...props}
    />
  ),
)
TabsList.displayName = 'TabsList'

interface TabsTriggerProps extends ComponentPropsWithoutRef<'button'> {
  active?: boolean
}

const TabsTrigger = forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ className, active, ...props }, ref) => (
    <button
      ref={ref}
      role="tab"
      aria-selected={active}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-lg px-5 h-11 text-[13px] font-semibold transition-all duration-200 ease-in-out touch-manipulation select-none',
        active
          ? 'bg-white text-[var(--color-primario)] shadow-sm'
          : 'bg-transparent text-[var(--color-texto-suave)] hover:text-[var(--color-texto)]',
        className,
      )}
      {...props}
    />
  ),
)
TabsTrigger.displayName = 'TabsTrigger'

const TabsContent = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<'div'> & { active?: boolean }
>(({ className, active, ...props }, ref) => {
  if (!active) return null
  return (
    <div
      ref={ref}
      role="tabpanel"
      className={cn('focus-visible:outline-none', className)}
      style={{ marginTop: 24 }}
      {...props}
    />
  )
})
TabsContent.displayName = 'TabsContent'

export { Tabs, TabsList, TabsTrigger, TabsContent }
