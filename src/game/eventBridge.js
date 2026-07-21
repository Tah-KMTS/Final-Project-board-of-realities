// Minimal pub-sub used to pass interaction events from a Phaser scene
// (canvas-only, not part of the React tree) up to React modal state.
export function createEventBridge() {
  const listeners = new Map()
  return {
    on(event, handler) {
      if (!listeners.has(event)) listeners.set(event, new Set())
      listeners.get(event).add(handler)
      return () => listeners.get(event)?.delete(handler)
    },
    emit(event, payload) {
      listeners.get(event)?.forEach((handler) => handler(payload))
    },
  }
}
