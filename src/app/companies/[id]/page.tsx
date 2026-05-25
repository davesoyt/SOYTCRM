import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import CompanyView from './CompanyView'

export const dynamic = 'force-dynamic'

export default async function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const company = await prisma.company.findUnique({
    where: { id },
    include: {
      contacts: { include: { opportunities: true, activities: true } },
      opportunities: { orderBy: { createdAt: 'desc' } },
      activities: { orderBy: { createdAt: 'desc' } },
      tasks: { orderBy: { createdAt: 'desc' } },
    },
  })
  if (!company) notFound()

  const totalOpportunityValue = company.opportunities
    .filter((d) => d.stage !== 'Closed Lost')
    .reduce((sum, d) => sum + d.value, 0)

  return (
    <CompanyView
      company={company}
      totalOpportunityValue={totalOpportunityValue}
    />
  )
}
