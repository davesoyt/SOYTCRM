import { prisma } from '@/lib/prisma'
import MyWorkDashboard from './MyWorkDashboard'

export const dynamic = 'force-dynamic'

export default async function MyWorkPage() {
  const [users, tasks, enrollments, forms] = await Promise.all([
    prisma.user.findMany({ orderBy: { name: 'asc' } }),

    prisma.task.findMany({
      where: { status: { not: 'done' } },
      include: {
        assignee: { select: { id: true, name: true, color: true } },
        contact:  { select: { id: true, firstName: true, lastName: true } },
        company:  { select: { id: true, name: true } },
        deal:     { select: { id: true, name: true } },
      },
      orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
    }),

    prisma.enrollment.findMany({
      where: { active: true },
      include: {
        contact:  { select: { id: true, firstName: true, lastName: true, email: true } },
        sequence: { select: { id: true, name: true, nodesJson: true } },
      },
      orderBy: { startedAt: 'desc' },
    }),

    prisma.form.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, description: true } }),
  ])

  // Serialize dates
  const serializedTasks = tasks.map(t => ({
    ...t,
    dueDate:   t.dueDate?.toISOString() ?? null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }))

  const serializedEnrollments = enrollments.map(e => ({
    id:         e.id,
    startedAt:  e.startedAt.toISOString(),
    currentStep: e.currentStep,
    contact:    e.contact,
    sequence:   e.sequence,
  }))

  return (
    <MyWorkDashboard
      users={users}
      tasks={serializedTasks}
      enrollments={serializedEnrollments}
      forms={forms}
    />
  )
}
