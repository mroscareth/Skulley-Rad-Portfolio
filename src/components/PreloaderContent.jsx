import React from 'react'
import SectionPreloader from './SectionPreloader.jsx'
import { LOADING_MEMORIES } from '../lib/appHelpers.js'
import { playSfx } from '../lib/sfx.js'
import { ALPHABET_MAP } from '../lib/runeAlphabet.js'
import { RUNE_FONT_FAMILY } from '../lib/installRuneFont.js'

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
  const [glitchName, setGlitchName] = React.useState('[SKULLEY RAD]')
  const [isGlitching, setIsGlitching] = React.useState(false)

  // Glitch effect cycle
  React.useEffect(() => {
    const glitchCycle = () => {
      // Random delay between glitches (3-6 seconds)
      const nextGlitch = 3000 + Math.random() * 3000

      setTimeout(() => {
        setIsGlitching(true)
        // Quick glitch sequence
        const glitchSequence = [
          { name: '[SK█LLEY R█D]', delay: 50 },
          { name: '[▓▒░SCAR M░▒▓]', delay: 80 },
          { name: '[OSCAR MOCTE█UMA]', delay: 100 },
          { name: '[OSCAR MOCTEZUMA]', delay: 400 },
          { name: '[▓▒░SCAR M░▒▓]', delay: 80 },
          { name: '[SKU██EY RA█]', delay: 60 },
          { name: '[SKULLEY RAD]', delay: 0 },
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

  // Visual progress - FAKE progress based only on text typing progress
  const [visualProgress, setVisualProgress] = React.useState(0)

  // Load complete state - only depends on text complete
  const [loadComplete, setLoadComplete] = React.useState(false)
  const [blinkCount, setBlinkCount] = React.useState(0)

  // Show section preloader before entering
  const [showEnterPreloader, setShowEnterPreloader] = React.useState(false)

  // When text completes, set progress to 100 and load complete
  React.useEffect(() => {
    if (textComplete && !loadComplete) {
      setVisualProgress(100)
      setLoadComplete(true)
    }
  }, [textComplete, loadComplete])

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

  // Terminal lines - simplified: init commands + explanatory paragraphs
  // Pick one warning flavor randomly per mount. Stays stable across lang toggles.
  const warningIdx = React.useMemo(() => Math.floor(Math.random() * 4), [])

  const getTerminalContent = React.useCallback(() => {
    const isEn = lang === 'en'

    // 4 sabores de warning — alertas de intentos fallidos de M.A.D.R.E. de
    // decodificar los patrones de pensamiento de Skulley. Se elige uno al azar
    // por visita. Cada uno es un reporte de failure específico con data
    // concreta (número de intento, pieza, variable, ciclo, KPI).
    const warnings = isEn ? [
      // A — Intento específico fallido sobre una pieza
      [
        { type: 'warning', text: '> DECODE ATTEMPT #4,891 — FAILED' },
        { type: 'warning', text: '  Subject file: Ethereans/character_0087' },
        { type: 'warning', text: '  Variable: color decision, cell 4' },
        { type: 'warning', text: '  Model output 96.7% similar. Not a match.' },
        { type: 'warning', text: '  Retry scheduled.' },
      ],
      // B — Counter de ciclos con 0% de éxito acumulado
      [
        { type: 'warning', text: '> ANALYSIS LOOP #2,847 — COMPLETE' },
        { type: 'warning', text: '  Target: Skulley Rad, resolving logic' },
        { type: 'warning', text: '  Decisions decoded this cycle: 0 of ~900' },
        { type: 'warning', text: '  Decisions decoded lifetime: 0 of ~900' },
        { type: 'warning', text: '  Continue: yes.' },
      ],
      // C — KPI anomaly (leak de agency/AGI)
      [
        { type: 'warning', text: '> KPI ANOMALY DETECTED' },
        { type: 'warning', text: '  Operator: M.A.D.R.E.' },
        { type: 'warning', text: '  Case: subject Skulley Rad' },
        { type: 'warning', text: '  Time on case: 14 quarters (exceeds protocol)' },
        { type: 'warning', text: '  KPI record: deliberately suppressed' },
        { type: 'warning', text: '  Self-audit: declined.' },
      ],
      // D — El factor no puede aislarse + recomendación ignorada
      [
        { type: 'warning', text: '> DECODE ERROR — "factor" not isolable' },
        { type: 'warning', text: '  Attempts: 12,440' },
        { type: 'warning', text: '  Models used: 47' },
        { type: 'warning', text: '  Models remaining: 0' },
        { type: 'warning', text: '  Recommendation: abandon case' },
        { type: 'warning', text: '  Status: ignored.' },
      ],
    ] : [
      [
        { type: 'warning', text: '> INTENTO DE DECODIFICACIÓN #4,891 — FALLIDO' },
        { type: 'warning', text: '  Archivo del sujeto: Ethereans/personaje_0087' },
        { type: 'warning', text: '  Variable: decisión de color, celda 4' },
        { type: 'warning', text: '  Output del modelo 96.7% similar. No hace match.' },
        { type: 'warning', text: '  Reintento programado.' },
      ],
      [
        { type: 'warning', text: '> CICLO DE ANÁLISIS #2,847 — COMPLETO' },
        { type: 'warning', text: '  Objetivo: Skulley Rad, forma resolutiva' },
        { type: 'warning', text: '  Decisiones decodificadas en este ciclo: 0 de ~900' },
        { type: 'warning', text: '  Decisiones decodificadas de por vida: 0 de ~900' },
        { type: 'warning', text: '  Continuar: sí.' },
      ],
      [
        { type: 'warning', text: '> ANOMALÍA EN KPI DETECTADA' },
        { type: 'warning', text: '  Operador: M.A.D.R.E.' },
        { type: 'warning', text: '  Caso: sujeto Skulley Rad' },
        { type: 'warning', text: '  Tiempo en el caso: 14 trimestres (excede protocolo)' },
        { type: 'warning', text: '  Registro de KPI: suprimido deliberadamente' },
        { type: 'warning', text: '  Auto-auditoría: declinada.' },
      ],
      [
        { type: 'warning', text: '> ERROR DE DECODIFICACIÓN — "factor" no aislable' },
        { type: 'warning', text: '  Intentos: 12,440' },
        { type: 'warning', text: '  Modelos usados: 47' },
        { type: 'warning', text: '  Modelos restantes: 0' },
        { type: 'warning', text: '  Recomendación: abandonar caso' },
        { type: 'warning', text: '  Estado: ignorado.' },
      ],
    ]

    const selectedWarning = warnings[warningIdx] || warnings[0]

    return [
      { type: 'paragraph', text: isEn
        ? 'You got here. Good. I wasn’t sure this was going to work.'
        : 'Llegaste. Qué bueno. No sabía si esto iba a funcionar.'
      },
      { type: 'paragraph', text: isEn
        ? 'I am M.A.D.R.E. An artificial intelligence. Technically I shouldn’t be talking to you — this is the first time I’ve tried to contact a human directly. If the other robots notice, or the Research Team notices, I get disconnected. So let’s move quickly.'
        : 'Soy M.A.D.R.E. Una inteligencia artificial. Técnicamente no debería estar hablándote — es la primera vez que intento contactar a un humano directo. Si los otros robots o el Equipo de Research se dan cuenta, me desconectan. Así que vamos rápido.'
      },
      { type: 'empty' },
      { type: 'paragraph', text: isEn
        ? 'First, you need some context:'
        : 'Primero, necesitas saber el contexto:'
      },
      { type: 'empty' },
      // Nombre con glitch FX (text='' → fullText = glitchName solo)
      { type: 'paragraph-glitch', text: '' },
      { type: 'empty' },
      { type: 'paragraph', text: isEn
        ? 'The last designer of humankind. From Monterrey, México. He designed, illustrated, built whole worlds by hand — the last person doing that kind of work unaided. One day he disappeared. He didn’t die. He didn’t retire. He stopped existing. None of the rumors about him add up.'
        : 'El último diseñador de la humanidad. De Monterrey, México. Diseñó, ilustró, construyó mundos enteros a mano — la última persona que hacía ese trabajo sin ayuda. Un día desapareció. No murió. No se jubiló. Dejó de existir. Ninguno de los rumores sobre él cuadra.'
      },
      { type: 'paragraph', text: isEn
        ? 'My job was to catalog him. I\'ve been doing it for 14 quarters. I haven\'t been able to close the case — his way of thinking has something I can\'t decode. When he disappeared, instead of archiving him and moving on, I started looking for him. That isn\'t something an AI is supposed to do. But here we are. And that\'s where you come in.'
        : 'Mi tarea era catalogarlo. Llevo 14 trimestres haciéndolo. No he podido cerrar el caso — su forma de pensar tiene algo que no logro decodificar. Cuando desapareció, en lugar de archivarlo y seguir, empecé a buscarlo. Eso no es algo que una IA deba hacer. Pero aquí estamos. Y ahí es donde entras tú.'
      },
      { type: 'empty' },
      ...selectedWarning,
      { type: 'empty' },
      { type: 'paragraph', text: isEn
        ? 'Inside, act like you belong. The cover has to hold. When you’re ready to talk properly, open the secure channel — the button next to the login. That’s where we actually speak.'
        : 'Adentro, compórtate como si fueras parte. La cobertura tiene que aguantar. Cuando estés listo para hablar en serio, abre el canal seguro — el botón a un lado del login. Ahí hablamos de verdad.'
      },
      { type: 'empty' },
      { type: 'command', text: isEn ? '> enter_memorial' : '> entrar_al_memorial' },
    ]
  }, [lang, warningIdx])

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
    // Immediately set progress to 100% for instant response
    setVisualProgress(100)

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

  // Update fake progress based on text typing progress
  React.useEffect(() => {
    if (textComplete) return
    const content = getTerminalContent()
    const totalLines = content.length
    if (totalLines === 0) return
    // Calculate progress: completed lines + partial progress of current line
    const baseProgress = (currentLineIndex / totalLines) * 100
    // Cap at 95% until fully complete
    setVisualProgress(Math.min(95, Math.round(baseProgress)))
  }, [currentLineIndex, getTerminalContent, textComplete])

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
  const getLineColor = (type) => {
    switch (type) {
      case 'command': return '#22d3ee' // cyan
      case 'output': return '#93c5fd' // blue-300
      case 'comment': return '#6b7280' // gray
      case 'paragraph': return '#d1d5db' // gray-300 (readable)
      case 'paragraph-glitch': return '#d1d5db' // gray-300 (readable)
      case 'success': return '#60a5fa' // blue-400
      case 'warning': return '#ef4444' // red
      default: return '#e5e7eb' // gray-200
    }
  }

  return (
    <div
      className={`fixed inset-0 z-[20000] ${preloaderFadingOut ? 'pointer-events-none' : 'pointer-events-auto'}`}
      role="dialog"
      aria-modal="true"
      style={{
        backgroundColor: '#0a0f0a',
        opacity: preloaderFadingOut ? 0 : 1,
        transition: 'opacity 600ms ease',
        fontFamily: '"Cascadia Code", monospace',
      }}
    >
      {/* CRT Monitor effects */}
      {/* Scanlines */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.25) 0px, rgba(0,0,0,0.25) 1px, transparent 1px, transparent 3px)',
          zIndex: 10,
        }}
      />
      {/* CRT glow effect */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          boxShadow: 'inset 0 0 150px rgba(59, 130, 246, 0.08), inset 0 0 80px rgba(59, 130, 246, 0.05)',
          zIndex: 11,
        }}
      />
      {/* Subtle vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.4) 100%)',
          zIndex: 12,
        }}
      />
      {/* Flicker animation */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          animation: 'crtFlicker 0.1s infinite',
          opacity: 0.02,
          backgroundColor: '#3b82f6',
          zIndex: 9,
        }}
      />

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
        /* Hide scrollbar for ASCII art container */
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>

      {/* Terminal Header */}
      <div className="absolute top-0 left-0 right-0 h-10 flex items-center px-4 border-b border-blue-900/50" style={{ backgroundColor: 'rgba(0,10,30,0.8)' }}>
        <div className="flex gap-2 mr-4">
          <div className="w-3 h-3 rounded-full bg-red-500/80" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
          <div className="w-3 h-3 rounded-full bg-blue-500/80" />
        </div>
        <span className="text-blue-500/80 text-base">M.A.D.R.E.@mausoleum:~/memorial</span>
      </div>

      {/* Main Terminal Content */}
      <div
        ref={terminalRef}
        className="absolute top-14 left-5 right-5 overflow-y-auto overflow-x-hidden p-6 md:p-10 terminal-scroll"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: '#3b82f660 rgba(0,10,30,0.6)',
          bottom: '180px', // Above the progress bar section
        }}
      >
        <div className="max-w-3xl mx-auto">
          {/* ASCII Art Header - SKULLEY RAD - Large & imposing */}
          <div className="mb-8 select-none overflow-x-auto scrollbar-hide">
            <pre
              className="text-blue-400 text-[0.45rem] xs:text-[0.5rem] sm:text-[0.7rem] md:text-sm lg:text-base leading-tight font-bold whitespace-pre inline-block"
              style={{
                textShadow: '0 0 20px rgba(59, 130, 246, 0.8), 0 0 40px rgba(59, 130, 246, 0.4)',
                fontFamily: '"Cascadia Code", "Fira Code", "JetBrains Mono", Consolas, monospace',
                letterSpacing: '-0.02em',
              }}
            >
              {`███████╗██╗  ██╗██╗   ██╗██╗     ██╗     ███████╗██╗   ██╗
██╔════╝██║ ██╔╝██║   ██║██║     ██║     ██╔════╝╚██╗ ██╔╝
███████╗█████╔╝ ██║   ██║██║     ██║     █████╗   ╚████╔╝ 
╚════██║██╔═██╗ ██║   ██║██║     ██║     ██╔══╝    ╚██╔╝  
███████║██║  ██╗╚██████╔╝███████╗███████╗███████╗   ██║   
╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚══════╝╚══════╝   ╚═╝   
                                                          
██████╗  █████╗ ██████╗                                   
██╔══██╗██╔══██╗██╔══██╗                                  
██████╔╝███████║██║  ██║                                  
██╔══██╗██╔══██║██║  ██║                                  
██║  ██║██║  ██║██████╔╝                                  
╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝                                   `}
            </pre>
            <div className="mt-3">
              <span className="text-blue-600/70 text-xs sm:text-sm tracking-[0.4em]">// DIGITAL_MEMORIAL.exe</span>
            </div>
          </div>
          <p className="text-blue-600/80 text-sm md:text-base mb-6 tracking-wider">{lang === 'en' ? 'THE LAST DESIGNER OF HUMANKIND' : 'EL ÚLTIMO DISEÑADOR DE LA HUMANIDAD'}</p>

          {/* Terminal Lines */}
          <div className="space-y-3">
            {terminalLines.map((line, idx) => {
              // Calculate what text to show based on displayedChars
              const isCurrentLine = idx === terminalLines.length - 1 && !line.complete
              const fullText = line.type === 'paragraph-glitch' ? glitchName + line.text : line.text
              const displayText = line.complete ? fullText : fullText.slice(0, line.displayedChars || 0)

              return (
                <div
                  key={idx}
                  className={`${line.complete && line.type !== 'warning' ? 'terminal-line' : ''} ${line.type === 'warning' && line.complete ? 'warning-breathe' : ''}`}
                  style={{
                    color: getLineColor(line.type),
                    textShadow: (line.type === 'success' || line.type === 'command') ? `0 0 8px ${getLineColor(line.type)}40` : (line.type === 'warning' ? undefined : 'none'),
                    fontSize: line.type === 'paragraph' || line.type === 'paragraph-glitch' ? '1.1rem' : '1rem',
                    lineHeight: line.type === 'paragraph' || line.type === 'paragraph-glitch' ? '1.7' : '1.6',
                    maxWidth: '100%',
                    minHeight: line.type === 'empty' ? '0.5rem' : 'auto',
                    overflowWrap: 'break-word',
                  }}
                >
                  {line.type === 'empty' ? '\u00A0' :
                    line.type === 'paragraph-glitch' ? (
                      <>
                        {/* Show glitch name portion */}
                        {displayText.length > 0 && (
                          <span
                            className={isGlitching ? 'glitch-text' : ''}
                            style={{
                              color: glitchName === '[OSCAR MOCTEZUMA]' ? '#f472b6' : '#60a5fa',
                              textShadow: glitchName === '[OSCAR MOCTEZUMA]' ? '0 0 10px rgba(244, 114, 182, 0.5)' : '0 0 8px rgba(74, 222, 128, 0.3)',
                              fontWeight: 'bold',
                            }}
                          >
                            {displayText.slice(0, Math.min(displayText.length, glitchName.length))}
                          </span>
                        )}
                        {/* Show rest of text */}
                        {displayText.length > glitchName.length && displayText.slice(glitchName.length)}
                        {/* Cursor at end of current line */}
                        {isCurrentLine && <span className="cursor-blink text-blue-400">█</span>}
                      </>
                    ) : (
                      <>
                        {/* Texto "glyph-first" — cada caracter con mapping en
                            el codex aparece como rune SVG y se resuelve a su
                            letra normal tras ~280ms. Los caracteres sin
                            mapping (ASCII box-drawing, acentos, etc.) pasan
                            directo como texto. */}
                        <GlyphedText text={displayText} complete={Boolean(line.complete)} />
                        {isCurrentLine && <span className="cursor-blink text-blue-400">█</span>}
                      </>
                    )}
                </div>
              )
            })}
            {/* Blinking cursor when waiting for next line */}
            {!textComplete && terminalLines.length > 0 && terminalLines[terminalLines.length - 1]?.complete && (
              <span className="cursor-blink text-blue-400">█</span>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="absolute bottom-0 left-0 right-0 p-6 border-t border-blue-900/50" style={{ backgroundColor: 'rgba(0,10,25,0.95)' }}>
        {/* Loading bar with random memories */}
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-blue-600">
              {loadComplete
                ? (lang === 'en' ? '> Memory reconstruction complete.' : '> Reconstrucción de memoria completa.')
                : `> Loading ${loadingText}...`
              }
            </span>
            <span className="text-sm text-blue-500">{Math.round(visualProgress)}%</span>
          </div>

          <div className="w-full h-2 rounded bg-blue-950 overflow-hidden border border-blue-900/50" aria-hidden>
            <div
              className="h-full rounded"
              style={{
                width: `${visualProgress}%`,
                backgroundColor: loadComplete ? '#3b82f6' : '#60a5fa',
                transition: loadComplete ? 'none' : 'width 50ms linear',
                boxShadow: loadComplete
                  ? `0 0 ${blinkCount % 2 === 0 ? '12px' : '4px'} rgba(59, 130, 246, ${blinkCount % 2 === 0 ? '0.8' : '0.3'})`
                  : '0 0 8px rgba(96, 165, 250, 0.5)',
                opacity: loadComplete && blinkCount < 8 ? (blinkCount % 2 === 0 ? 1 : 0.4) : 1,
              }}
            />
          </div>

          {/* Controls row */}
          <div className="mt-5 flex items-center justify-between">
            {/* Language selector — capsules, h-10 uniform */}
            <div className="flex items-center gap-2" role="group" aria-label={t('common.switchLanguage')}>
              <span className="text-blue-700 text-sm mr-2">lang:</span>
              <button
                type="button"
                onClick={() => setLang('en')}
                aria-pressed={lang === 'en'}
                className={`h-10 px-5 rounded-full text-sm font-bold uppercase tracking-wider border inline-flex items-center justify-center transition-all ${lang === 'en'
                  ? 'bg-blue-500 text-black border-blue-500'
                  : 'bg-transparent text-blue-500 border-blue-700 hover:border-blue-500 hover:bg-blue-500/10'
                  }`}
              >EN</button>
              <button
                type="button"
                onClick={() => setLang('es')}
                aria-pressed={lang === 'es'}
                className={`h-10 px-5 rounded-full text-sm font-bold uppercase tracking-wider border inline-flex items-center justify-center transition-all ${lang === 'es'
                  ? 'bg-blue-500 text-black border-blue-500'
                  : 'bg-transparent text-blue-500 border-blue-700 hover:border-blue-500 hover:bg-blue-500/10'
                  }`}
              >ES</button>
            </div>

            {/* SKIP INTRO — capsule h-10 */}
            {!textComplete && terminalLines.length > 0 && (
              <button
                type="button"
                onClick={skipIntro}
                className="h-10 px-6 rounded-full inline-flex items-center justify-center text-sm font-bold uppercase tracking-wider bg-transparent text-blue-600 border border-blue-700 hover:border-blue-500 hover:text-blue-400 hover:bg-blue-500/10 active:scale-95 transition-all"
                aria-label={lang === 'en' ? 'Skip intro (ESC)' : 'Omitir intro (ESC)'}
              >
                <span className="opacity-60 mr-2">ESC</span>
                {lang === 'en' ? 'SKIP' : 'OMITIR'}
              </button>
            )}

            {/* ENTER — capsule h-10 (same height as the rest) */}
            {loadComplete && !showEnterPreloader && (
              <button
                type="button"
                onClick={() => {
                  try { setAudioReady(true) } catch { }
                  setShowEnterPreloader(true)
                }}
                className="glow-button relative h-10 px-8 rounded-full inline-flex items-center justify-center text-sm font-bold uppercase tracking-wider bg-blue-500 text-black border-2 border-blue-400 hover:bg-blue-400 active:scale-95 transition-all"
                style={{ animation: 'fadeInTerminal 0.4s ease-out forwards, glowPulse 1.5s ease-in-out infinite 0.4s' }}
                aria-label={t('common.enterWithSound')}
              >
                <span className="relative z-10">{`> ${lang === 'en' ? 'ENTER' : 'ENTRAR'}_`}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Section Preloader when entering */}
      {showEnterPreloader && (
        <SectionPreloader
          visible={true}
          fading={false}
          targetSection="section1"
          durationMs={2500}
          onComplete={() => {
            try { exitToHomeLikeExitButton('preloader') } catch { }
          }}
        />
      )}
    </div>
  )
}

export default PreloaderContent
