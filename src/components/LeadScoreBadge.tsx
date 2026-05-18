import { scoreLabel } from '@/lib/scoring'

export default function LeadScoreBadge({ score }: { score: number }) {
  const { label, color } = scoreLabel(score)
  const pct = Math.min(score, 100)
  return (
    <div className="flex items-center gap-2">
      <div className="w-24 h-2 rounded-full bg-zinc-100 overflow-hidden">
        <div
          className="h-full rounded-full bg-current transition-all"
          style={{ width: `${pct}%`, color: color.replace('text-', '') }}
        />
      </div>
      <span className={`text-sm font-semibold ${color}`}>
        {score} · {label}
      </span>
    </div>
  )
}
