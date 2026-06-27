import Image, { type ImageProps } from 'next/image'

/**
 * Builds a tiny, heavily-blurred Cloudinary variant of the source to use as the
 * blur-up placeholder. ~1KB, fetched from the CDN, shown instantly while the
 * full-resolution image streams in.
 */
function cloudinaryBlurURL(src: string): string | undefined {
  if (src.includes('res.cloudinary.com') && src.includes('/upload/')) {
    return src.replace('/upload/', '/upload/w_24,e_blur:1000,q_10,f_auto/')
  }
  return undefined
}

/**
 * Drop-in replacement for next/image that shows a blurred placeholder until the
 * image finishes loading.
 *
 * For Cloudinary sources the placeholder is derived automatically; for other
 * hosts it renders a normal <Image> (unless an explicit blurDataURL is passed).
 * Any next/image prop (fill, sizes, quality, className, priority, …) is forwarded.
 */
export function BlurImage({ blurDataURL, placeholder, ...props }: ImageProps) {
  const src = typeof props.src === 'string' ? props.src : ''
  const blur = blurDataURL ?? cloudinaryBlurURL(src)

  return (
    <Image
      {...props}
      placeholder={blur ? (placeholder ?? 'blur') : placeholder}
      blurDataURL={blur}
    />
  )
}
