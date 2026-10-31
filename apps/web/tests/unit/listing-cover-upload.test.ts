/**
 * POST /api/settings/listing/cover — the listing cover photo upload on
 * Settings → Public Listing. Owner or manager only; the file type comes
 * from the bytes, not the browser's Content-Type; each upload is a new
 * file, so nothing already in storage is overwritten. Supabase and
 * next/headers are mocked — no network, no real accounts.
 */
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sniffListingImage } from '@/lib/image-type'

const OWN = 'a0000000-0000-4000-8000-00000000000a'
const USER = 'u0000000-0000-4000-8000-0000000000c1'

let role: string | null = 'owner'
let uploads: { path: string; contentType: string; upsert: boolean }[] = []
let updates: { table: string; row: Record<string, unknown>; id?: string }[] = []

vi.mock('next/headers', () => ({
  headers: async () => ({ get: (k: string) => (k === 'x-tenant-id' ? OWN : null) }),
  cookies: async () => ({ get: () => undefined }),
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: USER } } }) } }),
}))
vi.mock('@/lib/rate-limit', () => ({ onboardingLimiter: {}, enforceRateLimit: async () => null }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: role ? { role, is_active: true } : null }) }) }) }) }),
  }),
}))
vi.mock('@/lib/supabase/tenant-admin', () => ({
  createTenantAdminClientFromHeaders: async () => ({
    storage: {
      from: () => ({
        upload: async (path: string, _b: unknown, o: { contentType: string; upsert: boolean }) => {
          uploads.push({ path, ...o })
          return { error: null }
        },
        getPublicUrl: (path: string) => ({ data: { publicUrl: `https://db.beddilo.test/storage/v1/object/public/tenant-photos/${path}` } }),
      }),
    },
    from: (table: string) => ({
      update: (row: Record<string, unknown>) => ({
        eq: async (_c: string, id: string) => { updates.push({ table, row, id }); return { error: null } },
      }),
    }),
  }),
}))

const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d]
const WEBP = [0x52, 0x49, 0x46, 0x46, 0x24, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]
const HTML = [...Buffer.from('<html><script>alert(1)</script>')]

function upload(bytes: number[], type = 'image/jpeg') {
  const form = new FormData()
  form.append('photo', new File([new Uint8Array(bytes)], 'cover.jpg', { type }))
  return new NextRequest('https://own.beddilo.test/api/settings/listing/cover', { method: 'POST', body: form })
}
const post = async (req: NextRequest) => (await import('@/app/api/settings/listing/cover/route')).POST(req)

beforeEach(() => {
  role = 'owner'
  uploads = []
  updates = []
})

describe('sniffListingImage', () => {
  it('recognises JPEG, PNG and WebP by their bytes', () => {
    expect(sniffListingImage(new Uint8Array(JPEG))).toBe('image/jpeg')
    expect(sniffListingImage(new Uint8Array(PNG))).toBe('image/png')
    expect(sniffListingImage(new Uint8Array(WEBP))).toBe('image/webp')
  })

  it('rejects anything else, whatever it claims to be', () => {
    expect(sniffListingImage(new Uint8Array(HTML))).toBeNull()
    expect(sniffListingImage(new Uint8Array([]))).toBeNull()
  })
})

describe('POST /api/settings/listing/cover', () => {
  it.each(['owner', 'manager'])('lets the %s set a new cover', async (r) => {
    role = r
    const res = await post(upload(JPEG))
    expect(res.status).toBe(200)
    const { hero_image_url } = await res.json()
    expect(uploads).toHaveLength(1)
    expect(uploads[0].path).toMatch(new RegExp(`^${OWN}/cover-\\d+\\.jpg$`))
    expect(uploads[0].upsert).toBe(false)
    expect(updates).toEqual([{ table: 'tenants', row: { hero_image_url }, id: OWN }])
  })

  it.each(['receptionist', 'housekeeper', 'accountant', 'security', 'occupant', null])(
    'refuses %s and changes nothing',
    async (r) => {
      role = r
      const res = await post(upload(JPEG))
      expect(res.status).toBe(403)
      expect(uploads).toEqual([])
      expect(updates).toEqual([])
    },
  )

  it('stores the type found in the bytes, not the one the browser sent', async () => {
    await post(upload(PNG, 'image/jpeg'))
    expect(uploads[0]).toMatchObject({ contentType: 'image/png' })
    expect(uploads[0].path).toMatch(/\.png$/)
  })

  it('refuses a file that is not a JPEG, PNG or WebP', async () => {
    const res = await post(upload(HTML, 'image/jpeg'))
    expect(res.status).toBe(400)
    expect(uploads).toEqual([])
    expect(updates).toEqual([])
  })

  it('refuses a file over 5 MB', async () => {
    const big = new Array(5 * 1024 * 1024 + 1).fill(0)
    big.splice(0, JPEG.length, ...JPEG)
    const res = await post(upload(big))
    expect(res.status).toBe(400)
    expect(uploads).toEqual([])
  })
})
