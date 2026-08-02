import { ImageResponse } from 'next/og'
import { isProduction } from '@/lib/constants'
import { readProdFaviconSvg } from '@/lib/prod-favicon'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  if (isProduction) {
    const svg = readProdFaviconSvg()
    const dataUri = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`

    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
          }}
        >
          <img src={dataUri} width={size.width} height={size.height} alt="" />
        </div>
      ),
      { ...size },
    )
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 40,
          background: '#0A9E99',
          color: '#FFFFFF',
          fontSize: 96,
          fontWeight: 700,
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        S
      </div>
    ),
    { ...size },
  )
}
