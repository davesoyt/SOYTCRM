import { GitMerge } from 'lucide-react'
import FileMergeTool from './FileMergeTool'

export const dynamic = 'force-dynamic'

export default function FileMergePage() {
  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-6">
        <GitMerge className="w-6 h-6" />
        <h1 className="text-2xl font-bold">File Merge</h1>
      </div>
      <FileMergeTool />
    </div>
  )
}
