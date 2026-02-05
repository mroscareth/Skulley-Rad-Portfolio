/**
 * ScoreStore - Store ligero para el score del juego
 * 
 * Usa refs y suscripciones manuales para evitar re-renders de React.
 * Solo los componentes suscritos se actualizan cuando cambia el score.
 */

// Estado interno (no es estado de React - no causa re-renders)
let _score = 0
const _listeners = new Set()

export const scoreStore = {
  /** Obtener el score actual */
  get() {
    return _score
  },

  /** Establecer el score */
  set(value) {
    const newScore = typeof value === 'function' ? value(_score) : value
    if (newScore === _score) return
    _score = newScore
    // Notificar a todos los listeners
    _listeners.forEach(listener => {
      try { listener(_score) } catch {}
    })
  },

  /** Agregar delta al score */
  add(delta) {
    this.set(prev => prev + delta)
  },

  /** Reset a cero */
  reset() {
    this.set(0)
  },

  /** Suscribirse a cambios (retorna función para desuscribirse) */
  subscribe(listener) {
    _listeners.add(listener)
    // Llamar inmediatamente con el valor actual
    try { listener(_score) } catch {}
    return () => _listeners.delete(listener)
  },
}

export default scoreStore
