import { redirect } from 'next/navigation'
import { headers } from 'next/headers'

/**
 * Root index route.
 * - On a tenant domain → redirect straight to the dashboard
 * - On the platform app domain → redirect to login
 */
export default async function RootPage() {
  const headersList = await headers()
  const tenantId = headersList.get('x-tenant-id')

  if (tenantId) {
    redirect('/dashboard')
  }

  redirect('/login')
}
