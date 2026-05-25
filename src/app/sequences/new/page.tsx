'use client'

import { useState, useTransition } from 'react'
import { createSequence } from '@/app/actions'
import { Play, Mail, ArrowRight, Building2, TrendingUp, FileText, Sparkles } from 'lucide-react'

const TRIGGERS = [
  {
    value: 'Manual',
    label: 'Manual',
    description: 'Trigger this workflow manually from a contact profile',
    icon: Play,
    color: 'border-zinc-200 hover:border-zinc-400',
    activeColor: 'border-zinc-900 bg-zinc-900 text-white',
  },
  {
    value: 'Contact Created',
    label: 'Contact Created',
    description: 'Automatically enroll new contacts when they are added to the CRM',
    icon: Mail,
    color: 'border-zinc-200 hover:border-blue-400',
    activeColor: 'border-blue-600 bg-blue-600 text-white',
  },
  {
    value: 'Opportunity Created',
    label: 'Opportunity Created',
    description: 'Start when a new opportunity is added to the pipeline',
    icon: TrendingUp,
    color: 'border-zinc-200 hover:border-indigo-400',
    activeColor: 'border-indigo-600 bg-indigo-600 text-white',
  },
  {
    value: 'Opportunity Stage Changed',
    label: 'Opportunity Stage Changed',
    description: 'Trigger when an opportunity moves to a new pipeline stage',
    icon: ArrowRight,
    color: 'border-zinc-200 hover:border-purple-400',
    activeColor: 'border-purple-600 bg-purple-600 text-white',
  },
  {
    value: 'Contact Enriched',
    label: 'Contact Enriched',
    description: 'Run after AI enriches a contact with new data',
    icon: Sparkles,
    color: 'border-zinc-200 hover:border-pink-400',
    activeColor: 'border-pink-600 bg-pink-600 text-white',
  },
  {
    value: 'Form Submitted',
    label: 'Form Submitted',
    description: 'Start when a contact fills out a web form',
    icon: FileText,
    color: 'border-zinc-200 hover:border-teal-400',
    activeColor: 'border-teal-600 bg-teal-600 text-white',
  },
]

export default function NewSequencePage() {
  const [trigger, setTrigger] = useState('Manual')
  const [, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    fd.set('trigger', trigger)
    startTransition(async () => {
      await createSequence(fd)
    })
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">New Workflow</h1>
        <p className="text-sm text-zinc-500 mt-1">Set a name and choose what triggers this workflow to start.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-xl border border-zinc-200 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Workflow Name</label>
            <input
              name="name"
              required
              placeholder="e.g. New Lead Nurture, Post-Demo Follow-up"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Description <span className="text-zinc-400 font-normal">(optional)</span></label>
            <input
              name="description"
              placeholder="What does this workflow do?"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-3">Enrollment Trigger</label>
          <div className="grid grid-cols-2 gap-3">
            {TRIGGERS.map((t) => {
              const Icon = t.icon
              const isActive = trigger === t.value
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTrigger(t.value)}
                  className={`flex flex-col items-start gap-2 p-4 rounded-xl border-2 text-left transition-all ${
                    isActive ? t.activeColor : `bg-white ${t.color} text-zinc-700`
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <div>
                    <p className={`text-sm font-semibold ${isActive ? '' : 'text-zinc-800'}`}>{t.label}</p>
                    <p className={`text-xs mt-0.5 leading-snug ${isActive ? 'opacity-80' : 'text-zinc-400'}`}>{t.description}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <button
          type="submit"
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
        >
          <Building2 className="w-4 h-4" />
          Create & Open Workflow Builder
        </button>
      </form>
    </div>
  )
}
