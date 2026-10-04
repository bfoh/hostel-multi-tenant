import Link from 'next/link'

export function ListPagination({
  pathname,
  page,
  pageSize,
  total,
  params = {},
}: {
  pathname: string
  page: number
  pageSize: number
  total: number
  params?: Record<string, string | undefined | null>
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  if (totalPages <= 1) return null

  function href(targetPage: number) {
    const query = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (value) query.set(key, value)
    }
    if (targetPage > 1) query.set('page', String(targetPage))
    const suffix = query.toString()
    return suffix ? `${pathname}?${suffix}` : pathname
  }

  return (
    <nav
      aria-label="Pagination"
      className="border-border flex flex-wrap items-center justify-between gap-3 border-t pt-4"
    >
      <p className="text-text-secondary text-sm">
        Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
      </p>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link
            href={href(page - 1)}
            className="border-border bg-surface text-text-secondary hover:text-text-primary hover:bg-surface-raised rounded-md border px-3 py-2 text-sm font-medium"
          >
            Previous
          </Link>
        ) : (
          <span className="border-border text-text-disabled rounded-md border px-3 py-2 text-sm font-medium">
            Previous
          </span>
        )}
        <span className="text-text-secondary px-1 text-sm">Page {page} of {totalPages}</span>
        {page < totalPages ? (
          <Link
            href={href(page + 1)}
            className="border-border bg-surface text-text-secondary hover:text-text-primary hover:bg-surface-raised rounded-md border px-3 py-2 text-sm font-medium"
          >
            Next
          </Link>
        ) : (
          <span className="border-border text-text-disabled rounded-md border px-3 py-2 text-sm font-medium">
            Next
          </span>
        )}
      </div>
    </nav>
  )
}
