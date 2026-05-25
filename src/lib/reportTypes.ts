/**
 * Pure types and constants for Reports — safe to import in both server and client components.
 * No prisma or other server-only imports here.
 */

export type ReportColumn = {
  id: string
  fieldKey: string
  label: string
}

export type ReportSection = {
  id: string
  label: string
  objectType: string
  columns: ReportColumn[]
  parentObjectType?: string
  parentLinkField?: string
}

export type ReportConfig = {
  sections: ReportSection[]
}

export type AvailableReportObject = {
  id: string
  label: string
  fields: { key: string; label: string; fieldType: string }[]
}

export type BuiltInRelationship = {
  parentObject: string
  childObject: string
  childLinkField: string
  label: string
}

export const BUILT_IN_RELATIONSHIPS: BuiltInRelationship[] = [
  { parentObject: 'company', childObject: 'contact', childLinkField: 'companyId', label: 'Contacts' },
  { parentObject: 'company', childObject: 'opportunity',    childLinkField: 'companyId', label: 'Opportunities' },
  { parentObject: 'contact', childObject: 'opportunity',    childLinkField: 'contactId', label: 'Opportunities' },
]

export function getBuiltInRelationshipsForParent(parentObjectType: string): BuiltInRelationship[] {
  return BUILT_IN_RELATIONSHIPS.filter(r => r.parentObject === parentObjectType)
}
