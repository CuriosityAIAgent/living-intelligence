'use client'

import { createClient } from '@/lib/supabase'
import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FDF8F2] flex items-center justify-center"><div className="text-gray-400">Loading...</div></div>}>
      <LoginContent />
    </Suspense>
  )
}

function LoginContent() {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') || '/latest'
  const errorParam = searchParams.get('error')

  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleContinueWithGoogle() {
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback?redirect=${encodeURIComponent(redirect)}`,
        queryParams: { prompt: 'select_account' },
      },
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    }
  }

  async function handleContinueWithEmail() {
    if (!email.trim()) { setError('Please enter your work email'); return }
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/api/auth/callback?redirect=${encodeURIComponent(redirect)}`,
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setSent(true)
    setLoading(false)
  }

  async function handleResend() {
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/api/auth/callback?redirect=${encodeURIComponent(redirect)}`,
      },
    })

    if (error) setError(error.message)
    setLoading(false)
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

        {!sent ? (
          <>
            {/* Email */}
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
              {loading ? 'Sending...' : 'Continue →'}
            </button>

            <p className="text-[12px] text-gray-400 text-center mt-2 mb-5">
              We&apos;ll send a secure link to your email. No password needed.
            </p>

            {/* Divider */}
            <div className="flex items-center mb-5">
              <div className="flex-1 border-t border-gray-200" />
              <span className="px-4 text-xs text-gray-400">or</span>
              <div className="flex-1 border-t border-gray-200" />
            </div>

            {/* Google */}
            <button
              onClick={handleContinueWithGoogle}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 rounded-lg px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>
          </>
        ) : (
          /* Link sent */
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

        {/* Error */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 text-center">
            {error}
          </div>
        )}

        <p className="text-center text-xs text-gray-400 mt-8">
          By continuing, you agree to our terms of service.
        </p>
      </div>
    </div>
  )
}
