import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { scoreLabel } from '@/lib/scoring'
import ContactView from './ContactView'

export const dynamic = 'force-dynamic'

export default async function ContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const contact = await prisma.contact.findUnique({
    where: { id },
    include: {
      company: true,
      activities: { orderBy: { createdAt: 'desc' } },
      deals: true,
      enrollments: { include: { sequence: true } },
      tasks: { orderBy: { createdAt: 'desc' } },
    },
  })
  if (!contact) notFound()

  const sequences = await prisma.sequence.findMany({ orderBy: { name: 'asc' } })
  const { label, color } = scoreLabel(contact.leadScore)

  return (
    <ContactView
      contact={{
        ...contact,
        street: contact.street ?? null,
        city: contact.city ?? null,
        state: contact.state ?? null,
        zip: contact.zip ?? null,
        country: contact.country ?? null,
        lat: contact.lat ?? null,
        lng: contact.lng ?? null,
      }}
      sequences={sequences}
      scoreLabel={label}
      scoreColor={color}
    />
  )
}
