import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const startedAt = Date.now()

  try {
    const [users, contacts, companies, opportunities] = await Promise.all([
      prisma.user.count(),
      prisma.contact.count(),
      prisma.company.count(),
      prisma.opportunity.count(),
    ])

    return NextResponse.json({
      ok: true,
      database: 'connected',
      elapsedMs: Date.now() - startedAt,
      counts: { users, contacts, companies, opportunities },
      env: {
        hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
        nodeEnv: process.env.NODE_ENV ?? 'unknown',
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown database error'
    return NextResponse.json(
      {
        ok: false,
        database: 'unreachable',
        elapsedMs: Date.now() - startedAt,
        error: message,
        env: {
          hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
          nodeEnv: process.env.NODE_ENV ?? 'unknown',
        },
      },
      { status: 500 },
    )
  }
}
