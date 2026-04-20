/**
 * AI Chat Agent — streaming endpoint
 * Uses Anthropic Messages API directly (no SDK install required).
 * Claude Haiku is the default model for cost efficiency.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const MODEL = 'claude-haiku-4-5-20251001'
const MAX_TOKENS = 1024

/* ── Tool definitions ──────────────────────────────────────────────── */

const TOOLS = [
  {
    name: 'check_availability',
    description: 'Check which room types are currently available at the hostel.',
    input_schema: {
      type: 'object',
      properties: {
        check_in_date: { type: 'string', description: 'ISO date (YYYY-MM-DD)' },
      },
      required: [],
    },
  },
  {
    name: 'get_pricing',
    description: 'Get room category names and prices (rates) for the hostel.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'search_faqs',
    description: 'Search hostel FAQs and policies for an answer.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'What the guest is asking about' },
      },
      required: ['query'],
    },
  },
  {
    name: 'escalate_to_human',
    description: 'Escalate this conversation to a human staff member. Call this when the guest has a complex issue you cannot resolve.',
    input_schema: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why escalation is needed' },
      },
      required: ['reason'],
    },
  },
  {
    name: 'create_booking',
    description: 'Create a provisional booking for a guest. Call this ONLY after the guest has confirmed their details (name, phone, check-in date, and room type). The booking will be in pending_payment status until the phone is verified via OTP.',
    input_schema: {
      type: 'object',
      properties: {
        category_id:   { type: 'string', description: 'Room category UUID from check_availability' },
        first_name:    { type: 'string', description: "Guest's first name" },
        last_name:     { type: 'string', description: "Guest's last name" },
        phone:         { type: 'string', description: "Guest's Ghana phone number (e.g. 0244000000)" },
        email:         { type: 'string', description: "Guest's email (optional)" },
        check_in_date: { type: 'string', description: 'ISO date YYYY-MM-DD' },
      },
      required: ['category_id', 'first_name', 'last_name', 'phone', 'check_in_date'],
    },
  },
  {
    name: 'send_otp',
    description: 'Send a 4-digit OTP to the guest phone number to verify their booking. Call this after create_booking succeeds.',
    input_schema: {
      type: 'object',
      properties: {
        booking_id: { type: 'string', description: 'Booking UUID returned by create_booking' },
        phone:      { type: 'string', description: "Guest's phone number" },
      },
      required: ['booking_id', 'phone'],
    },
  },
  {
    name: 'verify_otp',
    description: 'Verify the OTP code the guest provided. If correct, the booking is confirmed.',
    input_schema: {
      type: 'object',
      properties: {
        booking_id: { type: 'string', description: 'Booking UUID' },
        otp_code:   { type: 'string', description: '4-digit code the guest provided' },
      },
      required: ['booking_id', 'otp_code'],
    },
  },
  {
    name: 'initiate_payment',
    description: 'Initiate a Mobile Money (MoMo) payment via Paystack for a confirmed booking. The guest will receive a USSD prompt on their phone to approve the payment. Call this ONLY after verify_otp has confirmed the booking and the guest wants to pay now via MoMo.',
    input_schema: {
      type: 'object',
      properties: {
        booking_id: { type: 'string', description: 'Booking UUID' },
        phone:      { type: 'string', description: "Guest's Ghana MoMo phone number (e.g. 0244000000)" },
        provider:   { type: 'string', description: "MoMo network: 'mtn', 'vodafone', or 'airteltigo'", enum: ['mtn', 'vodafone', 'airteltigo'] },
      },
      required: ['booking_id', 'phone', 'provider'],
    },
  },
]

/* ── Tool execution ────────────────────────────────────────────────── */

