import { cn } from '@/lib/utils'

type AvatarSize = 'sm' | 'md' | 'lg'
type AvatarColor = 'primary' | 'accent' | 'highlight' | 'success'

interface AvatarProps {
  name: string
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

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase()
}

export function Avatar({ name, size = 'md', color = 'primary', className }: AvatarProps) {
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
