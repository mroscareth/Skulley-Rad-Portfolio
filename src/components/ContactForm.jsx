import React from 'react'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import { playSfx } from '../lib/sfx.js'

// Terminal-themed contact form: users answer questions as if typing in a CLI.
// Preserves all original logic: validation, honeypot anti-spam, server submission, i18n.

export default function ContactForm() {
  const { t, lang } = useLanguage()
  const [step, setStep] = React.useState(0)
  const [name, setName] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [subject, setSubject] = React.useState('')
  const [comments, setComments] = React.useState('')
  // Current input value (for the active prompt)
  const [inputVal, setInputVal] = React.useState('')
  // Honeypot anti-spam (bots usually fill hidden fields)
  const [company, setCompany] = React.useState('')
  const [submitted, setSubmitted] = React.useState(false)
  const [sending, setSending] = React.useState(false)
  const [error, setError] = React.useState('')
  const [typingDone, setTypingDone] = React.useState(false)

  const inputRef = React.useRef(null)
  const textareaRef = React.useRef(null)
  const terminalRef = React.useRef(null)

  const subjectOptions = ['workTogether', 'collaboration', 'other']
  const subjectMap = { '1': 'workTogether', '2': 'collaboration', '3': 'other' }

  // Focus input on step change
  React.useEffect(() => {
    setError('')
    setInputVal('')
    const timer = setTimeout(() => {
      if (step === 3) textareaRef.current?.focus()
      else inputRef.current?.focus()
    }, 80)
    return () => clearTimeout(timer)
  }, [step])

  // Typing animation for initial prompt
  React.useEffect(() => {
    const timer = setTimeout(() => setTypingDone(true), 1200)
    return () => clearTimeout(timer)
  }, [])

  // Auto-focus input once typing animation finishes (so user can type immediately)
  React.useEffect(() => {
    if (!typingDone) return
    const timer = setTimeout(() => {
      if (step === 3) textareaRef.current?.focus()
      else inputRef.current?.focus()
    }, 100)
    return () => clearTimeout(timer)
  }, [typingDone])

  const isValidEmail = (v) => /.+@.+\..+/.test(String(v || '').toLowerCase())

  async function sendToServer(data) {
    setSending(true)
    setError('')
    try {
      const res = await fetch('/api/contact.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          company,
          source: 'mroscar.xyz',
          lang,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (res.status === 429) throw new Error('too_many_requests')
        throw new Error(json?.error || 'send_failed')
      }
      setSubmitted(true)
    } catch (e) {
      const code = String(e?.message || '')
      if (code === 'too_many_requests') setError(t('contact.errors.tooManyRequests'))
      else if (code === 'missing_vendor') setError(t('contact.errors.serverNeedsVendor'))
      else if (code === 'smtp_not_configured') setError(t('contact.errors.serverMisconfigured'))
      else setError(t('contact.errors.sendFailed'))
    } finally {
      setSending(false)
    }
  }

  function next() {
    const val = inputVal.trim()
    if (step === 0) {
      if (!val) return setError(t('contact.errors.emptyName'))
      setName(val)
      setError('')
      setStep(1)
    } else if (step === 1) {
      if (!val) return setError(t('contact.errors.emptyEmail'))
      if (!isValidEmail(val)) return setError(t('contact.errors.invalidEmail'))
      setEmail(val)
      setError('')
      setStep(2)
    } else if (step === 2) {
      const mapped = subjectMap[val]
      if (!mapped) return setError(lang === 'es' ? 'Escribe 1, 2 o 3' : 'Type 1, 2 or 3')
      setSubject(mapped)
      setError('')
      setStep(3)
    } else if (step === 3) {
      if (!val) return setError(t('contact.errors.emptyComments'))
      setComments(val)
      setError('')
      sendToServer({
        name: name.trim(),
        email: email.trim(),
        subject,
        comments: val.trim(),
      })
    }
  }

  function handleKeyDown(e) {
    if (step === 3 && e.key === 'Enter' && e.shiftKey) return // allow newline
    if (e.key === 'Enter') {
      e.preventDefault()
      next()
    }
  }

  // Build history lines for completed steps
  const history = []
  if (step > 0 || submitted) history.push({ field: 'name', value: name })
  if (step > 1 || submitted) history.push({ field: 'email', value: email })
  if (step > 2 || submitted) history.push({ field: 'subject', value: t(`contact.subject.options.${subject}`) })
  if (submitted) history.push({ field: 'comments', value: comments })

  const steps = [
    { id: 'name', label: t('contact.name.label'), desc: t('contact.name.desc') },
    { id: 'email', label: t('contact.email.label'), desc: t('contact.email.desc') },
    { id: 'subject', label: t('contact.subject.question'), desc: t('contact.subject.desc') },
    { id: 'comments', label: t('contact.comments.label'), desc: t('contact.comments.desc') },
  ]

  const promptLabels = [
    t('contact.name.placeholder'),
    t('contact.email.placeholder'),
    t('contact.subject.label'),
    t('contact.comments.placeholder'),
  ]

  return (
    <form className="pointer-events-auto w-full max-w-3xl mx-auto" onSubmit={(e) => e.preventDefault()}>
      {/* Honeypot field (hidden). Must remain empty. */}
      <input
        type="text"
        name="company"
        value={company}
        onChange={(e) => setCompany(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        className="hidden"
        aria-hidden="true"
      />

      {/* Terminal styles */}
      <style>{`
        @keyframes terminalBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes terminalGlow {
          0%, 100% { box-shadow: 0 0 20px rgba(59, 130, 246, 0.3), inset 0 0 60px rgba(59, 130, 246, 0.05); }
          50% { box-shadow: 0 0 30px rgba(59, 130, 246, 0.4), inset 0 0 80px rgba(59, 130, 246, 0.08); }
        }
        @keyframes typeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes successPulse {
          0%, 100% { text-shadow: 0 0 10px rgba(34, 197, 94, 0.5); }
          50% { text-shadow: 0 0 20px rgba(34, 197, 94, 0.8); }
        }
      `}</style>

      {/* Terminal container */}
      <div
        className="relative rounded-lg overflow-hidden crt-scanlines"
        style={{
          backgroundColor: '#0a0a14',
          border: '2px solid #3b82f6',
          fontFamily: '"Cascadia Code", "Fira Code", "JetBrains Mono", monospace',
          animation: 'terminalGlow 3s ease-in-out infinite',
        }}
      >

        {/* Terminal header bar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-blue-500/30 bg-blue-500/10 relative z-20">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="p-1.5 -m-1.5 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors cursor-pointer z-30"
              onClick={() => { try { playSfx('click', { volume: 0.8 }) } catch { }; window.dispatchEvent(new CustomEvent('exit-section')) }}
              aria-label="Close"
            >
              <span className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-400 transition-colors" />
            </button>
            <div className="w-3 h-3 rounded-full bg-white/20" />
            <div className="w-3 h-3 rounded-full bg-white/20" />
          </div>
          <span className="text-blue-500/70 text-xs">M.A.D.R.E.@mausoleum:~/contact</span>
          <div className="w-6" />
        </div>

        {/* Terminal body */}
        <div
          ref={terminalRef}
          className="relative z-20 p-4 sm:p-6 min-h-[320px] max-h-[60vh] overflow-hidden"
        >
          {/* Boot message */}
          <div className="text-blue-500/50 text-xs font-mono mb-1" style={{ animation: 'typeIn 300ms ease both' }}>
            [M.A.D.R.E. OS v2.0.26] — contact module loaded
          </div>
          <div className="text-blue-500/30 text-xs font-mono mb-4" style={{ animation: 'typeIn 300ms ease 150ms both' }}>
            ──────────────────────────────────────────
          </div>

          {/* Welcome message with typing effect */}
          {typingDone && (
            <div className="text-gray-400 text-sm font-mono mb-4" style={{ animation: 'typeIn 200ms ease both' }}>
              {lang === 'es'
                ? '¿Quieres ponerte en contacto? Responde las siguientes preguntas.'
                : 'Want to get in touch? Answer the following questions.'}
              <br />
              <span className="text-blue-500/40">
                {lang === 'es' ? '(Presiona Enter para continuar)' : '(Press Enter to continue)'}
              </span>
            </div>
          )}

          {/* History: completed answers */}
          {history.map((h, i) => (
            <div key={`${h.field}-${i}`} className="mb-2 font-mono" style={{ animation: 'typeIn 200ms ease both' }}>
              <div className="flex items-start gap-1">
                <span className="text-green-400 text-sm shrink-0">{'>'}</span>
                <span className="text-blue-400 text-sm shrink-0">{h.field}:</span>
                <span className="text-white text-sm break-all whitespace-pre-wrap">{h.value}</span>
              </div>
            </div>
          ))}

          {/* Success state */}
          {submitted && (
            <div className="mt-4 font-mono" style={{ animation: 'typeIn 300ms ease both' }}>
              <div className="text-green-400 text-sm mb-2" style={{ animation: 'successPulse 2s ease-in-out infinite' }}>
                ✓ {lang === 'es' ? 'Mensaje enviado exitosamente' : 'Message sent successfully'}
              </div>
              <div className="text-gray-400 text-sm mb-4">
                {t('contact.thanksDesc')}
              </div>
              <div className="text-blue-500/30 text-xs">
                ──────────────────────────────────────────
              </div>
              <button
                type="button"
                onClick={() => {
                  setSubmitted(false)
                  setStep(0)
                  setName('')
                  setEmail('')
                  setSubject('')
                  setComments('')
                  setInputVal('')
                  setError('')
                }}
                className="mt-3 text-cyan-400 text-sm font-mono hover:text-cyan-300 transition-colors"
              >
                {'>'} {t('contact.sendAnother')}
              </button>
            </div>
          )}

          {/* Sending state */}
          {sending && !submitted && (
            <div className="mt-2 font-mono" style={{ animation: 'typeIn 200ms ease both' }}>
              <span className="text-yellow-400 text-sm" style={{ animation: 'terminalBlink 1s ease infinite' }}>
                {lang === 'es' ? '⟳ Enviando mensaje...' : '⟳ Sending message...'}
              </span>
            </div>
          )}

          {/* Active prompt (current step) — inlined, not a separate component */}
          {!submitted && !sending && typingDone && (
            <div style={{ animation: 'typeIn 200ms ease both' }}>
              {/* Step question */}
              <div className="text-gray-300 text-sm font-mono mb-1">
                <span className="text-yellow-400/80">
                  [{step + 1}/4]
                </span>{' '}
                {steps[step].label}
              </div>

              {/* Subject step: numbered options */}
              {step === 2 && (
                <div className="mt-1">
                  <div className="text-blue-400/70 text-xs mb-2 font-mono">
                    {`// ${t('contact.subject.question')}`}
                  </div>
                  {subjectOptions.map((optId, i) => (
                    <div key={optId} className="text-gray-300 text-sm font-mono ml-2">
                      <span className="text-cyan-400">[{i + 1}]</span>{' '}
                      {t(`contact.subject.options.${optId}`)}
                    </div>
                  ))}
                  <div className="flex items-center mt-3 gap-1">
                    <span className="text-green-400 font-mono text-sm shrink-0">{'>'}</span>
                    <span className="text-blue-400 font-mono text-sm shrink-0">select:</span>
                    <input
                      ref={inputRef}
                      type="text"
                      value={inputVal}
                      onChange={(e) => setInputVal(e.target.value)}
                      onKeyDown={handleKeyDown}
                      className="flex-1 bg-transparent text-white font-mono text-sm outline-none caret-green-400 placeholder-white/20 min-w-0"
                      placeholder="_"
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </div>
                </div>
              )}

              {/* Comments step: multi-line textarea */}
              {step === 3 && (
                <div className="mt-1">
                  <div className="text-blue-400/70 text-xs mb-2 font-mono">
                    {`// ${t('contact.comments.desc')} (Shift+Enter = ${lang === 'es' ? 'nueva línea' : 'new line'})`}
                  </div>
                  <div className="flex items-start gap-1">
                    <span className="text-green-400 font-mono text-sm shrink-0 mt-0.5">{'>'}</span>
                    <span className="text-blue-400 font-mono text-sm shrink-0 mt-0.5">msg:</span>
                    <textarea
                      ref={textareaRef}
                      value={inputVal}
                      onChange={(e) => setInputVal(e.target.value)}
                      onKeyDown={handleKeyDown}
                      rows={4}
                      className="flex-1 bg-transparent text-white font-mono text-sm outline-none caret-green-400 placeholder-white/20 resize-none min-w-0"
                      placeholder={t('contact.comments.placeholder')}
                      spellCheck={false}
                    />
                  </div>
                </div>
              )}

              {/* Name (step 0) and Email (step 1) */}
              {(step === 0 || step === 1) && (
                <div className="mt-1">
                  <div className="text-blue-400/70 text-xs mb-2 font-mono">
                    {`// ${steps[step].desc}`}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-green-400 font-mono text-sm shrink-0">{'>'}</span>
                    <span className="text-blue-400 font-mono text-sm shrink-0">{step === 0 ? 'name' : 'email'}:</span>
                    <input
                      ref={inputRef}
                      type={step === 1 ? 'email' : 'text'}
                      value={inputVal}
                      onChange={(e) => setInputVal(e.target.value)}
                      onKeyDown={handleKeyDown}
                      className="flex-1 bg-transparent text-white font-mono text-sm outline-none caret-green-400 placeholder-white/20 min-w-0"
                      placeholder={promptLabels[step]}
                      autoComplete={step === 0 ? 'name' : 'email'}
                      spellCheck={false}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Error message */}
          {!!error && (
            <div className="mt-2 font-mono" style={{ animation: 'typeIn 150ms ease both' }}>
              <span className="text-red-400 text-sm">ERROR: {error}</span>
            </div>
          )}

          {/* Blinking cursor at bottom when waiting for typing animation */}
          {!typingDone && (
            <span className="text-green-400 font-mono text-sm" style={{ animation: 'terminalBlink 0.8s ease infinite' }}>
              █
            </span>
          )}
        </div>

        {/* Terminal footer / progress */}
        {!submitted && (
          <div className="border-t border-blue-500/20 px-4 py-2 bg-blue-500/5 relative z-20 flex items-center justify-between">
            <span className="text-blue-500/40 text-xs font-mono">
              {lang === 'es' ? 'paso' : 'step'} {step + 1}/4
            </span>
            <div className="flex items-center gap-1">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-1.5 rounded-full transition-all duration-300"
                  style={{
                    width: i <= step ? '16px' : '6px',
                    backgroundColor: i < step ? '#22c55e' : i === step ? '#3b82f6' : 'rgba(59,130,246,0.2)',
                    boxShadow: i === step ? '0 0 6px rgba(59,130,246,0.5)' : 'none',
                  }}
                />
              ))}
            </div>
            <span className="text-blue-500/30 text-xs font-mono">
              Enter ↵
            </span>
          </div>
        )}
      </div>
    </form>
  )
}
