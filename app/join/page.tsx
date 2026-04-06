'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'

export default function JoinPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FDF8F2] flex items-center justify-center"><div className="text-gray-400">Loading...</div></div>}>
      <JoinContent />
    </Suspense>
  )
}

function JoinContent() {
  const searchParams = useSearchParams()
  const coupon = searchParams.get('coupon') || ''
  const tier = searchParams.get('tier') || 'standard'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleJoin() {
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coupon, tier }),
      })

      const data = await res.json()

      if (data.url) {
        window.location.href = data.url
      } else {
        setError(data.error || 'Failed to create checkout session')
        setLoading(false)
      }
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  // Auto-redirect if coupon is present
  useEffect(() => {
    if (coupon) {
      handleJoin()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="min-h-screen bg-[#FDF8F2] flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <div className="text-[11px] font-semibold uppercase tracking-widest text-[#990F3D] mb-2">
          Living Intelligence
        </div>
        <h1 className="text-2xl font-bold text-[#1C1C2E] mb-2">
          AI in Wealth Management
        </h1>
        <p className="text-sm text-gray-500 mb-8">
          {coupon
            ? 'Setting up your access...'
            : 'Get started with Living Intelligence'}
        </p>

        {!coupon && (
          <button
            onClick={handleJoin}
            disabled={loading}
            className="w-full bg-[#990F3D] text-white rounded-lg px-6 py-3 text-sm font-medium hover:bg-[#7a0c31] transition-colors disabled:opacity-50"
          >
            {loading ? 'Redirecting to checkout...' : 'Subscribe now'}
          </button>
        )}

        {loading && (
          <div className="mt-4 text-sm text-gray-400 animate-pulse">
            Redirecting to secure checkout...
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
