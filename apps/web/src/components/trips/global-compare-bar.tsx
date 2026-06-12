'use client'

import { usePathname } from 'next/navigation'
import { useCompareQueue } from '@/hooks/use-compare-queue'
import { CompareBar } from './compare-bar'

/**
 * App-level wrapper that connects CompareBar to the shared context.
 *
 * Rendered once inside `<Providers>`. Visibility is driven by queue state
 * (items selected and not dismissed) — like a cart bar, it follows the user
 * across pages, so any surface that adds a compare toggle works without a
 * route allowlist. The only exceptions are immersive full-viewport-height
 * surfaces where a fixed bottom bar would cover critical UI (the chat input,
 * the checkout CTA). A missed route here fails safe — an extra dismissible
 * bar — unlike the old allowlist, whose drift produced dead compare toggles.
 */
const IMMERSIVE_ROUTES = [/^\/messages/, /^\/trips\/[^/]+\/book/]

export function GlobalCompareBar() {
  const { items, isOpen, remove, close } = useCompareQueue()
  const pathname = usePathname()

  if (items.length === 0 || !isOpen) return null
  if (IMMERSIVE_ROUTES.some((re) => re.test(pathname ?? ''))) return null

  return (
    <>
      <CompareBar items={items} onRemove={remove} onClose={close} isOpen={isOpen} />
      <div className="h-20" />
    </>
  )
}
