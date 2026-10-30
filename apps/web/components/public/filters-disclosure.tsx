'use client'

import { useState, type ReactNode } from 'react'
import { ChevronDown, SlidersHorizontal } from 'lucide-react'

/**
 * /browse filters: a "Filters" toggle on phones, where an always-open panel
 * pushed the results below the fold; always open beside the results on
 * large screens. Without JavaScript the button does nothing and the panel
 * stays collapsed on phones — the search form above still works.
 */
export function FiltersDisclosure({ activeCount, children }: { activeCount: number; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="browse-filters"
        onClick={() => setOpen((o) => !o)}
        className="bd-focus flex min-h-[44px] w-full items-center justify-between gap-3 rounded-xl border border-bd-teal/12 bg-white px-4 text-[14px] font-semibold text-bd-teal lg:hidden"
      >
        <span className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          Filters
          {activeCount > 0 && (
            <span className="rounded-full bg-bd-teal px-2 py-0.5 text-[11px] font-bold text-bd-ivory">
              {activeCount}<span className="sr-only"> active</span>
            </span>
          )}
        </span>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      <div id="browse-filters" className={`${open ? 'mt-2 block' : 'hidden'} lg:mt-0 lg:block`}>
        {children}
      </div>
    </div>
  )
}
