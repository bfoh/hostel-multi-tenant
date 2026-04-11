import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getServerTenantId } from '@/lib/auth/tenant'

// POST /api/staff/[id]/invite — create Supabase auth account and send invite email
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const tenantId = await getServerTenantId()
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const admin = createAdminClient()

  // Fetch the staff record (admin client bypasses RLS)
  const { data: staff, error: staffError } = await admin
    .from('staff_profiles')
    .select('id, first_name, last_name, email, user_id, member:tenant_members(role)')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (staffError || !staff) {
    return NextResponse.json({ error: 'Staff member not found' }, { status: 404 })
  }
  if (!staff.email) {
    return NextResponse.json({ error: 'Staff member has no email address' }, { status: 422 })
  }
  if (staff.user_id) {
    return NextResponse.json({ error: 'Staff member already has a login account' }, { status: 409 })
  }

  // Invite via Supabase Admin API (sends magic-link email)
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    staff.email,
    {
      data: {
        first_name:  staff.first_name,
        last_name:   staff.last_name,
        portal_type: 'staff',
        tenant_id:   tenantId,
      },
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/auth/invite`,
    }
  )

  if (inviteError) {
    if (inviteError.message.includes('already been registered')) {
      return NextResponse.json({ error: 'A user with this email already exists. Ask them to use the login page.' }, { status: 409 })
    }
    return NextResponse.json({ error: inviteError.message }, { status: 500 })
  }

  const authUserId = invited.user.id

  // Upsert tenant_members so JWT hook picks up tenant context on login
  const memberRec = Array.isArray(staff.member) ? staff.member[0] : staff.member
  const staffRole = (memberRec as any)?.role ?? 'staff'
  await admin
    .from('tenant_members')
    .upsert({
      tenant_id: tenantId,
      user_id:   authUserId,
      role:      staffRole,
      is_active: true,
    }, { onConflict: 'tenant_id,user_id' })

  // Link auth user to staff record
  await admin
    .from('staff_profiles')
    .update({ user_id: authUserId })
    .eq('id', id)
    .eq('tenant_id', tenantId)

  return NextResponse.json({ ok: true, message: `Invite sent to ${staff.email}` }, { status: 200 })
}
