import { ImageResponse } from 'next/og'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

/** Generates a dynamic favicon using the first two letters of APP_NAME. */
export default function Icon() {
  const appName = process.env.NEXT_PUBLIC_APP_NAME || 'Safarnama'
  const initials = appName
    .split(/(?=[A-Z\s])/)
    .filter((s) => s.trim())
    .map((s) => s.trim()[0].toUpperCase())
    .slice(0, 2)
    .join('')

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 8,
          background: '#0A9E99',
          color: '#FFFFFF',
          fontSize: 18,
          fontWeight: 700,
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {initials}
      </div>
    ),
    { ...size },
  )
}
