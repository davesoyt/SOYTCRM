export type StandardObjectType = 'contact' | 'company' | 'opportunity'

/** @deprecated Use StandardObjectType for built-in objects; segment keys may also be `custom:{defId}` */
export type ObjectType = StandardObjectType

export const ALL_OBJECT_TYPES: StandardObjectType[] = ['contact', 'company', 'opportunity']

/** Legacy segment JSON may still use `deal`. */
export function normalizeObjectTypeSlug(type: string): string {
  if (type === 'deal' || type === 'deals') return 'opportunity'
  return type
}

export {
  parseSegmentObjectTypes as parseObjectTypes,
  serializeSegmentObjectTypes as serializeObjectTypes,
} from '@/lib/segmentObjects'

export function memberKey(objectType: string, id: string, multiObject: boolean): string {
  return multiObject ? `${objectType}:${id}` : id
}

export function parseMemberKey(
  key: string,
  defaultType: string,
): { objectType: string; id: string } {
  if (key.startsWith('custom:')) {
    const parts = key.split(':')
    if (parts.length >= 3) {
      return { objectType: `custom:${parts[1]}`, id: parts.slice(2).join(':') }
    }
  }
  const colon = key.indexOf(':')
  if (colon > 0) {
    return { objectType: key.slice(0, colon), id: key.slice(colon + 1) }
  }
  return { objectType: defaultType, id: key }
}

export type FilterOperator =
  | 'contains' | 'not_contains' | 'equals' | 'not_equals'
  | 'starts_with' | 'ends_with'
  | 'is_set' | 'is_not_set'
  | 'gte' | 'lte' | 'gt' | 'lt'
  | 'within_miles' | 'within_km'

export type SegmentFilter = {
  id: string
  objectType?: string
  field: string
  operator: FilterOperator
  value: string
  geoLat?: number
  geoLng?: number
  geoLabel?: string
}

export type FieldMeta = {
  key: string
  label: string
  group: string
  valueType: 'text' | 'number' | 'boolean' | 'select' | 'geo'
  operators: FilterOperator[]
  options?: string[]
}

export const TEXT_OPS: FilterOperator[]   = ['contains', 'not_contains', 'equals', 'not_equals', 'starts_with', 'ends_with', 'is_set', 'is_not_set']
export const NUM_OPS: FilterOperator[]    = ['equals', 'not_equals', 'gt', 'gte', 'lt', 'lte', 'is_set', 'is_not_set']
export const BOOL_OPS: FilterOperator[]   = ['equals']
export const SELECT_OPS: FilterOperator[] = ['equals', 'not_equals', 'is_set', 'is_not_set']
export const GEO_OPS: FilterOperator[]    = ['within_miles', 'within_km']

const STAGES = ['Prospect', 'Qualified', 'Proposal', 'Closed Won', 'Closed Lost']
const ACTIVITY_TYPES = ['email', 'call', 'note', 'opportunity_created', 'stage_change', 'enrichment', 'sequence_enrolled']

