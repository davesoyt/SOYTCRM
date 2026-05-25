import { scoreLabel } from '@/lib/scoring'
import type { ObjectListColumn } from '@/components/ObjectListView'
import { STANDARD_META, type SchemaField } from '@/lib/objectSchemaShared'

const CONTACT_BUILTIN = new Set(STANDARD_META.contact.builtInFields.map((b) => b.key))

function readCustomFields(json?: string): Record<string, string> {
  try {
    return JSON.parse(json || '{}')
  } catch {
    return {}
  }
}

type Contact = {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string | null
  title: string | null
  linkedin?: string | null
  leadScore: number
  street?: string | null
  city?: string | null
  state?: string | null
  zip?: string | null
  country?: string | null
  company: { id: string; name: string } | null
  customFields?: string
}

type Company = {
  id: string
  name: string
  domain: string | null
  industry: string | null
  size: string | null
  website: string | null
  custom: Record<string, string>
  _count: { contacts: number; opportunities: number }
}

/** List columns for contacts from schema field definitions (labels + which fields exist). */
export function buildContactListColumns(schemaFields: SchemaField[]): ObjectListColumn<Contact>[] {
  const cols: ObjectListColumn<Contact>[] = []

  for (const f of schemaFields) {
    if (!f.isBuiltIn) {
      cols.push({
        key: `custom:${f.key}`,
        label: f.label,
        pinned: f.isPrimary,
        defaultVisible: false,
        render: (c) => readCustomFields(c.customFields)[f.key] || '—',
        gridText: (c) => readCustomFields(c.customFields)[f.key] || null,
      })
      continue
    }

    const vis = (k: string) => ['email', 'title', 'leadScore'].includes(k)
    const pinned = f.isPrimary

    switch (f.key) {
      case 'email':
        cols.push({
          key: 'email',
          label: f.label,
          pinned,
          defaultVisible: vis('email'),
          render: (c) => c.email,
          gridText: (c) => c.email,
        })
        break
      case 'phone':
        cols.push({
          key: 'phone',
          label: f.label,
          pinned,
          defaultVisible: false,
          render: (c) => c.phone ?? '—',
          gridText: (c) => c.phone,
        })
        break
      case 'title':
        cols.push({
          key: 'title',
          label: f.label,
          pinned,
          defaultVisible: vis('title'),
          render: (c) => c.title ?? '—',
          gridText: (c) => c.title,
        })
        break
      case 'linkedin':
        cols.push({
          key: 'linkedin',
          label: f.label,
          pinned,
          defaultVisible: false,
          render: (c) => c.linkedin ?? '—',
          gridText: (c) => c.linkedin ?? null,
        })
        break
      case 'leadScore':
        cols.push({
          key: 'leadScore',
          label: f.label,
          pinned,
          defaultVisible: vis('leadScore'),
          render: (c) => {
            const { label, color } = scoreLabel(c.leadScore)
            return (
              <span className={`font-semibold ${color}`}>
                {c.leadScore} · {label}
              </span>
            )
          },
          gridText: (c) => {
            const { label } = scoreLabel(c.leadScore)
            return `${c.leadScore} · ${label}`
          },
        })
        break
      case 'firstName':
        cols.push({
          key: 'firstName',
          label: f.label,
          pinned,
          defaultVisible: true,
          render: (c) => c.firstName || '—',
          gridText: (c) => c.firstName,
        })
        break
      case 'lastName':
        cols.push({
          key: 'lastName',
          label: f.label,
          pinned,
          defaultVisible: true,
          render: (c) => c.lastName || '—',
          gridText: (c) => c.lastName,
        })
        break
      default: {
        const k = f.key as keyof Contact
        cols.push({
          key: f.key,
          label: f.label,
          pinned,
          defaultVisible: false,
          render: (c) => String((c[k] as string | null | undefined) ?? '') || '—',
          gridText: (c) => (c[k] as string | null | undefined) || null,
        })
      }
    }
  }

  cols.push({
    key: 'company',
    label: 'Company',
    defaultVisible: true,
    customizable: false,
    render: (c) => c.company?.name ?? '—',
    gridText: (c) => c.company?.name ?? null,
  })

  return cols
}

export function contactListPrimaryKey(schemaFields: SchemaField[], columns: ObjectListColumn<Contact>[]): string {
  const pinned = columns.find((c) => c.pinned)
  if (pinned) return pinned.key
  const p = schemaFields.find((f) => f.isPrimary)
  if (p?.isBuiltIn && CONTACT_BUILTIN.has(p.key)) {
    return p.key
  }
  if (p && !p.isBuiltIn) return `custom:${p.key}`
  return columns[0]?.key ?? 'firstName'
}

/** List columns for companies from schema. */
export function buildCompanyListColumns(schemaFields: SchemaField[]): ObjectListColumn<Company>[] {
  const cols: ObjectListColumn<Company>[] = []

  for (const f of schemaFields) {
    if (!f.isBuiltIn) {
      cols.push({
        key: `custom:${f.key}`,
        label: f.label,
        pinned: f.isPrimary,
        defaultVisible: false,
        render: (c) => c.custom[f.key] || '—',
        gridText: (c) => c.custom[f.key] || null,
      })
      continue
    }

    const pinned = f.isPrimary
    switch (f.key) {
      case 'name':
        cols.push({
          key: 'name',
          label: f.label,
          pinned,
          defaultVisible: true,
          render: (c) => c.name,
          gridText: (c) => c.name,
        })
        break
      case 'domain':
        cols.push({
          key: 'domain',
          label: f.label,
          pinned,
          defaultVisible: true,
          render: (c) => c.domain ?? '—',
          gridText: (c) => c.domain,
        })
        break
      case 'industry':
        cols.push({
          key: 'industry',
          label: f.label,
          pinned,
          defaultVisible: true,
          render: (c) => c.industry ?? '—',
          gridText: (c) => c.industry,
        })
        break
      case 'size':
        cols.push({
          key: 'size',
          label: f.label,
          pinned,
          defaultVisible: true,
          render: (c) => (c.size ? `${c.size} employees` : '—'),
          gridText: (c) => (c.size ? `${c.size} employees` : null),
        })
        break
      case 'website':
        cols.push({
          key: 'website',
          label: f.label,
          pinned,
          defaultVisible: false,
          render: (c) => c.website ?? '—',
          gridText: (c) => c.website,
        })
        break
      default: {
        const k = f.key as keyof Company
        cols.push({
          key: f.key,
          label: f.label,
          pinned,
          defaultVisible: false,
          render: (c) => String((c[k] as string | null | undefined) ?? '') || '—',
          gridText: (c) => (c[k] as string | null | undefined) || null,
        })
      }
    }
  }

  cols.push(
    {
      key: 'contacts',
      label: 'Contacts',
      defaultVisible: true,
      customizable: false,
      render: (c) => c._count.contacts,
      gridText: (c) => `${c._count.contacts} contacts`,
    },
    {
      key: 'opportunities',
      label: 'Opportunities',
      defaultVisible: true,
      customizable: false,
      render: (c) => c._count.opportunities,
      gridText: (c) => `${c._count.opportunities} opportunities`,
    },
  )

  return cols
}

export function companyListPrimaryKey(columns: ObjectListColumn<Company>[]): string {
  return columns.find((c) => c.pinned)?.key ?? 'name'
}
