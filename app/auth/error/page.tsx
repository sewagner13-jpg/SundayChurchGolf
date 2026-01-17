import { Suspense } from 'react'
import ErrorContent from './ErrorContent'

export default function ErrorPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center">Loading...</div>}>
      <ErrorContent />
    </Suspense>
  )
}
