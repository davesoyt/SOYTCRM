'use server'

import { authenticate, createSession } from '@/lib/auth'

export async function login(
  emailOrUsername: string,
  password: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const result = await authenticate(emailOrUsername, password)
  if (!result.success) return result
  await createSession(result.userId, result.name)
  return { success: true }
}
