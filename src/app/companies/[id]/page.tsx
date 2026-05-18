import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import CompanyView from './CompanyView'

export const dynamic = 'force-dynamic'

export default async function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const company = await prisma.company.findUnique({
    where: { id },
    include: {
      contacts: { include: { deals: true, activities: true } },
      deals: { orderBy: { createdAt: 'desc' } },
      activities: { orderBy: { createdAt: 'desc' } },
      tasks: { orderBy: { createdAt: 'desc' } },
    },
  })
  if (!company) notFound()

  const totalDealValue = company.deals
    .filter((d) => d.stage !== 'Closed Lost')
    .reduce((sum, d) => sum + d.value, 0)

  return (
    <CompanyView
      company={company}
      totalDealValue={totalDealValue}
    />
  )
}
