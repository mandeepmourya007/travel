'use client'

import Link from 'next/link'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

/** A single destination inside a grouped nav dropdown (e.g. "My Bookings" → /my-bookings). */
export interface NavDropdownLink {
  href: string
  label: string
}

interface NavDropdownMenuProps {
  /** The clickable element that opens the menu — styled by the caller. */
  trigger: React.ReactNode
  items: NavDropdownLink[]
  align?: 'start' | 'center' | 'end'
  side?: 'top' | 'right' | 'bottom' | 'left'
  contentClassName?: string
}

/**
 * Shared Radix-based dropdown for grouped nav entries — used by both the desktop
 * header nav and the mobile bottom-tab bar so "one nav slot, several destinations"
 * (e.g. My Account → Bookings/Reviews/Messages) isn't reimplemented per surface.
 */
export function NavDropdownMenu({ trigger, items, align = 'start', side, contentClassName }: NavDropdownMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align={align} side={side} className={cn('min-w-[10rem]', contentClassName)}>
        {items.map((item) => (
          <DropdownMenuItem key={item.href} asChild>
            <Link href={item.href} prefetch={false}>{item.label}</Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
