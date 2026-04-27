import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { IdVerificationClient } from '@/components/occupants/id-verification-client'

export const metadata: Metadata = { title: 'ID Verification Queue' }

export default async function IdVerificationPage() {
  const supabase = createAdminClient()

  // Occupants with docs but not yet verified
  const { data: pending } = await supabase
    .from('occupants')
    .select(`
      id, first_name, last_name, phone, email, photo_url,
      student_id, id_verified, id_verified_at, id_rejection_notes,
      occupant_documents(id, document_type, file_url, created_at)
    `)
    .eq('id_verified' as any, false)
    .order('created_at', { ascending: false })

  const withDocs = ((pending ?? []) as any[]).filter((o) => {
    const docs = Array.isArray(o.occupant_documents) ? o.occupant_documents : []
    return docs.length > 0
  })

  const { data: recentReviews } = await supabase
    .from('id_verification_reviews')
    .select('*, occupants(first_name, last_name)')
    .order('created_at', { ascending: false })
    .limit(20)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">ID Verification Queue</h1>
          <p className="mt-0.5 text-sm text-text-secondary">
            {withDocs.length} occupant{withDocs.length !== 1 ? 's' : ''} awaiting review
          </p>
        </div>
        <Link href="/occupants" className="text-sm text-text-secondary hover:text-text-primary transition-colors">
          ← Occupants
        </Link>
      </div>
      <IdVerificationClient initialQueue={withDocs as any[]} recentReviews={(recentReviews ?? []) as any} />
    </div>
  )
}
