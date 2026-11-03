import React from 'react'

// Filtración del nombre civil: cada 3-6 s el título se rompe en bloques
// █▓▒░, tiembla, deja ver OSCAR MOCTEZUMA ~400 ms y regresa. Se cambió por
// un pop toon al quitar el lenguaje terminal (2026-10-23) y Oscar lo pidió
// de vuelta: es el beat de canon de esta pantalla, no adorno de consola.
// Lo usan el preloader de escritorio (PreloaderContent) y la primera pantalla
// de la home de teléfono (MobileScrollHome). El estado vive aquí y no en la
// pantalla que lo monta: cada cambio repinta solo el título.

// [nombre, cuánto se queda]
const SEQUENCE = [
  ['SK█LLEY R█D', 50],
  ['▓▒░SCAR M░▒▓', 80],
  ['OSCAR MOCTE█UMA', 100],
  ['OSCAR MOCTEZUMA', 400],
  ['▓▒░SCAR M░▒▓', 80],
  ['SKU██EY RA█', 60],
  ['SKULLEY RAD', 0],
]

// Cada palabra que llega a pintarse, para medir el título contra la más ancha
// (MOCTE█UMA) y que el glitch nunca se salga de su columna.
export const GLITCH_NAME_WORDS = [...new Set(SEQUENCE.flatMap(([name]) => name.split(' ')))]

// Una palabra por renglón, siempre dos. Los spans van ocultos al lector de
// pantalla: el nombre accesible es el aria-label, no los bloques del glitch.
export default function GlitchName({ as: Tag = 'h1', className = '', ...rest }) {
  const [glitchName, setGlitchName] = React.useState('SKULLEY RAD')
  const [isGlitching, setIsGlitching] = React.useState(false)

  React.useEffect(() => {
    const timers = new Set()
    const later = (fn, ms) => {
      const id = setTimeout(() => { timers.delete(id); fn() }, ms)
      timers.add(id)
    }
    const cycle = (wait) => later(() => {
      setIsGlitching(true)
      let at = 0
      for (const [name, hold] of SEQUENCE) {
        later(() => setGlitchName(name), at)
        at += hold
      }
      later(() => {
        setIsGlitching(false)
        cycle(3000 + Math.random() * 3000)
      }, at + 100)
    }, wait)
    cycle(2000)
    return () => timers.forEach(clearTimeout)
  }, [])

  return (
    <Tag
      {...rest}
      className={`glitch-name ${className} ${isGlitching ? 'glitch-name--on' : ''}`}
      style={{ color: glitchName === 'OSCAR MOCTEZUMA' ? '#f472b6' : '#ffffff' }}
      aria-label="Skulley Rad"
    >
      {glitchName.split(' ').map((word, i) => (
        <span key={i} className="block whitespace-nowrap" aria-hidden>{word}</span>
      ))}
    </Tag>
  )
}
