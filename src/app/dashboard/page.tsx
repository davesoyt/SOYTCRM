import { prisma } from '@/lib/prisma'
import FunnelChart from './FunnelChart'
import ActivityChart from './ActivityChart'
import DashboardActions from './DashboardActions'
import Link from 'next/link'
import { scoreLabel } from '@/lib/scoring'
import { Users, Building2, TrendingUp, CheckCircle2 } from 'lucide-react'

const STAGES = ['Prospect', 'Qualified', 'Proposal', 'Closed Won', 'Closed Lost']

export default async function DashboardPage() {
  const [contacts, companies, deals, activities] = await Promise.all([
    prisma.contact.findMany({ include: { deals: true, activities: true } }),
    prisma.company.findMany(),
    prisma.deal.findMany(),
    prisma.activity.findMany({ orderBy: { createdAt: 'desc' }, take: 200 }),
  ])

  const wonDeals = deals.filter((d) => d.stage === 'Closed Won')
  const pipelineValue = deals
    .filter((d) => d.stage !== 'Closed Lost' && d.stage !== 'Closed Won')
    .reduce((s, d) => s + d.value, 0)
  const wonValue = wonDeals.reduce((s, d) => s + d.value, 0)

  const funnelData = STAGES.map((stage) => {
    const stageDeals = deals.filter((d) => d.stage === stage)
    return {
      stage,
      count: stageDeals.length,
      value: stageDeals.reduce((s, d) => s + d.value, 0),
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

  const hotContacts = contacts
    .sort((a, b) => b.leadScore - a.leadScore)
    .slice(0, 5)

  const stats = [
    { label: 'Contacts', value: contacts.length, icon: Users, href: '/contacts' },
    { label: 'Companies', value: companies.length, icon: Building2, href: '/companies' },
    { label: 'Open Pipeline', value: `$${pipelineValue.toLocaleString()}`, icon: TrendingUp, href: '/deals' },
    { label: 'Closed Won', value: `$${wonValue.toLocaleString()}`, icon: CheckCircle2, href: '/deals' },
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
          <h2 className="font-semibold mb-4">Deal Funnel</h2>
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
              <th className="text-left py-2 font-medium text-zinc-500">Open Deals</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-50">
            {hotContacts.map((c) => {
              const { label, color } = scoreLabel(c.leadScore)
              const openDeals = c.deals.filter((d) => !d.closedAt).length
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
                  <td className="py-2 text-zinc-500">{c.activities.length}</td>
                  <td className="py-2 text-zinc-500">{openDeals}</td>
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
