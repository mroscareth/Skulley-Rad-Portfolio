import React from 'react'
import { deliverDebrief, loadState, getCurrentQuest } from '../lib/questEngine.js'

/**
 * MadreOverlay — reveal cinemática Q8.
 *
 * Se monta cuando la terminal dispara 'madre-overlay-open' (tras submitClick
 * en cinematic_sequence). Flujo:
 *   1. deliverDebrief() commit atómico → state pasa a Q9 briefing.
 *   2. Fade-in del backdrop + bipbop con glow azul.
 *   3. Reveal del nombre ("Oscar Moctezuma Rodríguez") con blur→sharp + line-draw.
 *   4. Typewriter del debrief.
 *   5. Hold 3s post-texto, fade-out, unmount.
 *
 * Guard: si no hay quest ready_for_debrief o no es cinematic_sequence, sale.
 */

const TYPE_SPEED = 28

export default function MadreOverlay({ open, lang = 'en', onClose }) {
  const [phase, setPhase] = React.useState('idle')
  const [text, setText] = React.useState('')
  const [displayedChars, setDisplayedChars] = React.useState(0)
  const [nameIn, setNameIn] = React.useState(false)
  const initRef = React.useRef(false)

  React.useEffect(() => {
    if (!open) {
      initRef.current = false
      setPhase('idle')
      setText('')
      setDisplayedChars(0)
      setNameIn(false)
      return
    }
    if (initRef.current) return
    initRef.current = true

    // Guard: solo arranca si estamos realmente en cinematic_sequence ready_for_debrief
    const s = loadState()
    const q = getCurrentQuest(s)
    if (!q || q.completion?.type !== 'cinematic_sequence' || s.questPhase !== 'ready_for_debrief') {
      onClose?.()
      return
    }

    const result = deliverDebrief(lang)
    if (!result?.text) {
      onClose?.()
      return
    }
    setText(result.text)
    setPhase('reveal')

    // Sequencia tempo: bipbop+nombre aparecen → respiran solos ~3.4s → typewriter
    // El hold del nombre solo es lo que carga el peso emocional sin necesitar voz.
    const t1 = setTimeout(() => setNameIn(true), 350)
    const t2 = setTimeout(() => setPhase('typing'), 4000)

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [open, lang, onClose])

  // Typewriter
  React.useEffect(() => {
    if (phase !== 'typing' || !text) return
    if (displayedChars >= text.length) {
      const t = setTimeout(() => setPhase('hold'), 100)
      return () => clearTimeout(t)
    }
    const id = setTimeout(() => setDisplayedChars(c => c + 1), TYPE_SPEED)
    return () => clearTimeout(id)
  }, [phase, displayedChars, text])

  // Hold → fade. Holdeo más largo para que el momento se sostenga sin voz.
  React.useEffect(() => {
    if (phase !== 'hold') return
    const t = setTimeout(() => setPhase('fading'), 4500)
    return () => clearTimeout(t)
  }, [phase])

  // Fade → unmount. Fade lento (2s) para no cortar abrupto el momento.
  React.useEffect(() => {
    if (phase !== 'fading') return
    const t = setTimeout(() => onClose?.(), 2000)
    return () => clearTimeout(t)
  }, [phase, onClose])

  // ESC skip
  React.useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const showContent = phase !== 'idle' && phase !== 'fading'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="M.A.D.R.E. reveal"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999998,
        backgroundColor: phase === 'fading' ? 'rgba(0, 3, 12, 0)' : 'rgba(0, 3, 12, 0.88)',
        backdropFilter: phase === 'fading' ? 'blur(0px)' : 'blur(6px)',
        WebkitBackdropFilter: phase === 'fading' ? 'blur(0px)' : 'blur(6px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        transition: 'background-color 2s ease-out, backdrop-filter 2s ease-out',
        pointerEvents: phase === 'fading' ? 'none' : 'auto',
      }}
    >
      {/* Vignette interno que respira con el momento */}
      <div
        aria-hidden
        style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse 70% 60% at 50% 45%, rgba(0,0,0,0) 35%, rgba(0,0,0,0.65) 100%)',
          opacity: showContent ? 1 : 0,
          transition: 'opacity 1.4s ease-out',
        }}
      />
      <style>{`
        @keyframes madreOverlayBackdropIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes madreOverlayNameIn {
          from { opacity: 0; transform: translateY(18px); letter-spacing: 0.32em; filter: blur(12px); }
          to { opacity: 1; transform: translateY(0); letter-spacing: 0.04em; filter: blur(0); }
        }
        @keyframes madreOverlayBipbopPulseBlue {
          0%, 100% { box-shadow: 0 0 0 2px rgba(96,165,250,0.45), 0 0 28px rgba(59,130,246,0.35); }
          50% { box-shadow: 0 0 0 3px rgba(96,165,250,0.75), 0 0 48px rgba(59,130,246,0.65); }
        }
        @keyframes madreOverlayNameGlow {
          0%, 100% { text-shadow: 0 0 28px rgba(59,130,246,0.42), 0 0 80px rgba(59,130,246,0.18); }
          50% { text-shadow: 0 0 36px rgba(96,165,250,0.6), 0 0 120px rgba(59,130,246,0.32); }
        }
        @keyframes madreOverlayCursor {
          0%, 50% { opacity: 1 } 51%, 100% { opacity: 0 }
        }
        .madre-overlay-bipbop { animation: madreOverlayBipbopPulseBlue 1.8s ease-in-out infinite; }
        .madre-overlay-name-breath { animation: madreOverlayNameGlow 4s ease-in-out infinite; }
        .madre-overlay-cursor { animation: madreOverlayCursor 1s step-end infinite; }
      `}</style>

      {/* Bipbop avatar */}
      <div
        className="madre-overlay-bipbop"
        style={{
          width: 120,
          height: 120,
          borderRadius: '50%',
          overflow: 'hidden',
          border: '2px solid rgba(96,165,250,0.55)',
          marginBottom: 36,
          flexShrink: 0,
          opacity: showContent ? 1 : 0,
          transform: showContent ? 'scale(1)' : 'scale(0.9)',
          transition: 'opacity 1.1s ease-out, transform 1.1s ease-out',
        }}
      >
        <video
          src="/bipbop.mp4"
          muted
          loop
          autoPlay
          playsInline
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>

      {/* Name reveal — el peso del momento vive aquí */}
      <div style={{
        textAlign: 'center',
        opacity: showContent ? 1 : 0,
        transition: 'opacity 1.4s ease-out',
        marginBottom: 44,
        position: 'relative',
        zIndex: 2,
      }}>
        <div
          className={nameIn ? 'madre-overlay-name-breath' : ''}
          style={{
            fontSize: 'clamp(1.85rem, 5.4vw, 4.2rem)',
            letterSpacing: '0.04em',
            fontWeight: 200,
            color: '#f0f9ff',
            fontFamily: '"Cascadia Code", "Fira Code", monospace',
            animation: nameIn
              ? 'madreOverlayNameIn 1.6s cubic-bezier(0.2,0.65,0.25,1) both, madreOverlayNameGlow 4s ease-in-out 1.6s infinite'
              : 'none',
            opacity: nameIn ? 1 : 0,
            lineHeight: 1.05,
          }}
        >
          Oscar Moctezuma Rodríguez
        </div>
        <div style={{
          height: 2,
          maxWidth: 600,
          margin: '18px auto 0',
          background: 'linear-gradient(90deg, transparent, #60a5fa, transparent)',
          transformOrigin: 'center',
          transform: nameIn ? 'scaleX(1)' : 'scaleX(0)',
          transition: 'transform 1.5s cubic-bezier(0.2,0.65,0.25,1) 0.45s',
          boxShadow: '0 0 14px rgba(96,165,250,0.55)',
        }} />
      </div>

      {/* Debrief typewriter — secundario al nombre */}
      <div style={{
        maxWidth: 'min(640px, 92vw)',
        fontSize: 'clamp(0.88rem, 1.4vw, 1rem)',
        lineHeight: 1.7,
        color: '#cbd5e1',
        fontFamily: '"Cascadia Code", "Fira Code", monospace',
        textAlign: 'left',
        minHeight: '6em',
        opacity: (phase === 'typing' || phase === 'hold') ? 1 : 0,
        transition: 'opacity 0.8s ease-out',
        whiteSpace: 'pre-wrap',
        wordBreak: 'normal',
        overflowWrap: 'break-word',
        position: 'relative',
        zIndex: 2,
      }}>
        <span style={{ color: '#60a5fa', marginRight: 6, fontWeight: 600, letterSpacing: '0.05em' }}>
          M.A.D.R.E. &gt;
        </span>
        {text.slice(0, displayedChars)}
        {phase === 'typing' && displayedChars < text.length && (
          <span className="madre-overlay-cursor" style={{ color: '#60a5fa', marginLeft: 2 }}>█</span>
        )}
      </div>

      {/* Hint ESC (sutil, solo durante typing/hold) */}
      {(phase === 'typing' || phase === 'hold') && (
        <div style={{
          position: 'absolute',
          bottom: 20,
          right: 24,
          color: 'rgba(96,165,250,0.4)',
          fontSize: '0.7rem',
          fontFamily: '"Cascadia Code", "Fira Code", monospace',
          letterSpacing: '0.1em',
        }}>
          ESC
        </div>
      )}
    </div>
  )
}
