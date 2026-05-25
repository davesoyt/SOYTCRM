import { prisma } from '@/lib/prisma'
import TasksBoard from './TasksBoard'

export default async function TasksPage() {
  const [tasks, users, segments, contacts, companies, opportunities] = await Promise.all([
    prisma.task.findMany({
      include: {
        assignee: true,
        contact: { select: { id: true, firstName: true, lastName: true } },
        company: { select: { id: true, name: true } },
        opportunity: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.findMany({ orderBy: { name: 'asc' } }),
    prisma.segment.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, objectType: true } }),
    prisma.contact.findMany({ orderBy: { firstName: 'asc' }, select: { id: true, firstName: true, lastName: true } }),
    prisma.company.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.opportunity.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ])

  return (
    <TasksBoard
      tasks={tasks.map(t => ({
        ...t,
        dueDate: t.dueDate?.toISOString() ?? null,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
        assignee: t.assignee ? { id: t.assignee.id, name: t.assignee.name, color: t.assignee.color } : null,
      }))}
      users={users}
      segments={segments}
      contacts={contacts}
      companies={companies}
      opportunities={opportunities}
    />
  )
}
