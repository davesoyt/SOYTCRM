import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { getWebhookTargetOptions } from '@/app/actions'
import WebhookEditor from '../WebhookEditor'

export default async function WebhookEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const integration = await prisma.webhookIntegration.findUnique({ where: { id } })
  if (!integration) notFound()

  const targetOptions = await getWebhookTargetOptions()
  const hdrs = await headers()
  const host = hdrs.get('x-forwarded-host') ?? hdrs.get('host') ?? 'localhost:3000'
  const proto = hdrs.get('x-forwarded-proto') ?? (host.includes('localhost') ? 'http' : 'https')
  const appOrigin = `${proto}://${host}`

  return (
    <WebhookEditor
      integration={integration}
      targetOptions={targetOptions}
      appOrigin={appOrigin}
    />
  )
}
