'use client'

import Link from 'next/link'
import { GoogleLogin } from '@react-oauth/google'
import { useGoogleAuth } from '@/hooks/use-google-auth'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

/** Google sign-in button with divider. Renders nothing when GOOGLE_CLIENT_ID is not configured. */
interface GoogleAuthSectionProps {
  onSuccess: (isNewUser: boolean) => void
  /** Called the moment the user taps the Google button (before auth completes). */
  onInitiate?: () => void
  /** Called if Google auth fails or is cancelled, so callers can reset pending state. */
  onError?: () => void
  label?: string
  /**
   * Gates the button behind an explicit consent checkbox elsewhere on the page
   * (used on the signup page, alongside its "I agree to..." checkbox). When true,
   * the real Google button isn't rendered at all, so no OAuth flow can start.
   */
  disabled?: boolean
  /** Hint shown under the button while `disabled` — e.g. "Accept the terms above to continue". */
  disabledHint?: string
}

export function GoogleAuthSection({ onSuccess, onInitiate, onError, label = 'Or', disabled, disabledHint }: GoogleAuthSectionProps) {
  // Register success/error at the mutation level (inside the hook) so they still
  // fire if this component unmounts mid-flow (the login page swaps to a spinner
  // on click, unmounting us — per-call mutate callbacks would be dropped).
  const { mutate, isPending, error } = useGoogleAuth({
    onSuccess: (data) => onSuccess(data.isNewUser),
    onError: () => onError?.(),
  })

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

      {/* Capture the click at the container level so we know when the user initiates Google auth,
          even before the GIS library calls onSuccess (important for redirect-mode flow on mobile). */}
      <div className="flex justify-center" data-testid="google-login-wrapper" onClick={disabled ? undefined : onInitiate}>
        {disabled ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                {/* Wrapper span, not the disabled <button>, is the actual trigger — a native
                    disabled button doesn't reliably fire pointer/hover events in all browsers. */}
                <span tabIndex={0} className="block w-full">
                  <button
                    type="button"
                    disabled
                    className="btn-secondary w-full opacity-50 pointer-events-none"
                    data-testid="google-login-disabled"
                  >
                    Continue with Google
                  </button>
                </span>
              </TooltipTrigger>
              {disabledHint && <TooltipContent>{disabledHint}</TooltipContent>}
            </Tooltip>
          </TooltipProvider>
        ) : isPending ? (
          <div className="skeleton h-10 w-full" data-testid="google-loading" />
        ) : (
          <GoogleLogin
            onSuccess={(response) => {
              if (response.credential) {
                mutate(response.credential)
              } else {
                onError?.()
              }
            }}
            onError={() => {
              onError?.()
            }}
            width="100%"
            text="continue_with"
          />
        )}
      </div>

      {disabled && disabledHint && (
        <p className="text-xs text-neutral-500 text-center" data-testid="google-disabled-hint">
          {disabledHint}
        </p>
      )}

      {!disabled && (
        <p className="text-xs text-neutral-400 text-center">
          By continuing, you agree to our{' '}
          <Link href="/terms" className="font-medium text-primary-600 hover:text-primary-700">
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link href="/privacy" className="font-medium text-primary-600 hover:text-primary-700">
            Privacy Policy
          </Link>
          .
        </p>
      )}

      {error && (
        <p className="text-sm text-error-500 text-center" data-testid="google-error">
          {(error as Error).message || 'Google sign-in failed'}
        </p>
      )}
    </div>
  )
}