// ─── Contact fields ───────────────────────────────────────────────────────────
export const CONTACT_FIELDS: FieldMeta[] = [
  // Identifiers
  { key: 'firstName',  label: 'First Name',       group: 'Contact',  valueType: 'text',    operators: TEXT_OPS },
  { key: 'lastName',   label: 'Last Name',         group: 'Contact',  valueType: 'text',    operators: TEXT_OPS },
  { key: 'email',      label: 'Email',             group: 'Contact',  valueType: 'text',    operators: TEXT_OPS },
  { key: 'phone',      label: 'Phone',             group: 'Contact',  valueType: 'text',    operators: TEXT_OPS },
  { key: 'title',      label: 'Job Title',         group: 'Contact',  valueType: 'text',    operators: TEXT_OPS },
  { key: 'linkedin',   label: 'LinkedIn',          group: 'Contact',  valueType: 'text',    operators: ['is_set', 'is_not_set', 'contains'] },
  { key: 'leadScore',  label: 'Lead Score',        group: 'Contact',  valueType: 'number',  operators: NUM_OPS },
  { key: 'enriched',   label: 'AI Enriched',       group: 'Contact',  valueType: 'boolean', operators: BOOL_OPS, options: ['true', 'false'] },
  // Location
  { key: 'street',     label: 'Street',            group: 'Location', valueType: 'text',    operators: TEXT_OPS },
  { key: 'city',       label: 'City',              group: 'Location', valueType: 'text',    operators: TEXT_OPS },
  { key: 'state',      label: 'State / Region',    group: 'Location', valueType: 'text',    operators: TEXT_OPS },
  { key: 'country',    label: 'Country',           group: 'Location', valueType: 'text',    operators: TEXT_OPS },
  { key: 'zip',        label: 'Zip / Postal',      group: 'Location', valueType: 'text',    operators: TEXT_OPS },
  { key: 'geo',        label: 'Distance from…',   group: 'Location', valueType: 'geo',     operators: GEO_OPS },
  // Company (related)
  { key: 'companyName',     label: 'Company Name',  group: 'Company', valueType: 'text',   operators: TEXT_OPS },
  { key: 'companyIndustry', label: 'Industry',      group: 'Company', valueType: 'text',   operators: TEXT_OPS },
  { key: 'companySize',     label: 'Company Size',  group: 'Company', valueType: 'text',   operators: TEXT_OPS },
  { key: 'companyDomain',   label: 'Company Domain',group: 'Company', valueType: 'text',   operators: TEXT_OPS },
  // Opportunities (filter keys kept for saved segments)
  { key: 'dealCount',  label: 'Number of Opportunities',   group: 'Opportunities',   valueType: 'number',  operators: NUM_OPS },
  { key: 'dealStage',  label: 'Opportunity Stage',         group: 'Opportunities',   valueType: 'select',  operators: SELECT_OPS, options: STAGES },
  { key: 'dealValue',  label: 'Total Opportunity Value',   group: 'Opportunities',   valueType: 'number',  operators: NUM_OPS },
  // Activity
  { key: 'activityCount', label: 'Activity Count', group: 'Activity', valueType: 'number', operators: NUM_OPS },
  { key: 'activityType',  label: 'Activity Type',  group: 'Activity', valueType: 'select', operators: SELECT_OPS, options: ACTIVITY_TYPES },
  // Sequences
  { key: 'sequenceId', label: 'Enrolled in Sequence', group: 'Sequence', valueType: 'select', operators: SELECT_OPS },
]

// ─── Company fields ──────────────────────────────────────────────────────────
export const COMPANY_FIELDS: FieldMeta[] = [
  // Core
  { key: 'name',       label: 'Company Name',      group: 'Company',  valueType: 'text',   operators: TEXT_OPS },
  { key: 'domain',     label: 'Domain',            group: 'Company',  valueType: 'text',   operators: TEXT_OPS },
  { key: 'industry',   label: 'Industry',          group: 'Company',  valueType: 'text',   operators: TEXT_OPS },
  { key: 'size',       label: 'Employee Size',     group: 'Company',  valueType: 'text',   operators: TEXT_OPS },
  { key: 'website',    label: 'Website',           group: 'Company',  valueType: 'text',   operators: ['is_set', 'is_not_set', 'contains'] },
  { key: 'geo',        label: 'Distance from…',    group: 'Location', valueType: 'geo',    operators: GEO_OPS },
  // Contacts (related)
  { key: 'contactCount', label: 'Number of Contacts', group: 'Contacts', valueType: 'number', operators: NUM_OPS },
  // Opportunities (related; filter keys kept for saved segments)
  { key: 'dealCount',    label: 'Number of Opportunities',    group: 'Opportunities',    valueType: 'number',  operators: NUM_OPS },
  { key: 'dealStage',    label: 'Opportunity Stage',          group: 'Opportunities',    valueType: 'select',  operators: SELECT_OPS, options: STAGES },
  { key: 'dealValue',    label: 'Total Opportunity Value ($)', group: 'Opportunities',   valueType: 'number',  operators: NUM_OPS },
  { key: 'wonValue',     label: 'Closed Won Value ($)', group: 'Opportunities',   valueType: 'number',  operators: NUM_OPS },
  // Activity
  { key: 'activityCount', label: 'Activity Count',   group: 'Activity', valueType: 'number',  operators: NUM_OPS },
  { key: 'activityType',  label: 'Activity Type',    group: 'Activity', valueType: 'select',  operators: SELECT_OPS, options: ACTIVITY_TYPES },
]

