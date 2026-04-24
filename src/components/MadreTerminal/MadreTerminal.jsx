import React from 'react'
import { useLanguage } from '../../i18n/LanguageContext.jsx'
import {
  loadState,
  saveState,
  getCurrentQuest,
  getBriefing,
  getObjectiveHint,
  isPhysicalActionComplete,
  submitAnswer,
  submitClick,
  submitChoice,
  deliverDebrief,
  incrementVisit,
  setPref,
} from '../../lib/questEngine.js'
import {
  SKULLEY_TRIGGERS,
  SKULLEY_PATH,
} from '../../lib/madreResponses.js'

// Typewriter speed (ms por caracter).
const TYPE_SPEED = 22
// Pausa antes de empezar cuando un efecto 'delay' está activo.
const DELAY_MS = 1800
// Silencio largo del Skulley path stage 0.
const SKULLEY_STAGE0_SILENCE = 12000

/**
 * MadreTerminal — panel de quest system.
 *
 * Reemplaza el flujo conversacional por: briefing → awaiting_action → ready_for_debrief → debrief.
 * Cada quest define qué tipo de completion espera (click + answer, archive doc + answer, song + second, choice, etc).
 *
 * Props:
 *   open: boolean — visible o no
 *   onClose: () => void
 *
 * Side-effects:
 *   - Al cerrar después de un briefing, quest pasa a 'awaiting_action' — el user sale
 *     a ejecutar la tarea y los hooks del sitio (trackPieceClicked, etc.) marcan progreso.
 *   - Al reabrir, si isPhysicalActionComplete === true, pide el answer correspondiente.
 *
 * Preserva: bipbop visual, Skulley path (si user escribe "soy skulley"), signal detection.
 */
