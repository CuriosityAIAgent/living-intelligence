'use client'

import { createClient } from '@/lib/supabase'
import { Suspense, useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FDF8F2] flex items-center justify-center"><div className="text-gray-400">Loading...</div></div>}>
      <LoginContent />
    </Suspense>
  )
}

// Valid invite codes — checked client-side for instant feedback, validated server-side on activate
const VALID_CODES = ['FRIEND2026']

function LoginContent() {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const router = useRouter()
  const redirect = searchParams.get('redirect') || '/latest'
  const errorParam = searchParams.get('error')
  const codeFromUrl = searchParams.get('code') || searchParams.get('invite') || ''

  // Steps: 'code' → 'login' → 'profile' → 'activating'
  // Returning users (no invite code) skip straight to 'login'
  const [step, setStep] = useState<'code' | 'login' | 'profile' | 'activating'>('code')
  const [inviteCode, setInviteCode] = useState(codeFromUrl)
  const [codeValid, setCodeValid] = useState(false)
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [company, setCompany] = useState('')
  const [loadingEmail, setLoadingEmail] = useState(false)
  const [loadingGoogle, setLoadingGoogle] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const loading = loadingEmail || loadingGoogle
  const isNewUser = codeValid // If they entered a valid code, they're registering

  // On mount: check localStorage for pending invite code, check if already logged in
  useEffect(() => {
    const saved = localStorage.getItem('li_invite_code')
    if (codeFromUrl && VALID_CODES.includes(codeFromUrl.toUpperCase())) {
      setInviteCode(codeFromUrl)
      setCodeValid(true)
      localStorage.setItem('li_invite_code', codeFromUrl.toUpperCase())
      setStep('login')
    } else if (saved && VALID_CODES.includes(saved.toUpperCase())) {
      setInviteCode(saved)
      setCodeValid(true)
      setStep('login')
    }

    // Check if user is already logged in (returning from OAuth)
    async function checkUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('full_name, company, org_id')
          .eq('id', user.id)
          .single()

        if (profile?.org_id && profile?.full_name) {
          // Fully set up — go to portal
          localStorage.removeItem('li_invite_code')
          router.push(redirect)
          return
        }

        // Logged in but needs profile/org — check for pending invite
        const pendingCode = localStorage.getItem('li_invite_code')
        if (pendingCode) {
          setInviteCode(pendingCode)
          setCodeValid(true)
          const meta = user.user_metadata || {}
          setFullName(meta.full_name || meta.name || '')
          setCompany(profile?.company || '')
          setStep('profile')
        } else if (!profile?.org_id) {
          // Logged in, no org, no invite code — they need a code or subscription
          setStep('code')
        } else {
          router.push(redirect)
        }
      }
    }
    checkUser()
  }, [])

  function handleCodeSubmit() {
    const code = inviteCode.trim().toUpperCase()
    if (VALID_CODES.includes(code)) {
      setCodeValid(true)
      setInviteCode(code)
      localStorage.setItem('li_invite_code', code)
      setError('')
      setStep('login')
    } else {
      setError('Invalid invitation code')
    }
  }

  async function handleContinueWithGoogle() {
    setLoadingGoogle(true)
    setError('')

    // Store code before OAuth redirect
    if (codeValid) {
      localStorage.setItem('li_invite_code', inviteCode.toUpperCase())
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback?redirect=${encodeURIComponent('/login')}`,
        queryParams: { prompt: 'select_account' },
      },
    })
    if (error) {
      setError(error.message)
      setLoadingGoogle(false)
    }
  }

  async function handleContinueWithEmail() {
    if (!email.trim()) { setError('Please enter your work email'); return }
    setLoadingEmail(true)
    setError('')

    // Store code before redirect
    if (codeValid) {
      localStorage.setItem('li_invite_code', inviteCode.toUpperCase())
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/api/auth/callback?redirect=${encodeURIComponent('/login')}`,
      },
    })

    if (error) {
      setError(error.message)
      setLoadingEmail(false)
      return
    }

    setSent(true)
    setLoadingEmail(false)
  }

  async function handleResend() {
    setLoadingEmail(true)
    setError('')

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/api/auth/callback?redirect=${encodeURIComponent('/login')}`,
      },
    })

    if (error) setError(error.message)
    setLoadingEmail(false)
  }

  async function handleActivate() {
    if (!fullName.trim()) { setError('Please enter your name'); return }
    if (!company.trim()) { setError('Please enter your company'); return }

    setStep('activating')
    setError('')

    try {
      const res = await fetch('/api/invite/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: inviteCode, fullName: fullName.trim(), company: company.trim() }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Something went wrong')
        setStep('profile')
        return
      }

      localStorage.removeItem('li_invite_code')
      router.push('/latest')
    } catch {
      setError('Something went wrong. Please try again.')
      setStep('profile')
    }
  }

  return (
    <div className="min-h-screen bg-[#FDF8F2] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-[#1C1C2E] mb-1">
            Living Intelligence
          </h1>
          <div className="text-[11px] font-semibold uppercase tracking-widest text-[#990F3D] mb-4">
            AI in Wealth Management
          </div>
        </div>

        {errorParam === 'inactive' && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">
            Your subscription is no longer active. Please contact us to restore access.
          </div>
        )}

        {/* Invite code badge — shown once validated */}
        {codeValid && step !== 'code' && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2.5 mb-5 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-emerald-800">Invitation accepted</div>
              <div className="text-xs text-emerald-600">{inviteCode}</div>
            </div>
            <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}

        {/* ─── STEP 1: INVITE CODE ─── */}
        {step === 'code' && (
          <>
            <p className="text-sm text-gray-600 text-center mb-4">
              Enter your invitation code to get started, or sign in if you already have an account.
            </p>

            <input
              type="text"
              value={inviteCode}
              onChange={e => { setInviteCode(e.target.value.toUpperCase()); setError('') }}
              placeholder="Invitation code"
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm text-center tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent mb-3"
              onKeyDown={e => e.key === 'Enter' && handleCodeSubmit()}
            />

            <button
              onClick={handleCodeSubmit}
              className="w-full bg-[#1C1C2E] text-white rounded-lg px-4 py-3.5 text-sm font-medium hover:bg-[#2a2a40] transition-colors mb-4"
            >
              Continue
            </button>

            {/* Divider */}
            <div className="flex items-center mb-4">
              <div className="flex-1 border-t border-gray-200" />
              <span className="px-4 text-xs text-gray-400">already a subscriber?</span>
              <div className="flex-1 border-t border-gray-200" />
            </div>

            <button
              onClick={() => setStep('login')}
              className="w-full text-sm text-[#990F3D] hover:text-[#7a0c31] font-medium py-2"
            >
              Sign in to your account
            </button>
          </>
        )}

        {/* ─── STEP 2: LOGIN ─── */}
        {step === 'login' && !sent && (
          <>
            {/* Google — primary for new users */}
            <button
              onClick={handleContinueWithGoogle}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 rounded-lg px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 mb-4"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>

            {/* Divider */}
            <div className="flex items-center mb-4">
              <div className="flex-1 border-t border-gray-200" />
              <span className="px-4 text-xs text-gray-400">or</span>
              <div className="flex-1 border-t border-gray-200" />
            </div>

            <input
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setError('') }}
              placeholder="Work email"
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#990F3D] focus:border-transparent mb-3"
              onKeyDown={e => e.key === 'Enter' && handleContinueWithEmail()}
            />

            <button
              onClick={handleContinueWithEmail}
              disabled={loading}
              className="w-full bg-[#1C1C2E] text-white rounded-lg px-4 py-3.5 text-sm font-medium hover:bg-[#2a2a40] transition-colors disabled:opacity-50"
            >
              {loadingEmail ? 'Sending...' : 'Continue with email'}
            </button>

            <p className="text-[12px] text-gray-400 text-center mt-2">
              We&apos;ll send a secure link to your email. No password needed.
            </p>
          </>
        )}

        {step === 'login' && sent && (
          <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
            <div className="text-3xl mb-3">✉️</div>
            <h2 className="text-lg font-bold text-[#1C1C2E] mb-2">Check your inbox</h2>
            <p className="text-sm text-gray-600 mb-1">We sent a login link to</p>
            <p className="text-sm font-medium text-[#1C1C2E] mb-4">{email}</p>
            <p className="text-[13px] text-gray-500 mb-4">
              Click the link to continue. It expires in 1 hour.
            </p>
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={handleResend}
                disabled={loading}
                className="text-[13px] text-[#990F3D] hover:text-[#7a0c31] font-medium disabled:opacity-50"
              >
                {loading ? 'Sending...' : 'Resend'}
              </button>
              <span className="text-gray-300">|</span>
              <button
                onClick={() => { setSent(false); setError('') }}
                className="text-[13px] text-gray-500 hover:text-gray-700"
              >
                Use a different email
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP 3: PROFILE (invite users only) ─── */}
        {step === 'profile' && (
          <>
            <p className="text-sm text-gray-600 text-center mb-4">
              Almost there — tell us a bit about yourself.
            </p>

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
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#990F3D] focus:border-transparent mb-3"
            />

            <button
              onClick={handleActivate}
              className="w-full bg-[#1C1C2E] text-white rounded-lg px-4 py-3.5 text-sm font-medium hover:bg-[#2a2a40] transition-colors"
            >
              Get started
            </button>
          </>
        )}

        {/* ─── ACTIVATING ─── */}
        {step === 'activating' && (
          <div className="text-center py-8">
            <div className="animate-spin w-6 h-6 border-2 border-[#990F3D] border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-sm text-gray-500">Setting up your account...</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 text-center">
            {error}
          </div>
        )}

        <p className="text-center text-xs text-gray-400 mt-8">
          The intelligence platform for wealth management decision-makers.
        </p>
      </div>
    </div>
  )
}
