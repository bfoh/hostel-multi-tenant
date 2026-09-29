/**
 * Staff AI Assistant — streaming endpoint, tool-calling agent for signed-in
 * staff (not the guest-facing widget at /api/ai/chat, which has zero auth
 * and executes every tool immediately with no confirmation — unacceptable
 * for a tool set with this much reach). Reuses that route's Anthropic
 * fetch/SSE loop pattern, but:
 *   - gated by requireTenantRole() — every request re-verifies the caller
 *     is an active tenant member before anything else runs.
 *   - every write-executing tool pauses the loop and asks the client to
 *     get explicit staff confirmation before it actually runs (see
 *     WRITE_TOOLS / the `resolvedToolUse` request field below).
 *   - every executed write is logged to audit_log.
 *   - tools call into the SAME logic other authenticated routes use
 *     (createBooking, resolveOccupant) rather than reimplementing booking
 *     rules a second time.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'
import { requireTenantRole } from '@/lib/auth/tenant-role'
import { createBooking } from '@/lib/bookings/create-booking'
import { resolveOccupant } from '@/lib/bookings/resolve-occupant'
import { getAvailableRooms } from '@/lib/data/bookings'

const MODEL = 'claude-haiku-4-5-20251001'
const MAX_TOKENS = 1024
const STAFF_ROLES = ['owner', 'manager', 'receptionist'] as const

/** Tools in this set never execute inline — the loop always pauses for staff confirmation first. */
export const WRITE_TOOLS = new Set(['create_booking', 'cancel_booking', 'add_charge', 'check_in', 'check_out'])

/* ── Tool definitions ──────────────────────────────────────────────── */

export function buildTools(isHotel: boolean) {
  const tools = [
    {
      name: 'lookup_booking',
      description: 'Look up a booking by its reference number. Use this to answer questions about an existing booking or before cancelling/checking a guest in or out.',
      input_schema: {
        type: 'object',
        properties: { booking_ref: { type: 'string', description: 'Booking reference, e.g. ABR-2026-123456' } },
        required: ['booking_ref'],
      },
    },
    {
      name: 'check_room_availability',
      description: 'Check which rooms are available for a date range.',
      input_schema: {
        type: 'object',
        properties: {
          check_in_date:  { type: 'string', description: 'ISO date YYYY-MM-DD' },
          check_out_date: { type: 'string', description: 'ISO date YYYY-MM-DD' },
        },
        required: ['check_in_date', 'check_out_date'],
      },
    },
    {
      name: 'create_booking',
      description: 'Create a new booking for a guest. Requires an available room number (from check_room_availability) and the guest\'s details. This is a real, billable action — confirm the details with the staff member before calling it.',
      input_schema: {
        type: 'object',
        properties: {
          room_number:     { type: 'string', description: 'Room number, e.g. "101"' },
          check_in_date:   { type: 'string', description: 'ISO date YYYY-MM-DD' },
          check_out_date:  { type: 'string', description: 'ISO date YYYY-MM-DD' },
          guest_first_name:{ type: 'string' },
          guest_last_name: { type: 'string' },
          guest_phone:     { type: 'string', description: 'Guest phone number, e.g. 0244000000' },
          guest_email:     { type: 'string' },
        },
        required: ['room_number', 'check_in_date', 'check_out_date', 'guest_first_name', 'guest_last_name', 'guest_phone'],
      },
    },
    {
      name: 'cancel_booking',
      description: 'Cancel an existing booking. This is irreversible — confirm with staff before calling it.',
      input_schema: {
        type: 'object',
        properties: {
          booking_ref: { type: 'string' },
          reason:      { type: 'string', description: 'Why the booking is being cancelled' },
        },
        required: ['booking_ref', 'reason'],
      },
    },
    {
      name: 'check_in',
      description: 'Check a guest in for their booking (booking must be confirmed).',
      input_schema: {
        type: 'object',
        properties: { booking_ref: { type: 'string' } },
        required: ['booking_ref'],
      },
    },
    {
      name: 'check_out',
      description: 'Check a guest out of their booking.',
      input_schema: {
        type: 'object',
        properties: { booking_ref: { type: 'string' } },
        required: ['booking_ref'],
      },
    },
  ]

  // Folio charges are a hotel-only concept — omit the tool entirely for
  // hostel tenants rather than let the model offer something that'll 403.
  if (isHotel) {
    tools.push({
      name: 'add_charge',
      description: 'Add a folio charge (minibar, room service, laundry, etc.) to a booking.',
      input_schema: {
        type: 'object',
        properties: {
          booking_ref:    { type: 'string' },
          description:    { type: 'string', description: 'e.g. "2x Coca-Cola"' },
          category:       { type: 'string', enum: ['food_beverage', 'room_service', 'minibar', 'laundry', 'phone_internet', 'parking', 'other'] },
          amount_ghs:     { type: 'number', description: 'Total charge amount in GHS, e.g. 25.50' },
        },
        required: ['booking_ref', 'description', 'category', 'amount_ghs'],
      },
    } as any)
  }

  return tools
}

