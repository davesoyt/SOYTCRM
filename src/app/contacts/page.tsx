import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { Plus } from 'lucide-react'
import ContactsList from './ContactsList'
import DeleteAllButton from '@/components/DeleteAllButton'

export default async function ContactsPage() {
  const contacts = await prisma.contact.findMany({
    include: { company: { select: { id: true, name: true } } },
    orderBy: { leadScore: 'desc' },
  })

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Contacts</h1>
        <div className="flex items-center gap-2">
          <DeleteAllButton target="contacts" count={contacts.length} />
          <Link
            href="/contacts/new"
            className="flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Contact
          </Link>
        </div>
      </div>
      <ContactsList contacts={contacts} />
    </div>
  )
}