// ─── Opportunity fields ──────────────────────────────────────────────────────
export const OPPORTUNITY_FIELDS: FieldMeta[] = [
  // Core
  { key: 'name',       label: 'Opportunity Name',         group: 'Opportunity',     valueType: 'text',   operators: TEXT_OPS },
  { key: 'value',      label: 'Value ($)',          group: 'Opportunity',     valueType: 'number', operators: NUM_OPS },
  { key: 'stage',      label: 'Stage',             group: 'Opportunity',     valueType: 'select', operators: SELECT_OPS, options: STAGES },
  { key: 'isClosed',   label: 'Is Closed',         group: 'Opportunity',     valueType: 'boolean',operators: BOOL_OPS, options: ['true', 'false'] },
  { key: 'daysOpen',   label: 'Days Since Created',group: 'Opportunity',     valueType: 'number', operators: NUM_OPS },
  { key: 'geo',        label: 'Distance from…',    group: 'Location',        valueType: 'geo',    operators: GEO_OPS },
  // Contact (related)
  { key: 'contactName',  label: 'Contact Name',    group: 'Contact',  valueType: 'text',   operators: TEXT_OPS },
  { key: 'contactEmail', label: 'Contact Email',   group: 'Contact',  valueType: 'text',   operators: TEXT_OPS },
  { key: 'contactTitle', label: 'Contact Title',   group: 'Contact',  valueType: 'text',   operators: TEXT_OPS },
  { key: 'contactScore', label: 'Contact Lead Score', group: 'Contact', valueType: 'number', operators: NUM_OPS },
  // Company (related)
  { key: 'companyName',     label: 'Company Name',  group: 'Company', valueType: 'text',   operators: TEXT_OPS },
  { key: 'companyIndustry', label: 'Industry',      group: 'Company', valueType: 'text',   operators: TEXT_OPS },
  // Activity
  { key: 'activityCount', label: 'Activity Count', group: 'Activity', valueType: 'number', operators: NUM_OPS },
  { key: 'activityType',  label: 'Activity Type',  group: 'Activity', valueType: 'select', operators: SELECT_OPS, options: ACTIVITY_TYPES },
]

export function getFieldsForType(type: StandardObjectType): FieldMeta[] {
  switch (type) {
    case 'contact': return CONTACT_FIELDS
    case 'company': return COMPANY_FIELDS
    case 'opportunity': return OPPORTUNITY_FIELDS
  }
}

export function getGroupsForType(type: StandardObjectType): string[] {
  return [...new Set(getFieldsForType(type).map(f => f.group))]
}

export const OP_LABELS: Record<FilterOperator, string> = {
  contains:      'contains',
  not_contains:  'does not contain',
  equals:        'is',
  not_equals:    'is not',
  starts_with:   'starts with',
  ends_with:     'ends with',
  is_set:        'is not null',
  is_not_set:    'is null',
  gte:           '≥ (greater or equal)',
  lte:           '≤ (less or equal)',
  gt:            '> (greater than)',
  lt:            '< (less than)',
  within_miles:  'within (miles)',
  within_km:     'within (km)',
}

// ─── Flat serializable record ─────────────────────────────────────────────────
export type FlatRecord = {
  _id: string
  _objectType?: string
  _displayName: string
  _subtext: string
  _href: string
  _initials: string
} & Record<string, unknown>

export function applyFiltersForObjectTypes(
  recordsByType: Partial<Record<string, FlatRecord[]>>,
  filters: SegmentFilter[],
  objectTypes: string[],
): FlatRecord[] {
  const defaultType = objectTypes[0]
  const result: FlatRecord[] = []
  for (const type of objectTypes) {
    const records = recordsByType[type] ?? []
    const typeFilters = filters.filter(f => (f.objectType ?? defaultType) === type)
    const matched = applyFilters(records, typeFilters)
    result.push(...matched.map(r => ({ ...r, _objectType: type })))
  }
  return result
}

// ─── Haversine ────────────────────────────────────────────────────────────────
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(a))
}

// ─── Evaluation helpers ───────────────────────────────────────────────────────
// Operators that require a value — filters with no value are skipped unless using one of these
const NO_VALUE_OPS: FilterOperator[] = ['is_set', 'is_not_set']
// Operators that always do numeric comparison regardless of field type
const NUMERIC_OPS: FilterOperator[] = ['gt', 'gte', 'lt', 'lte']

function evalText(val: unknown, op: FilterOperator, target: string): boolean {
  const v = ((val as string) ?? '').toString().toLowerCase()
  const t = target.toLowerCase()
  switch (op) {
    case 'contains':     return v.includes(t)
    case 'not_contains': return !v.includes(t)
    case 'equals':       return v === t
    case 'not_equals':   return v !== t
    case 'starts_with':  return v.startsWith(t)
    case 'ends_with':    return v.endsWith(t)
    case 'is_set':       return !!val && v !== ''
    case 'is_not_set':   return !val || v === ''
    default:             return false  // unknown op → exclude; prevents numeric ops silently passing
  }
}