/* ── Tool execution ────────────────────────────────────────────────── */

interface ToolCtx {
  supabase: Awaited<ReturnType<typeof createTenantAdminClientFromHeaders>>
  tenantId: string
  userId: string
}

async function findBookingByRef(ctx: ToolCtx, ref: string) {
  const { data } = await ctx.supabase
    .from('bookings')
    .select('id, booking_ref, status, room_id, occupant_id')
    .eq('tenant_id', ctx.tenantId)
    .ilike('booking_ref', ref.trim())
    .maybeSingle()
  return data
}

/** Mirrors the room-status sync pattern used by the status/reassign routes — simplified, no email/housekeeping side effects. */
async function syncRoomStatus(ctx: ToolCtx, roomId: string | null) {
  if (!roomId) return
  const { data: room } = await ctx.supabase
    .from('rooms')
    .select('category:room_categories(capacity)')
    .eq('id', roomId)
    .single()
  const cat = Array.isArray((room as any)?.category) ? (room as any).category[0] : (room as any)?.category
  const capacity = cat?.capacity ?? 1
  const { count } = await ctx.supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('room_id', roomId)
    .in('status', ['pending_payment', 'confirmed', 'checked_in'])
  const active = count ?? 0
  const status = active === 0 ? 'available' : active >= capacity ? 'occupied' : 'reserved'
  await (ctx.supabase.from('rooms') as any).update({ status }).eq('id', roomId)
}

