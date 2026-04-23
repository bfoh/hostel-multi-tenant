/**
 * Fetch a tenant's notification template (DB override) and render {{vars}}.
 * Falls back to the baked-in default from defaults.ts when no active override exists.
 */

import { createClient } from '@/lib/supabase/server'
import {
  DEFAULT_TEMPLATES,
  type EventType,
  type Channel,
} from './defaults'

export interface RenderedTemplate {
  subject: string | null
  body:    string
}

export type TemplateVars = Record<string, string | number | null | undefined>

/** Replace `{{var}}` with the value from `vars`. Missing values stay as-is. */
export function renderTemplate(body: string, vars: TemplateVars): string {
  return body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    const v = vars[key]
    return v === undefined || v === null ? `{{${key}}}` : String(v)
  })
}

/**
 * Resolve the template for (tenant, event, channel):
 *   1. Tenant override in `notification_templates` (if `is_active`)
 *   2. System default from DEFAULT_TEMPLATES
 *   3. Returns null if no default exists for this combination.
 */
export async function resolveTemplate(
  tenantId: string,
  event: EventType,
  channel: Channel,
): Promise<{ subject: string | null; body: string } | null> {
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('notification_templates')
      .select('subject, body, is_active')
      .eq('tenant_id',  tenantId)
      .eq('event_type', event)
      .eq('channel',    channel)
      .maybeSingle()

    if (data?.is_active && data.body) {
      return { subject: data.subject ?? null, body: data.body }
    }
  } catch {
    // fall through to baked-in default
  }

  const fallback = DEFAULT_TEMPLATES.find(
    (t) => t.event_type === event && t.channel === channel,
  )
  if (!fallback) return null

  return { subject: fallback.subject ?? null, body: fallback.body }
}

/** Resolve + render in one call. */
export async function renderNotification(
  tenantId: string,
  event: EventType,
  channel: Channel,
  vars: TemplateVars,
): Promise<RenderedTemplate | null> {
  const tpl = await resolveTemplate(tenantId, event, channel)
  if (!tpl) return null
  return {
    subject: tpl.subject ? renderTemplate(tpl.subject, vars) : null,
    body:    renderTemplate(tpl.body, vars),
  }
}
