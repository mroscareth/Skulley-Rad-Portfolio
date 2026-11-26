import { useEffect, useMemo, useRef, useState } from 'react'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import { pedirTurno, soltarTurno, tiempoLinea, alCompletar, hablando, registrarCallar, TURNO } from '../lib/turnoGlobos.js'

// Lo que dura un globo sale del turno de palabra (lib/turnoGlobos.js): se escribe a TURNO.letras y,
// ya completo, se queda lo que se tarda en leerlo. Las frases de Skulley piden turno como las de
// Argus y M.A.D.R.E.: no cortan a nadie ni se cortan.
function computeVisibleMs(txt) {
  return tiempoLinea(txt).total * 1000
}

// Chained phrase pairs: when phrase at key index finishes, the value index follows.
// The follower indices are excluded from the random pool so they only appear after their trigger.
const PHRASE_CHAINS = { 7: 8 } // McDonald's "rather die" → "was just a joke"
const CHAINED_FOLLOWERS = new Set(Object.values(PHRASE_CHAINS))

/**
 * useSpeechBubbles
 * - Simple scheduler: shows random phrases with a typing effect.
 * - Supports chained pairs: certain phrases always trigger a specific follow-up.
 * - i18n: on language change, re-translates the active bubble keeping the same index.
 */
