import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import { unstable_cache } from 'next/cache'
import './globals.css'
import Sidebar from '@/components/Sidebar'
import NotificationsBell from '@/components/NotificationsBell'
import NavigationLoadingCursor from '@/components/NavigationLoadingCursor'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist-sans' })

export const metadata: Metadata = {
  title: 'CRM',
  description: 'Customer Relationship Management',
}

const getShellData = unstable_cache(
  async () => {
    try {
      const [settings, customObjects, firstUser] = await Promise.all([
        prisma.cRMSettings.findUnique({ where: { id: 'default' } }),
        prisma.customObjectDef.findMany({
          orderBy: { createdAt: 'asc' },
          select: { id: true, pluralName: true, icon: true },
        }),
        prisma.user.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true } }),
      ])
      return {
        settings: { name: settings?.name ?? 'CRM', logoData: settings?.logoData ?? null },
        customObjects,
        currentUserId: firstUser?.id ?? null,
      }
    } catch {
      return {
        settings: { name: 'CRM', logoData: null },
        customObjects: [] as { id: string; pluralName: string; icon: string }[],
        currentUserId: null,
      }
    }
  },
  ['shell-data'],
  { revalidate: 15 },
)

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { settings, customObjects, currentUserId } = await getShellData()
  const session = await getSession()

  if (!session) {
    return (
      <html lang="en" className={`${geist.variable} h-full`}>
        <body className="h-full font-sans antialiased bg-zinc-50 text-zinc-900">
          <NavigationLoadingCursor />
          {children}
        </body>
      </html>
    )
  }

  return (
    <html lang="en" className={`${geist.variable} h-full`}>
      <body className="h-full flex font-sans antialiased bg-zinc-50 text-zinc-900">
        <NavigationLoadingCursor />
        <Sidebar
          crmName={settings.name}
          logoData={settings.logoData ?? null}
          customObjects={customObjects}
        />
        <main className="flex-1 overflow-auto min-h-0 flex flex-col">
          <header className="flex items-center justify-end gap-2 border-b border-zinc-200 bg-white px-4 py-2 shrink-0">
            <span className="text-xs text-zinc-500 mr-2">
              {session.name}
            </span>
            <NotificationsBell currentUserId={currentUserId} />
            <form action="/logout" method="post">
              <button
                type="submit"
                className="rounded-lg border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
              >
                Logout
              </button>
            </form>
          </header>
          <div className="flex-1 min-h-0 flex flex-col">{children}</div>
        </main>
      </body>
    </html>
  )
}
