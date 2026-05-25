import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import CampaignEditor from './CampaignEditor'

export const dynamic = 'force-dynamic'

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: { segment: true },
  })
  if (!campaign) notFound()

  const segments = await prisma.segment.findMany({
    where: { objectType: 'contact' },
    orderBy: { name: 'asc' },
  })

  // Compute recipient counts for each segment
  const { applyFilters, flattenContact } = await import('@/lib/filters')
  const contacts = await prisma.contact.findMany({
    include: {
      company: { select: { id: true, name: true, domain: true, industry: true, size: true } },
      opportunities: { select: { stage: true, value: true } },
      activities: { select: { type: true } },
      enrollments: { select: { sequenceId: true } },
    },
  })
  const flatContacts = contacts.map(flattenContact)

  const segmentsWithCounts = segments.map(s => {
    let filters: import('@/lib/filters').SegmentFilter[] = []
    try { filters = JSON.parse(s.filtersJson) } catch {}
    const matching = applyFilters(flatContacts, filters)
    return { id: s.id, name: s.name, recipientCount: matching.length }
  })

  // For preview: first matching contact in the campaign's segment
  let previewContact: { firstName: string; lastName: string; email: string; company: { name: string } | null } | null = null
  if (campaign.segment) {
    let filters: import('@/lib/filters').SegmentFilter[] = []
    try { filters = JSON.parse(campaign.segment.filtersJson) } catch {}
    const matching = applyFilters(flatContacts, filters)
    if (matching.length > 0) {
      const firstId = matching[0]._id
      const found = contacts.find(c => c.id === firstId)
      if (found) {
        previewContact = {
          firstName: found.firstName,
          lastName: found.lastName,
          email: found.email,
          company: found.company ? { name: found.company.name } : null,
        }
      }
    }
  }

  return (
    <CampaignEditor
      campaign={{
        id: campaign.id,
        name: campaign.name,
        subject: campaign.subject,
        body: campaign.body,
        segmentId: campaign.segmentId,
        fromName: campaign.fromName,
        fromEmail: campaign.fromEmail,
        status: campaign.status,
        recipientCount: campaign.recipientCount,
        openCount: campaign.openCount,
        clickCount: campaign.clickCount,
        sentAt: campaign.sentAt ? campaign.sentAt.toISOString() : null,
      }}
      segments={segmentsWithCounts}
      previewContact={previewContact}
    />
  )
}
