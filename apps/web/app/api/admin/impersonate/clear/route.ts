import { NextResponse } from 'next/server'

/**
 * GET /api/admin/impersonate/clear
 * Convenient browser-navigable route that clears impersonation and redirects to admin panel.
 */
export async function GET() {
  const response = NextResponse.redirect(new URL('/admin', process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'))
  response.cookies.delete('x-admin-impersonate-tenant')
  response.cookies.delete('x-admin-impersonate-slug')
  return response
}
