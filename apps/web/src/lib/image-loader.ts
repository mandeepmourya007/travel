/**
 * Custom next/image loader.
 *
 * Default behaviour routes every image through Next's own optimizer
 * (/_next/image → sharp on the server). For Cloudinary-hosted images that's
 * wasteful double-optimization: the request leaves the browser, hits our Next
 * server (slow `sharp` pass, throttled on Render free tier — the 3-6s cold
 * hit), then re-fetches from Cloudinary anyway.
 *
 * Instead we hand the browser a Cloudinary (or Unsplash) transformation URL so
 * it fetches the correctly-sized, modern-format image DIRECTLY from the CDN.
 * Cloudinary's `f_auto` picks AVIF/WebP per browser and `q_auto` tunes quality.
 *
 * Next calls this once per width in the responsive srcset, so we only resize
 * (`w_<width>,c_limit` — never upscale); the browser picks the right candidate.
 *
 * This file runs in both server and client bundles — keep it pure (no Node APIs).
 */

interface LoaderArgs {
  src: string
  width: number
  quality?: number
}

export default function imageLoader({ src, width, quality }: LoaderArgs): string {
  // Cloudinary — inject a transformation segment right after `/upload/`.
  if (src.includes('res.cloudinary.com') && src.includes('/upload/')) {
    const q = quality ?? 'auto'
    const transform = `f_auto,q_${q},w_${width},c_limit`
    // Avoid stacking onto an existing leading transform we may have added before.
    return src.replace('/upload/', `/upload/${transform}/`)
  }

  // Unsplash (imgix-backed) — use its query params for CDN-side resizing.
  if (src.includes('images.unsplash.com')) {
    const sep = src.includes('?') ? '&' : '?'
    return `${src}${sep}auto=format&fit=max&w=${width}&q=${quality ?? 75}`
  }

  // Everything else (Google avatars, data URIs, local /public) — serve as-is.
  // These are either already small/optimized or not transformable.
  return src
}
