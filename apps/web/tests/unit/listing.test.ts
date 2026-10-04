import { describe, expect, it, vi } from 'vitest'

import { applySearchTerms, containsFilter, normalisePage, paginateRows } from '@/lib/data/listing'

describe('shared listing helpers', () => {
  it('applies every search word as its own OR group', () => {
    const query = { or: vi.fn().mockReturnThis() }

    applySearchTerms(query, ['first_name', 'last_name'], '  Francis   Otoo ')

    expect(query.or).toHaveBeenNthCalledWith(
      1,
      'first_name.ilike."*Francis*",last_name.ilike."*Francis*"',
    )
    expect(query.or).toHaveBeenNthCalledWith(
      2,
      'first_name.ilike."*Otoo*",last_name.ilike."*Otoo*"',
    )
  })

  it('quotes user input before embedding it in a PostgREST OR filter', () => {
    expect(containsFilter('name', 'A"B*')).toBe('name.ilike."*A\\"B\\**"')
  })

  it('clamps invalid page numbers and paginates complete result sets', () => {
    expect(normalisePage('-10')).toBe(1)
    expect(normalisePage('not-a-number')).toBe(1)
    expect(paginateRows(['a', 'b', 'c', 'd', 'e'], 9, 2)).toEqual({
      rows: ['e'],
      total: 5,
      page: 3,
      pageSize: 2,
    })
  })
})
