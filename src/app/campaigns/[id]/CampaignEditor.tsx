'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Send, Pencil, Check, Users, Mail, BarChart3 } from 'lucide-react'
import { updateCampaign, sendCampaign } from '@/app/actions'

type Segment = { id: string; name: string; recipientCount: number }

type Props = {
  campaign: {
    id: string
    name: string
    subject: string
    body: string
    segmentId: string | null
    fromName: string
    fromEmail: string
    status: string
    recipientCount: number
    openCount: number
    clickCount: number
    sentAt: string | null
  }
  segments: Segment[]
  previewContact: {
    firstName: string
    lastName: string
    email: string
    company: { name: string } | null
  } | null
}

const MERGE_TAGS = ['{{firstName}}', '{{lastName}}', '{{email}}', '{{company}}']

function applyMergeTags(
  template: string,
  contact: Props['previewContact'],
): string {
  if (!contact) {
    return template
      .replaceAll('{{firstName}}', '[First Name]')
      .replaceAll('{{lastName}}', '[Last Name]')
      .replaceAll('{{email}}', '[Email]')
      .replaceAll('{{company}}', '[Company]')
  }
  return template
    .replaceAll('{{firstName}}', contact.firstName || '')
    .replaceAll('{{lastName}}', contact.lastName || '')
    .replaceAll('{{email}}', contact.email || '')
    .replaceAll('{{company}}', contact.company?.name || '')
}

