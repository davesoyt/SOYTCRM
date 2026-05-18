import { getCRMSettings } from '@/app/actions'
import GeneralSettingsClient from './GeneralSettingsClient'

export default async function SetupPage() {
  const settings = await getCRMSettings()
  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-xl font-bold text-zinc-900 mb-1">General Settings</h1>
      <p className="text-sm text-zinc-500 mb-8">Configure your CRM name and branding.</p>
      <GeneralSettingsClient name={settings.name} logoData={settings.logoData ?? null} />
    </div>
  )
}
