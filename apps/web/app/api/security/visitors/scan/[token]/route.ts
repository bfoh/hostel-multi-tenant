import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/security/visitors/scan/[token]
 * Called when a guard scans a visitor QR code.
 * Marks the pass as used and logs the check-in time.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const admin = createAdminClient()

  const { data: visitor } = await admin
    .from('visitor_logs')
    .select('id, visitor_name, host_name, purpose, pass_status, pass_used_at, checked_in_at')
    .eq('pass_token', token)
    .maybeSingle()

  if (!visitor) {
    return new Response(buildPage('Invalid Pass', '⚠️ This visitor pass is not valid.', '#dc2626'), {
      headers: { 'Content-Type': 'text/html' },
    })
  }

  if (visitor.pass_status === 'revoked') {
    return new Response(buildPage('Revoked', '🚫 This visitor pass has been revoked.', '#dc2626'), {
      headers: { 'Content-Type': 'text/html' },
    })
  }

  if (visitor.pass_status === 'used') {
    const usedAt = visitor.pass_used_at
      ? new Date(visitor.pass_used_at).toLocaleString('en-GH')
      : ''
    return new Response(
      buildPage('Already Used', `⚠️ This pass was already scanned${usedAt ? ` at ${usedAt}` : ''}.`, '#d97706'),
      { headers: { 'Content-Type': 'text/html' } }
    )
  }

  // Mark as used
  await admin
    .from('visitor_logs')
    .update({
      pass_status:  'used',
      pass_used_at: new Date().toISOString(),
      checked_in_at: visitor.checked_in_at ?? new Date().toISOString(),
    })
    .eq('pass_token', token)

  const html = buildPage(
    'Access Granted',
    `✅ Welcome, <strong>${visitor.visitor_name}</strong>!<br>
     Visiting: <strong>${visitor.host_name ?? '—'}</strong><br>
     Purpose: ${visitor.purpose ?? '—'}`,
    '#16a34a'
  )

  return new Response(html, { headers: { 'Content-Type': 'text/html' } })
}

function buildPage(title: string, body: string, color: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; align-items: center;
           justify-content: center; min-height: 100vh; margin: 0; background: #f9fafb; }
    .card { background: white; border-radius: 1rem; padding: 2rem; text-align: center;
            box-shadow: 0 4px 24px rgba(0,0,0,.08); max-width: 360px; width: 90%; }
    h1 { font-size: 1.5rem; font-weight: 700; color: ${color}; margin-bottom: 1rem; }
    p  { font-size: 1rem; color: #374151; line-height: 1.6; }
    .time { margin-top: 1.5rem; font-size: .8rem; color: #9ca3af; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p>${body}</p>
    <div class="time">${new Date().toLocaleString('en-GH')}</div>
  </div>
</body>
</html>`
}
