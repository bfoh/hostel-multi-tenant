'use client'

import { useRouter, useSearchParams } from 'next/navigation'

export function ListingSortSelect({ current }: { current: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function onChange(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('sort', value)
    router.push(`/browse?${params.toString()}`)
  }

  return (
    <select
      value={current}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md border border-neutral-300 px-2 py-1 text-[13px] text-neutral-900"
    >
      <option value="name">Name</option>
      <option value="price_asc">Price: low to high</option>
      <option value="price_desc">Price: high to low</option>
    </select>
  )
}
