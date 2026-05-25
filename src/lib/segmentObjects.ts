import { Users, Building2, TrendingUp, Box, type LucideIcon } from 'lucide-react'
import type { StandardObjectType } from '@/lib/filters'

export const STANDARD_OBJECT_TYPES: StandardObjectType[] = ['contact', 'company', 'opportunity']

export type CustomObjectOption = {
  id: string
  pluralName: string
  icon: string
  color: string
}

// Serializable — safe to pass from Server → Client components.
export type ObjectTypeMeta = {
  label: string
  description: string
  iconName: string   // 'Users' | 'Building2' | 'TrendingUp' | 'Box' etc.
  color: string
  bg: string
}

// Client-side icon resolver — call this in client components instead of using meta.Icon directly.
const ICON_MAP: Record<string, LucideIcon> = {
  Users,
  Building2,
  TrendingUp,
  Box,
}
export function resolveIcon(iconName: string): LucideIcon {
  return ICON_MAP[iconName] ?? Box
}

const STANDARD_META: Record<StandardObjectType, ObjectTypeMeta> = {
  contact: {
    label: 'Contacts',
    description: 'People & leads',
    iconName: 'Users',
    color: 'text-violet-600',
    bg: 'bg-violet-100',
  },
  company: {
    label: 'Companies',
    description: 'Accounts & orgs',
    iconName: 'Building2',
    color: 'text-blue-600',
    bg: 'bg-blue-100',
  },
  opportunity: {
    label: 'Opportunities',
    description: 'Sales opportunities',
    iconName: 'TrendingUp',
    color: 'text-emerald-600',
    bg: 'bg-emerald-100',
  },
}

export function customObjectKey(defId: string): string {
  return `custom:${defId}`
}

export function getCustomDefId(key: string): string | null {
  return key.startsWith('custom:') ? key.slice(7) : null
}

export function isStandardObjectType(key: string): key is StandardObjectType {
  const normalized = key === 'deal' || key === 'deals' ? 'opportunity' : key
  return STANDARD_OBJECT_TYPES.includes(normalized as StandardObjectType)
}

export function isCustomObjectKey(key: string): boolean {
  return key.startsWith('custom:')
}

export function parseSegmentObjectTypes(segment: {
  objectType: string
  objectTypesJson?: string | null
}): string[] {
  const raw = segment.objectTypesJson ?? segment.objectType
  if (raw.startsWith('[')) {
    try {
      const parsed = JSON.parse(raw) as unknown
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
          .filter((t): t is string => typeof t === 'string' && t.length > 0)
          .map(t => (t === 'deal' || t === 'deals' ? 'opportunity' : t))
      }
    } catch { /* fall through */ }
  }
  if (raw.length > 0) return [raw === 'deal' || raw === 'deals' ? 'opportunity' : raw]
  return ['contact']
}

export function serializeSegmentObjectTypes(types: string[]): string {
  if (types.length === 1) return types[0]
  return JSON.stringify(types)
}

export function filterValidObjectTypes(
  types: string[],
  customDefIds: Set<string>,
): string[] {
  const valid = types.filter(t => {
    if (isStandardObjectType(t)) return true
    const defId = getCustomDefId(t)
    return defId !== null && customDefIds.has(defId)
  })
  return valid.length > 0 ? valid : ['contact']
}

export function buildObjectTypeMeta(
  customObjects: CustomObjectOption[],
): Record<string, ObjectTypeMeta> {
  const meta: Record<string, ObjectTypeMeta> = { ...STANDARD_META }
  for (const obj of customObjects) {
    const key = customObjectKey(obj.id)
    meta[key] = {
      label: obj.pluralName,
      description: 'Custom object',
      iconName: 'Box',
      color: 'text-indigo-600',
      bg: 'bg-indigo-100',
    }
  }
  return meta
}

export function getObjectTypeLabel(
  key: string,
  meta: Record<string, ObjectTypeMeta>,
): string {
  return meta[key]?.label ?? key
}
