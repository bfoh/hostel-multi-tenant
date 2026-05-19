import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { GroupCreator } from '@/components/messages/group-creator'

export const metadata: Metadata = { title: 'New group' }
export const dynamic = 'force-dynamic'

export default async function NewGroupPage() {
  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) redirect('/login')

  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient() as any
  const { data: staff } = await admin
    .from('tenant_members')
    .select('role')
    .eq('tenant_id', tenantId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()
  if (!staff) redirect('/messages')

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href="/messages" className="inline-flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary">
        <ArrowLeft className="h-3 w-3" /> Back to messages
      </Link>

      <header>
        <h1 className="text-2xl font-bold text-text-primary">New group</h1>
        <p className="mt-0.5 text-sm text-text-secondary">
          Create a group with staff and/or occupants. Anyone in the group can post.
        </p>
      </header>

      <GroupCreator />
    </div>
  )
}
