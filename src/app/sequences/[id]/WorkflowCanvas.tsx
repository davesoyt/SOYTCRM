'use client'

import { useCallback, useState, useRef } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
  type NodeTypes,
  Handle,
  Position,
  Panel,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  Mail, Clock, GitBranch, Zap, ArrowUpCircle, MoveRight,
  Webhook, MessageSquare, Play, Plus, Save, CheckCircle2,
  ChevronDown, X, Users, ClipboardList,
} from 'lucide-react'
import { saveWorkflowState } from '@/app/actions'
import { formatWaitLabel, normalizeWaitConfig, type WaitUnit } from '@/lib/workflowExecution'
import WorkflowSegmentRunner from './WorkflowSegmentRunner'

const WAIT_UNITS: { value: WaitUnit; label: string }[] = [
  { value: 'seconds', label: 'Seconds' },
  { value: 'minutes', label: 'Minutes' },
  { value: 'days', label: 'Days' },
]

// ---- Node definitions ----

type NodeData = {
  label: string
  config?: Record<string, string>
  onRemove?: (id: string) => void
}

const NODE_TYPES_META = [
  { type: 'trigger', label: 'Trigger', icon: Play, color: 'bg-violet-600', border: 'border-violet-200', description: 'Start the workflow' },
  { type: 'email', label: 'Send Email', icon: Mail, color: 'bg-blue-600', border: 'border-blue-200', description: 'Send an email to contact' },
  { type: 'wait', label: 'Wait / Delay', icon: Clock, color: 'bg-amber-500', border: 'border-amber-200', description: 'Pause before next step' },
  { type: 'condition', label: 'If / Then', icon: GitBranch, color: 'bg-orange-500', border: 'border-orange-200', description: 'Branch on a condition' },
  { type: 'task', label: 'Create Task', icon: Zap, color: 'bg-green-600', border: 'border-green-200', description: 'Create a CRM task' },
  { type: 'updatescore', label: 'Update Lead Score', icon: ArrowUpCircle, color: 'bg-pink-600', border: 'border-pink-200', description: 'Adjust contact lead score' },
  { type: 'moveopportunity', label: 'Move Opportunity Stage', icon: MoveRight, color: 'bg-indigo-600', border: 'border-indigo-200', description: 'Change opportunity pipeline stage' },
  { type: 'sms', label: 'Send SMS', icon: MessageSquare, color: 'bg-teal-600', border: 'border-teal-200', description: 'Send a text message' },
  { type: 'webhook', label: 'Webhook', icon: Webhook, color: 'bg-zinc-700', border: 'border-zinc-200', description: 'Call an external endpoint' },
  { type: 'enroll', label: 'Enroll in Workflow', icon: Users, color: 'bg-cyan-600', border: 'border-cyan-200', description: 'Add contact to another workflow' },
  { type: 'form', label: 'Assign Form', icon: ClipboardList, color: 'bg-rose-600', border: 'border-rose-200', description: 'Present a form to fill out' },
] as const

type WorkflowNodeType = typeof NODE_TYPES_META[number]['type']

const metaByType = Object.fromEntries(NODE_TYPES_META.map((m) => [m.type, m])) as Record<WorkflowNodeType, typeof NODE_TYPES_META[number]>

