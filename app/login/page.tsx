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
  const redirect = searchParams.get('redirect') || '/'
  const error = searchParams.get('error')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'magic' | 'password'>('magic')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  async function signInWithGoogle() {
    setLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback?redirect=${encodeURIComponent(redirect)}`,
      },
    })
    if (error) {
      setMessage(error.message)
      setLoading(false)
    }
  }

  async function signInWithMagicLink() {
    if (!email) { setMessage('Please enter your email'); return }
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/api/auth/callback?redirect=${encodeURIComponent(redirect)}`,
      },
    })
    if (error) {
      setMessage(error.message)
    } else {
      setMessage('Check your inbox — we sent you a login link.')
    }
    setLoading(false)
  }

  async function signInWithPassword() {
    if (!email || !password) { setMessage('Please enter email and password'); return }
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        // Try to sign up instead
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/api/auth/callback?redirect=${encodeURIComponent(redirect)}`,
          },
        })
        if (signUpError) {
          setMessage(signUpError.message)
        } else {
          setMessage('Check your inbox to confirm your account.')
        }
      } else {
        setMessage(error.message)
      }
    } else {
      window.location.href = redirect
    }
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
          <div className="text-[11px] font-semibold uppercase tracking-widest text-[#990F3D] mb-3">
            AI in Wealth Management
          </div>
          <p className="text-sm text-gray-500">
            Sign in to access your intelligence portal
          </p>
        </div>

        {error === 'inactive' && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">
            Your subscription is no longer active. Please contact us to restore access.
          </div>
        )}

        {/* Google Sign In */}
        <button
          onClick={signInWithGoogle}
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

        <div className="flex items-center my-6">
          <div className="flex-1 border-t border-gray-200" />
          <span className="px-4 text-xs text-gray-400 uppercase">or</span>
          <div className="flex-1 border-t border-gray-200" />
        </div>

        {/* Email input */}
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@company.com"
          className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#990F3D] focus:border-transparent mb-3"
        />

        {mode === 'password' && (
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#990F3D] focus:border-transparent mb-3"
          />
        )}

        {/* Submit button */}
        <button
          onClick={mode === 'magic' ? signInWithMagicLink : signInWithPassword}
          disabled={loading}
          className="w-full bg-[#1C1C2E] text-white rounded-lg px-4 py-3 text-sm font-medium hover:bg-[#2a2a40] transition-colors disabled:opacity-50"
        >
          {loading ? 'Please wait...' : mode === 'magic' ? 'Send magic link' : 'Sign in'}
        </button>

        {/* Toggle between magic link and password */}
        <button
          onClick={() => setMode(mode === 'magic' ? 'password' : 'magic')}
          className="w-full text-center text-sm text-[#990F3D] mt-4 hover:text-[#7a0c31] transition-colors font-medium"
        >
          {mode === 'magic' ? 'Use password instead' : 'Use magic link instead'}
        </button>

        {/* Message */}
        {message && (
          <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 text-center">
            {message}
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-8">
          By signing in, you agree to our terms of service.
        </p>
      </div>
    </div>
  )
}
