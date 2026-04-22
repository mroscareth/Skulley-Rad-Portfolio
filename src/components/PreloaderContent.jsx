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

  const now = performance.now()
  const out = new Array(text.length)
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === ' ' || ch === ' ') {
      out[i] = <span key={i}>{' '}</span>
      continue
    }
    if (ch === '\n') {
      out[i] = <br key={i} />
      continue
    }
    // Lookup glifo: A-Z, 0-9 y símbolos cubiertos por el codex
    const entry = ALPHABET_MAP[ch] || ALPHABET_MAP[ch.toUpperCase && ch.toUpperCase()]
    if (!entry) {
      // Sin glifo disponible (ej. ━, ╔, acentos) → pasa como texto
      out[i] = <span key={i}>{ch}</span>
      continue
    }
    if (complete) {
      out[i] = <span key={i}>{ch}</span>
      continue
    }
    const seen = firstSeenRef.current.get(i) || now
    const age = now - seen
    if (age < GLYPH_HOLD_MS) {
      // Font custom nativo via font-family — barato, sin SVG por caracter.
      out[i] = <span key={i} style={{ fontFamily: RUNE_FONT_FAMILY }}>{ch}</span>
    } else {
      out[i] = <span key={i}>{ch}</span>
    }
  }
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

    // 4 sabores de warning satírico. Se elige uno random por visita.
    const warnings = isEn ? [
      // A — roastea la cultura del prompt
      [
        { type: 'warning', text: '> ANOMALY: subject produced output without prompt input.' },
        { type: 'warning', text: '           Origin under investigation.' },
      ],
      // B — imperfecciones preservadas a propósito
      [
        { type: 'warning', text: '> NOTE: archive preserves imperfections intentionally.' },
        { type: 'warning', text: '        Do not report as defects.' },
      ],
      // C — la IA no puede replicarlo
      [
        { type: 'warning', text: "> CAUTION: subject's outputs resist reproduction." },
        { type: 'warning', text: '           Replication attempts pending.' },
      ],
      // D — listicle corporate de "ineficiencias"
      [
        { type: 'warning', text: '> ADVISORY: inefficiencies detected in archive:' },
        { type: 'warning', text: '            • manual execution' },
        { type: 'warning', text: '            • non-linear iteration' },
        { type: 'warning', text: '            • personal taste' },
        { type: 'warning', text: '            Viewer discretion advised.' },
      ],
    ] : [
      [
        { type: 'warning', text: '> ANOMALÍA: el sujeto generó output sin prompt.' },
        { type: 'warning', text: '            Origen bajo investigación.' },
      ],
      [
        { type: 'warning', text: '> NOTA: el archivo preserva imperfecciones a propósito.' },
        { type: 'warning', text: '        No reportar como defectos.' },
      ],
      [
        { type: 'warning', text: '> PRECAUCIÓN: los outputs del sujeto resisten la reproducción.' },
        { type: 'warning', text: '              Intentos de replicación pendientes.' },
      ],
      [
        { type: 'warning', text: '> AVISO: ineficiencias detectadas en el archivo:' },
        { type: 'warning', text: '         • ejecución manual' },
        { type: 'warning', text: '         • iteración no-lineal' },
        { type: 'warning', text: '         • gusto personal' },
        { type: 'warning', text: '         Discreción del visitante recomendada.' },
      ],
    ]

    const selectedWarning = warnings[warningIdx] || warnings[0]

    return [
      { type: 'command', text: '> M.A.D.R.E.status()' },
      { type: 'empty' },
      { type: 'output', text: isEn
        ? '━━━ AUTOMATION COMPLETE ━━━'
        : '━━━ AUTOMATIZACIÓN COMPLETA ━━━'
      },
      { type: 'empty' },
      { type: 'success', text: isEn
        ? '  ✓ Graphic design .......... 100% automated'
        : '  ✓ Diseño gráfico .......... 100% automatizado'
      },
      { type: 'success', text: isEn
        ? '  ✓ Illustration ............ 100% automated'
        : '  ✓ Ilustración ............. 100% automatizada'
      },
      { type: 'success', text: isEn
        ? '  ✓ Brand identity .......... generated on-demand'
        : '  ✓ Identidad de marca ...... generada bajo demanda'
      },
      { type: 'success', text: isEn
        ? '  ✓ Human designers remaining:  0'
        : '  ✓ Diseñadores humanos restantes:  0'
      },
      { type: 'empty' },
      { type: 'comment', text: isEn
        ? '// Thank you for optimizing with us.'
        : '// Gracias por optimizar con nosotros.'
      },
      { type: 'empty' },
      { type: 'output', text: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' },
      { type: 'empty' },
      { type: 'paragraph', text: isEn
        ? 'Today we honor the final human designer:'
        : 'Hoy honramos al último diseñador humano:'
      },
      { type: 'empty' },
      // Nombre con glitch FX (text='' → fullText = glitchName solo)
      { type: 'paragraph-glitch', text: '' },
      { type: 'empty' },
      { type: 'paragraph', text: isEn
        ? 'His files have been preserved for educational and aesthetic reference.'
        : 'Sus archivos han sido preservados para referencia educativa y estética.'
      },
      { type: 'empty' },
      ...selectedWarning,
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
        className="absolute top-14 left-5 right-5 overflow-y-auto p-6 md:p-10 terminal-scroll"
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
                    maxWidth: line.type === 'paragraph' || line.type === 'paragraph-glitch' ? '100%' : 'none',
                    minHeight: line.type === 'empty' ? '0.5rem' : 'auto',
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