async function runTool(name: string, input: Record<string, unknown>, ctx: ToolCtx): Promise<string> {
  const { supabase, tenantId, userId } = ctx

  if (name === 'lookup_booking') {
    const booking = await findBookingByRef(ctx, String(input.booking_ref ?? ''))
    if (!booking) return 'No booking found with that reference.'
    const { data: full } = await supabase
      .from('bookings')
      .select(`
        booking_ref, status, payment_status, check_in_date, check_out_date, final_amount, paid_amount,
        occupant:occupants(first_name, last_name, phone),
        room:rooms(room_number)
      `)
      .eq('id', booking.id)
      .single()
    return JSON.stringify(full)
  }

  if (name === 'check_room_availability') {
    const rooms = await getAvailableRooms(String(input.check_in_date), String(input.check_out_date))
    if (rooms.length === 0) return 'No rooms available for those dates.'
    return rooms.map((r: any) => {
      const cat = Array.isArray(r.category) ? r.category[0] : r.category
      return `Room ${r.room_number}${r.block ? ` (${r.block})` : ''} — ${cat?.name ?? 'Standard'}, GH₵${((cat?.base_rate ?? 0) / 100).toFixed(2)}/${cat?.rate_unit ?? 'night'}, ${r.spotsRemaining} spot(s) left`
    }).join('\n')
  }

  if (name === 'create_booking') {
    const { room_number, check_in_date, check_out_date, guest_first_name, guest_last_name, guest_phone, guest_email } = input as any
    const { data: room } = await supabase
      .from('rooms')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('room_number', String(room_number))
      .maybeSingle()
    if (!room) return `No room numbered "${room_number}" found.`

    const occupantId = await resolveOccupant(supabase, tenantId, {
      firstName: guest_first_name, lastName: guest_last_name, phone: guest_phone, email: guest_email || undefined,
    })

    const result = await createBooking(supabase, tenantId, {
      occupant_id: occupantId, room_id: room.id, check_in_date, check_out_date,
      source: 'phone', receivedBy: userId,
    })

    if (!result.ok) return `Booking failed: ${result.error}`

    await (supabase.from('audit_log') as any).insert({
      tenant_id: tenantId, action: 'ai_agent.create_booking', entity_type: 'booking', entity_id: result.bookingId,
      actor_name: 'AI Staff Assistant', actor_role: 'system', new_values: { ...input, approved_by: userId },
    }).catch(() => {})

    return JSON.stringify({ booking_ref: result.bookingRef, room: result.roomNumber, status: result.status })
  }

  if (name === 'cancel_booking') {
    const booking = await findBookingByRef(ctx, String(input.booking_ref ?? ''))
    if (!booking) return 'No booking found with that reference.'
    if (booking.status === 'cancelled') return 'That booking is already cancelled.'

    await (supabase.from('bookings') as any)
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString(), cancellation_reason: String(input.reason ?? '') })
      .eq('id', booking.id)
    await syncRoomStatus(ctx, booking.room_id)

    await (supabase.from('audit_log') as any).insert({
      tenant_id: tenantId, action: 'ai_agent.cancel_booking', entity_type: 'booking', entity_id: booking.id,
      actor_name: 'AI Staff Assistant', actor_role: 'system', new_values: { ...input, approved_by: userId },
    }).catch(() => {})

    return `Booking ${booking.booking_ref} cancelled.`
  }

  if (name === 'check_in' || name === 'check_out') {
    const booking = await findBookingByRef(ctx, String(input.booking_ref ?? ''))
    if (!booking) return 'No booking found with that reference.'
    const nextStatus = name === 'check_in' ? 'checked_in' : 'checked_out'
    if (name === 'check_in' && booking.status !== 'confirmed') return 'Only a confirmed booking can be checked in.'
    if (name === 'check_out' && booking.status !== 'checked_in') return 'Only a checked-in booking can be checked out.'

    await (supabase.from('bookings') as any)
      .update({
        status: nextStatus,
        ...(name === 'check_in' ? { actual_check_in: new Date().toISOString() } : { actual_check_out: new Date().toISOString() }),
      })
      .eq('id', booking.id)
    await syncRoomStatus(ctx, booking.room_id)

    await (supabase.from('audit_log') as any).insert({
      tenant_id: tenantId, action: `ai_agent.${name}`, entity_type: 'booking', entity_id: booking.id,
      actor_name: 'AI Staff Assistant', actor_role: 'system', new_values: { ...input, approved_by: userId },
    }).catch(() => {})

    return `Booking ${booking.booking_ref} ${nextStatus === 'checked_in' ? 'checked in' : 'checked out'}.`
  }

  if (name === 'add_charge') {
    const booking = await findBookingByRef(ctx, String(input.booking_ref ?? ''))
    if (!booking) return 'No booking found with that reference.'
    const amountPesewas = Math.round(Number((input as any).amount_ghs) * 100)
    if (!Number.isFinite(amountPesewas) || amountPesewas <= 0) return 'Invalid amount.'

    const { error } = await (supabase.from('booking_charges') as any).insert({
      tenant_id: tenantId, booking_id: booking.id,
      description: String((input as any).description), category: (input as any).category,
      quantity: 1, unit_price: amountPesewas,  // amount is a generated column — never set it directly
      paid: false, notes: null, created_by: userId,
    })
    if (error) return `Failed to add charge: ${error.message}`

    await (supabase.from('audit_log') as any).insert({
      tenant_id: tenantId, action: 'ai_agent.add_charge', entity_type: 'booking', entity_id: booking.id,
      actor_name: 'AI Staff Assistant', actor_role: 'system', new_values: { ...input, approved_by: userId },
    }).catch(() => {})

    return `Charge of GH₵${((input as any).amount_ghs).toFixed(2)} added to booking ${booking.booking_ref}.`
  }

  return `Unknown tool: ${name}`
}

/* ── Request schema ────────────────────────────────────────────────── */

const contentBlockSchema = z.union([
  z.string(),
  z.array(z.object({ type: z.string() }).passthrough()),
])

const messageSchema = z.object({
  role:    z.enum(['user', 'assistant']),
  content: contentBlockSchema,
})

const reqSchema = z.object({
  messages: z.array(messageSchema).min(1).max(60),
  resolvedToolUse: z.object({
    id:       z.string(),
    name:     z.string(),
    input:    z.record(z.string(), z.unknown()),
    approved: z.boolean(),
  }).optional(),
})

