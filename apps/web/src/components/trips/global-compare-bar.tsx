'use client'

import { usePathname } from 'next/navigation'
import { useCompareQueue } from '@/hooks/use-compare-queue'
import { CompareBar } from './compare-bar'

/**
 * App-level wrapper that connects CompareBar to the shared context.
 *
 * Rendered once inside `<Providers>` so the floating compare bar
 * appears only on the /trips page. Also adds bottom padding to
 * prevent page content from hiding behind the fixed bar.
 */
export function GlobalCompareBar() {
  const { items, isOpen, remove, close } = useCompareQueue()
  const pathname = usePathname()

  // Only show the compare bar on the /trips listing page
  if (pathname !== '/trips') return null

  return (
    <>
      <CompareBar items={items} onRemove={remove} onClose={close} isOpen={isOpen} />
      {items.length > 0 && isOpen && <div className="h-20" />}
    </>
  )
}