function evalNum(val: unknown, op: FilterOperator, target: string): boolean {
  if (op === 'is_set')     return val != null && val !== '' && !isNaN(parseFloat(String(val)))
  if (op === 'is_not_set') return val == null || val === '' || isNaN(parseFloat(String(val)))
  const n = parseFloat(target)
  const v = parseFloat(String(val ?? ''))
  if (isNaN(n) || isNaN(v)) return false  // non-numeric field value → exclude
  switch (op) {
    case 'equals':     return v === n
    case 'not_equals': return v !== n
    case 'gte':        return v >= n
    case 'lte':        return v <= n
    case 'gt':         return v > n
    case 'lt':         return v < n
    default:           return false
  }
}

function evalMultiValue(vals: unknown, op: FilterOperator, target: string): boolean {
  const arr = Array.isArray(vals) ? (vals as string[]) : []
  const has = arr.includes(target)
  switch (op) {
    case 'equals':     return has
    case 'not_equals': return !has
    case 'is_set':     return arr.length > 0
    case 'is_not_set': return arr.length === 0
    default:           return false
  }
}

export function applyFilter(record: FlatRecord, f: SegmentFilter): boolean {
  const val = record[f.field]

  // Geo filter
  if (f.field === 'geo') {
    if (f.geoLat == null || f.geoLng == null) return false
    const lat = record['lat'] as number | null
    const lng = record['lng'] as number | null
    if (lat == null || lng == null) return false
    const dist = haversine(f.geoLat, f.geoLng, lat, lng)
    const radius = parseFloat(f.value) || 0
    return f.operator === 'within_km' ? dist * 1.60934 <= radius : dist <= radius
  }

  // Boolean filter
  if (f.field === 'enriched' || f.field === 'isClosed') {
    return (val === true) === (f.value === 'true')
  }

  // Multi-value fields (arrays stored in record)
  const multiKey = f.field === 'dealStage' ? 'dealStages' : f.field === 'activityType' ? 'activityTypes' : f.field === 'sequenceId' ? 'sequenceIds' : null
  if (multiKey) return evalMultiValue(record[multiKey], f.operator, f.value)

  // Numeric operators always use numeric evaluation — covers both built-in and custom number fields
  if (NUMERIC_OPS.includes(f.operator)) return evalNum(val, f.operator, f.value)

  // Known numeric fields using equals/not_equals/is_set also evaluate as numbers
  const numFields = ['leadScore', 'dealCount', 'dealValue', 'wonValue', 'activityCount', 'contactCount', 'value', 'daysOpen', 'contactScore']
  if (numFields.includes(f.field)) return evalNum(val, f.operator, f.value)

  // Text fields (default)
  return evalText(val, f.operator, f.value)
}

export function applyFilters(records: FlatRecord[], filters: SegmentFilter[]): FlatRecord[] {
  if (!filters.length) return records
  // Skip filters with no value unless they are null-check operators (is_set / is_not_set)
  const active = filters.filter(f =>
    NO_VALUE_OPS.includes(f.operator) || f.field === 'geo' || f.value.trim() !== ''
  )
  if (!active.length) return records
  return records.filter(r => active.every(f => applyFilter(r, f)))
}

// ─── Record flatteners (called server-side) ───────────────────────────────────

type PrismaContact = {
  id: string; firstName: string; lastName: string; email: string; phone: string | null
  title: string | null; linkedin: string | null; leadScore: number; enriched: boolean
  customFields: string
  street: string | null; city: string | null; state: string | null; zip: string | null
  country: string | null; lat: number | null; lng: number | null
  company: { id: string; name: string; domain: string | null; industry: string | null; size: string | null } | null
  opportunities: { stage: string; value: number }[]
  activities: { type: string }[]
  enrollments: { sequenceId: string }[]
}

type PrismaCompany = {
  id: string; name: string; domain: string | null; industry: string | null
  size: string | null; website: string | null
  customFields: string
  contacts: { id: string; lat: number | null; lng: number | null }[]
  opportunities: { stage: string; value: number }[]
  activities: { type: string }[]
}

