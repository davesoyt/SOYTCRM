import { getReports } from '@/app/actions'
import ReportsListClient from './ReportsListClient'

export const dynamic = 'force-dynamic'

export default async function ReportsPage() {
  const reports = await getReports()
  return <ReportsListClient reports={reports} />
}