export default function useSpeechBubbles({
  enabled = true,
  phrasesKey = 'portrait.phrases',
  typingCps = 14,
  firstDelayMs = 250,
  delayMinMs = 2000,
  delayRandMs = 2600,
  // false: sin frases solas; solo salen al llamar `decir()` (y las de override).
  automatico = true,
  pausaMs = 2500,
} = {}) {
  const { lang, t } = useLanguage()
  // Bubble theme (e.g. egg override for 3D bubble)
  const [theme, setTheme] = useState('normal') // 'normal' | 'egg'

  const phrases = useMemo(() => {
    try {
      const arr = t(phrasesKey)
      if (Array.isArray(arr) && arr.length) return arr
    } catch {}
    return []
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, phrasesKey])

  const phrasesRef = useRef(phrases)
  useEffect(() => { phrasesRef.current = phrases }, [phrases])

  const [visible, setVisible] = useState(false)
  const [fullText, setFullText] = useState('')
  const [displayText, setDisplayText] = useState('')

  const idxRef = useRef(null)
  const overrideRef = useRef(null) // { phrasesKey, idx, untilMs }
  const typingIdxRef = useRef(0)
  const shownOnceRef = useRef(false)

  const showTimerRef = useRef(null)
  const hideTimerRef = useRef(null)
  const typingTimerRef = useRef(null)
  const epochRef = useRef(0)

  const clearAllTimers = () => {
    try { if (showTimerRef.current) { clearTimeout(showTimerRef.current); showTimerRef.current = null } } catch {}
    try { if (hideTimerRef.current) { clearTimeout(hideTimerRef.current); hideTimerRef.current = null } } catch {}
    try { if (typingTimerRef.current) { clearInterval(typingTimerRef.current); typingTimerRef.current = null } } catch {}
  }

  const bumpEpoch = () => {
    epochRef.current += 1
    clearAllTimers()
  }

  const startTyping = (text) => {
    try { if (typingTimerRef.current) clearInterval(typingTimerRef.current) } catch {}
    typingIdxRef.current = 0
    setDisplayText('')
    if (!text) return
    const stepMs = Math.max(12, Math.round(1000 / TURNO.letras))
    const myEpoch = epochRef.current
    typingTimerRef.current = setInterval(() => {
      if (myEpoch !== epochRef.current) return
      typingIdxRef.current += 1
      const next = text.slice(0, typingIdxRef.current)
      setDisplayText(next)
      if (typingIdxRef.current >= text.length) {
        try { clearInterval(typingTimerRef.current) } catch {}
        typingTimerRef.current = null
      }
    }, stepMs)
  }

  const showOverride = (detail) => {
    try {
      if (!detail) return
      const k = typeof detail.phrasesKey === 'string' ? detail.phrasesKey : null
      const idx = (detail.idx === 0 || detail.idx) ? Number(detail.idx) : null
      const dur = (detail.durationMs === 0 || detail.durationMs) ? Number(detail.durationMs) : null
      const direct = typeof detail.text === 'string' ? detail.text : ''

      let resolved = direct
      if (k) {
        try {
          const fresh = t(k)
          const arr = Array.isArray(fresh) ? fresh : []
          if (idx != null && isFinite(idx) && arr.length) resolved = arr[idx] || arr[0] || resolved
        } catch {}
      }
      if (!resolved) return
      pedirTurno({ quien: 'skulley', texto: resolved, prioridad: 3, espera: 8, iniciar: () => mostrarOverride(k, idx, resolved, dur) })
    } catch {}
  }

  const mostrarOverride = (k, idx, resolved, dur) => {
    try {
      bumpEpoch()
      try {
        // Egg theme: only when the override comes from i18n egg phrases `portrait.eggPhrases`
        setTheme(k === 'portrait.eggPhrases' ? 'egg' : 'normal')
      } catch {}
      // save override for re-translation on language change
      overrideRef.current = (k && idx != null && isFinite(idx)) ? { phrasesKey: k, idx: idx } : { phrasesKey: null, idx: null, text: resolved }
      setFullText(resolved)
      setVisible(true)
      startTyping(resolved)

      const visibleFor = (dur && isFinite(dur) && dur > 200) ? dur : computeVisibleMs(resolved, typingCps)
      const myEpoch = epochRef.current
      hideTimerRef.current = setTimeout(() => {
        if (myEpoch !== epochRef.current) return
        overrideRef.current = null
        setVisible(false)
        setFullText('')
        setDisplayText('')
        try { setTheme('normal') } catch {}
        soltarTurno('skulley')
        scheduleNext()
      }, visibleFor)
    } catch {}
  }

  // Show a specific phrase by index then schedule next (used by chaining logic). Pide turno.
  const pendienteRef = useRef(0)
  const showPhraseByIdx = (idx, { prioridad = 1, espera = 8 } = {}) => {
    const list = phrasesRef.current || []
    const next = list[idx] || list[0] || ''
    if (!next) { scheduleNext(); return }
    pendienteRef.current = performance.now() + espera * 1000
    pedirTurno({ quien: 'skulley', texto: next, prioridad, espera, iniciar: () => { pendienteRef.current = 0; mostrarFrase(idx, next) } })
  }

  const mostrarFrase = (idx, next) => {
    bumpEpoch()
    idxRef.current = idx
    shownOnceRef.current = true
    try { setTheme('normal') } catch {}
    setFullText(next)
    setVisible(true)
    startTyping(next)
    const visibleFor = computeVisibleMs(next, typingCps)
    const myEpoch = epochRef.current
    hideTimerRef.current = setTimeout(() => {
      if (myEpoch !== epochRef.current) return
      setVisible(false)
      setFullText('')
      setDisplayText('')
      try { setTheme('normal') } catch {}
      soltarTurno('skulley')
      // If this phrase triggers a chained follow-up, show it after a short pause
      if (PHRASE_CHAINS[idx] != null) {
        const followerIdx = PHRASE_CHAINS[idx]
        // Fijo, no derivado de delayMinMs: el remate del chain debe ser rápido y no escalar con el delay
        // ambient. El remate va primero en la fila del turno de palabra.
        const chainDelay = 600 + Math.random() * 400
        showTimerRef.current = setTimeout(() => {
          if (myEpoch !== epochRef.current) return
          showPhraseByIdx(followerIdx, { prioridad: 5, espera: 10 })
        }, chainDelay)
      } else {
        scheduleNext()
      }
    }, visibleFor)
  }

  const scheduleNext = () => {
    if (!enabled || !automatico) return
    if (overrideRef.current) return
    const arr = phrasesRef.current || []
    if (!arr.length) return

    const delay = shownOnceRef.current
      ? (delayMinMs + Math.random() * delayRandMs)
      : firstDelayMs

    const myEpoch = epochRef.current
    showTimerRef.current = setTimeout(() => {
      if (myEpoch !== epochRef.current) return
      const list = phrasesRef.current || []
      // Build pool excluding chained followers (they only appear after their trigger)
      const pool = []
      for (let i = 0; i < list.length; i++) {
        if (!CHAINED_FOLLOWERS.has(i)) pool.push(i)
      }
      if (!pool.length) return
      const idx = pool[Math.floor(Math.random() * pool.length)]
      showPhraseByIdx(idx)
    }, delay)
  }

  // Start/stop
  useEffect(() => {
    bumpEpoch()
    if (!enabled) {
      // Soltar el override colgado: su hide-timer ya murió con bumpEpoch y si queda
      // seteado, scheduleNext() abortaría para siempre al re-habilitar.
      overrideRef.current = null
      setVisible(false)
      setFullText('')
      setDisplayText('')
      try { setTheme('normal') } catch {}
      return () => {}
    }
    // Re-habilitar agenda desde cero: firstDelayMs solo si nunca se mostró nada
    // (shownOnceRef), si no con el delay ambient normal (ver scheduleNext).
    scheduleNext()
    return () => clearAllTimers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])

  // External overrides (e.g. portrait easter egg) to show specific phrase for a few seconds
  useEffect(() => {
    const onOverride = (e) => { try { showOverride(e?.detail) } catch {} }
    try { window.addEventListener('speech-bubble-override', onOverride) } catch {}
    return () => { try { window.removeEventListener('speech-bubble-override', onOverride) } catch {} }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, typingCps])

  // Re-translate visible bubble on language change
  useEffect(() => {
    if (!enabled) return
    if (!visible) return
    // If there's an active override (with key+idx), re-resolve from i18n egg phrases
    if (overrideRef.current && overrideRef.current.phrasesKey && (overrideRef.current.idx === 0 || overrideRef.current.idx)) {
      const k = overrideRef.current.phrasesKey
      const idx = overrideRef.current.idx
      try {
        const fresh = t(k)
        const arr = (Array.isArray(fresh) && fresh.length) ? fresh : []
        const next = arr[idx] || arr[0] || ''
        if (!next) return
        bumpEpoch()
        try { setTheme(k === 'portrait.eggPhrases' ? 'egg' : 'normal') } catch {}
        setFullText(next)
        setVisible(true)
        startTyping(next)
        const visibleFor = computeVisibleMs(next, typingCps)
        const myEpoch = epochRef.current
        hideTimerRef.current = setTimeout(() => {
          if (myEpoch !== epochRef.current) return
          overrideRef.current = null
          setVisible(false)
          setFullText('')
          setDisplayText('')
          try { setTheme('normal') } catch {}
          scheduleNext()
        }, visibleFor)
      } catch {}
      return
    }

    const idx = idxRef.current
    if (idx == null) return
    try {
      const fresh = t(phrasesKey)
      const arr = (Array.isArray(fresh) && fresh.length) ? fresh : (phrasesRef.current || [])
      const next = arr[idx] || arr[0] || ''
      bumpEpoch()
      try { setTheme('normal') } catch {}
      setFullText(next)
      setVisible(true)
      startTyping(next)
      const visibleFor = computeVisibleMs(next, typingCps)
      const myEpoch = epochRef.current
      hideTimerRef.current = setTimeout(() => {
        if (myEpoch !== epochRef.current) return
        setVisible(false)
        setFullText('')
        setDisplayText('')
        try { setTheme('normal') } catch {}
        scheduleNext()
      }, visibleFor)
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang])

  // Ocupada mientras hay frase y `pausaMs` después de que se va (también el
  // hueco antes del remate de un chain), para que no salgan una tras otra.
  const visibleRef = useRef(visible)
  visibleRef.current = visible
  const libreDesdeRef = useRef(0)
  useEffect(() => {
    if (!visible) libreDesdeRef.current = performance.now() + pausaMs
  }, [visible, pausaMs])
  const ocupada = () => visibleRef.current || performance.now() < libreDesdeRef.current
    || performance.now() < pendienteRef.current || hablando() === 'skulley'

  // Una frase al azar ahora mismo, sin repetir la última.
  const fullTextRef = useRef(fullText)
  fullTextRef.current = fullText
  useEffect(() => alCompletar(() => {
    if (!typingTimerRef.current) return
    try { clearInterval(typingTimerRef.current) } catch {}
    typingTimerRef.current = null
    setDisplayText(fullTextRef.current)
  }), [])
  // un susto (el rayo que lo despieza): se calla a media frase (turnoGlobos `choque`)
  useEffect(() => registrarCallar('skulley', () => {
    epochRef.current += 1
    clearAllTimers()
    overrideRef.current = null
    pendienteRef.current = 0
    setVisible(false)
    setFullText('')
    setDisplayText('')
    try { setTheme('normal') } catch {}
  }), [])
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled
  const decir = () => {
    if (!enabledRef.current || ocupada()) return
    const list = phrasesRef.current || []
    const pool = []
    for (let i = 0; i < list.length; i++) {
      if (!CHAINED_FOLLOWERS.has(i) && i !== idxRef.current) pool.push(i)
    }
    if (!pool.length) return
    bumpEpoch()
    overrideRef.current = null
    showPhraseByIdx(pool[Math.floor(Math.random() * pool.length)])
  }

  return {
    visible,
    text: displayText || fullText,
    fullText,
    theme,
    decir,
    ocupada,
  }
}