async function runTool(
  name: string,
  input: Record<string, unknown>,
  tenantId: string,
): Promise<string> {
  const supabase = await createClient()

  if (name === 'check_availability') {
    const { data } = await supabase
      .from('room_categories')
      .select(`
        name, type, base_rate, rate_unit, capacity,
        rooms:rooms(status)
      `)
      .eq('tenant_id', tenantId)
      .eq('is_active', true)

    const result = (data ?? []).map((cat) => {
      const rooms = Array.isArray(cat.rooms) ? cat.rooms : []
      const avail = rooms.filter((r: any) => r.status === 'available').length
      return `${cat.name}: ${avail} available`
    }).join('\n')

    return result || 'No availability data found.'
  }

  if (name === 'get_pricing') {
    const { data } = await supabase
      .from('room_categories')
      .select('name, base_rate, rate_unit, type, capacity')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('sort_order')

    const result = (data ?? []).map((cat) => {
      const price = `GH₵ ${(cat.base_rate / 100).toFixed(2)} / ${cat.rate_unit}`
      return `${cat.name} (${cat.type}, up to ${cat.capacity} person${cat.capacity !== 1 ? 's' : ''}): ${price}`
    }).join('\n')

    return result || 'No pricing data found.'
  }

  if (name === 'search_faqs') {
    const query = String(input.query ?? '').trim()

    // Search hostel description / settings for FAQ-like content
    const { data: tenant } = await supabase
      .from('tenants')
      .select('name, address_line1, address_city, contact_phone, contact_email')
      .eq('id', tenantId)
      .single()

    if (!tenant) return 'No information available.'

    // Basic policy answers derived from tenant contact info
    const facts = [
      `Hostel name: ${tenant.name}`,
      tenant.address_line1 ? `Address: ${tenant.address_line1}, ${tenant.address_city ?? ''}` : null,
      tenant.contact_phone ? `Phone: ${tenant.contact_phone}` : null,
      tenant.contact_email ? `Email: ${tenant.contact_email}` : null,
    ].filter(Boolean).join('\n')

    return facts || 'Please contact the hostel directly for more information.'
  }

  if (name === 'create_booking') {
    const { category_id, first_name, last_name, phone, email, check_in_date } = input as any
    if (!category_id || !first_name || !last_name || !phone || !check_in_date) {
      return 'Missing required booking fields.'
    }

    // Verify category + availability
    const { data: cat } = await supabase
      .from('room_categories')
      .select('id, name, base_rate, rate_unit, rooms(id, status)')
      .eq('id', category_id)
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .single()

    if (!cat) return 'Room type not found or unavailable.'
    const rooms = Array.isArray(cat.rooms) ? cat.rooms : []
    const availRoom = rooms.find((r: any) => r.status === 'available')
    if (!availRoom) return 'Sorry, no rooms are available in that category right now.'

    // Create or find occupant
    let occupantId: string
    const { data: existing } = await supabase.from('occupants').select('id').eq('tenant_id', tenantId).eq('phone', phone).maybeSingle()
    if (existing) {
      occupantId = existing.id
    } else {
      const { data: newOcc, error: occErr } = await supabase.from('occupants').insert({
        tenant_id:  tenantId, first_name, last_name, phone, email: email ?? null,
        status: 'pending', type: 'guest',
      }).select('id').single()
      if (occErr || !newOcc) return 'Failed to create guest record. Please try again.'
      occupantId = newOcc.id
    }

    const holdExpiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()
    const { data: booking, error: bErr } = await (supabase.from('bookings') as any).insert({
      tenant_id: tenantId, occupant_id: occupantId, room_id: availRoom.id,
      check_in_date, final_amount: cat.base_rate, paid_amount: 0,
      payment_status: 'unpaid', status: 'pending_payment', source: 'voice_ai',
      hold_expires_at: holdExpiresAt,
    }).select('id, booking_ref').single()

    if (bErr || !booking) return 'Failed to create booking. Please try again.'
    await supabase.from('rooms').update({ status: 'reserved' }).eq('id', availRoom.id)

    return JSON.stringify({
      booking_id:  booking.id,
      booking_ref: booking.booking_ref,
      room_type:   cat.name,
      rate:        `GH₵ ${(cat.base_rate / 100).toFixed(2)} / ${cat.rate_unit}`,
      check_in:    check_in_date,
      status:      'Pending phone verification',
    })
  }

  if (name === 'send_otp') {
    const { booking_id, phone } = input as any
    if (!booking_id || !phone) return 'Missing booking_id or phone.'

    // Generate 4-digit OTP
    const otp = String(Math.floor(1000 + Math.random() * 9000))
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

    // Upsert OTP record
    await (supabase.from('booking_otps') as any).upsert({
      tenant_id: tenantId, booking_id, phone, otp_code: otp, expires_at: expiresAt, used_at: null,
    }, { onConflict: 'booking_id' })

    // Send SMS via Arkesel
    const arkeselKey = process.env.ARKESEL_API_KEY
    if (arkeselKey) {
      await fetch('https://sms.arkesel.com/sms/api', {
        method: 'POST',
        headers: { 'api-key': arkeselKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: 'GH Hostels',
          message: `Your GH Hostels booking verification code is: ${otp}. Valid for 10 minutes.`,
          recipients: [phone.replace(/\D/g, '').replace(/^0/, '233')],
        }),
      }).catch(() => {})
    }

    return `OTP sent to ${phone}. Please ask the guest to provide the 4-digit code they received by SMS.`
  }

  if (name === 'verify_otp') {
    const { booking_id, otp_code } = input as any
    if (!booking_id || !otp_code) return 'Missing booking_id or otp_code.'

    const { data: record } = await (supabase.from('booking_otps') as any)
      .select('otp_code, expires_at, used_at')
      .eq('booking_id', booking_id)
      .eq('tenant_id', tenantId)
      .single() as { data: any }

    if (!record) return 'No OTP found for this booking. Please call send_otp first.'
    if (record.used_at) return 'This OTP has already been used.'
    if (new Date(record.expires_at) < new Date()) return 'The OTP has expired. Please send a new one.'
    if (record.otp_code !== String(otp_code).trim()) return 'Incorrect code. Please ask the guest to check the SMS and try again.'

    // Mark OTP used + confirm booking
    await (supabase.from('booking_otps') as any).update({ used_at: new Date().toISOString() }).eq('booking_id', booking_id)
    const { data: updated } = await supabase
      .from('bookings')
      .update({ status: 'confirmed' })
      .eq('id', booking_id)
      .eq('tenant_id', tenantId)
      .select('booking_ref')
      .single()

    return JSON.stringify({
      success:     true,
      booking_ref: updated?.booking_ref,
      message:     'Phone verified! Booking is now confirmed. Payment will be collected at check-in or via MoMo.',
    })
  }

  if (name === 'initiate_payment') {
    const { booking_id, phone, provider } = input as any
    if (!booking_id || !phone || !provider) return 'Missing booking_id, phone, or provider.'

    const paystackKey = process.env.PAYSTACK_SECRET_KEY
    if (!paystackKey) return 'Payment processing is not configured. Please pay at check-in.'

    // Tenant subaccount required to route funds to the hostel's bank
    const { data: tenantRow } = await supabase
      .from('tenants')
      .select('paystack_subaccount_code')
      .eq('id', tenantId)
      .single()

    const tenantSubaccount = tenantRow?.paystack_subaccount_code ?? null
    if (!tenantSubaccount) return 'This hostel has not connected a payout bank yet. Please pay at check-in.'

    // Fetch booking to get amount + ref
    const { data: booking } = await supabase
      .from('bookings')
      .select('id, booking_ref, final_amount, payment_status, occupants(email)')
      .eq('id', booking_id)
      .eq('tenant_id', tenantId)
      .single()

    if (!booking) return 'Booking not found.'
    if (booking.payment_status === 'paid') return 'This booking has already been paid.'

    const email = (booking.occupants as any)?.email ?? `${phone}@momo.guest`
    const amountPesewas = booking.final_amount // stored in pesewas

    // Map provider to payment method
    const providerMethod: Record<string, string> = {
      mtn: 'momo_mtn', vodafone: 'momo_vodafone', airteltigo: 'momo_airteltigo',
    }

    // Create pending booking_payments record so webhook can correlate
    const { data: payment, error: payErr } = await supabase
      .from('booking_payments')
      .insert({
        tenant_id:  tenantId,
        booking_id,
        amount:     amountPesewas,
        method:     (providerMethod[provider] ?? 'mobile_money') as any,
        status:     'pending',
        reference:  null,
      })
      .select('id')
      .single()

    if (payErr || !payment) return 'Failed to create payment record. Please try again or pay at check-in.'

    // Initiate Paystack MoMo charge
    const chargeRes = await fetch('https://api.paystack.co/charge', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${paystackKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount: amountPesewas, // Paystack uses smallest unit (kobo/pesewas)
        currency: 'GHS',
        mobile_money: {
          phone: phone.replace(/\D/g, '').replace(/^0/, '233'),
          provider,
        },
        metadata: {
          booking_id:  booking.id,
          booking_ref: booking.booking_ref,
          tenant_id:   tenantId,
          payment_id:  payment.id,
          source:      'ai_agent',
        },
        subaccount: tenantSubaccount,
        bearer:     'subaccount',
      }),
    })

    const chargeData = await chargeRes.json()

    if (!chargeRes.ok || chargeData.status === false) {
      // Clean up pending record on failure
      await supabase.from('booking_payments').delete().eq('id', payment.id)
      const msg = chargeData.message ?? 'Payment initiation failed'
      return `Payment could not be initiated: ${msg}. Please try again or pay at check-in.`
    }

    const reference = chargeData.data?.reference
    if (reference) {
      // Store reference on both payment record and booking
      await supabase.from('booking_payments').update({ reference }).eq('id', payment.id)
      await (supabase.from('bookings') as any)
        .update({ paystack_reference: reference, payment_status: 'pending' })
        .eq('id', booking_id)
    }

    const displayAmount = `GH₵ ${(amountPesewas / 100).toFixed(2)}`
    return JSON.stringify({
      success:   true,
      reference,
      amount:    displayAmount,
      message:   `A MoMo prompt for ${displayAmount} has been sent to ${phone}. Please check your phone and enter your PIN to complete the payment. Your booking ref is ${booking.booking_ref}.`,
    })
  }

  if (name === 'escalate_to_human') {
    // Log escalation to audit_log
    const reason = String(input.reason ?? 'Guest requested human assistance')
    await supabase.from('audit_log').insert({
      tenant_id:   tenantId,
      action:      'ai_escalation',
      entity_type: 'ai_chat',
      description: reason,
      actor_name:  'AI Agent',
      actor_role:  'system',
    }).throwOnError().then(() => {})  // fire-and-forget

    return `Escalation recorded. A staff member will be in touch soon. Reason: ${reason}`
  }

  return `Unknown tool: ${name}`
}

