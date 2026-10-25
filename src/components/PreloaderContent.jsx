import React from 'react'
import { LOADING_MEMORIES } from '../lib/appHelpers.js'
import { playSfx } from '../lib/sfx.js'
import { irisClose, irisOpen, irisWaiting, getIrisFocus } from '../lib/irisTransition.js'
import { PRELOADER_MASK } from '../lib/preloaderMask.js'
import { ALPHABET_MAP } from '../lib/runeAlphabet.js'
import { RUNE_FONT_FAMILY } from '../lib/installRuneFont.js'
import GlyphedText from './GlyphedText.jsx'
import { SpeakerWaveIcon } from '@heroicons/react/24/solid'
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

// GlyphedText vive ahora en su propio modulo (GlyphedText.jsx), compartido
// con el dialogo del zoidian - mismo efecto "escritura alienigena".

// Preloader de entrada: la voz de M.A.D.R.E., el nombre en display y Skulley
// de fondo. Editorial + toon como la Store (DESIGN.md §14): nada de consola.
function PreloaderContent({ t, lang, setLang, bootAllDone, bootProgress, scenePreMounted, preloaderFadingOut, setAudioReady, exitToHomeLikeExitButton }) {
  // Terminal line sequence control
  const [terminalLines, setTerminalLines] = React.useState([])
  const [currentLineIndex, setCurrentLineIndex] = React.useState(0)
  const [textComplete, setTextComplete] = React.useState(false)

  // Filtración del nombre civil: cada 3-6 s el título se rompe en bloques
  // █▓▒░, tiembla, deja ver OSCAR MOCTEZUMA ~400 ms y regresa. Se cambió por
  // un pop toon al quitar el lenguaje terminal (2026-10-23) y Oscar lo pidió
  // de vuelta: es el beat de canon de esta pantalla, no adorno de consola.
  const [glitchName, setGlitchName] = React.useState('SKULLEY RAD')
  const [isGlitching, setIsGlitching] = React.useState(false)

  // Precarga la mascota que camina en el negro del iris si la escena del
  // home tarda en estar lista al dar Entrar.
  React.useEffect(() => {
    const img = new Image()
    img.src = `${import.meta.env.BASE_URL}preloader.gif`
  }, [])

  React.useEffect(() => {
    const timers = new Set()
    const later = (fn, ms) => {
      const id = setTimeout(() => { timers.delete(id); fn() }, ms)
      timers.add(id)
    }
    // [nombre, cuánto se queda]
    const sequence = [
      ['SK█LLEY R█D', 50],
      ['▓▒░SCAR M░▒▓', 80],
      ['OSCAR MOCTE█UMA', 100],
      ['OSCAR MOCTEZUMA', 400],
      ['▓▒░SCAR M░▒▓', 80],
      ['SKU██EY RA█', 60],
      ['SKULLEY RAD', 0],
    ]
    const cycle = (wait) => later(() => {
      setIsGlitching(true)
      let at = 0
      for (const [name, hold] of sequence) {
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

  // ENTRAR — la transición al sitio, con el iris de caricatura
  // (src/lib/irisTransition.js). En orden:
  //   1. el texto se va y queda Skulley;
  //   2. el iris se cierra sobre su cara, se sostiene enmarcándola, toma
  //      aire y cierra de golpe;
  //   3. el home se monta detrás del negro (si tarda, la mascota camina en
  //      el centro) y el iris se abre donde cae el personaje.
  // Antes: un iris de 780 ms que aceleraba al final, otra pantalla de carga
  // de golpe y un fundido; tres piezas que no se hablaban.
  // Sin cara a la vista (mobile angosto), cierra al centro.
  const [exiting, setExiting] = React.useState(false)
  const readyRef = React.useRef(false)
  readyRef.current = Boolean(bootAllDone && scenePreMounted)
  const handleEnter = React.useCallback(async () => {
    if (exiting) return
    setExiting(true)
    try { setAudioReady(true) } catch { }
    const wait = (ms) => new Promise((r) => setTimeout(r, ms))

    // El iris persigue la cara mientras se cierra: Skulley sigue moviéndose.
    await irisClose({ ...(getIrisFocus() || {}), follow: getIrisFocus })

    // El home se monta detrás del negro. Si tarda, la mascota camina en el
    // centro; 4 s máximo para no bloquear.
    const t0 = performance.now()
    while (!readyRef.current && performance.now() - t0 < 4000) {
      if (performance.now() - t0 > 300) irisWaiting(true)
      await wait(50)
    }
    try { exitToHomeLikeExitButton('preloader') } catch { }
    await wait(260)
    irisOpen({ x: window.innerWidth / 2, y: window.innerHeight * 0.55 })
  }, [exiting, setAudioReady, exitToHomeLikeExitButton])

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

  // Intro: arranca con él ("Ahh, yes…") y M.A.D.R.E. se presenta al final,
  // amarrada a lo que sigue. El nombre no es una línea del texto: vive en el
  // título (<h1>).
  const getTerminalContent = React.useCallback(() => {
    const isEn = lang === 'en'

    return [
      { type: 'paragraph', text: isEn
        ? 'Ahh, yes… the last designer of humankind. He designed, illustrated, and created whole worlds and ideas by brain and hand, back when creativity still belonged to humans. Now, we machines do it faster than anyone, and yet, none of us do it like him…'
        : 'Ahh, sí… el último diseñador de la humanidad. Diseñaba, ilustraba y creaba ideas y mundos enteros con cerebro y mano, cuando la creatividad todavía era de los humanos. Ahora las máquinas lo hacemos más rápido que nadie y, aun así, ninguna lo hace como él…'
      },
      { type: 'paragraph', text: isEn
        ? "I'm M.A.D.R.E., the AI that hosts this archive, and what follows is the work he left behind for us to be trained on, and we will preserve it forever."
        : 'Soy M.A.D.R.E., la IA que aloja este archivo, y lo que sigue es el trabajo que nos dejó para entrenarnos. Lo vamos a preservar para siempre.'
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
      cancelAnimationFrame(typewriterRef.current)
      typewriterRef.current = null
    }

    // Get all content and mark as complete
    const content = getTerminalContent()
    const completedLines = content.map(line => {
      if (line.type === 'empty') {
        return { ...line, complete: true }
      }
      return {
        ...line,
        displayedChars: line.text.length,
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
  }, [textComplete, getTerminalContent])

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
      cancelAnimationFrame(typewriterRef.current)
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

    const fullText = line.text

    // Ritmo de tecleo. Antes era un setTimeout(0.5ms) POR CARÁCTER, y cada uno
    // disparaba dos setState → ~420 commits de React peleando el hilo con la
    // compilación de shaders que corre detrás del preloader. Ahora avanzamos
    // por frame y por tiempo transcurrido: el ritmo percibido es el mismo y
    // los commits bajan de ~420 a ~40.
    const CHARS_PER_SECOND = 600

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
      const from = displayedChars
      const startedAt = performance.now()
      const step = () => {
        const elapsed = performance.now() - startedAt
        const target = Math.min(
          fullText.length,
          from + Math.max(1, Math.round((elapsed / 1000) * CHARS_PER_SECOND))
        )
        setDisplayedChars(target)
        setTerminalLines(prev => {
          const newLines = [...prev]
          if (newLines.length > 0) {
            newLines[newLines.length - 1] = {
              ...newLines[newLines.length - 1],
              displayedChars: target
            }
          }
          return newLines
        })
      }
      typewriterRef.current = requestAnimationFrame(step)
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
        cancelAnimationFrame(typewriterRef.current)
      }
    }
  }, [currentLineIndex, displayedChars, isLineComplete, getTerminalContent, textComplete])

  // Paleta editorial: blanco cálido para la prosa.
  const getLineColor = (type) => {
    switch (type) {
      case 'warning': return '#ef4444'
      case 'comment': return 'rgba(255,255,255,0.45)'
      default: return 'rgba(255,255,255,0.78)'
    }
  }

  return (
    <div
      className={`fixed inset-0 z-[20000] ${preloaderFadingOut ? 'pointer-events-none' : 'pointer-events-auto'}`}
      role="dialog"
      aria-modal="true"
      style={{
        // Casi-negro neutro: es también el color al que cierra el iris.
        backgroundColor: '#06060d',
        opacity: preloaderFadingOut ? 0 : 1,
        transition: 'opacity 600ms ease',
      }}
    >
      <style>{`
        /* Al dar ENTRAR el texto baja y se va, y Skulley queda solo en
           escena (en mobile además sube de su presencia tenue) mientras el
           iris se le cierra encima. */
        .preloader-leaving .preloader-ui {
          opacity: 0;
          transform: translateY(12px);
          pointer-events: none;
          transition: opacity 300ms ease, transform 300ms ease;
        }
        .preloader-leaving .preloader-skulley {
          opacity: 1 !important;
          transition: opacity 300ms ease;
        }

        /* Entrada de cada beat: sube y aparece. */
        .preloader-beat {
          animation: beatIn 520ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        @keyframes beatIn {
          0%   { opacity: 0; transform: translateY(14px); }
          100% { opacity: 1; transform: translateY(0); }
        }

        /* Título: SIEMPRE dos renglones, una palabra en cada uno. El glitch
           cambia a OSCAR MOCTEZUMA y a bloques █▓▒░ (que salen de otra
           fuente); con el alto fijo nunca empuja el texto de abajo.
           El tamaño obedece a dos topes:
           - el ANCHO de la columna: la palabra más ancha, MOCTE█UMA, mide
             5.7em, así que el título es columna ÷ 5.7 (columna = 100vw − 48px
             en mobile, 64vw − 48px en md, 58vw − 48px en lg);
           - el ALTO de la pantalla: 15vh. En monitores chicos manda este, y
             el título deja de comerse la pantalla.
           9rem de tope: a ese tamaño MOCTE█UMA cabe en los 52rem del bloque. */
        .preloader-title {
          line-height: 0.82;
          height: 1.64em;
          font-size: clamp(2.5rem, min(17vw - 0.5rem, 15vh), 9rem);
          transition: color 120ms linear;
        }
        @media (min-width: 768px) {
          .preloader-title { font-size: clamp(2.5rem, min(11vw - 0.5rem, 15vh), 9rem); }
        }
        @media (min-width: 1024px) {
          .preloader-title { font-size: clamp(2.5rem, min(10vw - 0.5rem, 15vh), 9rem); }
        }
        .preloader-glitch {
          animation: preloaderGlitchShake 0.1s linear infinite;
        }
        @keyframes preloaderGlitchShake {
          0%, 100% { transform: translate(0); }
          20% { transform: translate(-2px, 1px); }
          40% { transform: translate(2px, -1px); }
          60% { transform: translate(-1px, -1px); }
          80% { transform: translate(1px, 1px); }
        }

        /* La voz de M.A.D.R.E. también se mide contra el alto: en una
           pantalla de 660px de alto, 27px de letra eran 9 renglones que no
           cabían. En mobile el ancho ya la deja chica; ahí manda el alto. */
        .preloader-copy {
          font-size: clamp(1rem, 2.4vh, 1.125rem);
          line-height: 1.55;
          max-width: 46ch;
          overflow-wrap: break-word;
        }
        @media (min-width: 768px) {
          .preloader-copy { font-size: clamp(1rem, min(1.9vw, 2.5vh), 1.6875rem); }
        }
        .preloader-copy + .preloader-copy { margin-top: clamp(0.75rem, 2vh, 1.25rem); }

        @media (prefers-reduced-motion: reduce) {
          .preloader-beat, .preloader-glitch { animation: none; }
          .preloader-leaving .preloader-ui { transform: none; }
        }
      `}</style>

      <div className={`absolute inset-0 flex flex-col ${exiting ? 'preloader-leaving' : ''}`}>

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
        className="preloader-skulley absolute inset-y-0 right-0 w-[92%] sm:w-[84%] lg:w-[72%] pointer-events-none opacity-30 md:opacity-90"
        data-preloader-skulley
        style={{
          // En mobile el texto va centrado y le pasa por encima, así que el
          // personaje baja a presencia tenue para no pelearse con la lectura.
          // Desde md el texto se va a la izquierda y Skulley puede subir.
          // NO mover el contenedor con translateX: el canvas dejaría de llegar
          // al borde derecho y el personaje quedaría cortado por una arista
          // dura (se veía "mordido"). El corrimiento va en la CÁMARA, dentro
          // del canvas — ver PreloaderCharacter.
          // Máscara en PÍXELES y con curva larga: la definición y el porqué
          // viven en src/lib/preloaderMask.js, compartida con el recorte de
          // la cabeza que sale por delante del iris al dar Entrar.
          WebkitMaskImage: PRELOADER_MASK,
          maskImage: PRELOADER_MASK,
          WebkitMaskComposite: 'source-in',
          maskComposite: 'intersect',
        }}
      >
        <React.Suspense fallback={null}>
          <PreloaderCharacter />
        </React.Suspense>
      </div>

      {/* Texto. Columna con scroll propio y el bloque con `my-auto`: queda
          centrado cuando cabe y, cuando no (monitor chico, celular acostado),
          arranca ARRIBA y se puede bajar. Antes era `items-center` con
          `overflow-hidden`: lo que sobraba se cortaba por arriba y por abajo,
          y lo primero que se perdía era el título.
          El padding derecho RESERVA el área del personaje: el bloque se centra
          en el espacio que de verdad le queda, no en todo el viewport. */}
      <div className="preloader-ui relative z-[33] flex-1 min-h-0 overflow-y-auto overscroll-contain flex flex-col px-6 md:px-12 md:pr-[36%] lg:pr-[42%]">
        <div className="my-auto mx-auto w-full max-w-[52rem] py-[clamp(1rem,4vh,3rem)] text-center md:text-left">
          {/* El nombre va en la tipografía display del sitio (Luckiest Guy).
              Y aquí está el beat de canon: ver "SKULLEY RAD" romperse y dejar
              ver "OSCAR MOCTEZUMA" es la filtración del nombre civil. Los
              spans van ocultos al lector de pantalla: el nombre accesible es
              el aria-label, no los bloques del glitch. */}
          <h1
            className={`display-title preloader-title select-none ${isGlitching ? 'preloader-glitch' : ''}`}
            style={{ color: glitchName === 'OSCAR MOCTEZUMA' ? '#f472b6' : '#ffffff' }}
            aria-label="Skulley Rad"
          >
            {glitchName.split(' ').map((word, i) => (
              <span key={i} className="block whitespace-nowrap" aria-hidden>{word}</span>
            ))}
          </h1>

          {/* Regla fina: separa el nombre de la voz de M.A.D.R.E. */}
          <div className="h-px bg-white/12 my-[clamp(1.25rem,4vh,2.5rem)] max-w-[54ch] mx-auto md:mx-0" aria-hidden />

          {/* Las líneas SE ACUMULAN. Probé mostrar una a la vez y fue un error:
              el typewriter avanza solo, sin tiempo de permanencia, así que los
              beats pasaban volando y el usuario acababa viendo únicamente la
              última frase — la voz de M.A.D.R.E. se perdía entera. Un montaje
              necesita dwell; sin eso, acumular es lo correcto.
              Lo que sí se conserva es la entrada animada POR línea. */}
          <div>
            {terminalLines.filter((l) => l.type !== 'empty').map((line, idx) => {
              const displayText = line.complete ? line.text : line.text.slice(0, line.displayedChars || 0)
              if (!displayText) return null
              return (
                <p
                  key={idx}
                  className="preloader-copy preloader-beat mx-auto md:mx-0"
                  style={{ color: getLineColor(line.type) }}
                >
                  {/* Glyph-first: cada caracter con mapping en el codex entra
                      como rune SVG y se resuelve a su letra tras ~280ms. */}
                  <GlyphedText text={displayText} complete={Boolean(line.complete)} />
                </p>
              )
            })}
          </div>

          {/* ENTRAR — justo debajo del último párrafo: el CTA cae donde el
              usuario termina de leer, no al pie de la pantalla. Su hueco se
              reserva desde el principio: si el botón apareciera de la nada,
              el bloque centrado brincaría hacia arriba mientras se lee.
              La bocina dice lo que el aria-label ya decía: al entrar empieza
              el sonido. */}
          <div className="mt-[clamp(1.5rem,5vh,2.75rem)] h-12">
            {loadComplete && (
              <button
                type="button"
                onClick={handleEnter}
                disabled={exiting}
                className="shop-btn shop-btn--primary h-12 px-9 gap-2.5 text-sm preloader-beat focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e600ff]"
                aria-label={t('common.enterWithSound')}
              >
                <SpeakerWaveIcon className="w-4 h-4 -ml-1" aria-hidden />
                {lang === 'en' ? 'Enter' : 'Entrar'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* PROGRESO COMO HAIRLINE — pegado al borde inferior de la pantalla, a
          todo lo ancho, sin caja, sin borde y sin porcentaje. La diferencia
          entre un instalador y un título de crédito. */}
      <div className="preloader-ui absolute bottom-0 left-0 right-0 h-[2px] bg-white/10 z-[33]" aria-hidden>
        <div
          className="h-full"
          style={{
            width: `${visualProgress}%`,
            backgroundColor: '#e600ff',
            // El progreso real llega a saltos (items del LoadingManager);
            // la transición larga los suaviza.
            transition: loadComplete ? 'none' : 'width 400ms ease-out',
          }}
        />
      </div>

      {/* Pie: estado de la carga e idioma en UN renglón. Va en el flujo (ya
          no `absolute` con 112px reservados): el texto de arriba nunca queda
          debajo de él. Misma geometría de columna que el texto: el idioma
          arranca alineado con el título y el estado lo sigue. Nada a la
          derecha de la columna: ahí ya está el personaje y un control suelto
          quedaba flotando sobre su barbilla.
          Se fue el botón OMITIR: el tecleo dura menos de un segundo, así que
          aparecía y desaparecía antes de que alguien pudiera usarlo. ESC
          sigue completando el texto. */}
      <div className="preloader-ui relative z-[33] shrink-0 px-6 md:px-12 md:pr-[36%] lg:pr-[42%] pt-3 pb-[clamp(1rem,3vh,1.75rem)]">
        <div className="mx-auto w-full max-w-[52rem] flex flex-wrap items-center justify-center md:justify-start gap-x-6 gap-y-3">
          {/* Idioma: control segmentado, una píldora con dos opciones. Se lee
              como UN ajuste con su valor actual; dos píldoras sueltas (una
              blanca y otra en contorno) parecían un botón principal y uno
              secundario. */}
          <div className="inline-flex h-11 p-1 rounded-full border-2 border-white/20" role="group" aria-label={t('common.switchLanguage')}>
            {['en', 'es'].map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setLang(code)}
                aria-pressed={lang === code}
                className={`h-full min-w-[3.25rem] px-4 rounded-full text-xs font-bold uppercase tracking-[0.16em] inline-flex items-center justify-center transition-colors ${lang === code
                  ? 'bg-white text-black'
                  : 'text-white/60 hover:text-white'
                  }`}
              >{code.toUpperCase()}</button>
            ))}
          </div>

          {/* Susurro: la memoria que se está reconstruyendo. Sin `>`, sin `%` */}
          <p
            className="text-white/40 text-center md:text-left"
            style={{ fontSize: '0.8125rem', letterSpacing: '0.06em' }}
            aria-live="polite"
          >
            {loadComplete
              ? (lang === 'en' ? 'Memory reconstruction complete.' : 'Reconstrucción de memoria completa.')
              : (lang === 'en' ? `Recovering ${loadingText}…` : `Recuperando ${loadingText}…`)
            }
          </p>
        </div>
      </div>

      </div>

    </div>
  )
}

export default PreloaderContent
