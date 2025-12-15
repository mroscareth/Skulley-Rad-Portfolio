import { useEffect, useMemo, useRef, useState } from 'react'
import { useLanguage } from '../i18n/LanguageContext.jsx'

function computeVisibleMs(txt, typingCps = 14) {
  try {
    const text = String(txt || '')
    const len = text.length
    const typingMs = Math.ceil((len / Math.max(1, typingCps)) * 1000)
    const readingMs = 1500 + len * 35
    const total = typingMs + readingMs
    return Math.max(6500, Math.min(18000, total))
  } catch {
    return 8000
  }
}

/**
 * useSpeechBubbles
 * - Scheduler simple: muestra frases aleatorias con typing.
 * - i18n: al cambiar idioma, re-traduce la viñeta activa manteniendo el mismo índice.
 */
export default function useSpeechBubbles({
  enabled = true,
  phrasesKey = 'portrait.phrases',
  typingCps = 14,
  firstDelayMs = 250,
  delayMinMs = 2000,
  delayRandMs = 2600,
} = {}) {
  const { lang, t } = useLanguage()
  // Tema de la viñeta (ej. egg override para burbuja 3D)
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
    const stepMs = Math.max(12, Math.round(1000 / Math.max(1, typingCps)))
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

      bumpEpoch()
      try {
        // Egg: solo cuando el override viene de i18n `portrait.eggPhrases`
        setTheme(k === 'portrait.eggPhrases' ? 'egg' : 'normal')
      } catch {}
      // guardamos override para re-traducir en cambio de idioma
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
        scheduleNext()
      }, visibleFor)
    } catch {}
  }

  const scheduleNext = () => {
    if (!enabled) return
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
      const idx = Math.floor(Math.random() * Math.max(1, list.length))
      idxRef.current = idx
      const next = list[idx] || list[0] || ''
      shownOnceRef.current = true
      try { setTheme('normal') } catch {}
      setFullText(next)
      setVisible(true)
      startTyping(next)
      const visibleFor = computeVisibleMs(next, typingCps)
      hideTimerRef.current = setTimeout(() => {
        if (myEpoch !== epochRef.current) return
        setVisible(false)
        setFullText('')
        setDisplayText('')
        try { setTheme('normal') } catch {}
        scheduleNext()
      }, visibleFor)
    }, delay)
  }

  // Start/stop
  useEffect(() => {
    bumpEpoch()
    if (!enabled) {
      setVisible(false)
      setFullText('')
      setDisplayText('')
      try { setTheme('normal') } catch {}
      return () => {}
    }
    scheduleNext()
    return () => clearAllTimers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])

  // Overrides externos (ej. easter egg del retrato) para mostrar frase específica unos segundos
  useEffect(() => {
    const onOverride = (e) => { try { showOverride(e?.detail) } catch {} }
    try { window.addEventListener('speech-bubble-override', onOverride) } catch {}
    return () => { try { window.removeEventListener('speech-bubble-override', onOverride) } catch {} }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, typingCps])

  // Re-traducir viñeta visible al cambiar idioma
  useEffect(() => {
    if (!enabled) return
    if (!visible) return
    // Si hay override activo (con key+idx), re-resolver desde i18n egg phrases
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

  return {
    visible,
    text: displayText || fullText,
    fullText,
    theme,
  }
}

