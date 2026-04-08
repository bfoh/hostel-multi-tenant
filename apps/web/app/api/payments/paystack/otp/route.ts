import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { submitOtp } from '@/lib/paystack'

const schema = z.object({
  reference: z.string(),
  otp:       z.string().min(4).max(8),
})

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 422 })

  try {
    const result = await submitOtp(parsed.data.reference, parsed.data.otp)
    return NextResponse.json({ status: result.status, display_text: result.display_text })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 502 })
  }
}
