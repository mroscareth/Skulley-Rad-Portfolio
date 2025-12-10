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
      const key = e.key.toLowerCase()
      setKeys((state) => {
        switch (key) {
          case 'w':
          case 'arrowup':
            return { ...state, forward: true }
          case 's':
          case 'arrowdown':
            return { ...state, backward: true }
          case 'a':
          case 'arrowleft':
            return { ...state, left: true }
          case 'd':
          case 'arrowright':
            return { ...state, right: true }
          case ' ': // spacebar
          case 'space':
            return { ...state, action: true }
          case 'shift':
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
            return { ...state, forward: false }
          case 's':
          case 'arrowdown':
            return { ...state, backward: false }
          case 'a':
          case 'arrowleft':
            return { ...state, left: false }
          case 'd':
          case 'arrowright':
            return { ...state, right: false }
          case ' ': // spacebar
          case 'space':
            return { ...state, action: false }
          case 'shift':
            return { ...state, shift: false }
          default:
            return state
        }
      })
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  return keys
}