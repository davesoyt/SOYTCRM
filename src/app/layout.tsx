import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import Sidebar from '@/components/Sidebar'
import NotificationsBell from '@/components/NotificationsBell'
import { getCRMSettings } from '@/app/actions'
import { prisma } from '@/lib/prisma'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist-sans' })

export const metadata: Metadata = {
  title: 'CRM',
  description: 'Customer Relationship Management',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [settings, customObjects, firstUser] = await Promise.all([
    getCRMSettings(),
    prisma.customObjectDef.findMany({ orderBy: { createdAt: 'asc' }, select: { id: true, pluralName: true, icon: true } }),
    prisma.user.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true } }),
  ])
  const currentUserId = firstUser?.id ?? null
  return (
    <html lang="en" className={`${geist.variable} h-full`}>
      <body className="h-full flex font-sans antialiased bg-zinc-50 text-zinc-900">
        <Sidebar
          crmName={settings.name}
          logoData={settings.logoData ?? null}
          customObjects={customObjects}
        />
        <main className="flex-1 overflow-auto min-h-0 flex flex-col">
          <header className="flex items-center justify-end gap-2 border-b border-zinc-200 bg-white px-4 py-2 shrink-0">
            <NotificationsBell currentUserId={currentUserId} />
          </header>
          <div className="flex-1 min-h-0 flex flex-col">{children}</div>
        </main>
      </body>
    </html>
  )
}
