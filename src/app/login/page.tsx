import LoginForm from './LoginForm'
import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function LoginPage() {
  const session = await getSession()
  if (session) redirect('/dashboard')

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 px-4">
      <LoginForm />
    </div>
  )
}
