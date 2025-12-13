import { useEffect, useState } from 'react'

// A simple custom hook that tracks the WASD and arrow keys.  When a
// relevant key is pressed or released, it updates the corresponding value in
// the returned state.  This hook is reused by the Player component to
// determine movement direction.
export default function useKeyboard() {
  const [keys, setKeys] = useState({
    forward: false,
    backward: false,
    left: false,
    right: false,
    action: false,
    shift: false,
  })

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Evitar re-renders por key-repeat del SO (muy frecuente en Windows)
      // Mantener una tecla presionada NO debería disparar setState continuamente.
      if (e && e.repeat) return
      const key = e.key.toLowerCase()
      setKeys((state) => {
        switch (key) {
          case 'w':
          case 'arrowup':
            if (state.forward) return state
            return { ...state, forward: true }
          case 's':
          case 'arrowdown':
            if (state.backward) return state
            return { ...state, backward: true }
          case 'a':
          case 'arrowleft':
            if (state.left) return state
            return { ...state, left: true }
          case 'd':
          case 'arrowright':
            if (state.right) return state
            return { ...state, right: true }
          case ' ': // spacebar
          case 'space':
            if (state.action) return state
            return { ...state, action: true }
          case 'shift':
            if (state.shift) return state
            return { ...state, shift: true }
          default:
            return state
        }
      })
    }

    const handleKeyUp = (e) => {
      const key = e.key.toLowerCase()
      setKeys((state) => {
        switch (key) {
          case 'w':
          case 'arrowup':
            if (!state.forward) return state
            return { ...state, forward: false }
          case 's':
          case 'arrowdown':
            if (!state.backward) return state
            return { ...state, backward: false }
          case 'a':
          case 'arrowleft':
            if (!state.left) return state
            return { ...state, left: false }
          case 'd':
          case 'arrowright':
            if (!state.right) return state
            return { ...state, right: false }
          case ' ': // spacebar
          case 'space':
            if (!state.action) return state
            return { ...state, action: false }
          case 'shift':
            if (!state.shift) return state
            return { ...state, shift: false }
          default:
            return state
        }
      })
    }

    const handleBlur = () => {
      // Si la ventana pierde foco, evitamos teclas “pegadas”
      setKeys({
        forward: false,
        backward: false,
        left: false,
        right: false,
        action: false,
        shift: false,
      })
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', handleBlur)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', handleBlur)
    }
  }, [])

  return keys
}