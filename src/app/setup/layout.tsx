import Link from 'next/link'
import { Settings, Box, ChevronRight, GitFork, Table2, Webhook } from 'lucide-react'

const TABS = [
  { href: '/setup', label: 'General', icon: Settings },
  { href: '/setup/schema', label: 'Schema', icon: Table2 },
  { href: '/setup/objects', label: 'Objects & Fields', icon: Box },
  { href: '/setup/relationships', label: 'Relationships', icon: GitFork },
  { href: '/setup/webhooks', label: 'Webhooks', icon: Webhook },
]

export default function SetupLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full">
      <nav className="w-52 shrink-0 border-r border-zinc-200 bg-white flex flex-col py-4">
        <p className="px-4 text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">Setup</p>
        {TABS.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href}
            className="flex items-center gap-2.5 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 transition-colors">
            <Icon className="w-4 h-4 text-zinc-400" />
            {label}
            <ChevronRight className="w-3.5 h-3.5 ml-auto text-zinc-300" />
          </Link>
        ))}
      </nav>
      <div className="flex-1 overflow-y-auto bg-zinc-50">
        {children}
      </div>
    </div>
  )
}
