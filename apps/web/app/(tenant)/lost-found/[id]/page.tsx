import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { getLfItemById } from '@/lib/data/lost-found'
import { LfItemForm } from '@/components/lost-found/lf-item-form'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Lost & Found Item' }

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  unclaimed: { label: 'Unclaimed', cls: 'bg-warning/10 text-warning' },
  claimed:   { label: 'Claimed',   cls: 'bg-success/10 text-success' },
  disposed:  { label: 'Disposed',  cls: 'bg-surface-raised text-text-tertiary' },
  donated:   { label: 'Donated',   cls: 'bg-brand/10 text-brand' },
}

export default async function LfItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [item, { data: occupants }, { data: rooms }] = await Promise.all([
    getLfItemById(id),
    supabase.from('occupants').select('id, first_name, last_name').eq('status', 'active').order('first_name'),
    supabase.from('rooms').select('id, room_number, block').order('room_number'),
  ])

  if (!item) notFound()

  const badge = STATUS_BADGE[item.status]

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/lost-found" className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors">
          <ChevronLeft className="h-4 w-4" /> Lost &amp; Found
        </Link>
        <span className="text-text-disabled">/</span>
        <span className="text-sm text-text-primary truncate">{item.description.slice(0, 40)}{item.description.length > 40 ? '…' : ''}</span>
      </div>

      <div className="flex items-start gap-3">
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-text-primary line-clamp-2">{item.description}</h1>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <span className={`rounded-full px-3 py-0.5 text-xs font-medium ${badge.cls}`}>{badge.label}</span>
            <span className="text-xs text-text-tertiary capitalize">{item.category}</span>
            <span className="text-xs text-text-tertiary">Found {item.found_date}</span>
            {item.found_location && <span className="text-xs text-text-tertiary">· {item.found_location}</span>}
          </div>
          {item.occupant && (
            <p className="mt-1 text-sm text-text-secondary">
              Linked to: <span className="font-medium text-text-primary">{item.occupant.first_name} {item.occupant.last_name}</span>
            </p>
          )}
          {item.claimed_by && (
            <p className="mt-1 text-sm text-text-secondary">
              Claimed by: <span className="font-medium text-text-primary">{item.claimed_by}</span>
              {item.claimed_at && <span className="text-text-tertiary"> on {item.claimed_at.slice(0, 10)}</span>}
            </p>
          )}
        </div>
      </div>

      <LfItemForm
        occupants={occupants ?? []}
        rooms={rooms ?? []}
        initial={{
          id:             item.id,
          description:    item.description,
          category:       item.category,
          found_date:     item.found_date,
          found_location: item.found_location,
          occupant_id:    item.occupant_id,
          room_id:        item.room_id,
          status:         item.status,
          claimed_by:     item.claimed_by,
          notes:          item.notes,
        }}
      />
    </div>
  )
}
