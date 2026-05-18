import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { Plus } from 'lucide-react'
import CompaniesList from './CompaniesList'
import DeleteAllButton from '@/components/DeleteAllButton'

export default async function CompaniesPage() {
  const companies = await prisma.company.findMany({
    include: { _count: { select: { contacts: true, deals: true } } },
    orderBy: { name: 'asc' },
  })

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Companies</h1>
        <div className="flex items-center gap-2">
          <DeleteAllButton target="companies" count={companies.length} />
          <Link
            href="/companies/new"
            className="flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Company
          </Link>
        </div>
      </div>
      <CompaniesList companies={companies} />
    </div>
  )
}
