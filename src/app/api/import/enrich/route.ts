import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import Papa from 'papaparse'
import {
  enrichAllRows,
  type EnrichMode,
  type EnrichTargetId,
} from '@/lib/enrichRecords'

export const runtime = 'nodejs'

type EnrichMeta = {
  targetId: EnrichTargetId
  keyField: string
  csvKeyColumn: string
  mode: EnrichMode
  mappings: Record<string, string>
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')
    const metaRaw = formData.get('meta')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'CSV file is required' }, { status: 400 })
    }
    if (typeof metaRaw !== 'string') {
      return NextResponse.json({ error: 'Enrich configuration is required' }, { status: 400 })
    }

    const meta = JSON.parse(metaRaw) as EnrichMeta
    if (!meta.targetId || !meta.keyField || !meta.csvKeyColumn || !meta.mappings) {
      return NextResponse.json({ error: 'Invalid enrich configuration' }, { status: 400 })
    }

    const text = await file.text()
    const parsed = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
    })

    if (parsed.errors.length > 0) {
      return NextResponse.json({ error: 'Could not parse CSV file' }, { status: 400 })
    }

    const result = await enrichAllRows({
      targetId: meta.targetId,
      keyField: meta.keyField,
      csvKeyColumn: meta.csvKeyColumn,
      mode: meta.mode ?? 'fill_empty',
      mappings: meta.mappings,
      rows: parsed.data,
    })

    revalidatePath('/contacts')
    revalidatePath('/companies')
    revalidatePath('/opportunities')

    return NextResponse.json(result)
  } catch (err) {
    console.error('Enrich API error:', err)
    return NextResponse.json({ error: 'Enrich failed' }, { status: 500 })
  }
}
