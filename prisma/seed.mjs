import { createClient } from '@libsql/client'

const db = createClient({
  url: 'file:/Users/daveniemann/projects/AGTEST/.claude/worktrees/sweet-ptolemy-bad962/dev.db',
})

function cuid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

const now = Date.now()
function daysAgo(n) { return new Date(now - n * 86400000).toISOString() }

async function main() {
  // Clear existing data
  await db.executeMultiple(`
    DELETE FROM Enrollment;
    DELETE FROM SequenceStep;
    DELETE FROM Sequence;
    DELETE FROM Activity;
    DELETE FROM Deal;
    DELETE FROM Contact;
    DELETE FROM Company;
  `)

  // Companies
  const acmeId = cuid(), techId = cuid(), greenId = cuid()
  await db.executeMultiple(`
    INSERT INTO Company (id, name, domain, industry, size, website, createdAt, updatedAt)
    VALUES ('${acmeId}', 'Acme Corp', 'acme.com', 'Manufacturing', '500-1000', 'https://acme.com', '${daysAgo(30)}', '${daysAgo(1)}');
    INSERT INTO Company (id, name, domain, industry, size, website, createdAt, updatedAt)
    VALUES ('${techId}', 'TechWave', 'techwave.io', 'SaaS', '50-200', 'https://techwave.io', '${daysAgo(25)}', '${daysAgo(2)}');
    INSERT INTO Company (id, name, domain, industry, size, createdAt, updatedAt)
    VALUES ('${greenId}', 'Greenfield Partners', 'greenfield.vc', 'Venture Capital', '10-50', '${daysAgo(50)}', '${daysAgo(3)}');
  `)

  // Contacts
  const aliceId = cuid(), bobId = cuid(), carolId = cuid(), daveId = cuid()
  await db.executeMultiple(`
    INSERT INTO Contact (id, firstName, lastName, email, title, phone, leadScore, enriched, linkedin, companyId, createdAt, updatedAt)
    VALUES ('${aliceId}', 'Alice', 'Johnson', 'alice@acme.com', 'VP of Operations', '+1-555-0101', 72, 1, 'https://linkedin.com/in/alice-johnson', '${acmeId}', '${daysAgo(25)}', '${daysAgo(1)}');
    INSERT INTO Contact (id, firstName, lastName, email, title, phone, leadScore, enriched, companyId, createdAt, updatedAt)
    VALUES ('${bobId}', 'Bob', 'Chen', 'bob@techwave.io', 'CTO', '+1-555-0202', 55, 0, '${techId}', '${daysAgo(18)}', '${daysAgo(2)}');
    INSERT INTO Contact (id, firstName, lastName, email, title, leadScore, enriched, companyId, createdAt, updatedAt)
    VALUES ('${carolId}', 'Carol', 'Martinez', 'carol@greenfield.vc', 'Managing Partner', 88, 1, '${greenId}', '${daysAgo(45)}', '${daysAgo(1)}');
    INSERT INTO Contact (id, firstName, lastName, email, title, leadScore, enriched, companyId, createdAt, updatedAt)
    VALUES ('${daveId}', 'Dave', 'Williams', 'dave@acme.com', 'IT Director', 30, 0, '${acmeId}', '${daysAgo(10)}', '${daysAgo(1)}');
  `)

  // Deals
  const d1 = cuid(), d2 = cuid(), d3 = cuid(), d4 = cuid(), d5 = cuid()
  await db.executeMultiple(`
    INSERT INTO Deal (id, name, value, stage, contactId, companyId, createdAt, updatedAt)
    VALUES ('${d1}', 'Acme Enterprise License', 120000, 'Proposal', '${aliceId}', '${acmeId}', '${daysAgo(20)}', '${daysAgo(5)}');
    INSERT INTO Deal (id, name, value, stage, contactId, companyId, createdAt, updatedAt)
    VALUES ('${d2}', 'TechWave Platform Integration', 45000, 'Qualified', '${bobId}', '${techId}', '${daysAgo(14)}', '${daysAgo(7)}');
    INSERT INTO Deal (id, name, value, stage, contactId, companyId, closedAt, createdAt, updatedAt)
    VALUES ('${d3}', 'Greenfield Portfolio Tool', 85000, 'Closed Won', '${carolId}', '${greenId}', '${daysAgo(14)}', '${daysAgo(35)}', '${daysAgo(14)}');
    INSERT INTO Deal (id, name, value, stage, contactId, companyId, createdAt, updatedAt)
    VALUES ('${d4}', 'Acme IT Upgrade', 28000, 'Prospect', '${daveId}', '${acmeId}', '${daysAgo(9)}', '${daysAgo(9)}');
    INSERT INTO Deal (id, name, value, stage, contactId, companyId, closedAt, createdAt, updatedAt)
    VALUES ('${d5}', 'TechWave Mobile App', 18000, 'Closed Lost', '${bobId}', '${techId}', '${daysAgo(30)}', '${daysAgo(40)}', '${daysAgo(30)}');
  `)

  // Activities
  const activities = [
    [cuid(), 'note', 'Contact created', null, aliceId, null, null, daysAgo(25)],
    [cuid(), 'email', 'Sent intro email', 'Hi Alice, following up on our call...', aliceId, null, null, daysAgo(20)],
    [cuid(), 'call', '30-min discovery call', 'Discussed pain points around procurement workflows.', aliceId, null, d1, daysAgo(15)],
    [cuid(), 'email', 'Sent proposal', 'Attached the formal proposal for the enterprise license.', aliceId, null, d1, daysAgo(5)],
    [cuid(), 'stage_change', 'Deal moved to Proposal', null, aliceId, null, d1, daysAgo(5)],
    [cuid(), 'note', 'Contact created', null, bobId, null, null, daysAgo(18)],
    [cuid(), 'email', 'Intro email sent', null, bobId, null, null, daysAgo(14)],
    [cuid(), 'call', 'Technical requirements call', 'Bob needs API access and SSO.', bobId, null, d2, daysAgo(7)],
    [cuid(), 'note', 'Contact created', null, carolId, null, null, daysAgo(45)],
    [cuid(), 'enrichment', 'Contact enriched by AI', 'Carol manages a $300M fund focused on B2B SaaS.', carolId, null, null, daysAgo(44)],
    [cuid(), 'call', 'Partnership discussion', null, carolId, null, null, daysAgo(40)],
    [cuid(), 'deal_created', 'Deal "Greenfield Portfolio Tool" created', null, carolId, null, d3, daysAgo(35)],
    [cuid(), 'stage_change', 'Deal moved to Closed Won', null, carolId, null, d3, daysAgo(14)],
    [cuid(), 'note', 'Contact created', null, daveId, null, null, daysAgo(10)],
    [cuid(), 'email', 'Sent brochure', null, daveId, null, null, daysAgo(8)],
  ]

  for (const [id, type, title, body, contactId, companyId, dealId, createdAt] of activities) {
    await db.execute({
      sql: `INSERT INTO Activity (id, type, title, body, contactId, companyId, dealId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [id, type, title, body, contactId, companyId, dealId, createdAt],
    })
  }

  // Sequence
  const seqId = cuid()
  await db.execute({
    sql: `INSERT INTO Sequence (id, name, description, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)`,
    args: [seqId, 'Inbound Lead Nurture', 'Automated 3-touch sequence for new inbound leads', daysAgo(20), daysAgo(1)],
  })

  const steps = [
    [cuid(), seqId, 0, 'Welcome — quick intro', "Hi {{firstName}}, thanks for your interest. I'd love to learn more about your goals. Would 15 min work this week?", 0],
    [cuid(), seqId, 3, 'Following up + relevant resource', 'Hi {{firstName}}, sharing a case study that might be relevant to your team: [link]. Happy to walk through it on a call.', 1],
    [cuid(), seqId, 7, 'Last touch — still interested?', "Hi {{firstName}}, I know things get busy. If now isn't the right time, no worries at all. Just let me know if you'd like to reconnect.", 2],
  ]
  for (const [id, sequenceId, dayOffset, subject, body, order] of steps) {
    await db.execute({
      sql: `INSERT INTO SequenceStep (id, sequenceId, dayOffset, subject, body, "order") VALUES (?, ?, ?, ?, ?, ?)`,
      args: [id, sequenceId, dayOffset, subject, body, order],
    })
  }

  const enrollId = cuid()
  await db.execute({
    sql: `INSERT INTO Enrollment (id, contactId, sequenceId, currentStep, active, startedAt) VALUES (?, ?, ?, ?, ?, ?)`,
    args: [enrollId, daveId, seqId, 1, 1, daysAgo(9)],
  })

  console.log('Seed complete!')
}

main().catch(e => { console.error(e); process.exit(1) })
