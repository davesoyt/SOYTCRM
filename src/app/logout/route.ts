import { destroySession } from '@/lib/auth'
import { redirect } from 'next/navigation'

export async function POST() {
  await destroySession()
  redirect('/login')
}

export async function GET() {
  redirect('/dashboard')
}