export default function MadreTerminal({ open, onClose }) {
  const { lang } = useLanguage()

  const scrollRef = React.useRef(null)
  const inputRef = React.useRef(null)
  const bipbopRef = React.useRef(null)

  const [state, setState] = React.useState(() => loadState())
  const [lines, setLines] = React.useState([])
  const [typing, setTyping] = React.useState(false)
  const [inputMode, setInputMode] = React.useState(null)
  // inputMode: null | 'text' | 'continue' | 'choice' | 'skulley_verification'
  const [inputValue, setInputValue] = React.useState('')
  const [pendingChoices, setPendingChoices] = React.useState(null)
  const [bipbopMuted, setBipbopMuted] = React.useState(() => !!loadState().prefs?.bipbopMuted)

  // Skulley path sub-state (manejado localmente — la state machine es simple)
  const [skulleyStage, setSkulleyStage] = React.useState(0)
  const [skulleyActive, setSkulleyActive] = React.useState(false)
  const [skulleyQuestionIndex, setSkulleyQuestionIndex] = React.useState(0)

  const initializedRef = React.useRef(false)

  // --- Inicialización al abrir ---
  React.useEffect(() => {
    if (!open) return
    if (initializedRef.current) return
    initializedRef.current = true

    const bumped = incrementVisit(state)
    saveState(bumped)
    setState(bumped)

    openingSequence(bumped)
  }, [open])

  // --- Reset al cerrar ---
  React.useEffect(() => {
    if (!open) {
      initializedRef.current = false
      setLines([])
      setInputMode(null)
      setInputValue('')
      setPendingChoices(null)
      setTyping(false)
      setSkulleyActive(false)
      setSkulleyStage(0)
      setSkulleyQuestionIndex(0)
    }
  }, [open])

  // --- Escape para cerrar ---
  React.useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // --- Auto-scroll ---
  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [lines, typing])

  // --- Focus input al aparecer ---
  React.useEffect(() => {
    if (inputMode === 'text' && !typing && inputRef.current) {
      inputRef.current.focus()
    }
  }, [inputMode, typing])

  // -------------------------------------------------------------------------
  // OPENING — decide qué mostrar al abrir según quest state
  // -------------------------------------------------------------------------
  function openingSequence(currentState) {
    if (currentState.questPhase === 'complete' || !currentState.currentQuestId) {
      showSimple(
        lang === 'es'
          ? 'Ya terminamos el protocolo. El canal sigue abierto — pero sin tareas pendientes.'
          : 'We finished the protocol. The channel stays open — but nothing pending.',
      )
      return
    }

    const quest = getCurrentQuest(currentState)
    if (!quest) return

    // FASE 1: briefing pendiente → entregar briefing
    if (currentState.questPhase === 'briefing') {
      deliverBriefing(currentState)
      return
    }

    // FASE 2: briefing ya entregado, esperando acción física
    if (currentState.questPhase === 'awaiting_action') {
      // ¿La acción ya se cumplió fuera? → ir directo a answer
      if (isPhysicalActionComplete(currentState)) {
        promptForAnswer(currentState)
      } else {
        // User volvió pero no ha hecho la acción — recordatorio corto
        const hint = getObjectiveHint(currentState, lang)
        showSimple(lang === 'es' ? `Sigues pendiente. ${hint}` : `Still pending. ${hint}`)
      }
      return
    }

    // FASE 3: acción ya cumplida, pendiente debrief — esto pasa si el flow se interrumpió
    if (currentState.questPhase === 'ready_for_debrief') {
      serveDebrief(currentState)
      return
    }
  }

  // -------------------------------------------------------------------------
  // DELIVER BRIEFING
  // -------------------------------------------------------------------------
  function deliverBriefing(currentState) {
    const { text, effects, quest } = getBriefing(currentState, lang)
    appendMadre(text, effects, () => {
      // Después del briefing: mostrar controles según tipo de completion
      const completion = quest.completion
      const updatedState = { ...currentState, questPhase: 'awaiting_action' }
      saveState(updatedState)
      setState(updatedState)

      if (completion.type === 'text_only') {
        // No hay acción física — prompt de respuesta inmediato
        promptForAnswer(updatedState)
      } else if (completion.type === 'click_only' || completion.type === 'cinematic_sequence') {
        // Un solo botón "Continuar"
        showContinueButton(updatedState, completion.type)
      } else if (completion.type === 'choice') {
        // 3 botones de choice
        setPendingChoices(completion.choices)
        setInputMode('choice')
      } else {
        // click_and_answer, archive_and_answer, song_and_answer → cerrar
        // o mostrar un "ok, ve a hacerlo" con opción de close
        showCloseForAction(updatedState)
      }
    })
  }

  // -------------------------------------------------------------------------
  // PROMPT FOR ANSWER (text input)
  // -------------------------------------------------------------------------
  function promptForAnswer(currentState) {
    const quest = getCurrentQuest(currentState)
    if (!quest) return
    const completion = quest.completion

    let promptText = ''
    if (completion.type === 'click_and_answer') {
      promptText = lang === 'es' ? '¿Cuál escogiste?' : 'Which one did you pick?'
    } else if (completion.type === 'archive_and_answer') {
      promptText = lang === 'es' ? 'Dímelo.' : 'Tell me.'
    } else if (completion.type === 'song_and_answer') {
      promptText = lang === 'es' ? '¿En qué segundo?' : 'At what second?'
    } else if (completion.type === 'text_only') {
      promptText = lang === 'es' ? 'Te escucho.' : "I'm listening."
    }

    appendMadre(promptText, [], () => {
      setInputMode('text')
    })
  }

  // -------------------------------------------------------------------------
  // CONTINUE BUTTON (Q7 línea cumbre, Q8 reveal)
  // -------------------------------------------------------------------------
  function showContinueButton(currentState, completionType) {
    setPendingChoices([
      {
        label: { en: 'Continue', es: 'Continuar' },
        action: () => {
          setPendingChoices(null)
          setInputMode(null)
          submitClick()
          const fresh = loadState()
          if (completionType === 'cinematic_sequence') {
            // TODO Q8: disparar cinematic forced nav. Por ahora entrega debrief.
            setState(fresh)
            serveDebrief(fresh)
          } else {
            setState(fresh)
            serveDebrief(fresh)
          }
        },
      },
    ])
    setInputMode('continue')
  }

  // -------------------------------------------------------------------------
  // CLOSE FOR ACTION — user tiene que salir a hacer algo en el sitio
  // -------------------------------------------------------------------------
  function showCloseForAction(currentState) {
    const hint = getObjectiveHint(currentState, lang)
    const quest = getCurrentQuest(currentState)
    const completionType = quest?.completion?.type

    appendMadre(hint, [], () => {
      // Label del botón varía según el tipo: si es archive, directo a fragmented-memories
      let label = { en: "I'm going", es: 'Voy' }
      let navTarget = null
      if (completionType === 'archive_and_answer') {
        label = { en: 'Open archive', es: 'Abrir archivo' }
        navTarget = 'section7'
      } else if (completionType === 'click_and_answer' && quest?.completion?.clickTarget?.section === 'work') {
        label = { en: 'Go to work', es: 'Ir a Work' }
        navTarget = 'section1'
      } else if (completionType === 'song_and_answer') {
        label = { en: 'Go listen', es: 'Ir a escuchar' }
      }

      setPendingChoices([
        {
          label,
          action: () => {
            onClose?.()
            if (navTarget) {
              try {
                window.dispatchEvent(new CustomEvent('navigate-section', { detail: { section: navTarget } }))
              } catch {}
            }
          },
        },
      ])
      setInputMode('continue')
    })
  }

  // -------------------------------------------------------------------------
  // SERVE DEBRIEF
  // -------------------------------------------------------------------------
  function serveDebrief(currentState) {
    const { text, effects, ctaOnDebrief, newState } = deliverDebrief(lang)
    appendMadre(text, effects, () => {
      setState(newState)

      // Después del debrief: entrega siguiente briefing automático, o CTA si es final
      if (newState.questPhase === 'complete') {
        if (ctaOnDebrief === 'contact') {
          showContactCTA()
        }
        return
      }

      // Pequeña pausa dramática + siguiente briefing
      setTimeout(() => deliverBriefing(newState), 1500)
    })
  }

  // -------------------------------------------------------------------------
  // CTA CONTACT (Q9 cierre)
  // -------------------------------------------------------------------------
  function showContactCTA() {
    setPendingChoices([
      {
        label: { en: 'Open contact', es: 'Abrir contacto' },
        action: () => {
          onClose?.()
          // Navegar a contact — depende de cómo maneja el sitio las secciones
          try {
            window.location.hash = '#contact'
            window.dispatchEvent(new CustomEvent('navigate-section', { detail: { section: 'contact' } }))
          } catch {}
        },
      },
    ])
    setInputMode('continue')
  }

  // -------------------------------------------------------------------------
  // HANDLE ANSWER SUBMISSION
  // -------------------------------------------------------------------------
  function handleSubmitText() {
    const text = inputValue.trim()
    if (!text || typing) return

    // Skulley path hijack: detect trigger
    if (!skulleyActive && matchesSkulleyTrigger(text)) {
      appendUser(text)
      setInputValue('')
      setInputMode(null)
      startSkulleyPath()
      return
    }

    // Skulley verification in progress
    if (skulleyActive && skulleyStage >= 1) {
      handleSkulleyAnswer(text)
      return
    }

    // Normal quest answer
    appendUser(text)
    setInputValue('')
    setInputMode(null)

    const result = submitAnswer(text)
    if (!result.ok) {
      appendMadre(
        lang === 'es'
          ? 'Esa no me cuadra. Probá distinto.'
          : 'That one doesn’t register. Try different.',
        [],
        () => setInputMode('text'),
      )
      return
    }

    setState(result.state)
    serveDebrief(result.state)
  }

  function handleChoiceClick(choice) {
    if (typing) return
    if (choice.action) {
      // Meta-choices: "Continue", "I'm going", CTA, etc. — no van al engine
      const label = typeof choice.label === 'object' ? choice.label[lang] || choice.label.en : choice.label
      appendUser(label)
      setPendingChoices(null)
      setInputMode(null)
      choice.action()
      return
    }

    // Quest choice (Q9)
    const label = typeof choice.label === 'object' ? choice.label[lang] || choice.label.en : choice.label
    appendUser(label)
    setPendingChoices(null)
    setInputMode(null)

    const result = submitChoice(choice.id)
    if (!result.ok) return
    setState(result.state)
    serveDebrief(result.state)
  }

  // -------------------------------------------------------------------------
  // SKULLEY PATH
  // -------------------------------------------------------------------------
  function matchesSkulleyTrigger(text) {
    const n = normalize(text)
    return SKULLEY_TRIGGERS.some(t => n.includes(normalize(t)))
  }

  function startSkulleyPath() {
    setSkulleyActive(true)
    setSkulleyStage(0)
    const stage0Text = SKULLEY_PATH.stage0.text[lang] || SKULLEY_PATH.stage0.text.en
    appendMadre(stage0Text, SKULLEY_PATH.stage0.effects || [], () => {
      setTyping(true)
      setTimeout(() => {
        const stage1Text = SKULLEY_PATH.stage1.text[lang] || SKULLEY_PATH.stage1.text.en
        appendMadre(stage1Text, [], () => {
          const q = SKULLEY_PATH.verification[0]
          const qText = q?.question?.[lang] || q?.question?.en || '...'
          appendMadre(qText, [], () => {
            setSkulleyStage(1)
            setSkulleyQuestionIndex(0)
            setInputMode('text')
          })
        })
      }, SKULLEY_STAGE0_SILENCE)
    })
  }

  function handleSkulleyAnswer(answer) {
    appendUser(answer)
    setInputValue('')
    setInputMode(null)

    const q = SKULLEY_PATH.verification[skulleyQuestionIndex]
    if (!q) {
      // Success
      const successText = SKULLEY_PATH.success.text[lang] || SKULLEY_PATH.success.text.en
      appendMadre(successText, SKULLEY_PATH.success.effects || [], () => {
        setSkulleyActive(false)
      })
      return
    }

    const matches = (q.expectedAnswers || []).some(exp => fuzzyMatchSkulley(answer, exp))

    if (matches) {
      const nextIdx = skulleyQuestionIndex + 1
      if (nextIdx >= SKULLEY_PATH.verification.length) {
        const successText = SKULLEY_PATH.success.text[lang] || SKULLEY_PATH.success.text.en
        appendMadre(successText, SKULLEY_PATH.success.effects || [], () => {
          setSkulleyActive(false)
        })
        return
      }
      const nextQ = SKULLEY_PATH.verification[nextIdx]
      const qText = nextQ?.question?.[lang] || nextQ?.question?.en || '...'
      appendMadre(qText, [], () => {
        setSkulleyQuestionIndex(nextIdx)
        setInputMode('text')
      })
    } else {
      const failureText = SKULLEY_PATH.failure.text[lang] || SKULLEY_PATH.failure.text.en
      appendMadre(failureText, [], () => {
        setSkulleyActive(false)
      })
    }
  }

  // -------------------------------------------------------------------------
  // TYPEWRITER + APPEND
  // -------------------------------------------------------------------------
  function appendMadre(text, effects = [], onDone) {
    const lineIndex = lines.length + 1
    setLines(prev => [...prev, { role: 'madre', text, complete: false, displayedChars: 0 }])
    typewriter(text, effects, lineIndex, onDone)
  }

  function appendUser(text) {
    setLines(prev => [...prev, { role: 'user', text, complete: true, displayedChars: text.length }])
  }

  function showSimple(text) {
    appendMadre(text, [], null)
  }

  function typewriter(fullText, effects, _lineIndex, onDone) {
    setTyping(true)
    const hasDelay = effects.includes('delay')
    const startDelay = hasDelay ? DELAY_MS : 0

    setTimeout(() => {
      let i = 0
      const tick = () => {
        i++
        setLines(prev => {
          if (prev.length === 0) return prev
          const newLines = [...prev]
          const last = newLines[newLines.length - 1]
          newLines[newLines.length - 1] = {
            ...last,
            displayedChars: Math.min(i, fullText.length),
          }
          return newLines
        })
        if (i < fullText.length) {
          setTimeout(tick, TYPE_SPEED)
        } else {
          setLines(prev => {
            if (prev.length === 0) return prev
            const newLines = [...prev]
            newLines[newLines.length - 1] = {
              ...newLines[newLines.length - 1],
              complete: true,
            }
            return newLines
          })
          setTyping(false)
          onDone?.()
        }
      }
      tick()
    }, startDelay)
  }

  // -------------------------------------------------------------------------
  // BIPBOP CONTROLS
  // -------------------------------------------------------------------------
  function toggleBipbopMute() {
    const next = !bipbopMuted
    setBipbopMuted(next)
    setPref('bipbopMuted', next)
  }

  // Autoplay handling: browsers require play() after user interaction.
  // We attempt play on mount, retry on first click.
  React.useEffect(() => {
    if (!open) return
    if (bipbopMuted) return
    const v = bipbopRef.current
    if (!v) return
    v.muted = false
    v.play().catch(() => { /* autoplay blocked — silent */ })
  }, [open, bipbopMuted])

  if (!open) return null

  const progress = state.completedQuests?.length || 0
  const currentQuestObj = getCurrentQuest(state)
  const questLabel = currentQuestObj
    ? `${currentQuestObj.index}/9`
    : state.questPhase === 'complete'
      ? 'DONE'
      : '—'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="M.A.D.R.E. secure channel"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999999,
        backgroundColor: 'rgba(0, 3, 12, 0.78)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        animation: 'madreTerminalFadeIn 220ms ease-out',
      }}
    >
      <style>{`
        @keyframes madreTerminalFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes madreTerminalPanelIn {
          from { opacity: 0; transform: translateY(12px) scale(0.985); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes madreCursorBlink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
        @keyframes madreBipbopPulse {
          0%, 100% { box-shadow: 0 0 0 1px rgba(96, 165, 250, 0.35), 0 0 12px rgba(59, 130, 246, 0.25); }
          50% { box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.6), 0 0 20px rgba(59, 130, 246, 0.45); }
        }
        .madre-cursor { animation: madreCursorBlink 1s step-end infinite; }
        .madre-bipbop-active { animation: madreBipbopPulse 1.6s ease-in-out infinite; }
        .madre-scroll::-webkit-scrollbar { width: 6px; }
        .madre-scroll::-webkit-scrollbar-track { background: rgba(0,10,30,0.4); }
        .madre-scroll::-webkit-scrollbar-thumb {
          background: rgba(59,130,246,0.4);
          border-radius: 3px;
        }
      `}</style>

      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(720px, 96vw)',
          maxHeight: '86vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'rgba(2, 8, 22, 0.97)',
          border: '1px solid rgba(96, 165, 250, 0.35)',
          borderRadius: 8,
          boxShadow: '0 0 0 1px rgba(96,165,250,0.06), 0 24px 64px rgba(0,0,0,0.6), 0 0 80px rgba(59,130,246,0.08)',
          fontFamily: '"Cascadia Code", "Fira Code", monospace',
          color: '#d1d5db',
          animation: 'madreTerminalPanelIn 280ms ease-out',
          position: 'relative',
        }}
      >
        {/* Scanlines */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 8,
            pointerEvents: 'none',
            background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.12) 0px, rgba(0,0,0,0.12) 1px, transparent 1px, transparent 3px)',
            zIndex: 2,
          }}
        />

        {/* Header con bipbop + progress + ESC */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 16px',
            borderBottom: '1px solid rgba(96, 165, 250, 0.2)',
            backgroundColor: 'rgba(3, 10, 24, 0.85)',
            borderTopLeftRadius: 8,
            borderTopRightRadius: 8,
            position: 'relative',
            zIndex: 4,
            gap: 12,
          }}
        >
          {/* Bipbop avatar (80x80 circular) + glow azul cuando activo */}
          <div
            className={typing ? 'madre-bipbop-active' : ''}
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              overflow: 'hidden',
              border: `2px solid ${typing ? 'rgba(96, 165, 250, 0.6)' : 'rgba(96, 165, 250, 0.3)'}`,
              boxShadow: typing
                ? '0 0 16px rgba(59, 130, 246, 0.4), inset 0 0 8px rgba(59, 130, 246, 0.2)'
                : '0 0 8px rgba(59, 130, 246, 0.15)',
              flexShrink: 0,
              transition: 'border-color 0.4s, box-shadow 0.4s',
              position: 'relative',
            }}
          >
            <video
              ref={bipbopRef}
              src="/bipbop.mp4"
              muted={bipbopMuted}
              loop
              autoPlay
              playsInline
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>

          {/* Center label */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ color: '#93c5fd', fontSize: '0.78rem', letterSpacing: '0.08em' }}>
              M.A.D.R.E.@mausoleum:~/secure
            </div>
            <div style={{ color: '#60a5fa', fontSize: '0.68rem', opacity: 0.7, letterSpacing: '0.06em' }}>
              {state.questPhase === 'complete'
                ? (lang === 'es' ? 'PROTOCOLO COMPLETO' : 'PROTOCOL COMPLETE')
                : `${lang === 'es' ? 'TAREA' : 'TASK'} ${questLabel}`}
            </div>
          </div>

          {/* Mute + ESC */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              type="button"
              onClick={toggleBipbopMute}
              aria-label={bipbopMuted ? 'Unmute M.A.D.R.E.' : 'Mute M.A.D.R.E.'}
              title={bipbopMuted ? 'Unmute' : 'Mute'}
              style={{
                color: bipbopMuted ? '#475569' : '#60a5fa',
                background: 'transparent',
                border: '1px solid rgba(96,165,250,0.25)',
                borderRadius: 4,
                padding: '2px 8px',
                fontSize: '0.72rem',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {bipbopMuted ? 'UNMUTE' : 'MUTE'}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              style={{
                color: '#60a5fa',
                background: 'transparent',
                border: '1px solid rgba(96,165,250,0.25)',
                borderRadius: 4,
                padding: '2px 8px',
                fontSize: '0.75rem',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              ESC
            </button>
          </div>
        </div>

        {/* Conversation body */}
        <div
          ref={scrollRef}
          className="madre-scroll"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px 20px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            position: 'relative',
            zIndex: 4,
          }}
        >
          {lines.map((line, idx) => {
            const isUser = line.role === 'user'
            const displayText = line.complete ? line.text : line.text.slice(0, line.displayedChars || 0)
            const isCurrentTyping = idx === lines.length - 1 && !line.complete
            return (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isUser ? 'flex-end' : 'flex-start',
                }}
              >
                <div
                  style={{
                    maxWidth: '88%',
                    padding: '8px 12px',
                    borderRadius: 6,
                    fontSize: '0.95rem',
                    lineHeight: 1.55,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'normal',
                    overflowWrap: 'break-word',
                    backgroundColor: isUser ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                    border: isUser ? '1px solid rgba(96, 165, 250, 0.2)' : 'none',
                    color: isUser ? '#dbeafe' : '#d1d5db',
                  }}
                >
                  {!isUser && (
                    <span style={{ color: '#60a5fa', marginRight: 6, fontWeight: 600, letterSpacing: '0.05em' }}>
                      M.A.D.R.E. &gt;
                    </span>
                  )}
                  {displayText}
                  {isCurrentTyping && (
                    <span className="madre-cursor" style={{ color: '#60a5fa', marginLeft: 2 }}>█</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Input zone */}
        <div
          style={{
            borderTop: '1px solid rgba(96, 165, 250, 0.2)',
            padding: '14px 16px',
            backgroundColor: 'rgba(3, 10, 24, 0.72)',
            borderBottomLeftRadius: 8,
            borderBottomRightRadius: 8,
            position: 'relative',
            zIndex: 4,
          }}
        >
          {/* Choice buttons */}
          {!typing && pendingChoices && pendingChoices.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {pendingChoices.map((choice, idx) => {
                const label = typeof choice.label === 'object' ? choice.label[lang] || choice.label.en : choice.label
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleChoiceClick(choice)}
                    style={{
                      textAlign: 'left',
                      padding: '8px 12px',
                      borderRadius: 6,
                      border: '1px solid rgba(96, 165, 250, 0.3)',
                      backgroundColor: 'rgba(59, 130, 246, 0.06)',
                      color: '#bfdbfe',
                      fontFamily: 'inherit',
                      fontSize: '0.88rem',
                      cursor: 'pointer',
                      transition: 'all 150ms ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.14)'
                      e.currentTarget.style.borderColor = 'rgba(96, 165, 250, 0.5)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.06)'
                      e.currentTarget.style.borderColor = 'rgba(96, 165, 250, 0.3)'
                    }}
                  >
                    <span style={{ color: '#60a5fa', marginRight: 8 }}>&gt;</span>
                    {label}
                  </button>
                )
              })}
            </div>
          )}

          {/* Text input */}
          {inputMode === 'text' && !typing && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: '#60a5fa', fontSize: '0.9rem' }}>&gt;</span>
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleSubmitText()
                  }
                }}
                placeholder={lang === 'es' ? 'Escribe...' : 'Type...'}
                maxLength={240}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#dbeafe',
                  fontFamily: 'inherit',
                  fontSize: '0.95rem',
                  padding: '6px 0',
                }}
              />
              <button
                type="button"
                onClick={handleSubmitText}
                disabled={!inputValue.trim()}
                style={{
                  border: '1px solid rgba(96, 165, 250, 0.35)',
                  background: inputValue.trim() ? 'rgba(59, 130, 246, 0.18)' : 'transparent',
                  color: inputValue.trim() ? '#93c5fd' : '#475569',
                  borderRadius: 4,
                  padding: '4px 10px',
                  fontSize: '0.75rem',
                  cursor: inputValue.trim() ? 'pointer' : 'not-allowed',
                  fontFamily: 'inherit',
                  letterSpacing: '0.06em',
                }}
              >
                SEND
              </button>
            </div>
          )}

          {/* Typing indicator */}
          {typing && (
            <div style={{ color: '#60a5fa', fontSize: '0.75rem', letterSpacing: '0.1em' }}>
              <span className="madre-cursor">█</span>
              <span style={{ marginLeft: 6, opacity: 0.7 }}>
                {lang === 'es' ? 'escribiendo...' : 'typing...'}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers for Skulley path fuzzy match (ported from madreEngine)
// ---------------------------------------------------------------------------

function normalize(text) {
  return (text || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function levenshtein(a, b) {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  const dp = new Array(b.length + 1).fill(0).map((_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0]
    dp[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j]
      if (a[i - 1] === b[j - 1]) dp[j] = prev
      else dp[j] = 1 + Math.min(prev, dp[j - 1], dp[j])
      prev = tmp
    }
  }
  return dp[b.length]
}

function toleranceForLength(len) {
  if (len <= 3) return 0
  if (len <= 6) return 1
  if (len <= 10) return 1
  if (len <= 16) return 2
  return 3
}

function fuzzyMatchSkulley(userInput, expected) {
  const input = normalize(userInput)
  const exp = normalize(expected)
  if (!input || !exp) return false
  if (input.includes(exp)) return true
  const tol = toleranceForLength(exp.length)
  if (levenshtein(input, exp) <= tol) return true
  const minLen = Math.max(1, exp.length - tol)
  const maxLen = exp.length + tol
  for (let start = 0; start <= Math.max(0, input.length - minLen); start++) {
    for (let windowLen = minLen; windowLen <= maxLen && start + windowLen <= input.length; windowLen++) {
      const chunk = input.slice(start, start + windowLen)
      if (levenshtein(chunk, exp) <= tol) return true
    }
  }
  return false
}
