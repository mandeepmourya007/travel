import { isProduction } from '@/lib/constants'
import { readProdFaviconSvg } from '@/lib/prod-favicon'

export const size = { width: 32, height: 32 }
export const contentType = 'image/svg+xml'

const DEV_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28" fill="none">
  <!-- Route/path line -->
  <path d="M4 24 C7 18, 5 14, 14 10" stroke="#0A9E99" stroke-width="1.5" stroke-linecap="round" stroke-dasharray="2.5 2.5" opacity="0.45"/>
  <!-- Map pin body -->
  <path d="M14 1C9.58 1 6 4.48 6 8.78C6 14.5 14 24 14 24C14 24 22 14.5 22 8.78C22 4.48 18.42 1 14 1Z" fill="#0A9E99"/>
  <!-- Pin inner circle -->
  <circle cx="14" cy="8.5" r="3.5" fill="white"/>
  <!-- Dot in center -->
  <circle cx="14" cy="8.5" r="1.3" fill="#0A9E99"/>
  <!-- Destination dot -->
  <circle cx="4" cy="24" r="1.8" fill="#0A9E99" opacity="0.35"/>
</svg>`

export default function Icon() {
  const svg = isProduction ? readProdFaviconSvg() : DEV_ICON_SVG

  return new Response(svg, {
    headers: { 'Content-Type': contentType },
  })
}
