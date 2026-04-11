import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { type, feedback, ratings, comment, user_id, user_email } = body

    const supabase = createAdminClient()

    await supabase.from('platform_feedback').insert({
      type,
      feedback: feedback || null,
      ratings: ratings || null,
      comment: comment || null,
      user_id: user_id || null,
      user_email: user_email || null,
    })

    return NextResponse.json({ ok: true })
  } catch {
    // Don't fail the user experience if storage fails
    return NextResponse.json({ ok: true })
  }
}
