import { Link, useLocation } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import type { NavMenuItem } from '@/types/menu'

interface SidebarNavProps {
  items: NavMenuItem[]
}

export function SidebarNav({ items }: SidebarNavProps) {
  const location = useLocation()

  return (
    <nav className="flex flex-col gap-0.5 px-2 py-2 flex-1 overflow-y-auto" aria-label="Menú de navegación">
      {items.map((item) => {
        const isActive = location.pathname === item.route || location.pathname.startsWith(`${item.route}/`)
        return (
          <Link
            key={item.id}
            to={item.route}
            className={cn(
              'block px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-200 no-underline',
              isActive
                ? 'bg-white/15 text-white font-semibold'
                : 'text-white/70 hover:bg-white/8 hover:text-white',
            )}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
