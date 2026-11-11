import React from 'react'
import { RUNE_FONT_FAMILY_BOLD } from '../lib/installRuneFont.js'
import { whenRuneFontsReady, runeLetterClones } from '../lib/runeReveal.js'

// Primer momento del preloader (idea de Oscar, 2026-11-10): SKULLEYRAD en
// runas, todo pegado para que la fuente le ponga la doble L, centrado y de
// orilla a orilla, sobre el azul y sin nada más.
// Las runas entran una por una, se sostienen, suben apagándose y, cuando ya
// se fue la última, entra lo demás (Oscar: "se va la palabra completa y
// después aparece lo demás", cada cosa con su tiempo, sin prisa).
// Una sola palabra recortada por letra (runeLetterClones), igual que el
// revelado del texto: solo se anima translate y opacity, que siguen fluidas
// aunque el hilo principal esté ocupado.
//
// Se sostiene hasta que `canLeave`: justo después de cargar el modelo el
// sitio compila la escena del home detrás del preloader y congela la página
// un par de segundos. Con un reloj fijo, ese congelón caía a media salida;
// así la palabra cubre la carga y se va con el hilo ya libre y la pantalla
// pintando fluido. Nada se mide con relojes: mientras la tarjeta de video
// compila, una animación arranca tarde, y un setTimeout metía lo demás con
// las runas todavía a medio irse. Se espera a que terminen de verdad
// (Animation.finished).
const WORD = 'SKULLEYRAD'
const T = {
  inStep: 100,   // entre una runa y la siguiente al entrar
  inMs: 750,
  minHold: 1200, // la palabra completa, quieta, por lo menos esto
  outStep: 80,
  outMs: 900,
  after: 300,    // azul solo, entre que se va la última runa y entra lo demás
}
const WIDTH = 0.92  // de la pantalla
const MAX_VH = 55   // tope en pantallas muy anchas y bajas
const SMOOTH = { frames: 8, ms: 40, cap: 2500 } // cuadros seguidos sin tirón antes de irse

// Cuando termina de verdad la animación `name` de la última runa (la que
// acaba al final). Si se cancela o nunca llega, el tope la da por terminada.
function lastRuneFinished(stage, name, capMs) {
  const runes = stage?.querySelectorAll('.pi-rune')
  const anim = runes?.length ? runes[runes.length - 1].getAnimations().find((a) => a.animationName === name) : null
  const cap = new Promise((resolve) => setTimeout(resolve, capMs))
  return Promise.race([anim ? anim.finished.catch(() => {}) : Promise.resolve(), cap])
}

// Resuelve cuando la pantalla lleva `frames` cuadros seguidos sin tirón.
function whenSmooth(isAlive) {
  return new Promise((resolve) => {
    const t0 = performance.now()
    let last = t0
    let streak = 0
    const tick = (now) => {
      if (!isAlive()) return
      streak = now - last < SMOOTH.ms ? streak + 1 : 0
      last = now
      if (streak >= SMOOTH.frames || now - t0 > SMOOTH.cap) resolve()
      else requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
}

export default function PreloaderIntro({ canLeave, onDone }) {
  const stageRef = React.useRef(null)
  const wordRef = React.useRef(null)
  const doneRef = React.useRef(onDone)
  doneRef.current = onDone
  // Desde cuándo puede irse (null mientras no carga la fuente).
  const [leaveAt, setLeaveAt] = React.useState(null)
  const [leaving, setLeaving] = React.useState(false)

  React.useEffect(() => {
    let alive = true
    // Si la fuente no llega a tiempo, el sitio no se queda esperando.
    const giveUp = setTimeout(() => { if (alive) doneRef.current?.() }, 2500)

    whenRuneFontsReady().then(() => requestAnimationFrame(() => {
      const el = wordRef.current
      if (!alive || !el) return
      clearTimeout(giveUp)
      // Ancho en vw: si la ventana cambia, la palabra la sigue.
      el.style.fontSize = '100px'
      const w = el.offsetWidth || 1
      el.style.fontSize = `min(${((WIDTH * 100 * 100) / w).toFixed(3)}vw, ${MAX_VH}vh)`
      const clones = runeLetterClones(el) || []
      // En orden y sin huecos: la doble L es una sola copia (letterBoxes).
      clones.forEach(([c], i) => {
        c.classList.add('pi-rune')
        c.style.setProperty('--pi-in-at', `${i * T.inStep}ms`)
        c.style.setProperty('--pi-in-len', `${T.inMs}ms`)
        c.style.setProperty('--pi-out-at', `${i * T.outStep}ms`)
        c.style.setProperty('--pi-out-len', `${T.outMs}ms`)
        el.parentNode.appendChild(c)
      })
      // El sostén cuenta desde que la última runa terminó de entrar.
      const inTotal = T.inStep * Math.max(0, clones.length - 1) + T.inMs
      lastRuneFinished(stageRef.current, 'piIn', inTotal + 4000).then(() => {
        if (alive) setLeaveAt(performance.now() + T.minHold)
      })
    }))

    return () => {
      alive = false
      clearTimeout(giveUp)
    }
  }, [])

  // Se va cuando ya pasó lo mínimo, el sitio terminó lo pesado y la pantalla
  // pinta fluido (si no, la salida arrancaría a tirones).
  React.useEffect(() => {
    if (leaveAt == null || !canLeave || leaving) return undefined
    let alive = true
    const id = setTimeout(() => {
      whenSmooth(() => alive).then(() => { if (alive) setLeaving(true) })
    }, Math.max(0, leaveAt - performance.now()))
    return () => {
      alive = false
      clearTimeout(id)
    }
  }, [leaveAt, canLeave, leaving])

  // Lo demás entra hasta que se apagó la última runa, y un respiro después.
  React.useEffect(() => {
    if (!leaving) return undefined
    let alive = true
    let id = null
    const n = stageRef.current?.querySelectorAll('.pi-rune').length || 0
    const outTotal = T.outStep * Math.max(0, n - 1) + T.outMs
    lastRuneFinished(stageRef.current, 'piOut', outTotal + 4000).then(() => {
      if (alive) id = setTimeout(() => doneRef.current?.(), T.after)
    })
    return () => {
      alive = false
      clearTimeout(id)
    }
  }, [leaving])

  return (
    <div ref={stageRef} className={`pi-stage ${leaving ? 'pi-leave' : ''}`} aria-hidden="true">
      <div className="pi-word">
        <span ref={wordRef} className="pi-base" style={{ fontFamily: RUNE_FONT_FAMILY_BOLD }}>{WORD}</span>
      </div>
    </div>
  )
}
