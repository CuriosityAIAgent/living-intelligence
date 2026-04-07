'use client'

import { createClient } from '@/lib/supabase'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function OnboardingPage() {
  const supabase = createClient()
  const router = useRouter()

  const [user, setUser] = useState<{ id: string; email: string; name: string; company: string } | null>(null)
  const [step, setStep] = useState<'loading' | 'profile' | 'team' | 'waiting'>('loading')

  // Profile fields
  const [fullName, setFullName] = useState('')
  const [company, setCompany] = useState('')

  // Team fields
  const [emails, setEmails] = useState(['', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    async function init() {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) { router.push('/login'); return }

      const name = authUser.user_metadata?.full_name || authUser.user_metadata?.name || ''
      const comp = authUser.user_metadata?.company || ''

      setUser({ id: authUser.id, email: authUser.email || '', name, company: comp })
      setFullName(name)
      setCompany(comp)

      // Check profile state
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('full_name, company, org_id')
        .eq('id', authUser.id)
        .single()

      // Ensure profile exists
      await supabase
        .from('user_profiles')
        .upsert({
          id: authUser.id,
          email: authUser.email || '',
          full_name: name || profile?.full_name || null,
          company: comp || profile?.company || null,
        }, { onConflict: 'id' })

      const hasName = profile?.full_name || name
      const hasCompany = profile?.company || comp
      const hasOrg = !!profile?.org_id

      if (!hasName || !hasCompany) {
        setStep('profile')
      } else if (hasOrg) {
        setStep('team')
      } else {
        setStep('waiting')
      }
    }
    init()
  }, [supabase, router])

  async function handleProfileSave() {
    if (!fullName.trim()) { setError('Please enter your name'); return }
    if (!company.trim()) { setError('Please enter your company'); return }

    setLoading(true)
    setError('')

    // Update auth metadata
    await supabase.auth.updateUser({
      data: { full_name: fullName, company },
    })

    // Update profile table
    await supabase
      .from('user_profiles')
      .update({ full_name: fullName, company })
      .eq('id', user?.id)

    // Check if org exists (from Stripe webhook)
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('org_id')
      .eq('id', user?.id)
      .single()

    setLoading(false)

    if (profile?.org_id) {
      setStep('team')
    } else {
      setStep('waiting')
    }
  }

  async function handleAddTeam() {
    const validEmails = emails.filter(e => e.trim() && e.includes('@'))
    if (validEmails.length === 0) {
      router.push('/intelligence')
      return
    }

    setLoading(true)
    setMessage(`Inviting ${validEmails.length} team member${validEmails.length > 1 ? 's' : ''}...`)

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

    for (const email of validEmails) {
      const { error } = await supabase.rpc('invite_team_member', {
        p_email: email,
        p_org_id: profile.org_id,
      })
      if (error) console.error(`Failed to invite ${email}:`, error)
    }

    setMessage('Team invited! Redirecting...')
    setTimeout(() => router.push('/intelligence'), 1500)
  }

  if (step === 'loading') {
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
          <h1 className="text-2xl font-bold text-[#1C1C2E] mb-1">
            Living Intelligence
          </h1>
          <div className="text-[11px] font-semibold uppercase tracking-widest text-[#990F3D] mb-4">
            AI in Wealth Management
          </div>
        </div>

        {/* ── PROFILE COMPLETION ── */}
        {step === 'profile' && (
          <>
            <h2 className="text-lg font-bold text-[#1C1C2E] text-center mb-1">Complete your profile</h2>
            <p className="text-sm text-gray-500 text-center mb-6">Just two quick details so we know who you are.</p>

            <input
              type="text"
              value={fullName}
              onChange={e => { setFullName(e.target.value); setError('') }}
              placeholder="Full name"
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#990F3D] focus:border-transparent mb-3"
            />

            <input
              type="text"
              value={company}
              onChange={e => { setCompany(e.target.value); setError('') }}
              placeholder="Company"
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#990F3D] focus:border-transparent mb-4"
            />

            <button
              onClick={handleProfileSave}
              disabled={loading}
              className="w-full bg-[#1C1C2E] text-white rounded-lg px-4 py-3.5 text-sm font-medium hover:bg-[#2a2a40] transition-colors disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Continue →'}
            </button>
          </>
        )}

        {/* ── TEAM INVITES ── */}
        {step === 'team' && (
          <>
            <h2 className="text-lg font-bold text-[#1C1C2E] text-center mb-1">Add your team</h2>
            <p className="text-sm text-gray-500 text-center mb-6">
              Invite up to 4 colleagues. They&apos;ll get a login link by email.
            </p>

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
                  placeholder={`colleague-${i + 1}@${company.toLowerCase().replace(/\s+/g, '') || 'company'}.com`}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#990F3D] focus:border-transparent"
                />
              ))}
            </div>

            <button
              onClick={handleAddTeam}
              disabled={loading}
              className="w-full bg-[#1C1C2E] text-white rounded-lg px-4 py-3.5 text-sm font-medium hover:bg-[#2a2a40] transition-colors disabled:opacity-50"
            >
              {loading ? 'Inviting...' : 'Invite team & enter portal →'}
            </button>

            <button
              onClick={() => router.push('/intelligence')}
              className="w-full text-center text-sm text-gray-500 mt-4 py-3 hover:text-[#1C1C2E] hover:bg-gray-100 rounded-lg transition-colors"
            >
              Skip — I&apos;ll add team members later
            </button>
          </>
        )}

        {/* ── WAITING FOR ORG ── */}
        {step === 'waiting' && (
          <div className="text-center">
            <h2 className="text-lg font-bold text-[#1C1C2E] mb-2">Setting up your account</h2>
            <p className="text-sm text-gray-500 mb-4">
              This usually takes a few seconds after checkout. If you haven&apos;t completed checkout yet, click below.
            </p>
            <div className="flex flex-col gap-3">
              <a
                href={`/join?tier=founding`}
                className="w-full block text-center bg-[#990F3D] hover:bg-[#7a0c31] text-white rounded-lg px-4 py-3 text-sm font-medium transition-colors no-underline"
              >
                Complete checkout
              </a>
              <button
                onClick={() => window.location.reload()}
                className="text-sm text-[#990F3D] hover:underline"
              >
                Refresh status
              </button>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 text-center">
            {error}
          </div>
        )}

        {/* Message */}
        {message && (
          <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 text-center">
            {message}
          </div>
        )}
      </div>
    </div>
  )
}