/* ── Request schema ────────────────────────────────────────────────── */

const messageSchema = z.object({
  role:    z.enum(['user', 'assistant']),
  content: z.string(),
})

const reqSchema = z.object({
  messages: z.array(messageSchema).min(1).max(40),
})

/* ── Route handler (streaming SSE) ────────────────────────────────── */

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'AI not configured (missing ANTHROPIC_API_KEY)' }, { status: 503 })
  }

  const headersList = await headers()
  const tenantId    = headersList.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Fetch hostel context + AI config for the system prompt
  const supabase  = await createClient()
  const { data: tenantData } = await supabase
    .from('tenants')
    .select('name, address_city, ai_config')
    .eq('id', tenantId)
    .single()
  const tenant = tenantData as any

  const hostelName = tenant?.name ?? 'our hostel'
  const hostelCity = tenant?.address_city ?? 'Ghana'

  const aiCfg = (tenant?.ai_config ?? {}) as {
    ai_enabled?:      boolean
    agent_name?:      string
    personality?:     string
    language?:        string
    custom_greeting?: string | null
    tools_enabled?:   Record<string, boolean>
  }

  // Respect ai_enabled flag
  if (aiCfg.ai_enabled === false) {
    return NextResponse.json({ error: 'AI assistant is currently disabled for this hostel.' }, { status: 503 })
  }

  const agentName  = aiCfg.agent_name  ?? 'Ama'
  const language   = aiCfg.language    ?? 'en'
  const personality= aiCfg.personality ?? 'professional'

  // Filter tools by what's enabled in config
  const enabledTools = TOOLS.filter((t) => aiCfg.tools_enabled?.[t.name] !== false)

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = reqSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const personalityGuide = {
    professional: 'Be formal, precise, and business-like. Use complete sentences and avoid slang.',
    friendly:     'Be warm, approachable, and enthusiastic. Use friendly language while remaining professional.',
    casual:       'Be relaxed and conversational. Short sentences are fine. Be like a helpful friend.',
  }[personality] ?? ''

  const languageGuide = language === 'tw'
    ? 'Respond in Twi when the guest writes in Twi. Offer to switch to English if helpful.'
    : 'Respond in English by default. Mirror the language the guest uses.'

  const systemPrompt = `You are ${agentName}, the AI booking assistant for ${hostelName}, a hostel in ${hostelCity}, Ghana.
Your role is to help prospective guests with availability inquiries, pricing, policies, and bookings.
${personalityGuide}
${languageGuide}

Booking flow (follow this order strictly):
1. When a guest wants to book: use check_availability to show available room types.
2. Let the guest choose a room type and confirm their details (name, phone, check-in date).
3. Call create_booking with their details — this creates a provisional hold.
4. Immediately call send_otp to send a verification code to their phone.
5. Ask the guest to share the 4-digit code they received by SMS.
6. Call verify_otp with the code — this confirms the booking.
7. Inform the guest their booking is confirmed and offer two payment options:
   a) Pay now via Mobile Money (MTN MoMo, Vodafone Cash, or AirtelTigo Money)
   b) Pay at check-in
8. If the guest chooses MoMo: ask for their MoMo phone number and network, then call initiate_payment.
   The guest will receive a USSD prompt on their phone to approve — tell them to check their phone and enter their PIN.
9. Once payment is initiated, give the guest their booking reference and wish them a pleasant stay.

Always use tools to look up real data. Never guess availability or prices.
If you cannot resolve an issue, escalate to a human staff member.`

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      function send(chunk: string) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`))
      }

      try {
        let conversationMessages = parsed.data.messages.map((m) => ({
          role: m.role,
          content: m.content,
        }))

        // Agentic loop: allow up to 5 tool-use rounds
        for (let round = 0; round < 5; round++) {
          const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'x-api-key':         apiKey,
              'anthropic-version': '2023-06-01',
              'content-type':      'application/json',
            },
            body: JSON.stringify({
              model:      MODEL,
              max_tokens: MAX_TOKENS,
              system:     systemPrompt,
              messages:   conversationMessages,
              tools:      enabledTools,
              stream:     true,
            }),
          })

          if (!anthropicRes.ok || !anthropicRes.body) {
            const errText = await anthropicRes.text()
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: errText })}\n\n`))
            break
          }

          // Parse SSE from Anthropic
          const reader     = anthropicRes.body.getReader()
          const textDecoder = new TextDecoder()
          let buffer = ''
          let assistantText = ''
          const toolUses: { id: string; name: string; input: string }[] = []
          let currentToolId   = ''
          let currentToolName = ''
          let currentToolInput = ''
          let stopReason = 'end_turn'

          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            buffer += textDecoder.decode(value, { stream: true })

            const lines = buffer.split('\n')
            buffer = lines.pop() ?? ''

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue
              const data = line.slice(6).trim()
              if (data === '[DONE]') continue

              let evt: any
              try { evt = JSON.parse(data) } catch { continue }

              if (evt.type === 'content_block_start' && evt.content_block?.type === 'tool_use') {
                currentToolId   = evt.content_block.id
                currentToolName = evt.content_block.name
                currentToolInput = ''
              }

              if (evt.type === 'content_block_delta') {
                if (evt.delta?.type === 'text_delta') {
                  assistantText += evt.delta.text
                  send(evt.delta.text)
                }
                if (evt.delta?.type === 'input_json_delta') {
                  currentToolInput += evt.delta.partial_json
                }
              }

              if (evt.type === 'content_block_stop' && currentToolId) {
                toolUses.push({ id: currentToolId, name: currentToolName, input: currentToolInput })
                currentToolId = currentToolName = currentToolInput = ''
              }

              if (evt.type === 'message_delta' && evt.delta?.stop_reason) {
                stopReason = evt.delta.stop_reason
              }
            }
          }

          // If no tool use, we're done
          if (toolUses.length === 0 || stopReason === 'end_turn') break

          // Execute tools and continue loop
          conversationMessages.push({
            role: 'assistant',
            content: [
              ...(assistantText ? [{ type: 'text', text: assistantText }] : []),
              ...toolUses.map((t) => ({
                type:  'tool_use',
                id:    t.id,
                name:  t.name,
                input: JSON.parse(t.input || '{}'),
              })),
            ] as any,
          })

          const toolResults = await Promise.all(
            toolUses.map(async (t) => {
              let parsedInput: Record<string, unknown> = {}
              try { parsedInput = JSON.parse(t.input || '{}') } catch {}
              const result = await runTool(t.name, parsedInput, tenantId)
              return { type: 'tool_result', tool_use_id: t.id, content: result }
            })
          )

          conversationMessages.push({ role: 'user', content: toolResults as any })
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`))
      } finally {
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      }
    },
  })

  return new NextResponse(stream, {
    headers: {
      'Content-Type':      'text/event-stream',
      'Cache-Control':     'no-cache',
      'X-Accel-Buffering': 'no',
    },
  })
}
