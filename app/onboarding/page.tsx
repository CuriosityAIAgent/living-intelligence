'use client'

import { createClient } from '@/lib/supabase'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function OnboardingPage() {
  const supabase = createClient()
  const router = useRouter()
  const [user, setUser] = useState<{ id: string; email: string } | null>(null)
  const [emails, setEmails] = useState(['', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [hasOrg, setHasOrg] = useState(false)

  useEffect(() => {
    async function checkUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setUser({ id: user.id, email: user.email || '' })

      // Check if user already has a profile with an org
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('org_id')
        .eq('id', user.id)
        .single()

      if (profile?.org_id) {
        setHasOrg(true)
      }

      // Ensure user profile exists
      const { error: upsertError } = await supabase
        .from('user_profiles')
        .upsert({
          id: user.id,
          email: user.email || '',
          full_name: user.user_metadata?.full_name || user.user_metadata?.name || null,
        }, { onConflict: 'id' })

      if (upsertError) {
        console.error('Profile upsert error:', upsertError)
      }
    }
    checkUser()
  }, [supabase, router])

  async function handleAddTeam() {
    const validEmails = emails.filter(e => e.trim() && e.includes('@'))
    if (validEmails.length === 0) {
      router.push('/')
      return
    }

    setLoading(true)
    setMessage(`Inviting ${validEmails.length} team member${validEmails.length > 1 ? 's' : ''}...`)

    // Get the user's org
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('org_id')
      .eq('id', user?.id)
      .single()

    if (!profile?.org_id) {
      setMessage('Your organization is still being set up. Please try again in a moment.')
      setLoading(false)
      return
    }

    // Create placeholder profiles for invited team members
    // They'll be linked to auth.users when they first sign in
    for (const email of validEmails) {
      const { error } = await supabase.rpc('invite_team_member', {
        p_email: email,
        p_org_id: profile.org_id,
      })
      if (error) {
        console.error(`Failed to invite ${email}:`, error)
      }
    }

    setMessage('Team invited! Redirecting...')
    setTimeout(() => router.push('/'), 1500)
  }

  function handleSkip() {
    router.push('/')
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#FDF8F2] flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FDF8F2] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-[#990F3D] mb-2">
            Living Intelligence
          </div>
          <h1 className="text-2xl font-bold text-[#1C1C2E]">
            Welcome
          </h1>
          <p className="text-sm text-gray-500 mt-2">
            {hasOrg
              ? 'Add your team members (up to 5 seats per organization)'
              : 'Your organization is being set up. This usually takes a few seconds after checkout.'}
          </p>
        </div>

        {hasOrg ? (
          <>
            <div className="space-y-3 mb-6">
              {emails.map((email, i) => (
                <input
                  key={i}
                  type="email"
                  value={email}
                  onChange={e => {
                    const next = [...emails]
                    next[i] = e.target.value
                    setEmails(next)
                  }}
                  placeholder={`team-member-${i + 1}@company.com`}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#990F3D] focus:border-transparent"
                />
              ))}
            </div>

            <button
              onClick={handleAddTeam}
              disabled={loading}
              className="w-full bg-[#1C1C2E] text-white rounded-lg px-4 py-3 text-sm font-medium hover:bg-[#2a2a40] transition-colors disabled:opacity-50"
            >
              {loading ? 'Setting up...' : 'Add team & continue'}
            </button>

            <button
              onClick={handleSkip}
              className="w-full text-center text-xs text-gray-400 mt-3 hover:text-gray-600 transition-colors"
            >
              Skip — I'll add team members later
            </button>
          </>
        ) : (
          <div className="text-center">
            <div className="animate-pulse text-gray-400 mb-4">Setting up your organization...</div>
            <button
              onClick={() => window.location.reload()}
              className="text-sm text-[#990F3D] hover:underline"
            >
              Refresh
            </button>
          </div>
        )}

        {message && (
          <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 text-center">
            {message}
          </div>
        )}
      </div>
    </div>
  )
}
