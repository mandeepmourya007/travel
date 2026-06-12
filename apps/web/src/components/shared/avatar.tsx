import Image from 'next/image'
import { IMAGE_HOSTS } from '@/config/image-hosts'
import { cn } from '@/lib/utils'

type AvatarSize = 'sm' | 'md' | 'lg'
type AvatarColor = 'primary' | 'accent' | 'highlight' | 'success'

interface AvatarProps {
  name: string
  src?: string | null
  size?: AvatarSize
  color?: AvatarColor
  className?: string
}

const SIZE_CLASSES: Record<AvatarSize, string> = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-base',
  lg: 'h-14 w-14 text-xl',
}

const COLOR_CLASSES: Record<AvatarColor, string> = {
  primary: 'bg-primary-100 text-primary-700',
  accent: 'bg-accent-100 text-accent-700',
  highlight: 'bg-highlight-100 text-highlight-700',
  success: 'bg-success-50 text-success-500',
}

/** Rendered pixel size per avatar size (matches the h-/w- classes above) */
const SIZE_PX: Record<AvatarSize, number> = {
  sm: 32,
  md: 40,
  lg: 56,
}

/** Hosts configured in next.config.js images.remotePatterns */
const OPTIMIZABLE_HOSTS = new Set(IMAGE_HOSTS)

/**
 * next/image hard-errors on hostnames missing from remotePatterns.
 * Avatar URLs are user-supplied, so unknown hosts skip optimization
 * (still get lazy-loading) instead of crashing the page.
 */
function isOptimizableSrc(src: string): boolean {
  // App-relative paths optimize; protocol-relative ("//host/…") have an
  // unknown host and must not be sent to the optimizer
  if (src.startsWith('/')) return !src.startsWith('//')
  try {
    return OPTIMIZABLE_HOSTS.has(new URL(src).hostname)
  } catch {
    return false
  }
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase()
}

export function Avatar({ name, src, size = 'md', color = 'primary', className }: AvatarProps) {
  if (src) {
    return (
      <Image
        src={src}
        alt={name}
        width={SIZE_PX[size]}
        height={SIZE_PX[size]}
        unoptimized={!isOptimizableSrc(src)}
        className={cn(
          'flex-shrink-0 rounded-full object-cover',
          SIZE_CLASSES[size],
          className,
        )}
      />
    )
  }

  return (
    <div
      className={cn(
        'flex flex-shrink-0 items-center justify-center rounded-full font-bold',
        SIZE_CLASSES[size],
        COLOR_CLASSES[color],
        className,
      )}
      aria-label={name}
    >
      {getInitials(name)}
    </div>
  )
}
