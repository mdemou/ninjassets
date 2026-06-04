// Lightweight cross-component signal for the (non-dismissed) data-quality alert set.
//
// The navbar bell owns its own count and polls on an interval, but a discard/undo happens
// on the overview route — a sibling in the tree with separate state. After such a change the
// overview emits here so the bell refetches immediately instead of waiting for its next poll
// or a page reload. EventTarget is available in the browser and in Node (SSR-safe on import).
const target = new EventTarget();
const EVENT = 'alerts:changed';

/** Notify listeners that the set of non-dismissed alerts may have changed. */
export function emitAlertsChanged(): void {
  target.dispatchEvent(new Event(EVENT));
}

/** Subscribe to alert-set changes. Returns an unsubscribe function. */
export function onAlertsChanged(listener: () => void): () => void {
  target.addEventListener(EVENT, listener);
  return () => target.removeEventListener(EVENT, listener);
}
