/**
 * Module-level stack of open overlays (modals, lightboxes, …).
 *
 * Overlays can stack — e.g. an image lightbox opened from inside a modal.
 * Each overlay registers on open and asks `isTopOverlay` before handling
 * document-level keyboard events (Escape, Tab focus trap), so only the
 * topmost layer reacts: Escape closes one layer at a time, and a parent
 * modal's focus trap never steals Tab from a child overlay.
 */

let stack: symbol[] = []

export function pushOverlay(label = 'overlay'): symbol {
  const id = Symbol(label)
  stack.push(id)
  return id
}

export function popOverlay(id: symbol): void {
  stack = stack.filter((entry) => entry !== id)
}

export function isTopOverlay(id: symbol): boolean {
  return stack[stack.length - 1] === id
}
