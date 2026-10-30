'use client'

import { useRouter, useSearchParams } from 'next/navigation'

export function ListingSortSelect({ current }: { current: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function onChange(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('sort', value)
    params.delete('page')
    router.push(`/browse?${params.toString()}`)
  }

  return (
    <select
      value={current}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Sort listings"
      className="bd-focus min-h-[40px] cursor-pointer rounded-xl border border-bd-teal/15 bg-white px-3 text-[16px] text-bd-teal sm:text-[14px]"
    >
      <option value="name">Name</option>
      <option value="price_asc">Price: low to high</option>
      <option value="price_desc">Price: high to low</option>
    </select>
  )
}