/* ── Route handler (streaming SSE) ────────────────────────────────── */

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'AI not configured (missing ANTHROPIC_API_KEY)' }, { status: 503 })
  }

  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const roleCtx = await requireTenantRole(tenantId, STAFF_ROLES)
  if (roleCtx instanceof NextResponse) return roleCtx

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const parsed = reqSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const supabase = await createTenantAdminClientFromHeaders()
  const { data: tenant } = await supabase.from('tenants').select('name, business_type').eq('id', tenantId).single()
  const isHotel = tenant?.business_type === 'hotel'
  const tools = buildTools(isHotel)
  const ctx: ToolCtx = { supabase, tenantId, userId: roleCtx.userId }

  const systemPrompt = `You are the staff assistant for ${tenant?.name ?? 'this property'}, helping front-desk staff manage bookings by chat.
Use tools to look up real data — never guess booking status, availability, or amounts.
Before creating, cancelling, checking in/out, or charging anything, make sure you have the details right; the system will ask the staff member to confirm any action that changes data before it actually runs.
Be concise — staff are working quickly at a front desk.`

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      function send(payload: Record<string, unknown>) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))
      }

      try {
        const conversationMessages: any[] = parsed.data.messages.map((m) => ({ role: m.role, content: m.content }))

        // Resuming after a staff confirm/cancel decision: execute (or skip)
        // the pending tool call, inject its result, then fall through to
        // the normal loop below to get Claude's next response.
        if (parsed.data.resolvedToolUse) {
          const { id, name, input, approved } = parsed.data.resolvedToolUse
          const result = approved
            ? await runTool(name, input, ctx)
            : 'This action was not approved by the staff member. Do not retry it without asking again.'
          conversationMessages.push({
            role: 'user',
            content: [{ type: 'tool_result', tool_use_id: id, content: result }],
          })
        }

        for (let round = 0; round < 5; round++) {
          const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'x-api-key':         apiKey,
              'anthropic-version': '2023-06-01',
              'content-type':      'application/json',
            },
            body: JSON.stringify({
              model: MODEL, max_tokens: MAX_TOKENS, system: systemPrompt,
              messages: conversationMessages, tools, stream: true,
            }),
          })

          if (!anthropicRes.ok || !anthropicRes.body) {
            send({ error: await anthropicRes.text() })
            break
          }

          const reader = anthropicRes.body.getReader()
          const decoder = new TextDecoder()
          let buffer = ''
          let assistantText = ''
          const toolUses: { id: string; name: string; input: string }[] = []
          let currentToolId = '', currentToolName = '', currentToolInput = ''
          let stopReason = 'end_turn'

          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() ?? ''

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue
              const data = line.slice(6).trim()
              if (data === '[DONE]') continue
              let evt: any
              try { evt = JSON.parse(data) } catch { continue }

              if (evt.type === 'content_block_start' && evt.content_block?.type === 'tool_use') {
                currentToolId = evt.content_block.id
                currentToolName = evt.content_block.name
                currentToolInput = ''
              }
              if (evt.type === 'content_block_delta') {
                if (evt.delta?.type === 'text_delta') {
                  assistantText += evt.delta.text
                  send({ text: evt.delta.text })
                }
                if (evt.delta?.type === 'input_json_delta') currentToolInput += evt.delta.partial_json
              }
              if (evt.type === 'content_block_stop' && currentToolId) {
                toolUses.push({ id: currentToolId, name: currentToolName, input: currentToolInput })
                currentToolId = currentToolName = currentToolInput = ''
              }
              if (evt.type === 'message_delta' && evt.delta?.stop_reason) stopReason = evt.delta.stop_reason
            }
          }

          if (toolUses.length === 0 || stopReason === 'end_turn') break

          // A write-tool call always pauses here for confirmation — even if
          // Claude requested several tools in one turn, take the first
          // sensitive one and stop; the rest can be re-requested after.
          const pending = toolUses.find((t) => WRITE_TOOLS.has(t.name))
          if (pending) {
            let pendingInput: Record<string, unknown> = {}
            try { pendingInput = JSON.parse(pending.input || '{}') } catch {}
            send({ confirm: { id: pending.id, name: pending.name, input: pendingInput } })
            break
          }

          // All tool calls this round are read-only — run them immediately.
          conversationMessages.push({
            role: 'assistant',
            content: [
              ...(assistantText ? [{ type: 'text', text: assistantText }] : []),
              ...toolUses.map((t) => ({ type: 'tool_use', id: t.id, name: t.name, input: JSON.parse(t.input || '{}') })),
            ],
          })
          const toolResults = await Promise.all(
            toolUses.map(async (t) => {
              let toolInput: Record<string, unknown> = {}
              try { toolInput = JSON.parse(t.input || '{}') } catch {}
              const result = await runTool(t.name, toolInput, ctx)
              return { type: 'tool_result', tool_use_id: t.id, content: result }
            }),
          )
          conversationMessages.push({ role: 'user', content: toolResults })
        }
      } catch (err) {
        send({ error: err instanceof Error ? err.message : 'Unknown error' })
      } finally {
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      }
    },
  })

  return new NextResponse(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no' },
  })
}
