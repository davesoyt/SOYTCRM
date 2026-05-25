'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Users, Building2, TrendingUp, GitBranch, LayoutDashboard, Upload, Filter, CheckSquare, UserCircle, Settings, Box, ClipboardList, LayoutGrid, Send, ChevronDown, ChevronRight, Database, BarChart2 } from 'lucide-react'
import GlobalSearch from './GlobalSearch'

const nav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/opportunities', label: 'Opportunities', icon: TrendingUp },
  { href: '/segments', label: 'Segments', icon: Filter },
  { href: '/tasks', label: 'Tasks', icon: CheckSquare },
  { href: '/sequences', label: 'Workflows', icon: GitBranch },
  { href: '/campaigns', label: 'Campaigns', icon: Send },
  { href: '/my-work', label: 'My Work', icon: LayoutGrid },
  { href: '/forms', label: 'Forms', icon: ClipboardList },
  { href: '/reports', label: 'Reports', icon: BarChart2 },
  { href: '/users', label: 'Users', icon: UserCircle },
]

const importItems = [
  { href: '/import', label: 'File Import' },
  { href: '/import/merge', label: 'File Merge' },
  { href: '/import/enrich', label: 'Record Enrich from .CSV' },
]

const coreObjects = [
  { href: '/contacts', label: 'Contacts', icon: Users },
  { href: '/companies', label: 'Companies', icon: Building2 },
]

type CustomObj = { id: string; pluralName: string; icon: string }

export default function Sidebar({
  crmName,
  logoData,
  customObjects = [],
}: {
  crmName: string
  logoData: string | null
  customObjects?: CustomObj[]
}) {
  const pathname = usePathname()
  const setupActive = pathname.startsWith('/setup')
  const importActive = pathname === '/import' || pathname.startsWith('/import/')

  const objectsActive =
    coreObjects.some(o => pathname === o.href || pathname.startsWith(o.href + '/')) ||
    customObjects.some(o => pathname.startsWith(`/objects/${o.id}`))

  const [objectsOpen, setObjectsOpen] = useState(objectsActive)
  const [importOpen, setImportOpen] = useState(importActive)

  return (
    <aside className="relative z-50 w-56 shrink-0 border-r border-zinc-200 bg-white flex flex-col">
      <div className="px-4 py-3.5 border-b border-zinc-200 flex items-center gap-2.5">
        {logoData ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoData} alt="logo" className="w-7 h-7 rounded-md object-contain shrink-0" />
        ) : (
          <div className="w-7 h-7 rounded-md bg-zinc-900 flex items-center justify-center shrink-0">
            <span className="text-white text-xs font-bold">{crmName.charAt(0).toUpperCase()}</span>
          </div>
        )}
        <span className="font-bold text-base tracking-tight text-zinc-900 truncate">{crmName}</span>
      </div>
      <div className="px-3 pt-3">
        <GlobalSearch />
      </div>
      <nav className="flex flex-col gap-1 p-3 flex-1 overflow-y-auto">
        {/* Dashboard + Opportunities */}
        {nav.slice(0, 2).map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          )
        })}

        {/* Objects submenu */}
        <button
          onClick={() => setObjectsOpen(o => !o)}
          className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors w-full text-left ${
            objectsActive ? 'text-zinc-900' : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
          }`}
        >
          <Database className="w-4 h-4 shrink-0" />
          <span className="flex-1">Objects</span>
          {objectsOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>

        {objectsOpen && (
          <div className="ml-3 flex flex-col gap-1 border-l border-zinc-200 pl-3">
            {coreObjects.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + '/')
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    active ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </Link>
              )
            })}
            {customObjects.map(obj => {
              const href = `/objects/${obj.id}`
              const active = pathname.startsWith(href)
              return (
                <Link
                  key={obj.id}
                  href={href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    active ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
                  }`}
                >
                  <Box className="w-4 h-4" />
                  {obj.pluralName}
                </Link>
              )
            })}
          </div>
        )}

        {/* Rest of nav */}
        {nav.slice(2, 9).map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          )
        })}

        {/* Import submenu */}
        <button
          onClick={() => setImportOpen(o => !o)}
          className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors w-full text-left ${
            importActive ? 'text-zinc-900' : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
          }`}
        >
          <Upload className="w-4 h-4 shrink-0" />
          <span className="flex-1">Import</span>
          {importOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>

        {importOpen && (
          <div className="ml-3 flex flex-col gap-1 border-l border-zinc-200 pl-3">
            {importItems.map(({ href, label }) => {
              const active = pathname === href || pathname.startsWith(href + '/')
              return (
                <Link
                  key={href}
                  href={href}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    active ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
                  }`}
                >
                  {label}
                </Link>
              )
            })}
          </div>
        )}

        {nav.slice(9).map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          )
        })}
      </nav>
      <div className="p-3 border-t border-zinc-100">
        <Link
          href="/setup"
          className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            setupActive ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900'
          }`}
        >
          <Settings className="w-4 h-4" />
          Setup
        </Link>
      </div>
    </aside>
  )
}
