import { NextResponse } from 'next/server'
import { tickWorkflows } from '@/app/actions'

export const dynamic = 'force-dynamic'

export async function GET() {
  const result = await tickWorkflows()
  return NextResponse.json(result)
}