type PrismaOpportunity = {
  id: string; name: string; value: number; stage: string
  createdAt: Date; closedAt: Date | null
  contact: { firstName: string; lastName: string; email: string; title: string | null; leadScore: number; lat: number | null; lng: number | null } | null
  company: { name: string; industry: string | null } | null
  activities: { type: string }[]
}

export function flattenContact(c: PrismaContact): FlatRecord {
  const dealValue = c.opportunities.reduce((s, d) => s + d.value, 0)
  let parsedCustom: Record<string, string> = {}
  try { parsedCustom = JSON.parse(c.customFields) } catch {}
  const customEntries = Object.fromEntries(Object.entries(parsedCustom).map(([k, v]) => [`custom_${k}`, v]))
  return {
    _id: c.id, _href: `/contacts/${c.id}`,
    _displayName: `${c.firstName} ${c.lastName}`,
    _subtext: [c.title, c.company?.name].filter(Boolean).join(' · ') || c.email,
    _initials: `${c.firstName[0] ?? ''}${c.lastName[0] ?? ''}`,
    firstName: c.firstName, lastName: c.lastName, email: c.email,
    phone: c.phone, title: c.title, linkedin: c.linkedin,
    leadScore: c.leadScore, enriched: c.enriched,
    street: c.street, city: c.city, state: c.state, zip: c.zip, country: c.country,
    lat: c.lat, lng: c.lng,
    companyName: c.company?.name ?? null, companyIndustry: c.company?.industry ?? null,
    companySize: c.company?.size ?? null, companyDomain: c.company?.domain ?? null,
    dealCount: c.opportunities.length, dealValue,
    dealStages: c.opportunities.map(d => d.stage),
    activityCount: c.activities.length,
    activityTypes: c.activities.map(a => a.type),
    sequenceIds: c.enrollments.map(e => e.sequenceId),
    ...customEntries,
  }
}

export function flattenCompany(c: PrismaCompany): FlatRecord {
  const dealValue = c.opportunities.reduce((s, d) => s + d.value, 0)
  const wonValue = c.opportunities.filter(d => d.stage === 'Closed Won').reduce((s, d) => s + d.value, 0)
  let parsedCustom: Record<string, string> = {}
  try { parsedCustom = JSON.parse(c.customFields) } catch {}
  const customEntries = Object.fromEntries(Object.entries(parsedCustom).map(([k, v]) => [`custom_${k}`, v]))
  const geoContacts = c.contacts.filter((contact) => contact.lat != null && contact.lng != null)
  const lat = geoContacts.length
    ? geoContacts.reduce((sum, contact) => sum + Number(contact.lat), 0) / geoContacts.length
    : null
  const lng = geoContacts.length
    ? geoContacts.reduce((sum, contact) => sum + Number(contact.lng), 0) / geoContacts.length
    : null

  return {
    _id: c.id, _href: `/companies/${c.id}`,
    _displayName: c.name,
    _subtext: [c.industry, c.domain].filter(Boolean).join(' · ') || 'No details',
    _initials: c.name[0] ?? '?',
    name: c.name, domain: c.domain, industry: c.industry, size: c.size, website: c.website,
    lat, lng,
    contactCount: c.contacts.length,
    dealCount: c.opportunities.length, dealValue, wonValue,
    dealStages: c.opportunities.map(d => d.stage),
    activityCount: c.activities.length,
    activityTypes: c.activities.map(a => a.type),
    ...customEntries,
  }
}

export function flattenOpportunity(d: PrismaOpportunity): FlatRecord {
  const daysOpen = Math.floor((Date.now() - d.createdAt.getTime()) / 86_400_000)
  return {
    _id: d.id, _href: '/opportunities',
    _displayName: d.name,
    _subtext: `${d.stage} · $${d.value.toLocaleString()}`,
    _initials: '$',
    // Core
    name: d.name, value: d.value, stage: d.stage,
    isClosed: d.closedAt != null, daysOpen,
    // Contact
    contactName: d.contact ? `${d.contact.firstName} ${d.contact.lastName}` : null,
    contactEmail: d.contact?.email ?? null,
    contactTitle: d.contact?.title ?? null,
    contactScore: d.contact?.leadScore ?? null,
    lat: d.contact?.lat ?? null,
    lng: d.contact?.lng ?? null,
    // Company
    companyName: d.company?.name ?? null,
    companyIndustry: d.company?.industry ?? null,
    // Activity
    activityCount: d.activities.length,
    activityTypes: d.activities.map(a => a.type),
  }
}
