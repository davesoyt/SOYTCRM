import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import ReportDesigner from './ReportDesigner'
import { getAvailableReportObjects } from '@/lib/reportData'

export const dynamic = 'force-dynamic'

export default async function ReportDesignerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [report, availableObjects] = await Promise.all([
    prisma.report.findUnique({ where: { id } }),
    getAvailableReportObjects(),
  ])

  if (!report) notFound()

  return (
    <ReportDesigner
      report={{
        id: report.id,
        name: report.name,
        description: report.description ?? '',
        configJson: report.configJson,
      }}
      availableObjects={availableObjects}
    />
  )
}
