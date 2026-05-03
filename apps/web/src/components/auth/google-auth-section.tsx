'use client'

import { GoogleLogin } from '@react-oauth/google'
import { useGoogleAuth } from '@/hooks/use-google-auth'

/** Google sign-in button with divider. Renders nothing when GOOGLE_CLIENT_ID is not configured. */
interface GoogleAuthSectionProps {
  onSuccess: (isNewUser: boolean) => void
  label?: string
}

export function GoogleAuthSection({ onSuccess, label = 'Or' }: GoogleAuthSectionProps) {
  const { mutate, isPending, error } = useGoogleAuth()

  // Guard: GoogleLogin requires GoogleOAuthProvider which is only mounted when env var exists
  if (!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) return null

  return (
    <div className="space-y-3">
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-neutral-200" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-2 text-neutral-500">{label}</span>
        </div>
      </div>

      <div className="flex justify-center" data-testid="google-login-wrapper">
        {isPending ? (
          <div className="skeleton h-10 w-full" data-testid="google-loading" />
        ) : (
          <GoogleLogin
            onSuccess={(response) => {
              if (response.credential) {
                mutate(response.credential, {
                  onSuccess: (data) => onSuccess(data.isNewUser),
                })
              }
            }}
            onError={() => {
              // GoogleLogin handles its own error UI. Nothing needed here.
            }}
            width="100%"
            text="continue_with"
          />
        )}
      </div>

      {error && (
        <p className="text-sm text-error-500 text-center" data-testid="google-error">
          {(error as Error).message || 'Google sign-in failed'}
        </p>
      )}
    </div>
  )
}
