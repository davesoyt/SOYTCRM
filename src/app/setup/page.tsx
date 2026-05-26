import { prisma } from '@/lib/prisma'
import GeneralSettingsClient from './GeneralSettingsClient'

export const dynamic = 'force-dynamic'

export default async function SetupPage() {
  let settings: { name: string; logoData: string | null } = { name: 'CRM', logoData: null }
  try {
    const saved = await prisma.cRMSettings.findUnique({
      where: { id: 'default' },
      select: { name: true, logoData: true },
    })
    if (saved) settings = saved
  } catch {
    settings = { name: 'CRM', logoData: null }
  }
  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-xl font-bold text-zinc-900 mb-1">General Settings</h1>
      <p className="text-sm text-zinc-500 mb-8">Configure your CRM name and branding.</p>
      <GeneralSettingsClient name={settings.name} logoData={settings.logoData ?? null} />
    </div>
  )
}