export default function CampaignEditor({ campaign, segments, previewContact }: Props) {
  const router = useRouter()
  const [name, setName] = useState(campaign.name)
  const [subject, setSubject] = useState(campaign.subject)
  const [body, setBody] = useState(campaign.body)
  const [segmentId, setSegmentId] = useState<string | null>(campaign.segmentId)
  const [fromName, setFromName] = useState(campaign.fromName)
  const [fromEmail, setFromEmail] = useState(campaign.fromEmail)
  const [editingName, setEditingName] = useState(false)
  const [isPending, startTransition] = useTransition()

  const isSent = campaign.status === 'sent'
  const selectedSegment = segments.find(s => s.id === segmentId) ?? null
  const canSend = !!segmentId && !isSent && !isPending

  function saveDraft() {
    startTransition(async () => {
      await updateCampaign(campaign.id, {
        name,
        subject,
        body,
        segmentId,
        fromName,
        fromEmail,
      })
    })
  }

  function saveName() {
    setEditingName(false)
    if (name !== campaign.name) {
      startTransition(async () => {
        await updateCampaign(campaign.id, { name })
      })
    }
  }

  function handleSend() {
    if (!segmentId) return
    const recipients = selectedSegment?.recipientCount ?? 0
    if (!confirm(`Send "${name}" to ${recipients} recipient${recipients === 1 ? '' : 's'}?`)) return
    startTransition(async () => {
      // Save current edits first
      await updateCampaign(campaign.id, {
        name,
        subject,
        body,
        segmentId,
        fromName,
        fromEmail,
      })
      await sendCampaign(campaign.id)
      router.refresh()
    })
  }

  function insertMergeTag(tag: string) {
    setBody(prev => prev + tag)
  }

  const previewSubject = applyMergeTags(subject || '(no subject)', previewContact)
  const previewBody = applyMergeTags(body || '(empty body)', previewContact)
  const previewToName = previewContact
    ? `${previewContact.firstName} ${previewContact.lastName}`
    : 'Recipient'
  const previewToEmail = previewContact ? previewContact.email : 'recipient@example.com'

  const openRate =
    campaign.recipientCount > 0
      ? Math.round((campaign.openCount / campaign.recipientCount) * 100)
      : 0
  const clickRate =
    campaign.recipientCount > 0
      ? Math.round((campaign.clickCount / campaign.recipientCount) * 100)
      : 0

  return (
    <div className="p-8">
      <div className="flex items-start justify-between mb-6 gap-4">
        <div className="flex-1 min-w-0">
          <Link
            href="/campaigns"
            className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to campaigns
          </Link>
          {editingName ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={name}
                onChange={e => setName(e.target.value)}
                onBlur={saveName}
                onKeyDown={e => { if (e.key === 'Enter') saveName() }}
                className="text-2xl font-bold border-b-2 border-zinc-900 outline-none px-1 -mx-1"
              />
              <button onClick={saveName} className="p-1 rounded text-zinc-500 hover:text-zinc-900">
                <Check className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{name}</h1>
              {!isSent && (
                <button
                  onClick={() => setEditingName(true)}
                  className="p-1 rounded text-zinc-400 hover:text-zinc-900"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        {!isSent && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={saveDraft}
              disabled={isPending}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50"
            >
              <Save className="w-4 h-4" /> Save Draft
            </button>
            <button
              onClick={handleSend}
              disabled={!canSend}
              className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
            >
              <Send className="w-4 h-4" /> Send Now
            </button>
          </div>
        )}
      </div>

      {isSent && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6 flex items-center gap-6">
          <div className="flex items-center gap-2 text-emerald-800 font-medium">
            <Check className="w-4 h-4" /> Sent
          </div>
          <div className="flex items-center gap-2 text-sm text-emerald-900">
            <Users className="w-4 h-4" /> {campaign.recipientCount} recipients
          </div>
          <div className="flex items-center gap-2 text-sm text-emerald-900">
            <Mail className="w-4 h-4" /> {campaign.openCount} opens ({openRate}%)
          </div>
          <div className="flex items-center gap-2 text-sm text-emerald-900">
            <BarChart3 className="w-4 h-4" /> {campaign.clickCount} clicks ({clickRate}%)
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        {/* Left: Form */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-zinc-200 p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1">
                  From Name
                </label>
                <input
                  value={fromName}
                  onChange={e => setFromName(e.target.value)}
                  disabled={isSent}
                  placeholder="Jane Doe"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 disabled:bg-zinc-50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1">
                  From Email
                </label>
                <input
                  type="email"
                  value={fromEmail}
                  onChange={e => setFromEmail(e.target.value)}
                  disabled={isSent}
                  placeholder="jane@company.com"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 disabled:bg-zinc-50"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1">
                Subject
              </label>
              <input
                value={subject}
                onChange={e => setSubject(e.target.value)}
                disabled={isSent}
                placeholder="An email subject your reader can't ignore"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-zinc-900 disabled:bg-zinc-50"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1">
                Segment {selectedSegment && (
                  <span className="ml-2 inline-block text-xs font-medium px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 normal-case tracking-normal">
                    {selectedSegment.recipientCount} recipient{selectedSegment.recipientCount === 1 ? '' : 's'}
                  </span>
                )}
              </label>
              <select
                value={segmentId ?? ''}
                onChange={e => setSegmentId(e.target.value || null)}
                disabled={isSent}
                className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 disabled:bg-zinc-50"
              >
                <option value="">Select a contact segment…</option>
                {segments.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.recipientCount})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1">
                Body
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                <span className="text-xs text-zinc-400 self-center mr-1">Insert:</span>
                {MERGE_TAGS.map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => insertMergeTag(tag)}
                    disabled={isSent}
                    className="text-xs font-mono px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-700 hover:bg-zinc-200 disabled:opacity-50"
                  >
                    {tag}
                  </button>
                ))}
              </div>
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                disabled={isSent}
                rows={14}
                placeholder={`Hi {{firstName}},\n\n...`}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-zinc-900 resize-none disabled:bg-zinc-50"
              />
            </div>
          </div>
        </div>

        {/* Right: Preview */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden sticky top-6">
            <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-2 flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-300" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-300" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-300" />
              </div>
              <span className="text-xs text-zinc-500 ml-2">Preview</span>
            </div>
            <div className="px-5 py-4 border-b border-zinc-100 bg-white">
              <div className="grid grid-cols-[60px_1fr] gap-y-1.5 text-sm">
                <span className="text-zinc-400">From</span>
                <span className="text-zinc-900">
                  {fromName || 'Sender'}{' '}
                  <span className="text-zinc-500">&lt;{fromEmail || 'sender@example.com'}&gt;</span>
                </span>
                <span className="text-zinc-400">To</span>
                <span className="text-zinc-900">
                  {previewToName}{' '}
                  <span className="text-zinc-500">&lt;{previewToEmail}&gt;</span>
                </span>
                <span className="text-zinc-400">Subject</span>
                <span className="font-semibold text-zinc-900">{previewSubject}</span>
              </div>
            </div>
            <div className="px-5 py-6 bg-white whitespace-pre-wrap text-sm text-zinc-800 leading-relaxed min-h-[300px]">
              {previewBody}
            </div>
            {!previewContact && segmentId && (
              <div className="px-5 py-3 bg-amber-50 border-t border-amber-200 text-xs text-amber-800">
                No contacts match this segment yet. Showing placeholder merge values.
              </div>
            )}
            {!segmentId && (
              <div className="px-5 py-3 bg-zinc-50 border-t border-zinc-200 text-xs text-zinc-500">
                Pick a segment to preview with real contact data.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
