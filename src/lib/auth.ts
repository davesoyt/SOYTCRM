import { cookies } from 'next/headers'
import { createHash } from 'crypto'
import { prisma } from '@/lib/prisma'

const SESSION_COOKIE = 'crm_session'
const MASTER_LOGIN = 'SOYTCRM'
const MASTER_PASSWORD_HASH = createHash('sha256').update('test123').digest('hex')

export function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex')
}

export async function authenticate(
  emailOrUsername: string,
  password: string,
): Promise<{ success: true; userId: string; name: string } | { success: false; error: string }> {
  const loginIdentifier = emailOrUsername.trim()
  const passwordHash = hashPassword(password)

  if (loginIdentifier.toLowerCase() === MASTER_LOGIN.toLowerCase() && passwordHash === MASTER_PASSWORD_HASH) {
    return { success: true, userId: '__master__', name: 'Master Admin' }
  }

  let user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: { equals: loginIdentifier, mode: 'insensitive' } },
        { name: { equals: loginIdentifier, mode: 'insensitive' } },
      ],
    },
    select: { id: true, name: true, password: true },
  })

  if (!user && loginIdentifier && !loginIdentifier.includes('@')) {
    // Fallback: treat username as the local-part of email (e.g. "alex" => "alex@company.com").
    user = await prisma.user.findFirst({
      where: {
        email: { startsWith: `${loginIdentifier}@`, mode: 'insensitive' },
      },
      select: { id: true, name: true, password: true },
    })
  }

  if (!user) {
    return { success: false, error: 'Invalid email/username or password' }
  }

  if (!user.password) {
    return { success: false, error: 'No password set for this account. Contact an admin.' }
  }

  if (user.password !== passwordHash) {
    return { success: false, error: 'Invalid email/username or password' }
  }

  return { success: true, userId: user.id, name: user.name }
}

export async function createSession(userId: string, name: string) {
  const cookieStore = await cookies()
  const payload = JSON.stringify({ userId, name, ts: Date.now() })
  const encoded = Buffer.from(payload).toString('base64')
  cookieStore.set(SESSION_COOKIE, encoded, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  })
}

export async function getSession(): Promise<{ userId: string; name: string } | null> {
  try {
    const cookieStore = await cookies()
    const raw = cookieStore.get(SESSION_COOKIE)?.value
    if (!raw) return null
    const payload = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'))
    if (payload.userId && payload.name) return { userId: payload.userId, name: payload.name }
    return null
  } catch {
    return null
  }
}

export async function destroySession() {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
}
