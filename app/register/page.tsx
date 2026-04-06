'use client'

import { createClient } from '@/lib/supabase'
import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FDF8F2] flex items-center justify-center"><div className="text-gray-400">Loading...</div></div>}>
      <RegisterContent />
    </Suspense>
  )
}

function RegisterContent() {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const tier = searchParams.get('tier') || 'founding'

  const [step, setStep] = useState<'details' | 'verify' | 'complete'>('details')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [company, setCompany] = useState('')
  const [password, setPassword] = useState('')
  const [authMethod, setAuthMethod] = useState<'password' | 'magic'>('password')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function handleGoogleSignUp() {
    setLoading(true)
    setError('')

    // Store company info in localStorage so we can capture it after OAuth redirect
    localStorage.setItem('li_register_company', company)
    localStorage.setItem('li_register_name', fullName)
    localStorage.setItem('li_register_tier', tier)

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback?redirect=/join?tier=${tier}`,
      },
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    }
  }

  async function handleEmailSubmit() {
    if (!fullName.trim()) { setError('Please enter your full name'); return }
    if (!email.trim()) { setError('Please enter your work email'); return }
    if (!company.trim()) { setError('Please enter your company name'); return }

    setLoading(true)
    setError('')

    if (authMethod === 'magic') {
      // Send OTP to verify email first
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          data: { full_name: fullName, company },
        },
      })
      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }
      setStep('verify')
      setMessage('We sent a 6-digit code to your email. Enter it below to verify.')
      setLoading(false)
    } else {
      // Password registration
      if (!password || password.length < 8) {
        setError('Password must be at least 8 characters')
        setLoading(false)
        return
      }

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName, company },
          emailRedirectTo: `${window.location.origin}/api/auth/callback?redirect=/join?tier=${tier}`,
        },
      })

      if (error) {
        if (error.message.includes('already registered')) {
          setError('This email is already registered. Try signing in instead.')
        } else {
          setError(error.message)
        }
        setLoading(false)
        return
      }

      setStep('verify')
      setMessage('We sent a verification email. Check your inbox and click the link to continue.')
      setLoading(false)
    }
  }

  async function handleVerifyOtp() {
    if (!otp.trim() || otp.length !== 6) {
      setError('Please enter the 6-digit code')
      return
    }

    setLoading(true)
    setError('')

    const { error } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: 'email',
    })

    if (error) {
      setError('Invalid code. Please check and try again.')
      setLoading(false)
      return
    }

    // Update user profile with company info
    await supabase.auth.updateUser({
      data: { full_name: fullName, company },
    })

    // Redirect to checkout
    window.location.href = `/join?tier=${tier}`
  }

  return (
    <div className="min-h-screen bg-[#FDF8F2] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-[#1C1C2E] mb-1">
            Living Intelligence
          </h1>
          <div className="text-[11px] font-semibold uppercase tracking-widest text-[#990F3D] mb-3">
            AI in Wealth Management
          </div>
          <p className="text-sm text-gray-500">
            {step === 'details' && 'Create your account to get started'}
            {step === 'verify' && 'Verify your email'}
          </p>
        </div>

        {step === 'details' && (
          <>
            {/* Google Sign Up */}
            <button
              onClick={handleGoogleSignUp}
              disabled={loading || (!company.trim())}
              className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 rounded-lg px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 mb-2"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>
            {!company.trim() && (
              <p className="text-[11px] text-gray-400 text-center mb-4">Enter your company name below to enable Google sign-up</p>
            )}

            <div className="flex items-center my-5">
              <div className="flex-1 border-t border-gray-200" />
              <span className="px-4 text-xs text-gray-400 uppercase">or register with email</span>
              <div className="flex-1 border-t border-gray-200" />
            </div>

            {/* Name */}
            <input
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="Full name"
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#990F3D] focus:border-transparent mb-3"
            />

            {/* Work email */}
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Work email (e.g. you@firm.com)"
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#990F3D] focus:border-transparent mb-3"
            />

            {/* Company */}
            <input
              type="text"
              value={company}
              onChange={e => setCompany(e.target.value)}
              placeholder="Company name"
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#990F3D] focus:border-transparent mb-3"
            />

            {/* Password (if password mode) */}
            {authMethod === 'password' && (
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Create a password (min 8 characters)"
                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#990F3D] focus:border-transparent mb-3"
              />
            )}

            {/* Submit */}
            <button
              onClick={handleEmailSubmit}
              disabled={loading}
              className="w-full bg-[#1C1C2E] text-white rounded-lg px-4 py-3 text-sm font-medium hover:bg-[#2a2a40] transition-colors disabled:opacity-50"
            >
              {loading ? 'Please wait...' : authMethod === 'magic' ? 'Send verification code' : 'Create account'}
            </button>

            {/* Toggle auth method */}
            <button
              onClick={() => setAuthMethod(authMethod === 'password' ? 'magic' : 'password')}
              className="w-full text-center text-sm text-[#990F3D] mt-3 hover:text-[#7a0c31] transition-colors font-medium"
            >
              {authMethod === 'password' ? 'Use magic link instead' : 'Use password instead'}
            </button>

            {/* Already have account */}
            <p className="text-center text-sm text-gray-500 mt-6">
              Already have an account?{' '}
              <a href="/login" className="text-[#990F3D] hover:text-[#7a0c31] font-medium">Sign in</a>
            </p>
          </>
        )}

        {step === 'verify' && authMethod === 'magic' && (
          <>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6 text-sm text-blue-700 text-center">
              {message}
            </div>

            <input
              type="text"
              value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="Enter 6-digit code"
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm text-center tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-[#990F3D] focus:border-transparent mb-3"
              maxLength={6}
            />

            <button
              onClick={handleVerifyOtp}
              disabled={loading || otp.length !== 6}
              className="w-full bg-[#1C1C2E] text-white rounded-lg px-4 py-3 text-sm font-medium hover:bg-[#2a2a40] transition-colors disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Verify and continue'}
            </button>

            <button
              onClick={() => { setStep('details'); setOtp(''); setMessage(''); }}
              className="w-full text-center text-sm text-gray-500 mt-3 hover:text-gray-700 transition-colors"
            >
              Back
            </button>
          </>
        )}

        {step === 'verify' && authMethod === 'password' && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700 text-center">
            <p className="mb-2">{message}</p>
            <p className="text-[12px] text-blue-500">Once verified, you&apos;ll be redirected to complete your subscription.</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 text-center">
            {error}
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-8">
          By creating an account, you agree to our terms of service.
        </p>
      </div>
    </div>
  )
}
