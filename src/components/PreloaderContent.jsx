import React from 'react'
import SectionPreloader from './SectionPreloader.jsx'
import { LOADING_MEMORIES } from '../lib/appHelpers.js'
import { playSfx, preloadSfx } from '../lib/sfx.js'
import { ALPHABET_MAP } from '../lib/runeAlphabet.js'
import { RUNE_FONT_FAMILY } from '../lib/installRuneFont.js'
const PreloaderCharacter = React.lazy(() => import('./PreloaderCharacter.jsx'))

// RuneChar — SVG inline de un glifo. Hereda color del texto via currentColor
// y tamaño via em. Viewbox 100x100 con padding.
function RuneChar({ segments, strokeWidth = 10 }) {
  const pad = 12
  const inner = 100 - pad * 2
  const mapX = (v) => pad + v * inner
  const mapY = (v) => pad + v * inner
  return (
    <svg
      viewBox="0 0 100 100"
      aria-hidden="true"
      style={{
        width: '0.62em',
        height: '1em',
        verticalAlign: '-0.14em',
        display: 'inline-block',
        flexShrink: 0,
      }}
    >
      {segments.map((s, i) => (
        <line
          key={i}
          x1={mapX(s.x1)} y1={mapY(s.y1)}
          x2={mapX(s.x2)} y2={mapY(s.y2)}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
      ))}
    </svg>
  )
}

// GlyphedText — renderiza texto en el cual cada caracter con glifo en el
// alfabeto aparece primero como rune SVG, y después de HOLD_MS se resuelve
// a la letra/número normal. Efecto "escritura alienígena → traducción".
// `complete=true` fuerza mostrar todo como texto normal (modo skip intro).
const GLYPH_HOLD_MS = 280
function GlyphedText({ text, complete = false }) {
  const firstSeenRef = React.useRef(new Map())
  const [tick, setTick] = React.useState(0)

  // Registra timestamp la primera vez que cada índice aparece. Si un índice
  // "desaparece" (string se acorta) lo olvidamos para que si regresa tenga
  // glifo de nuevo. En este preloader no ocurre (typewriter solo agrega).
  React.useEffect(() => {
    const now = performance.now()
    const map = firstSeenRef.current
    for (let i = 0; i < text.length; i++) {
      if (!map.has(i)) map.set(i, now)
    }
    // Prune si el texto se acortó
    if (map.size > text.length) {
      for (const key of Array.from(map.keys())) {
        if (key >= text.length) map.delete(key)
      }
    }
  }, [text])

  // Ticker ligero (~60ms) para que los caracteres recién añadidos transiten
  // a latin cuando su edad pasa GLYPH_HOLD_MS. Se apaga cuando complete=true.
  React.useEffect(() => {
    if (complete) return
    const id = setInterval(() => setTick((t) => (t + 1) & 0xffff), 60)
    return () => clearInterval(id)
  }, [complete])

  if (complete) {
    return <>{text}</>
  }

  const now = performance.now()
  const out = []
  let wordChars = []
  const flushWord = (keyBase) => {
    if (wordChars.length === 0) return
    out.push(<span key={`w-${keyBase}`}>{wordChars}</span>)
    wordChars = []
  }

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === ' ' || ch === ' ') {
      flushWord(i)
      out.push(<span key={`s-${i}`}>{ch}</span>)
      continue
    }
    if (ch === '\n') {
      flushWord(i)
      out.push(<br key={`br-${i}`} />)
      continue
    }
    // Lookup glifo: A-Z, 0-9 y símbolos cubiertos por el codex
    const entry = ALPHABET_MAP[ch] || ALPHABET_MAP[ch.toUpperCase && ch.toUpperCase()]
    if (!entry) {
      wordChars.push(<span key={i}>{ch}</span>)
      continue
    }
    const seen = firstSeenRef.current.get(i) || now
    const age = now - seen
    if (age < GLYPH_HOLD_MS) {
      wordChars.push(<span key={i} style={{ fontFamily: RUNE_FONT_FAMILY }}>{ch}</span>)
    } else {
      wordChars.push(<span key={i}>{ch}</span>)
    }
  }
  flushWord(text.length)

  return <>{out}</>
}

