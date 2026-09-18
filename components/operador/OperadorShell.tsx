'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart3, ClipboardList, FileText, Package, X, type LucideIcon } from 'lucide-react'
import { cx } from './cx'

type NavItem = {
  href: string
  label: string
  icon: LucideIcon
  exact?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { href: '/operador', label: 'Pedidos', icon: Package, exact: true },
  { href: '/operador/cotizacion', label: 'Cotización', icon: FileText },
  { href: '/operador/presupuesto', label: 'Presupuesto', icon: ClipboardList },
  { href: '/operador/reportes', label: 'Reportes', icon: BarChart3 },
]

const MenuContext = createContext({ openMenu: () => {} })

export function useOperadorMenu() {
  return useContext(MenuContext)
}

export function OperadorShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const menu = useMemo(() => ({ openMenu: () => setMenuOpen(true) }), [])

  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  return (
    <MenuContext.Provider value={menu}>
      <div className={cx("operador-root", "app-shell")}>
        <aside className={cx(`sidebar ${menuOpen ? 'sidebar-open' : ''}`)}>
          <div className={cx("sidebar-brand")}>
            <span>J3D - IMPRESIONES</span>
            <button className={cx("mobile-close")} type="button" onClick={() => setMenuOpen(false)} aria-label="Cerrar menú">
              <X />
            </button>
          </div>
          <nav className={cx("sidebar-nav")} aria-label="Navegación principal">
            {NAV_ITEMS.map((item) => {
              const active = item.exact ? pathname === item.href : pathname.startsWith(item.href)
              const Icon = item.icon
              return (
                <Link key={item.href} href={item.href} className={cx(`nav-item ${active ? 'nav-item-active' : ''}`)}>
                  <Icon />
                  {item.label}
                </Link>
              )
            })}
          </nav>
          <div className={cx("sidebar-footer")}>
            <div className={cx("operator-avatar")}>OP</div>
            <div>
              <strong>Operador</strong>
              <span>Panel de tienda</span>
            </div>
          </div>
        </aside>
        {menuOpen && <button className={cx("sidebar-overlay")} type="button" onClick={() => setMenuOpen(false)} aria-label="Cerrar menú" />}
        <main className={cx("main-content")}>{children}</main>
      </div>
    </MenuContext.Provider>
  )
}
