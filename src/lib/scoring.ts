import type { Contact, Activity, Opportunity } from '../generated/prisma/client'

type ContactWithRelations = Contact & {
  activities: Activity[]
  opportunities: Opportunity[]
}

export function computeLeadScore(contact: ContactWithRelations): number {
  let score = 0

  // Company/title enrichment
  if (contact.enriched) score += 10
  if (contact.title) score += 5
  if (contact.linkedin) score += 5

  // Activity engagement
  const emailActivities = contact.activities.filter((a) => a.type === 'email').length
  const callActivities = contact.activities.filter((a) => a.type === 'call').length
  score += Math.min(emailActivities * 3, 20)
  score += Math.min(callActivities * 5, 25)

  // Opportunity pipeline signal
  const activeOpportunities = contact.opportunities.filter((d) => !d.closedAt)
  for (const opp of activeOpportunities) {
    if (opp.stage === 'Proposal') score += 20
    else if (opp.stage === 'Qualified') score += 15
    else if (opp.stage === 'Prospect') score += 5
    score += Math.min(opp.value / 10000, 10)
  }

  const wonOpportunities = contact.opportunities.filter((d) => d.stage === 'Closed Won')
  score += wonOpportunities.length * 15

  return Math.min(Math.round(score), 100)
}

export function scoreLabel(score: number): { label: string; color: string } {
  if (score >= 75) return { label: 'Hot', color: 'text-red-600' }
  if (score >= 50) return { label: 'Warm', color: 'text-orange-500' }
  if (score >= 25) return { label: 'Cool', color: 'text-blue-500' }
  return { label: 'Cold', color: 'text-gray-400' }
}
