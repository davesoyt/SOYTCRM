import { createCompany } from '@/app/actions'

export default function NewCompanyPage() {
  return (
    <div className="p-8 max-w-xl">
      <h1 className="text-2xl font-bold mb-6">New Company</h1>
      <form action={createCompany} className="bg-white rounded-xl border border-zinc-200 p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Company Name</label>
          <input name="name" required className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900" />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Domain</label>
          <input name="domain" placeholder="acme.com" className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900" />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Industry</label>
          <input name="industry" className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900" />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Company Size</label>
          <select name="size" className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900">
            <option value="">— Select —</option>
            <option>1-10</option>
            <option>10-50</option>
            <option>50-200</option>
            <option>200-500</option>
            <option>500-1000</option>
            <option>1000+</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Website</label>
          <input name="website" type="url" placeholder="https://" className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900" />
        </div>
        <button type="submit" className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors">
          Create Company
        </button>
      </form>
    </div>
  )
}
