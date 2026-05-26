import { prisma } from '@/lib/prisma'
import FunnelChart from './FunnelChart'
import ActivityChart from './ActivityChart'
import DashboardActions from './DashboardActions'
import Link from 'next/link'
import { scoreLabel } from '@/lib/scoring'
import { Users, Building2, TrendingUp, CheckCircle2 } from 'lucide-react'

const STAGES = ['Prospect', 'Qualified', 'Proposal', 'Closed Won', 'Closed Lost']

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const since = new Date()
  since.setDate(since.getDate() - 14)

  let contactsCount = 0
  let companiesCount = 0
  let opportunityByStage: { stage: string; _count: { _all: number }; _sum: { value: number | null } }[] = []
  let hotContacts: {
    id: string
    firstName: string
    lastName: string
    leadScore: number
    opportunities: { closedAt: Date | null }[]
    _count: { activities: number }
  }[] = []
  let activities: { createdAt: Date }[] = []

  try {
    ;[contactsCount, companiesCount, opportunityByStage, hotContacts, activities] = await Promise.all([
      prisma.contact.count(),
      prisma.company.count(),
      prisma.opportunity.groupBy({
        by: ['stage'],
        _count: { _all: true },
        _sum: { value: true },
      }),
      prisma.contact.findMany({
        orderBy: { leadScore: 'desc' },
        take: 5,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          leadScore: true,
          opportunities: { select: { closedAt: true } },
          _count: { select: { activities: true } },
        },
      }),
      prisma.activity.findMany({
        where: { createdAt: { gte: since } },
        select: { createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
    ])
  } catch {
    // Build-time or transient DB outage fallback: render empty dashboard safely.
  }

  const stageMap = new Map(
    opportunityByStage.map((row) => [row.stage, { count: row._count._all, value: row._sum.value ?? 0 }]),
  )

  const pipelineValue = opportunityByStage
    .filter((d) => d.stage !== 'Closed Lost' && d.stage !== 'Closed Won')
    .reduce((sum, d) => sum + (d._sum.value ?? 0), 0)
  const wonValue = stageMap.get('Closed Won')?.value ?? 0

  const funnelData = STAGES.map((stage) => {
    const row = stageMap.get(stage)
    return {
      stage,
      count: row?.count ?? 0,
      value: row?.value ?? 0,
    }
  })

  // Activity over last 14 days
  const activityByDay = Array.from({ length: 14 }, (_, i) => {
    const date = new Date()
    date.setDate(date.getDate() - (13 - i))
    const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const count = activities.filter((a) => {
      const d = new Date(a.createdAt)
      return d.toDateString() === date.toDateString()
    }).length
    return { date: label, count }
  })

  const stats = [
    { label: 'Contacts', value: contactsCount, icon: Users, href: '/contacts' },
    { label: 'Companies', value: companiesCount, icon: Building2, href: '/companies' },
    { label: 'Open Pipeline', value: `$${pipelineValue.toLocaleString()}`, icon: TrendingUp, href: '/opportunities' },
    { label: 'Closed Won', value: `$${wonValue.toLocaleString()}`, icon: CheckCircle2, href: '/opportunities' },
  ]

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {stats.map(({ label, value, icon: Icon, href }) => (
          <Link key={label} href={href} className="bg-white rounded-xl border border-zinc-200 p-5 hover:border-zinc-400 transition-colors">
            <div className="flex items-center gap-2 text-zinc-500 mb-2">
              <Icon className="w-4 h-4" />
              <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
            </div>
            <p className="text-2xl font-bold text-zinc-900">{value}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Funnel */}
        <div className="bg-white rounded-xl border border-zinc-200 p-6">
          <h2 className="font-semibold mb-4">Opportunity Funnel</h2>
          <FunnelChart data={funnelData} />
        </div>

        {/* Activity over time */}
        <div className="bg-white rounded-xl border border-zinc-200 p-6">
          <h2 className="font-semibold mb-4">Activity (14 days)</h2>
          <ActivityChart data={activityByDay} />
        </div>
      </div>

      {/* Hot leads */}
      <div className="bg-white rounded-xl border border-zinc-200 p-6">
        <h2 className="font-semibold mb-4">Hottest Leads</h2>
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-100">
            <tr>
              <th className="text-left py-2 font-medium text-zinc-500">Contact</th>
              <th className="text-left py-2 font-medium text-zinc-500">Score</th>
              <th className="text-left py-2 font-medium text-zinc-500">Activities</th>
              <th className="text-left py-2 font-medium text-zinc-500">Open Opportunities</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-50">
            {hotContacts.map((c) => {
              const { label, color } = scoreLabel(c.leadScore)
              const openOpportunities = c.opportunities.filter((d) => !d.closedAt).length
              return (
                <tr key={c.id} className="hover:bg-zinc-50">
                  <td className="py-2">
                    <Link href={`/contacts/${c.id}`} className="font-medium hover:underline">
                      {c.firstName} {c.lastName}
                    </Link>
                  </td>
                  <td className="py-2">
                    <span className={`font-semibold ${color}`}>{c.leadScore} · {label}</span>
                  </td>
                  <td className="py-2 text-zinc-500">{c._count.activities}</td>
                  <td className="py-2 text-zinc-500">{openOpportunities}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <DashboardActions />
    </div>
  )
}
