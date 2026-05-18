import { getForms, createForm } from '@/app/actions'
import FormsListClient from './FormsListClient'

export const dynamic = 'force-dynamic'

export default async function FormsPage() {
  const forms = await getForms()
  return <FormsListClient forms={forms} />
}