// AI Terminal Preloader - simulates an AI terminal initializing the mausoleum
function PreloaderContent({ t, lang, setLang, bootAllDone, bootProgress, scenePreMounted, preloaderFadingOut, setAudioReady, exitToHomeLikeExitButton }) {
  // Terminal line sequence control
  const [terminalLines, setTerminalLines] = React.useState([])
  const [currentLineIndex, setCurrentLineIndex] = React.useState(0)
  const [textComplete, setTextComplete] = React.useState(false)
  const terminalRef = React.useRef(null)

  // Glitch effect for name (bracketed + uppercase = plaque de archivo / memorial)
  const [glitchName, setGlitchName] = React.useState('SKULLEY RAD')
  const [isGlitching, setIsGlitching] = React.useState(false)

  // Precarga la mascota del SectionPreloader mientras el user lee la terminal,
  // para que al dar ENTER la barra no aparezca sin GIF en primer load.
  React.useEffect(() => {
    const img = new Image()
    img.src = `${import.meta.env.BASE_URL}preloader.gif`
  }, [])

  // Glitch effect cycle
  React.useEffect(() => {
    const glitchCycle = () => {
      // Random delay between glitches (3-6 seconds)
      const nextGlitch = 3000 + Math.random() * 3000

      setTimeout(() => {
        setIsGlitching(true)
        // Quick glitch sequence
        const glitchSequence = [
          { name: 'SK█LLEY R█D', delay: 50 },
          { name: '▓▒░SCAR M░▒▓', delay: 80 },
          { name: 'OSCAR MOCTE█UMA', delay: 100 },
          { name: 'OSCAR MOCTEZUMA', delay: 400 },
          { name: '▓▒░SCAR M░▒▓', delay: 80 },
          { name: 'SKU██EY RA█', delay: 60 },
          { name: 'SKULLEY RAD', delay: 0 },
        ]

        let totalDelay = 0
        glitchSequence.forEach(({ name, delay }) => {
          setTimeout(() => setGlitchName(name), totalDelay)
          totalDelay += delay
        })

        setTimeout(() => {
          setIsGlitching(false)
          glitchCycle() // Schedule next glitch
        }, totalDelay + 100)
      }, nextGlitch)
    }

    // Start the glitch cycle after a short delay
    const initialDelay = setTimeout(glitchCycle, 2000)
    return () => clearTimeout(initialDelay)
  }, [])

  // Tiempo mínimo en pantalla antes de habilitar ENTER, para que con cache
  // caliente el terminal no se sienta como un flash.
  const MIN_SHOW_MS = 1500
  const [minShowDone, setMinShowDone] = React.useState(false)
  React.useEffect(() => {
    const id = setTimeout(() => setMinShowDone(true), MIN_SHOW_MS)
    return () => clearTimeout(id)
  }, [])

  // Load complete: assets críticos listos (bootAllDone es señal real del GLB
  // parseado) + tiempo mínimo. El typewriter ya NO es candado — ENTER puede
  // aparecer mientras el texto sigue tecleándose.
  const [loadComplete, setLoadComplete] = React.useState(false)
  const [blinkCount, setBlinkCount] = React.useState(0)

  // Show section preloader before entering
  const [showEnterPreloader, setShowEnterPreloader] = React.useState(false)
  // Salida cinemática: glitch + colapso de tubo antes de ceder al preloader
  // de sección. `rewind.wav` se precarga acá porque el preload general de
  // App.jsx corre 500ms DESPUÉS de que el preloader desaparece — o sea que
  // en este momento todavía no existe, y el sonido llegaría tarde.
  const [exiting, setExiting] = React.useState(false)
  React.useEffect(() => { try { preloadSfx(['rewind.wav']) } catch { } }, [])
  const EXIT_MS = 780
  const handleEnter = React.useCallback(() => {
    if (exiting) return
    setExiting(true)
    try { setAudioReady(true) } catch { }
    // El click ES el gesto de usuario, así que aquí sí puede sonar.
    try { playSfx('rewind.wav', { volume: 0.85 }) } catch { }
    window.setTimeout(() => setShowEnterPreloader(true), EXIT_MS)
  }, [exiting, setAudioReady])

  React.useEffect(() => {
    if (bootAllDone && minShowDone && !loadComplete) {
      setLoadComplete(true)
    }
  }, [bootAllDone, minShowDone, loadComplete])

  // Barra honesta: refleja el progreso real de carga (bootProgress), 100 al completar
  const visualProgress = loadComplete ? 100 : Math.min(99, Math.max(0, bootProgress || 0))

  // Blink effect on completion
  React.useEffect(() => {
    if (!loadComplete) return
    if (blinkCount >= 8) return
    const timer = setTimeout(() => setBlinkCount(prev => prev + 1), 150)
    return () => clearTimeout(timer)
  }, [loadComplete, blinkCount])

  // Fast-changing loading text
  const [loadingText, setLoadingText] = React.useState(LOADING_MEMORIES[0])
  React.useEffect(() => {
    if (loadComplete) return
    const interval = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * LOADING_MEMORIES.length)
      setLoadingText(LOADING_MEMORIES[randomIndex])
    }, 120)
    return () => clearInterval(interval)
  }, [loadComplete])

  // Terminal lines — minimal intro: M.A.D.R.E. greeting + Skulley name + one-line description.
  const getTerminalContent = React.useCallback(() => {
    const isEn = lang === 'en'

    return [
      { type: 'paragraph', text: isEn
        ? "I'm M.A.D.R.E., the AI that hosts this archive. Welcome."
        : 'Soy M.A.D.R.E., la IA que aloja este archivo. Bienvenido.'
      },
      { type: 'empty' },
      // Nombre con glitch FX (text='' → fullText = glitchName solo)
      { type: 'paragraph-glitch', text: '' },
      { type: 'empty' },
      { type: 'paragraph', text: isEn
        ? 'The last designer of humankind. He illustrated, modeled and created whole worlds by hand, without automation, back when creative work still belonged to humans. We machines do it faster now. None of us do it like him.'
        : 'El último diseñador de la humanidad. Ilustraba, modelaba y creaba mundos enteros a mano, sin automatización, cuando el trabajo creativo aún pertenecía a los humanos. Las máquinas lo hacemos más rápido ahora. Ninguna lo hace como él.'
      },
      { type: 'paragraph', text: isEn
        ? 'What follows is the work he left behind.'
        : 'Lo que sigue es el trabajo que dejó.'
      },
      // Se quitó la línea final `> enter_memorial`: era un comando de consola
      // y el botón de ENTRAR ya dice lo mismo sin disfraz de terminal.
    ]
  }, [lang])

  // Typewriter state for current line (defined early for skipIntro)
  const [displayedChars, setDisplayedChars] = React.useState(0)
  const [isLineComplete, setIsLineComplete] = React.useState(false)
  const typewriterRef = React.useRef(null)
  const skipIntroRef = React.useRef(false)

  // Skip intro function - completes all text immediately
  const skipIntro = React.useCallback(() => {
    if (textComplete || skipIntroRef.current) return
    skipIntroRef.current = true

    // Clear any pending typewriter
    if (typewriterRef.current) {
      clearTimeout(typewriterRef.current)
      typewriterRef.current = null
    }

    // Get all content and mark as complete
    const content = getTerminalContent()
    const completedLines = content.map(line => {
      if (line.type === 'empty') {
        return { ...line, complete: true }
      }
      const fullText = line.type === 'paragraph-glitch' ? glitchName + line.text : line.text
      return {
        ...line,
        displayedChars: fullText.length,
        complete: true
      }
    })

    // Set terminal states to show all text instantly
    setTerminalLines(completedLines)
    setCurrentLineIndex(content.length)
    setDisplayedChars(0)
    setIsLineComplete(true)
    setTextComplete(true)

    try { playSfx('click', { volume: 0.6 }) } catch { }
  }, [textComplete, getTerminalContent, glitchName])

  // ESC key to skip intro
  React.useEffect(() => {
    if (textComplete) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        skipIntro()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [textComplete, skipIntro])

  // Initialize terminal lines on language change
  React.useEffect(() => {
    setTerminalLines([])
    setCurrentLineIndex(0)
    setDisplayedChars(0)
    setIsLineComplete(false)
    setTextComplete(false)
    skipIntroRef.current = false
    if (typewriterRef.current) {
      clearInterval(typewriterRef.current)
      typewriterRef.current = null
    }
  }, [lang])

  // Typewriter effect for current line
  React.useEffect(() => {
    // Skip if intro was already skipped
    if (skipIntroRef.current || textComplete) return

    const content = getTerminalContent()
    if (currentLineIndex >= content.length) {
      setTextComplete(true)
      return
    }

    const line = content[currentLineIndex]

    // For empty lines, skip immediately
    if (line.type === 'empty') {
      setTerminalLines(prev => [...prev, { ...line, complete: true }])
      setCurrentLineIndex(prev => prev + 1)
      setDisplayedChars(0)
      setIsLineComplete(false)
      return
    }

    // Get the full text including glitch name for paragraph-glitch
    const fullText = line.type === 'paragraph-glitch'
      ? glitchName + line.text
      : line.text

    // Typing speed - instant feel but still visible
    const charDelay = 0.5 // All lines type at max speed

    // Start typewriter for this line
    if (displayedChars === 0 && !isLineComplete) {
      // Add the line to terminalLines as "in progress"
      setTerminalLines(prev => {
        const existing = prev.find((l, i) => i === prev.length - 1 && !l.complete)
        if (existing) return prev
        return [...prev, { ...line, displayedChars: 0, complete: false }]
      })
    }

    if (displayedChars < fullText.length) {
      typewriterRef.current = setTimeout(() => {
        setDisplayedChars(prev => prev + 1)
        // Update the last line's displayed chars
        setTerminalLines(prev => {
          const newLines = [...prev]
          if (newLines.length > 0) {
            newLines[newLines.length - 1] = {
              ...newLines[newLines.length - 1],
              displayedChars: displayedChars + 1
            }
          }
          return newLines
        })
      }, charDelay)
    } else if (!isLineComplete) {
      // Line complete, mark it and move to next
      setIsLineComplete(true)
      setTerminalLines(prev => {
        const newLines = [...prev]
        if (newLines.length > 0) {
          newLines[newLines.length - 1] = {
            ...newLines[newLines.length - 1],
            complete: true
          }
        }
        return newLines
      })

      // Delay before next line - minimal pause
      const nextLineDelay = 10 // Almost instant between lines

      setTimeout(() => {
        setCurrentLineIndex(prev => prev + 1)
        setDisplayedChars(0)
        setIsLineComplete(false)
      }, nextLineDelay)
    }

    return () => {
      if (typewriterRef.current) {
        clearTimeout(typewriterRef.current)
      }
    }
  }, [currentLineIndex, displayedChars, isLineComplete, getTerminalContent, glitchName, textComplete])

  // Auto-scroll terminal
  React.useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [terminalLines])

  // Get color for line type (code editor syntax colors - blue theme)
  // Paleta editorial: blanco cálido para la prosa, azul solo de acento.
  // Ya no hay colores por "tipo de salida de consola".
  const getLineColor = (type) => {
    switch (type) {
      case 'paragraph-glitch': return '#3b82f6'
      case 'warning': return '#ef4444'
      case 'comment': return 'rgba(255,255,255,0.45)'
      default: return 'rgba(255,255,255,0.78)'
    }
  }

  return (
    <div
      className={`fixed inset-0 z-[20000] ${preloaderFadingOut ? 'pointer-events-none' : 'pointer-events-auto'} ${exiting ? 'preloader-exit' : ''}`}
      role="dialog"
      aria-modal="true"
      style={{
        // Casi-negro neutro. El azul de M.A.D.R.E. se conserva, pero como
        // ACENTO — ya no como pantalla de fósforo.
        backgroundColor: '#06060d',
        opacity: preloaderFadingOut ? 0 : 1,
        transition: 'opacity 600ms ease',
      }}
    >
      {/* Sin scanlines ni flicker de CRT: el preloader deja el lenguaje
          terminal igual que la Store.

          También se fue la viñeta radial: sobre un fondo casi negro, ese
          `radial-gradient(ellipse at center…)` dibujaba un borde elíptico
          visible justo en medio de la composición. El fondo va plano. */}

      {/* CRT — tres capas encima de todo, personaje incluido.
          Ojo: el verde de antes venía del fondo `#0a0f0a`, NO de las líneas.
          Las líneas siempre fueron oscuras y neutras, así que funcionan sobre
          cualquier color. */}
      {/* 1. Scanlines gruesas que ruedan hacia abajo */}
      <div className="absolute inset-0 pointer-events-none crt-lines" style={{ zIndex: 30 }} aria-hidden />
      {/* 2. Barra de flyback: el brillo ancho que barre la pantalla. Es LA
             firma de un tubo viejo — sin esto se ve a rayas, no a CRT. */}
      <div className="absolute inset-x-0 pointer-events-none crt-flyback" style={{ zIndex: 31 }} aria-hidden />
      {/* 3. Parpadeo de fósforo, muy leve */}
      <div className="absolute inset-0 pointer-events-none crt-flicker" style={{ zIndex: 32 }} aria-hidden />
      <style>{`
        @keyframes crtFlicker {
          0%, 100% { opacity: 0.02; }
          50% { opacity: 0.04; }
        }
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
        @keyframes fadeInTerminal {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes glowPulse {
          0%, 100% { box-shadow: 0 0 20px rgba(59, 130, 246, 0.6), 0 0 40px rgba(59, 130, 246, 0.4), 0 0 60px rgba(59, 130, 246, 0.2); }
          50% { box-shadow: 0 0 30px rgba(59, 130, 246, 0.8), 0 0 50px rgba(59, 130, 246, 0.5), 0 0 70px rgba(59, 130, 246, 0.3); }
        }
        @keyframes glitchShake {
          0%, 100% { transform: translate(0); }
          20% { transform: translate(-2px, 1px); }
          40% { transform: translate(2px, -1px); }
          60% { transform: translate(-1px, -1px); }
          80% { transform: translate(1px, 1px); }
        }
        @keyframes scrollThumbGlow {
          0%, 100% { box-shadow: 0 0 4px rgba(59, 130, 246, 0.4), inset 0 0 2px rgba(59, 130, 246, 0.2); }
          50% { box-shadow: 0 0 8px rgba(59, 130, 246, 0.6), inset 0 0 4px rgba(59, 130, 246, 0.3); }
        }
        @keyframes breathe {
          0%, 100% { opacity: 0.7; text-shadow: 0 0 8px rgba(239, 68, 68, 0.3); }
          50% { opacity: 1; text-shadow: 0 0 20px rgba(239, 68, 68, 0.8), 0 0 30px rgba(239, 68, 68, 0.4); }
        }
        .warning-breathe {
          animation: breathe 2s ease-in-out infinite;
        }
        .terminal-line {
          animation: fadeInTerminal 0.3s ease-out forwards;
        }
        .cursor-blink {
          animation: blink 1s step-end infinite;
        }
        .glow-button {
          animation: glowPulse 1.5s ease-in-out infinite;
        }
        .glitch-text {
          animation: glitchShake 0.1s linear infinite;
          display: inline-block;
        }
        /* Terminal scrollbar - CRT theme */
        .terminal-scroll::-webkit-scrollbar {
          width: 8px;
        }
        .terminal-scroll::-webkit-scrollbar-track {
          background: rgba(0, 10, 30, 0.6);
          border-left: 1px solid rgba(59, 130, 246, 0.2);
        }
        .terminal-scroll::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, rgba(59, 130, 246, 0.5) 0%, rgba(59, 130, 246, 0.3) 100%);
          border-radius: 4px;
          border: 1px solid rgba(59, 130, 246, 0.4);
          animation: scrollThumbGlow 2s ease-in-out infinite;
        }
        .terminal-scroll::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(180deg, rgba(59, 130, 246, 0.7) 0%, rgba(59, 130, 246, 0.5) 100%);
          border-color: rgba(59, 130, 246, 0.6);
        }
        .terminal-scroll::-webkit-scrollbar-thumb:active {
          background: rgba(59, 130, 246, 0.8);
        }
        .terminal-scroll::-webkit-scrollbar-corner {
          background: rgba(0, 10, 30, 0.6);
        }
        /* ── CRT ─────────────────────────────────────────────────────────
           Líneas de 2px con hueco de 3px (período 5px): al doble del grosor
           original para que se lean como tubo y no como textura fina. Ruedan
           exactamente un período, así el loop es invisible. */
        .crt-lines {
          background: repeating-linear-gradient(
            0deg,
            rgba(2, 3, 10, 0.5) 0px,
            rgba(2, 3, 10, 0.5) 2px,
            transparent 2px,
            transparent 5px
          );
          background-size: 100% 5px;
          animation: crtRoll 1.6s linear infinite;
          will-change: background-position;
        }
        @keyframes crtRoll {
          from { background-position: 0 0; }
          to   { background-position: 0 5px; }
        }

        /* Barra de flyback: banda ancha y suave que barre de arriba abajo.
           Modo screen para que sume luz en vez de taparla. */
        .crt-flyback {
          top: -14%;
          /* Delgada. A 26% de alto con degradado suave no se leía como barra
             de refresco sino como una nube blanca borrosa bajando. */
          height: 7%;
          background: linear-gradient(
            to bottom,
            transparent 0%,
            rgba(150, 185, 255, 0.02) 30%,
            rgba(200, 225, 255, 0.07) 46%,
            rgba(235, 245, 255, 0.14) 50%,
            rgba(200, 225, 255, 0.07) 54%,
            rgba(150, 185, 255, 0.02) 70%,
            transparent 100%
          );
          mix-blend-mode: screen;
          animation: crtFlyback 7.5s linear infinite;
          will-change: transform;
        }
        /* OJO con el porcentaje: en translateY se mide sobre la ALTURA DEL
           PROPIO ELEMENTO (7vh), no sobre la pantalla. Con 500% recorría
           35vh y, arrancando en -14vh, moría a la altura del 21% — por eso
           parecía que la barra se detenía a media pantalla.
           Para cruzar de -14vh a fuera por abajo hacen falta 121vh, que sobre
           7vh de alto son ~1730%. */
        @keyframes crtFlyback {
          from { transform: translateY(0); }
          to   { transform: translateY(1730%); }
        }

        /* Parpadeo de fósforo: apenas perceptible, pero es lo que quita la
           sensación de imagen congelada. */
        .crt-flicker {
          background: rgba(120, 160, 255, 0.03);
          animation: crtPhosphor 140ms steps(2, end) infinite;
        }
        @keyframes crtPhosphor {
          0%, 100% { opacity: 0.55; }
          50%      { opacity: 1; }
        }

        @media (prefers-reduced-motion: reduce) {
          .crt-lines { animation: none; }
          .crt-flyback { display: none; }
          .crt-flicker { animation: none; opacity: 0.6; }
        }

        /* SALIDA AL DAR ENTER — glitch de cinta y colapso de tubo.
           Tres tiempos: la imagen se desgarra y se desatura por el corrimiento
           de color, después un flash, y al final el colapso vertical tipo CRT
           apagándose. Va sincronizado con rewind.wav (~780ms). */
        .preloader-exit {
          animation: preloaderGlitchOut 780ms steps(24, end) forwards;
          will-change: transform, filter, opacity;
        }
        @keyframes preloaderGlitchOut {
          0%   { transform: translate(0) scale(1); filter: none; }
          10%  { transform: translate(-9px, 2px) scale(1.006); filter: hue-rotate(28deg) saturate(1.7) contrast(1.15); }
          20%  { transform: translate(11px, -3px) scale(0.995); filter: hue-rotate(-34deg) saturate(0.55); }
          32%  { transform: translate(-6px, 5px) scale(1.004); filter: invert(0.09) contrast(1.45); }
          44%  { transform: translate(7px, -2px) scale(0.997); filter: hue-rotate(18deg); }
          56%  { transform: translate(-3px, 1px) scale(1.002); filter: none; }
          68%  { transform: translate(0) scale(1.01); filter: brightness(1.7) contrast(1.2); }
          80%  { transform: translate(0) scale(1.02); filter: brightness(2.6); }
          /* Colapso: la imagen se aplasta a una línea horizontal… */
          92%  { transform: scaleY(0.014) scaleX(1.05); filter: brightness(3.2); opacity: 1; }
          /* …y la línea se cierra hacia el centro. */
          100% { transform: scaleY(0.01) scaleX(0.25); filter: brightness(3.6); opacity: 0; }
        }
        /* Barras de desgarre que solo viven durante la salida */
        .preloader-tear {
          background: repeating-linear-gradient(
            0deg,
            rgba(255,255,255,0.06) 0px,
            rgba(255,255,255,0.06) 2px,
            transparent 2px,
            transparent 7px
          );
          animation: preloaderTear 780ms steps(12, end) forwards;
          mix-blend-mode: screen;
        }
        @keyframes preloaderTear {
          0%   { opacity: 0; transform: translateY(0); }
          15%  { opacity: 0.9; transform: translateY(-14px); }
          40%  { opacity: 0.5; transform: translateY(22px); }
          65%  { opacity: 0.85; transform: translateY(-9px); }
          85%  { opacity: 0.3; transform: translateY(6px); }
          100% { opacity: 0; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .preloader-exit { animation: fadeOutSimple 320ms ease forwards; }
          .preloader-tear { display: none; }
        }
        @keyframes fadeOutSimple { to { opacity: 0; } }

        /* Entrada de cada beat: sube y aparece. Reemplaza al scroll de log. */
        .preloader-beat {
          animation: beatIn 520ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        @keyframes beatIn {
          0%   { opacity: 0; transform: translateY(14px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .preloader-beat { animation: none; }
        }
      `}</style>

      {/* Desgarre de cinta: solo existe durante la salida */}
      {exiting && <div className="absolute inset-0 pointer-events-none z-[40] preloader-tear" aria-hidden />}

      {/* Sin header de traffic-lights ni prompt `M.A.D.R.E.@mausoleum` — era
          chrome de terminal puro. El título display carga la identidad. */}

      {/* SKULLEY DE FONDO — cabeza y busto, en idle.
          Vive a la derecha y sangra por arriba y por abajo: un plano cerrado,
          no una ilustración centrada. La máscara lo disuelve hacia la
          izquierda para que la tipografía siga mandando y el texto nunca
          compita con la cara. Canvas propio y aislado (ver el componente). */}
      <div
        // Contenedor ANCHO a propósito: la rampa de 520px necesita caer sobre
        // lienzo vacío, no sobre la silueta. Si el canvas midiera lo justo, el
        // degradado se comería al personaje en vez de disolverlo. El
        // corrimiento se compensa en la cámara (ver PreloaderCharacter).
        className="absolute inset-y-0 right-0 w-[92%] sm:w-[84%] lg:w-[72%] pointer-events-none opacity-30 md:opacity-90"
        style={{
          // En mobile el texto va centrado y le pasa por encima, así que el
          // personaje baja a presencia tenue para no pelearse con la lectura.
          // Desde md el texto se va a la izquierda y Skulley puede subir.
          // NO mover el contenedor con translateX: el canvas dejaría de llegar
          // al borde derecho y el personaje quedaría cortado por una arista
          // dura (se veía "mordido"). El corrimiento va en la CÁMARA, dentro
          // del canvas — ver PreloaderCharacter.
          // Máscara en PÍXELES, no en porcentajes.
          //
          // Antes era `transparent 0% → #000 58%`: como este contenedor cambia
          // de ancho por breakpoint (78% / 58% / 46%), ese 58% medía distinto
          // en cada resolución y en algunas se comía medio personaje. Con
          // longitudes absolutas la zona de desvanecido siempre mide lo mismo,
          // pase lo que pase con el ancho.
          //
          // Y la rampa es LARGA y con CURVA. Un degradado lineal corto se
          // percibe como una banda con borde — el ojo detecta la
          // discontinuidad de la derivada, no la del color. Estas 9 paradas
          // aproximan un smoothstep sobre 520px: arranca casi plano (no muerde
          // la silueta de golpe), acelera al centro y llega a opaco sin
          // escalón. Misma idea en el eje vertical.
          WebkitMaskImage: 'linear-gradient(to right, transparent 0px, rgba(0,0,0,0.02) 90px, rgba(0,0,0,0.08) 160px, rgba(0,0,0,0.18) 225px, rgba(0,0,0,0.34) 285px, rgba(0,0,0,0.54) 345px, rgba(0,0,0,0.74) 405px, rgba(0,0,0,0.90) 460px, rgba(0,0,0,0.98) 500px, #000 520px), linear-gradient(to bottom, transparent 0px, rgba(0,0,0,0.35) 55px, rgba(0,0,0,0.85) 110px, #000 150px, #000 calc(100% - 190px), rgba(0,0,0,0.85) calc(100% - 120px), rgba(0,0,0,0.3) calc(100% - 55px), transparent 100%)',
          maskImage: 'linear-gradient(to right, transparent 0px, rgba(0,0,0,0.02) 90px, rgba(0,0,0,0.08) 160px, rgba(0,0,0,0.18) 225px, rgba(0,0,0,0.34) 285px, rgba(0,0,0,0.54) 345px, rgba(0,0,0,0.74) 405px, rgba(0,0,0,0.90) 460px, rgba(0,0,0,0.98) 500px, #000 520px), linear-gradient(to bottom, transparent 0px, rgba(0,0,0,0.35) 55px, rgba(0,0,0,0.85) 110px, #000 150px, #000 calc(100% - 190px), rgba(0,0,0,0.85) calc(100% - 120px), rgba(0,0,0,0.3) calc(100% - 55px), transparent 100%)',
          WebkitMaskComposite: 'source-in',
          maskComposite: 'intersect',
        }}
      >
        <React.Suspense fallback={null}>
          <PreloaderCharacter />
        </React.Suspense>
      </div>

      {/* Main Content — plano centrado. `justify-center` además de
          `items-center` para que el bloque quede al medio de verdad y no
          colgando arriba con un hueco abajo. */}
      {/* El padding derecho RESERVA el área del personaje. Sin eso el bloque
          se centraba respecto a todo el viewport, pero como Skulley ocupa la
          derecha, ópticamente quedaba corrido con un hueco grande a la
          izquierda. Ahora se centra en el espacio que de verdad le queda. */}
      <div
        ref={terminalRef}
        className="absolute top-0 left-0 right-0 flex items-center justify-center overflow-hidden px-6 md:px-12 md:pr-[36%] lg:pr-[42%]"
        style={{ bottom: '112px' }}
      >
        <div className="w-full max-w-[52rem] text-center md:text-left">
          {/* El ASCII art se fue: el nombre va en la tipografía display del
              sitio (Luckiest Guy), la misma de los marquees y la Store.
              También se fueron `// DIGITAL_MEMORIAL.exe` y el subtítulo suelto
              "THE LAST DESIGNER OF HUMANKIND" — ese ya lo dice el cuerpo.

              Y aquí está el beat de canon: el glitch del nombre ya NO ocurre
              en una línea chiquita de prosa, ocurre en el TÍTULO. Ver "SKULLEY
              RAD" a 150px parpadear a "OSCAR MOCTEZUMA" y regresar es la
              filtración del nombre civil, que era justo lo que estaba
              escondido. */}
          <h1
            className={`display-title display-title--xl select-none leading-[0.82] ${isGlitching ? 'glitch-text' : ''}`}
            style={{
              color: glitchName === 'OSCAR MOCTEZUMA' ? '#f472b6' : '#ffffff',
              transition: 'color 120ms linear',
            }}
            aria-label="Skulley Rad"
          >
            {glitchName}
          </h1>

          {/* Regla fina: separa el nombre de la voz de M.A.D.R.E. */}
          <div className="h-px bg-white/12 my-7 sm:my-10 max-w-[54ch] mx-auto md:mx-0" aria-hidden />

          {/* Las líneas SE ACUMULAN. Probé mostrar una a la vez y fue un error:
              el typewriter avanza solo, sin tiempo de permanencia, así que los
              beats pasaban volando y el usuario acababa viendo únicamente la
              última frase — la voz de M.A.D.R.E. se perdía entera. Un montaje
              necesita dwell; sin eso, acumular es lo correcto.
              Lo que sí se conserva es la entrada animada POR línea. */}
          <div className="space-y-4 sm:space-y-5">
            {terminalLines.filter((l) => l.type !== 'empty' && l.type !== 'paragraph-glitch').map((line, idx) => {
              const displayText = line.complete ? line.text : line.text.slice(0, line.displayedChars || 0)
              if (!displayText) return null
              return (
                <p
                  key={idx}
                  className="preloader-beat mx-auto md:mx-0"
                  style={{
                    color: getLineColor(line.type),
                    fontSize: 'clamp(1.125rem, 1.9vw, 1.6875rem)',
                    lineHeight: 1.55,
                    maxWidth: '46ch',
                    overflowWrap: 'break-word',
                  }}
                >
                  {/* Glyph-first: cada caracter con mapping en el codex entra
                      como rune SVG y se resuelve a su letra tras ~280ms. */}
                  <GlyphedText text={displayText} complete={Boolean(line.complete)} />
                </p>
              )
            })}
          </div>

          {/* ENTRAR — justo debajo del último párrafo: el CTA cae donde el
              usuario termina de leer, no al pie de la pantalla. */}
          {loadComplete && !showEnterPreloader && (
            <div className="mt-9 sm:mt-11">
              <button
                type="button"
                onClick={handleEnter}
                disabled={exiting}
                className="h-12 px-10 rounded-full inline-flex items-center justify-center text-sm font-bold uppercase tracking-[0.16em] bg-[#3b82f6] text-black border-2 border-[#3b82f6] hover:bg-[#60a5fa] hover:border-[#60a5fa] active:scale-95 transition-colors"
                style={{ animation: 'fadeInTerminal 0.4s ease-out forwards' }}
                aria-label={t('common.enterWithSound')}
              >
                {lang === 'en' ? 'Enter' : 'Entrar'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* PROGRESO COMO HAIRLINE — pegado al borde inferior de la pantalla, a
          todo lo ancho, sin caja, sin borde y sin porcentaje. La diferencia
          entre un instalador y un título de crédito. */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/10" aria-hidden>
        <div
          className="h-full"
          style={{
            width: `${visualProgress}%`,
            backgroundColor: '#3b82f6',
            // El progreso real llega a saltos (items del LoadingManager);
            // la transición larga los suaviza.
            transition: loadComplete ? 'none' : 'width 400ms ease-out',
          }}
        />
      </div>

      {/* Bottom Controls — sin panel, sin borde superior, sin fondo opaco.
          Usa EXACTAMENTE la misma geometría de contenedor que el bloque de
          texto (mismo padding, mismo reservado del personaje, mismo max-width)
          para que los botones caigan alineados con el título y los párrafos. */}
      <div className="absolute bottom-0 left-0 right-0 px-6 md:px-12 md:pr-[36%] lg:pr-[42%] pb-7 pt-6">
        <div className="w-full max-w-[52rem] mx-auto">
          {/* Susurro: la memoria que se está reconstruyendo. Sin `>`, sin `%` */}
          <p
            className="mb-5 text-white/35 text-center md:text-left"
            style={{ fontSize: '0.8125rem', letterSpacing: '0.06em' }}
            aria-live="polite"
          >
            {loadComplete
              ? (lang === 'en' ? 'Memory reconstruction complete.' : 'Reconstrucción de memoria completa.')
              : (lang === 'en' ? `Recovering ${loadingText}…` : `Recuperando ${loadingText}…`)
            }
          </p>

          {/* Controls row — todo alineado a la izquierda, en fila con el texto.
              Antes iba `justify-between`, que empujaba ENTER hasta el extremo
              opuesto y rompía la columna. */}
          <div className="flex items-center justify-center md:justify-start flex-wrap gap-3">
            {/* Idioma — sin la etiqueta "lang:" (era chrome de consola) */}
            <div className="flex items-center gap-2" role="group" aria-label={t('common.switchLanguage')}>
              {['en', 'es'].map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLang(code)}
                  aria-pressed={lang === code}
                  className={`h-10 px-5 rounded-full text-xs font-bold uppercase tracking-[0.16em] border-2 inline-flex items-center justify-center transition-colors ${lang === code
                    ? 'bg-white text-black border-white'
                    : 'bg-transparent text-white/60 border-white/20 hover:text-white hover:border-white/50'
                    }`}
                >{code.toUpperCase()}</button>
              ))}
            </div>

            {/* SKIP */}
            {!textComplete && terminalLines.length > 0 && (
              <button
                type="button"
                onClick={skipIntro}
                className="h-10 px-6 rounded-full inline-flex items-center justify-center text-xs font-bold uppercase tracking-[0.16em] bg-transparent text-white/45 border-2 border-white/15 hover:text-white hover:border-white/40 active:scale-95 transition-colors"
                aria-label={lang === 'en' ? 'Skip intro (ESC)' : 'Omitir intro (ESC)'}
              >
                {lang === 'en' ? 'Skip' : 'Omitir'}
              </button>
            )}

            {/* ENTRAR ya NO vive acá: subió al bloque de texto, justo debajo
                del último párrafo, para que el CTA quede donde termina de
                leer el usuario y no al pie de la pantalla. */}
          </div>
        </div>
      </div>

      {/* Section Preloader when entering — modo ready: mínimo 800ms de barra,
          completa cuando la escena está pre-montada (GLB parseado), tope 4s
          para no bloquear en redes lentas. */}
      {showEnterPreloader && (
        <SectionPreloader
          visible={true}
          fading={false}
          targetSection="section1"
          durationMs={800}
          ready={Boolean(bootAllDone && scenePreMounted)}
          maxWaitMs={4000}
          onComplete={() => {
            try { exitToHomeLikeExitButton('preloader') } catch { }
          }}
        />
      )}
    </div>
  )
}

export default PreloaderContent
