'use client'

import { useState, useEffect } from 'react'

/**
 * Simple email domain gate for wealth.tigerai.tech (JPMorgan demo).
 * Only activates on that domain. Validates @jpmorgan.com emails.
 * Stores validation in sessionStorage (lasts until tab closes).
 */
export default function JpmGate({ children }: { children: React.ReactNode }) {
  const [isJpmDomain, setIsJpmDomain] = useState(false)
  const [verified, setVerified] = useState(false)
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [showTick, setShowTick] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const host = window.location.hostname
    if (host.includes('wealth.tigerai.tech')) {
      setIsJpmDomain(true)
      if (sessionStorage.getItem('jpm_verified') === 'true') {
        setVerified(true)
      }
    } else {
      // Not the JPM domain — don't gate anything
      setVerified(true)
    }
  }, [])

  // Avoid hydration mismatch — render nothing until mounted
  if (!mounted) return null

  // Not on JPM domain or already verified — show content
  if (!isJpmDomain || verified) {
    return <>{children}</>
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const trimmed = email.trim().toLowerCase()
    if (!trimmed) {
      setError('Please enter your work email address.')
      return
    }

    if (trimmed.endsWith('@jpmorgan.com')) {
      // Success — show green tick, then reveal content
      setShowTick(true)
      sessionStorage.setItem('jpm_verified', 'true')
      setTimeout(() => setVerified(true), 1200)
    } else {
      setError('Unable to access the platform.')
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#1C1C2E]">
      <div className="w-full max-w-md mx-4">
        {/* Logo / brand */}
        <div className="text-center mb-8">
          <h1 className="text-white text-lg font-bold uppercase tracking-widest">
            Living Intelligence
          </h1>
          <p className="text-[#9999BB] text-sm mt-1">AI in Wealth Management</p>
        </div>

        {showTick ? (
          /* Green tick animation */
          <div className="flex flex-col items-center gap-4 animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-emerald-400 text-sm font-medium">Verified</p>
          </div>
        ) : (
          /* Email form */
          <form onSubmit={handleSubmit} className="bg-[#141420] rounded-lg p-8 shadow-2xl">
            <label htmlFor="jpm-email" className="block text-[#CCCCDD] text-sm font-medium mb-3">
              Enter your work email
            </label>
            <input
              id="jpm-email"
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setError('') }}
              placeholder="name@jpmorgan.com"
              autoFocus
              autoComplete="email"
              className="w-full px-4 py-3 rounded-md bg-[#1C1C2E] border border-[#333355] text-white placeholder-[#666688] focus:outline-none focus:border-[#990F3D] focus:ring-1 focus:ring-[#990F3D] transition-colors"
            />
            {error && (
              <p className="mt-3 text-red-400 text-sm">{error}</p>
            )}
            <button
              type="submit"
              className="mt-5 w-full py-3 rounded-md bg-[#990F3D] text-white font-medium hover:bg-[#7a0c31] transition-colors"
            >
              Continue
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
