import { createServerSupabaseClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

const SITE = process.env.NEXT_PUBLIC_SUPABASE_URL ? 'https://livingintel.ai' : 'http://localhost:3002'

async function handleSignOut() {
  const supabase = await createServerSupabaseClient()
  await supabase.auth.signOut()
  return NextResponse.redirect(new URL('/', SITE))
}

export const GET = handleSignOut
export const POST = handleSignOut
