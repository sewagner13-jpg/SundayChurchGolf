'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

export default function ErrorContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <h1 className="text-2xl font-bold mb-4 text-red-600">Authentication Error</h1>
        <p className="text-gray-600 mb-6">
          {error === 'Configuration'
            ? 'There is a problem with the server configuration.'
            : error === 'AccessDenied'
            ? 'You do not have permission to sign in.'
            : error === 'Verification'
            ? 'The sign-in link is no longer valid. It may have expired.'
            : 'An error occurred during authentication.'}
        </p>
        <Link
          href="/auth/signin"
          className="inline-block px-6 py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700"
        >
          Try Again
        </Link>
      </div>
    </div>
  )
}
