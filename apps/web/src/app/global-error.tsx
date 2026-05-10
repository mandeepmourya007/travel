'use client'

import { useLogError } from '@/hooks/use-log-error'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useLogError(error)

  return (
    <html lang="en">
      <body>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'Inter, system-ui, sans-serif',
          backgroundColor: '#fafafa',
          padding: '1rem',
        }}>
          <div style={{
            maxWidth: '28rem',
            width: '100%',
            borderRadius: '0.75rem',
            backgroundColor: '#fff',
            border: '1px solid #e5e5e5',
            padding: '2.5rem',
            textAlign: 'center',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          }}>
            <p style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>💥</p>
            <h1 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#171717' }}>
              Something went wrong
            </h1>
            <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#737373' }}>
              An unexpected error occurred. Please try again or refresh the page.
            </p>
            <button
              onClick={reset}
              style={{
                marginTop: '1.5rem',
                padding: '0.625rem 1.5rem',
                borderRadius: '0.5rem',
                border: '1px solid #d4d4d4',
                backgroundColor: '#fff',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: 500,
                color: '#171717',
              }}
            >
              Try Again
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
