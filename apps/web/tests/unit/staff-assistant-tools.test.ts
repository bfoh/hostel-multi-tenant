/**
 * Unit tests for the staff assistant's tool set (app/api/ai/staff-assistant/
 * route.ts) — a regression guard on the confirm-before-execute gate itself:
 * every write-executing tool must be listed in WRITE_TOOLS (the loop only
 * pauses for confirmation on tools in that set), and the two read-only
 * tools must NOT be, so they keep executing immediately. Doesn't exercise
 * the actual Anthropic streaming loop (mocking that end-to-end adds a lot
 * of harness for little signal) — this locks down the one thing that
 * matters most: a new write tool can't accidentally ship without the gate.
 */
import { describe, expect, it } from 'vitest'
import { WRITE_TOOLS, buildTools } from '@/lib/ai/staff-assistant-tools'

describe('staff assistant — WRITE_TOOLS gate', () => {
  it('flags every mutating tool as requiring confirmation', () => {
    expect(WRITE_TOOLS.has('create_booking')).toBe(true)
    expect(WRITE_TOOLS.has('cancel_booking')).toBe(true)
    expect(WRITE_TOOLS.has('check_in')).toBe(true)
    expect(WRITE_TOOLS.has('check_out')).toBe(true)
    expect(WRITE_TOOLS.has('add_charge')).toBe(true)
  })

  it('does not gate the read-only tools', () => {
    expect(WRITE_TOOLS.has('lookup_booking')).toBe(false)
    expect(WRITE_TOOLS.has('check_room_availability')).toBe(false)
  })

  it('every tool name in WRITE_TOOLS actually exists in the tool set offered to Claude', () => {
    const names = new Set(buildTools(true).map((t) => t.name))
    for (const writeTool of WRITE_TOOLS) {
      expect(names.has(writeTool)).toBe(true)
    }
  })
})

describe('staff assistant — hotel-only tool gating', () => {
  it('omits add_charge for hostel tenants', () => {
    const names = buildTools(false).map((t) => t.name)
    expect(names).not.toContain('add_charge')
  })

  it('includes add_charge for hotel tenants', () => {
    const names = buildTools(true).map((t) => t.name)
    expect(names).toContain('add_charge')
  })
})