// Generic base node renderer
function BaseNode({ id, data, type }: { id: string; data: NodeData; type: string }) {
  const meta = metaByType[type as WorkflowNodeType]
  const Icon = meta?.icon ?? Play
  const colorClass = meta?.color ?? 'bg-zinc-700'
  const borderClass = meta?.border ?? 'border-zinc-200'

  const isCondition = type === 'condition'
  const isTrigger = type === 'trigger'

  return (
    <div className={`relative rounded-xl border-2 ${borderClass} bg-white shadow-sm min-w-[200px] text-sm`}>
      {/* Header */}
      <div className={`${colorClass} text-white rounded-t-lg px-3 py-2 flex items-center gap-2`}>
        <Icon className="w-3.5 h-3.5 shrink-0" />
        <span className="font-semibold text-xs">{data.label}</span>
        {!isTrigger && (
          <button
            className="ml-auto opacity-60 hover:opacity-100"
            onClick={() => data.onRemove?.(id)}
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Config preview */}
      <div className="px-3 py-2 text-zinc-500 text-xs leading-relaxed">
        {type === 'wait' ? (
          formatWaitLabel(data.config ?? {}) ? (
            <div className="truncate">
              <span className="text-zinc-400">Wait: </span>
              {formatWaitLabel(data.config ?? {})}
            </div>
          ) : (
            <span className="italic text-zinc-300">Click to configure…</span>
          )
        ) : data.config && Object.keys(data.config).length > 0 ? (
          Object.entries(data.config).slice(0, 2).map(([k, v]) => (
            <div key={k} className="truncate">
              <span className="text-zinc-400 capitalize">{k}: </span>{v}
            </div>
          ))
        ) : (
          <span className="italic text-zinc-300">Click to configure…</span>
        )}
      </div>

      {/* Handles */}
      {!isTrigger && (
        <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-zinc-400 !border-white !border-2" />
      )}
      {isCondition ? (
        <>
          <Handle type="source" position={Position.Bottom} id="yes" style={{ left: '30%' }} className="!w-3 !h-3 !bg-green-500 !border-white !border-2" />
          <Handle type="source" position={Position.Bottom} id="no" style={{ left: '70%' }} className="!w-3 !h-3 !bg-red-400 !border-white !border-2" />
          <div className="flex justify-between px-4 pb-1 text-[9px] font-semibold text-zinc-400">
            <span>YES</span><span>NO</span>
          </div>
        </>
      ) : (
        <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-zinc-400 !border-white !border-2" />
      )}
    </div>
  )
}

// Build nodeTypes map for ReactFlow
const nodeTypes: NodeTypes = Object.fromEntries(
  NODE_TYPES_META.map(({ type }) => [
    type,
    (props: { id: string; data: NodeData; type: string }) => <BaseNode {...props} type={type} />,
  ])
)

// ---- Inline config panel ----

function ConfigPanel({
  node, onUpdate, onClose, users, segments, forms,
}: {
  node: Node
  onUpdate: (id: string, config: Record<string, string>) => void
  onClose: () => void
  users: { id: string; name: string }[]
  segments: { id: string; name: string }[]
  forms: { id: string; name: string }[]
}) {
  const type = node.type as WorkflowNodeType
  const meta = metaByType[type]
  const [config, setConfig] = useState<Record<string, string>>(() => {
    const c = (node.data as NodeData).config ?? {}
    if (node.type === 'wait') {
      const { duration, unit } = normalizeWaitConfig(c)
      return { duration, unit }
    }
    return c
  })

  const fields: { key: string; label: string; type?: string; options?: string[]; dynamicOptions?: { value: string; label: string }[] }[] = []

  if (type === 'trigger') {
    fields.push({ key: 'event', label: 'Trigger Event', options: ['Manual', 'Segment Assignment', 'Contact Created', 'Opportunity Created', 'Opportunity Stage Changed', 'Contact Enriched', 'Form Submitted', 'Deal Created', 'Deal Stage Changed'] })
    if (config.event === 'Segment Assignment') {
      fields.push({
        key: 'segmentId', label: 'Triggered by segment',
        dynamicOptions: [{ value: '', label: '— Any segment —' }, ...segments.map(s => ({ value: s.id, label: s.name }))],
      })
    }
  } else if (type === 'email') {
    fields.push({ key: 'subject', label: 'Subject' })
    fields.push({ key: 'body', label: 'Body', type: 'textarea' })
  } else if (type === 'condition') {
    fields.push({ key: 'field', label: 'Contact field', options: ['leadScore', 'title', 'company', 'email', 'enriched'] })
    fields.push({ key: 'operator', label: 'Operator', options: ['equals', 'contains', 'greater than', 'less than', 'is set'] })
    fields.push({ key: 'value', label: 'Value' })
  } else if (type === 'task') {
    fields.push({ key: 'title', label: 'Task title' })
    fields.push({ key: 'priority', label: 'Priority', options: ['low', 'medium', 'high'] })
    fields.push({ key: 'due', label: 'Due in (days)', type: 'number' })
    fields.push({
      key: 'assigneeId', label: 'Assign to',
      dynamicOptions: [{ value: '', label: '— Unassigned —' }, ...users.map(u => ({ value: u.id, label: u.name }))],
    })
    fields.push({
      key: 'segmentId', label: 'Only for segment',
      dynamicOptions: [{ value: '', label: '— All contacts —' }, ...segments.map(s => ({ value: s.id, label: s.name }))],
    })
  } else if (type === 'updatescore') {
    fields.push({ key: 'delta', label: 'Score change (e.g. +10 or -5)' })
  } else if (type === 'moveopportunity') {
    fields.push({ key: 'stage', label: 'Target stage', options: ['Prospect', 'Qualified', 'Proposal', 'Closed Won', 'Closed Lost'] })
  } else if (type === 'sms') {
    fields.push({ key: 'message', label: 'Message', type: 'textarea' })
  } else if (type === 'webhook') {
    fields.push({ key: 'url', label: 'Endpoint URL' })
    fields.push({ key: 'method', label: 'Method', options: ['POST', 'GET', 'PUT', 'PATCH'] })
  } else if (type === 'enroll') {
    fields.push({ key: 'workflow', label: 'Workflow name' })
  } else if (type === 'form') {
    fields.push({
      key: 'formId', label: 'Select form',
      dynamicOptions: [{ value: '', label: '— Select a form —' }, ...forms.map(f => ({ value: f.id, label: f.name }))],
    })
    fields.push({
      key: 'assigneeId', label: 'Assign to user',
      dynamicOptions: [{ value: '', label: '— Unassigned —' }, ...users.map(u => ({ value: u.id, label: u.name }))],
    })
  }

  return (
    <div className="absolute right-4 top-16 z-10 w-72 bg-white rounded-xl border border-zinc-200 shadow-lg">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
        <span className="font-semibold text-sm">{meta?.label ?? type} Settings</span>
        <button onClick={onClose}><X className="w-4 h-4 text-zinc-400 hover:text-zinc-700" /></button>
      </div>
      <div className="p-4 space-y-3">
        {type === 'wait' && (
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">Wait duration</label>
            <div className="flex gap-2">
              <input
                type="number"
                min="0"
                step="any"
                value={config.duration ?? ''}
                onChange={(e) => setConfig({ ...config, duration: e.target.value })}
                placeholder="0"
                className="flex-1 rounded-lg border border-zinc-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
              />
              <select
                value={config.unit ?? 'days'}
                onChange={(e) => setConfig({ ...config, unit: e.target.value })}
                className="w-28 rounded-lg border border-zinc-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 bg-white"
              >
                {WAIT_UNITS.map(u => (
                  <option key={u.value} value={u.value}>{u.label}</option>
                ))}
              </select>
            </div>
          </div>
        )}
        {fields.map((f) => (
          <div key={f.key}>
            <label className="block text-xs font-medium text-zinc-700 mb-1">{f.label}</label>
            {f.dynamicOptions ? (
              <select
                value={config[f.key] ?? ''}
                onChange={(e) => setConfig({ ...config, [f.key]: e.target.value })}
                className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 bg-white"
              >
                {f.dynamicOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ) : f.options ? (
              <select
                value={config[f.key] ?? ''}
                onChange={(e) => setConfig({ ...config, [f.key]: e.target.value })}
                className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
              >
                <option value="">— Select —</option>
                {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : f.type === 'textarea' ? (
              <textarea
                value={config[f.key] ?? ''}
                onChange={(e) => setConfig({ ...config, [f.key]: e.target.value })}
                rows={3}
                className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 resize-none"
              />
            ) : (
              <input
                type={f.type ?? 'text'}
                value={config[f.key] ?? ''}
                onChange={(e) => setConfig({ ...config, [f.key]: e.target.value })}
                className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
              />
            )}
          </div>
        ))}
        <button
          onClick={() => {
            const toSave =
              type === 'wait'
                ? { duration: config.duration ?? '', unit: config.unit ?? 'days' }
                : config
            onUpdate(node.id, toSave)
            onClose()
          }}
          className="w-full rounded-lg bg-zinc-900 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
        >
          Apply
        </button>
      </div>
    </div>
  )
}

// ---- Main WorkflowCanvas ----

type Props = {
  sequenceId: string
  initialNodes: Node[]
  initialEdges: Edge[]
  isActive: boolean
  users: { id: string; name: string }[]
  segments: { id: string; name: string }[]
  forms: { id: string; name: string }[]
  segmentLinks: { id: string; segment: { id: string; name: string } }[]
}

let nodeIdCounter = 100

export default function WorkflowCanvas({ sequenceId, initialNodes, initialEdges, isActive: initialActive, users, segments, forms, segmentLinks }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [isActive, setIsActive] = useState(initialActive)
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const reactFlowWrapper = useRef<HTMLDivElement>(null)

  const removeNode = useCallback((id: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== id))
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id))
    setSelectedNode(null)
  }, [setNodes, setEdges])

  // Inject onRemove into each node's data
  const nodesWithHandlers = nodes.map((n) => ({
    ...n,
    data: { ...n.data, onRemove: removeNode },
  }))

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: '#71717a', strokeWidth: 2 } }, eds)),
    [setEdges],
  )

  function addNode(type: WorkflowNodeType) {
    const meta = metaByType[type]
    const id = `node_${++nodeIdCounter}`
    const newNode: Node = {
      id,
      type,
      position: { x: 250, y: nodes.length * 120 + 80 },
      data: { label: meta.label, config: {} },
    }
    setNodes((nds) => [...nds, newNode])
    setPaletteOpen(false)
  }

  function onNodeClick(_: React.MouseEvent, node: Node) {
    setSelectedNode(node)
  }

  function onPaneClick() {
    setSelectedNode(null)
  }

  function updateNodeConfig(id: string, config: Record<string, string>) {
    const meta = metaByType[nodes.find((n) => n.id === id)?.type as WorkflowNodeType]
    setNodes((nds) =>
      nds.map((n) =>
        n.id === id
          ? { ...n, data: { ...n.data, config, label: meta?.label ?? n.data.label } }
          : n
      )
    )
  }

  async function handleSave(newActive?: boolean) {
    setSaving(true)
    const activeState = newActive !== undefined ? newActive : isActive
    const cleanNodes = nodes.map(({ data, ...rest }) => ({
      ...rest,
      data: { label: data.label, config: (data as NodeData).config },
    }))
    await saveWorkflowState(sequenceId, JSON.stringify(cleanNodes), JSON.stringify(edges), activeState)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    if (newActive !== undefined) setIsActive(newActive)
  }

  return (
    <div className="relative" style={{ width: '100%', height: '100%' }} ref={reactFlowWrapper}>
      <ReactFlow
        nodes={nodesWithHandlers}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        defaultEdgeOptions={{ animated: true, style: { stroke: '#71717a', strokeWidth: 2 } }}
      >
        <Background color="#e4e4e7" gap={16} />
        <Controls />
        <MiniMap nodeColor="#a1a1aa" maskColor="rgba(244,244,245,0.7)" className="!rounded-lg !border !border-zinc-200" />

        {/* Top-right action bar */}
        <Panel position="top-right" className="flex items-center gap-2">
          <WorkflowSegmentRunner segmentLinks={segmentLinks} />

          <button
            onClick={() => setPaletteOpen((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Step
            <ChevronDown className="w-3 h-3" />
          </button>

          <button
            onClick={() => handleSave(!isActive)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium shadow-sm transition-colors ${
              isActive
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50'
            }`}
          >
            {isActive ? 'Active' : 'Draft'}
          </button>

          <button
            onClick={() => handleSave()}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 shadow-sm transition-colors"
          >
            {saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving…' : saved ? 'Saved' : 'Save'}
          </button>
        </Panel>

        {/* Node palette dropdown */}
        {paletteOpen && (
          <Panel position="top-right" className="mt-10">
            <div className="bg-white rounded-xl border border-zinc-200 shadow-lg p-2 w-56">
              {NODE_TYPES_META.filter((m) => m.type !== 'trigger').map((meta) => {
                const Icon = meta.icon
                return (
                  <button
                    key={meta.type}
                    onClick={() => addNode(meta.type as WorkflowNodeType)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-zinc-50 text-left transition-colors"
                  >
                    <span className={`${meta.color} rounded-md p-1`}>
                      <Icon className="w-3.5 h-3.5 text-white" />
                    </span>
                    <div>
                      <p className="text-xs font-medium text-zinc-900">{meta.label}</p>
                      <p className="text-[10px] text-zinc-400 leading-tight">{meta.description}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </Panel>
        )}
      </ReactFlow>

      {/* Config panel for selected node */}
      {selectedNode && (
        <ConfigPanel
          node={selectedNode}
          users={users}
          segments={segments}
          forms={forms}
          onUpdate={(id, config) => {
            updateNodeConfig(id, config)
            setSelectedNode(null)
          }}
          onClose={() => setSelectedNode(null)}
        />
      )}
    </div>
  )
}
