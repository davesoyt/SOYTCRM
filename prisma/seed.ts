import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const databaseUrl = process.env.DATABASE_URL?.trim()
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required for seeding. Use the same DATABASE_URL in Cursor and Vercel.')
}

const pool = new Pool({ connectionString: databaseUrl })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  // Companies
  const acme = await prisma.company.create({
    data: {
      name: 'Acme Corp',
      domain: 'acme.com',
      industry: 'Manufacturing',
      size: '500-1000',
      website: 'https://acme.com',
    },
  })
  const techwave = await prisma.company.create({
    data: {
      name: 'TechWave',
      domain: 'techwave.io',
      industry: 'SaaS',
      size: '50-200',
      website: 'https://techwave.io',
    },
  })
  const greenfield = await prisma.company.create({
    data: {
      name: 'Greenfield Partners',
      domain: 'greenfield.vc',
      industry: 'Venture Capital',
      size: '10-50',
    },
  })

  // Contacts
  const alice = await prisma.contact.create({
    data: {
      firstName: 'Alice',
      lastName: 'Johnson',
      email: 'alice@acme.com',
      title: 'VP of Operations',
      phone: '+1-555-0101',
      leadScore: 72,
      enriched: true,
      linkedin: 'https://linkedin.com/in/alice-johnson',
      companyId: acme.id,
    },
  })
  const bob = await prisma.contact.create({
    data: {
      firstName: 'Bob',
      lastName: 'Chen',
      email: 'bob@techwave.io',
      title: 'CTO',
      phone: '+1-555-0202',
      leadScore: 55,
      companyId: techwave.id,
    },
  })
  const carol = await prisma.contact.create({
    data: {
      firstName: 'Carol',
      lastName: 'Martinez',
      email: 'carol@greenfield.vc',
      title: 'Managing Partner',
      leadScore: 88,
      enriched: true,
      companyId: greenfield.id,
    },
  })
  const dave = await prisma.contact.create({
    data: {
      firstName: 'Dave',
      lastName: 'Williams',
      email: 'dave@acme.com',
      title: 'IT Director',
      leadScore: 30,
      companyId: acme.id,
    },
  })

  // Opportunities
  const opp1 = await prisma.opportunity.create({
    data: {
      name: 'Acme Enterprise License',
      value: 120000,
      stage: 'Proposal',
      contactId: alice.id,
      companyId: acme.id,
    },
  })
  const opp2 = await prisma.opportunity.create({
    data: {
      name: 'TechWave Platform Integration',
      value: 45000,
      stage: 'Qualified',
      contactId: bob.id,
      companyId: techwave.id,
    },
  })
  const opp3 = await prisma.opportunity.create({
    data: {
      name: 'Greenfield Portfolio Tool',
      value: 85000,
      stage: 'Closed Won',
      contactId: carol.id,
      companyId: greenfield.id,
      closedAt: new Date(Date.now() - 14 * 86400000),
    },
  })
  const opp4 = await prisma.opportunity.create({
    data: {
      name: 'Acme IT Upgrade',
      value: 28000,
      stage: 'Prospect',
      contactId: dave.id,
      companyId: acme.id,
    },
  })
  await prisma.opportunity.create({
    data: {
      name: 'TechWave Mobile App',
      value: 18000,
      stage: 'Closed Lost',
      contactId: bob.id,
      companyId: techwave.id,
      closedAt: new Date(Date.now() - 30 * 86400000),
    },
  })

  // Activities
  const now = Date.now()
  await prisma.activity.createMany({
    data: [
      { type: 'note', title: 'Contact created', contactId: alice.id, createdAt: new Date(now - 25 * 86400000) },
      { type: 'email', title: 'Sent intro email', body: 'Hi Alice, following up on our call...', contactId: alice.id, createdAt: new Date(now - 20 * 86400000) },
      { type: 'call', title: '30-min discovery call', body: 'Discussed pain points around procurement workflows.', contactId: alice.id, opportunityId: opp1.id, createdAt: new Date(now - 15 * 86400000) },
      { type: 'email', title: 'Sent proposal', body: 'Attached the formal proposal for the enterprise license.', contactId: alice.id, opportunityId: opp1.id, createdAt: new Date(now - 5 * 86400000) },
      { type: 'stage_change', title: 'Opportunity moved to Proposal', contactId: alice.id, opportunityId: opp1.id, createdAt: new Date(now - 5 * 86400000) },
      { type: 'note', title: 'Contact created', contactId: bob.id, createdAt: new Date(now - 18 * 86400000) },
      { type: 'email', title: 'Intro email sent', contactId: bob.id, createdAt: new Date(now - 14 * 86400000) },
      { type: 'call', title: 'Technical requirements call', body: 'Bob needs API access and SSO.', contactId: bob.id, opportunityId: opp2.id, createdAt: new Date(now - 7 * 86400000) },
      { type: 'note', title: 'Contact created', contactId: carol.id, createdAt: new Date(now - 45 * 86400000) },
      { type: 'enrichment', title: 'Contact enriched by AI', body: 'Carol manages a $300M fund focused on B2B SaaS.', contactId: carol.id, createdAt: new Date(now - 44 * 86400000) },
      { type: 'call', title: 'Partnership discussion', contactId: carol.id, createdAt: new Date(now - 40 * 86400000) },
      { type: 'opportunity_created', title: 'Opportunity "Greenfield Portfolio Tool" created', contactId: carol.id, opportunityId: opp3.id, createdAt: new Date(now - 35 * 86400000) },
      { type: 'stage_change', title: 'Opportunity moved to Closed Won', contactId: carol.id, opportunityId: opp3.id, createdAt: new Date(now - 14 * 86400000) },
      { type: 'note', title: 'Contact created', contactId: dave.id, createdAt: new Date(now - 10 * 86400000) },
      { type: 'email', title: 'Sent brochure', contactId: dave.id, createdAt: new Date(now - 8 * 86400000) },
    ],
  })

  // Sequence
  const sequence = await prisma.sequence.create({
    data: {
      name: 'Inbound Lead Nurture',
      description: 'Automated 3-touch sequence for new inbound leads',
      steps: {
        create: [
          { order: 0, dayOffset: 0, subject: 'Welcome — quick intro', body: 'Hi {{firstName}}, thanks for your interest. I\'d love to learn more about your goals. Would 15 min work this week?' },
          { order: 1, dayOffset: 3, subject: 'Following up + relevant resource', body: 'Hi {{firstName}}, sharing a case study that might be relevant to your team: [link]. Happy to walk through it on a call.' },
          { order: 2, dayOffset: 7, subject: 'Last touch — still interested?', body: 'Hi {{firstName}}, I know things get busy. If now isn\'t the right time, no worries at all. Just let me know if you\'d like to reconnect.' },
        ],
      },
    },
  })

  await prisma.enrollment.create({
    data: { contactId: dave.id, sequenceId: sequence.id, currentStep: 1 },
  })

  console.log('Seed complete')
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
    process.exit(0)
  })
