export const DEFAULT_LIST_PAGE_SIZE = 100

export interface ListPage<T> {
  rows: T[]
  total: number
  page: number
  pageSize: number
}

export function normalisePage(value?: number | string | null) {
  const parsed = typeof value === 'number' ? value : Number.parseInt(value ?? '1', 10)
  return Number.isFinite(parsed) ? Math.max(1, Math.floor(parsed)) : 1
}

/** Build a safely quoted PostgREST `ilike` expression for use inside `.or()`. */
export function containsFilter(column: string, value: string) {
  const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\*/g, '\\*')
  return `${column}.ilike."*${escaped}*"`
}

/**
 * Apply each word as an AND group, while allowing it to match any searchable
 * column. Thus "Francis Otoo" can match first_name + last_name.
 */
export function applySearchTerms<T>(query: T, columns: string[], search?: string | null): T {
  const terms = search?.trim().split(/\s+/).filter(Boolean) ?? []
  let next: any = query
  for (const term of terms) {
    next = next.or(columns.map((column) => containsFilter(column, term)).join(','))
  }
  return next as T
}

export function paginateRows<T>(rows: T[], requestedPage: number, pageSize = DEFAULT_LIST_PAGE_SIZE) {
  const total = rows.length
  const lastPage = Math.max(1, Math.ceil(total / pageSize))
  const page = Math.min(normalisePage(requestedPage), lastPage)
  const offset = (page - 1) * pageSize
  return { rows: rows.slice(offset, offset + pageSize), total, page, pageSize }
}
