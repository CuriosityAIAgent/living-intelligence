import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

// Valid invite codes and their tiers
const VALID_CODES: Record<string, { tier: string; maxSeats: number }> = {
  'FRIEND2026': { tier: 'founding', maxSeats: 5 },
}

export async function POST(request: Request) {
  try {
    const { code, fullName, company } = await request.json()

    // Validate invite code
    const codeConfig = VALID_CODES[code?.toUpperCase()]
    if (!codeConfig) {
      return NextResponse.json({ error: 'Invalid invitation code' }, { status: 400 })
    }

    if (!fullName?.trim() || !company?.trim()) {
      return NextResponse.json({ error: 'Name and company are required' }, { status: 400 })
    }

    // Get the authenticated user
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated. Please sign in first.' }, { status: 401 })
    }

    const admin = createAdminClient()

    // Check if user already has an org
    const { data: existingProfile } = await admin
      .from('user_profiles')
      .select('org_id')
      .eq('id', user.id)
      .single()

    if (existingProfile?.org_id) {
      // Already has org — just redirect
      return NextResponse.json({ success: true, message: 'Already activated' })
    }

    // Create organization
    const { data: org, error: orgError } = await admin
      .from('organizations')
      .insert({
        name: company.trim(),
        tier: codeConfig.tier,
        max_seats: codeConfig.maxSeats,
        status: 'active',
      })
      .select('id')
      .single()

    if (orgError) {
      console.error('Org creation error:', orgError)
      return NextResponse.json({ error: 'Failed to create organization' }, { status: 500 })
    }

    // Update user profile with name, company, org, and admin role
    const { error: profileError } = await admin
      .from('user_profiles')
      .upsert({
        id: user.id,
        email: user.email!,
        full_name: fullName.trim(),
        company: company.trim(),
        org_id: org.id,
        role: 'admin',
      }, { onConflict: 'id' })

    if (profileError) {
      console.error('Profile update error:', profileError)
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
    }

    // Update auth user metadata
    await admin.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...user.user_metadata,
        full_name: fullName.trim(),
        company: company.trim(),
      },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Invite activation error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
