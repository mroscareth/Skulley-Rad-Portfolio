/**
 * ScoreStore - Lightweight store for game score
 * 
 * Uses refs and manual subscriptions to avoid React re-renders.
 * Only subscribed components update when the score changes.
 */

// Internal state (not React state — does not cause re-renders)
let _score = 0
const _listeners = new Set()

export const scoreStore = {
  /** Get current score */
  get() {
    return _score
  },

  /** Set the score */
  set(value) {
    const newScore = typeof value === 'function' ? value(_score) : value
    if (newScore === _score) return
    _score = newScore
    // Notify all listeners
    _listeners.forEach(listener => {
      try { listener(_score) } catch {}
    })
  },

  /** Add delta to score */
  add(delta) {
    this.set(prev => prev + delta)
  },

  /** Reset to zero */
  reset() {
    this.set(0)
  },

  /** Subscribe to changes (returns unsubscribe function) */
  subscribe(listener) {
    _listeners.add(listener)
    // Call immediately with current value
    try { listener(_score) } catch {}
    return () => _listeners.delete(listener)
  },
}

export default scoreStore
