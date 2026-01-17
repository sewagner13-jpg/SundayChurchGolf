export default function VerifyRequestPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <h1 className="text-2xl font-bold mb-4">Check your email</h1>
        <p className="text-gray-600 mb-4">
          A sign-in link has been sent to your email address.
        </p>
        <p className="text-sm text-gray-500">
          Click the link in the email to sign in. You can close this window.
        </p>
      </div>
    </div>
  )
}
