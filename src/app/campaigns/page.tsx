import { prisma } from '@/lib/prisma'
import CampaignsList from './CampaignsList'

export const dynamic = 'force-dynamic'

export default async function CampaignsPage() {
  const campaigns = await prisma.campaign.findMany({
    include: { segment: true },
    orderBy: { createdAt: 'desc' },
  })

  return <CampaignsList campaigns={campaigns} />
}
