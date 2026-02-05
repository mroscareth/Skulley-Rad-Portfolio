import React from 'react'
import { useLanguage } from '../i18n/LanguageContext.jsx'

// Step-by-step form inspired by Typeform: one question per screen,
// with managed focus, basic validation, and accessibility (labels/fieldset/legend).
// Sends to server; shows a confirmation summary on completion.

export default function ContactForm() {
  const { t, lang } = useLanguage()
  const [isMobile, setIsMobile] = React.useState(false)
  React.useEffect(() => {
    const mql = window.matchMedia('(max-width: 640px)')
    const update = () => setIsMobile(Boolean(mql.matches))
    update()
    try { mql.addEventListener('change', update) } catch { window.addEventListener('resize', update) }
    return () => { try { mql.removeEventListener('change', update) } catch { window.removeEventListener('resize', update) } }
  }, [])
  const [step, setStep] = React.useState(0)
  const [name, setName] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [subject, setSubject] = React.useState('workTogether')
  const [comments, setComments] = React.useState('')
  // Honeypot anti-spam (bots usually fill hidden fields)
  const [company, setCompany] = React.useState('')
  const [submitted, setSubmitted] = React.useState(false)
  const [sending, setSending] = React.useState(false)
  const [error, setError] = React.useState('')

  const nameRef = React.useRef(null)
  const emailRef = React.useRef(null)
  const commentsRef = React.useRef(null)
  const firstRadioRef = React.useRef(null)
  const prevStepRef = React.useRef(0)

  React.useEffect(() => {
    setError('')
    const f = () => {
      if (step === 0) nameRef.current?.focus()
      else if (step === 1) emailRef.current?.focus()
      else if (step === 2) firstRadioRef.current?.focus()
      else if (step === 3) commentsRef.current?.focus()
    }
    const t = setTimeout(f, 50)
    return () => clearTimeout(t)
  }, [step])

  const isValidEmail = (v) => /.+@.+\..+/.test(String(v || '').toLowerCase())

  async function send() {
    if (sending) return
    setError('')
    setSending(true)
    try {
      const res = await fetch('/api/contact.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          subject,
          comments: comments.trim(),
          company,
          source: 'mroscar.xyz',
          lang,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (res.status === 429) throw new Error('too_many_requests')
        throw new Error(data?.error || 'send_failed')
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
    if (step === 0) {
      if (!name.trim()) return setError(t('contact.errors.emptyName'))
    }
    if (step === 1) {
      if (!email.trim()) return setError(t('contact.errors.emptyEmail'))
      if (!isValidEmail(email)) return setError(t('contact.errors.invalidEmail'))
    }
    if (step === 3) {
      // last step: send
      if (!comments.trim()) return setError(t('contact.errors.emptyComments'))
      void send()
      return
    }
    setStep((s) => Math.min(3, s + 1))
  }

  function prev() {
    setError('')
    setStep((s) => Math.max(0, s - 1))
  }

  function onKeyDown(e) {
    if (e.key !== 'Enter') return
    // In steps 0 and 1 we advance with Enter
    if (step !== 3) {
      e.preventDefault()
      next()
      return
    }
    // In textarea (step 3): Shift+Enter = line break, Enter = send/advance
    if (!e.shiftKey) {
      e.preventDefault()
      next()
    }
  }

  // Determine animation direction based on step change
  const prevStep = prevStepRef.current
  const direction = step >= prevStep ? 'forward' : 'backward'
  React.useEffect(() => { prevStepRef.current = step }, [step])

  if (submitted) {
    return (
      <div className="w-full mx-auto text-center">
        <h3 className="font-marquee text-black uppercase leading-none text-[clamp(72px,14vw,240px)] inline-block mx-auto whitespace-nowrap">{t('contact.thanks')}</h3>
        <p className="mt-6 text-xl sm:text-2xl md:text-3xl text-black/90">{t('contact.thanksDesc')}</p>
      </div>
    )
  }

  const steps = [
    { id: 'name', label: t('contact.name.label'), desc: t('contact.name.desc') },
    { id: 'email', label: t('contact.email.label'), desc: t('contact.email.desc') },
    { id: 'subject', label: t('contact.subject.question'), desc: t('contact.subject.desc') },
    { id: 'comments', label: t('contact.comments.label'), desc: t('contact.comments.desc') },
  ]

  return (
    <form className="pointer-events-auto" onSubmit={(e) => { e.preventDefault(); next() }}>
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
      <div className="w-full mx-auto text-black text-center" style={{ maxWidth: '840px' }}>
        {/* Progress bar (fixed on desktop; inline on mobile) */}
        {!isMobile && (
          <div
            className="mb-10 fixed left-1/2 -translate-x-1/2 z-[14000] pointer-events-none"
            aria-live="polite"
            style={{ width: 'min(840px, 92vw, calc(100vw - 36rem))', bottom: 'calc(env(safe-area-inset-bottom, 0px) + 90px)' }}
          >
            <div className="h-2 bg-black/10 rounded-full overflow-hidden ring-1 ring-black/15">
              <div className="h-full bg-black transition-all duration-300 ease-out" style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
            </div>
          </div>
        )}

        {/* Action bar: desktop fixed; on mobile rendered inline below */}
        {!isMobile && (
          <div
            className="fixed left-1/2 -translate-x-1/2 z-[14010] pointer-events-auto"
            style={{ width: 'min(840px, 92vw, calc(100vw - 36rem))', bottom: 'calc(env(safe-area-inset-bottom, 0px) + 155px)' }}
          >
            <div className="flex items-center justify-between gap-3 w-full">
              <button type="button" onClick={prev} disabled={step === 0} className="px-5 py-2 rounded-full bg-black text-white hover:bg-black/90 disabled:opacity-40">
                {t('contact.step.back')}
              </button>
              {step < 3 ? (
                <button type="button" onClick={next} className="px-5 py-2 rounded-full bg-black text-white hover:bg-black/90 ml-auto">
                  {t('contact.step.next')}
                </button>
              ) : (
                <button type="submit" disabled={sending} className="px-5 py-2 rounded-full bg-black text-white hover:bg-black/90 ml-auto disabled:opacity-60">
                  {sending ? t('common.loading') : t('contact.step.send')}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Current step */}
        <div key={step} className={`space-y-2 will-change-transform ${direction === 'forward' ? 'animate-[slideleft_260ms_ease]' : 'animate-[slideright_260ms_ease]'}`}>
          <label className={isMobile ? 'block font-marquee text-4xl text-black uppercase' : 'block font-marquee text-5xl sm:text-6xl text-black uppercase'} htmlFor={`field-${steps[step].id}`}>{steps[step].label}</label>

          {step === 0 && (
            <input
              id="field-name"
              ref={nameRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={onKeyDown}
              className="mt-4 w-full px-4 py-3 rounded-full bg-black text-white placeholder-white/60 ring-1 ring-white/15 focus:outline-none focus:ring-2 focus:ring-white mx-auto"
              placeholder={t('contact.name.placeholder')}
              autoComplete="name"
              required
            />
          )}

          {step === 1 && (
            <input
              id="field-email"
              ref={emailRef}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={onKeyDown}
              className="mt-4 w-full px-4 py-3 rounded-full bg-black text-white placeholder-white/60 ring-1 ring-white/15 focus:outline-none focus:ring-2 focus:ring-white mx-auto"
              placeholder={t('contact.email.placeholder')}
              autoComplete="email"
              required
            />
          )}

          {step === 2 && (
            <fieldset className="mt-2" style={{ marginTop: '30px' }}>
              <legend className="sr-only">{t('contact.subject.label')}</legend>
              <div className={isMobile ? 'grid grid-cols-1 gap-3 justify-items-stretch' : 'grid grid-cols-1 sm:grid-cols-3 gap-3 justify-items-center'}>
                {(['workTogether', 'collaboration', 'other']).map((optId, i) => {
                  const optLabel = t(`contact.subject.options.${optId}`)
                  const selected = subject === optId
                  return (
                    <label key={optId} className="cursor-pointer select-none">
                      <input
                        ref={i === 0 ? firstRadioRef : null}
                        type="radio"
                        name="subject"
                        value={optId}
                        checked={selected}
                        onChange={() => setSubject(optId)}
                        className="sr-only peer"
                      />
                      <span className={`block w-full text-center rounded-full px-6 py-4 transition-all duration-200 ${selected ? 'bg-black text-white ring-2 ring-black scale-[1.02]' : 'bg-transparent text-black ring-2 ring-black hover:bg-black/5'} peer-focus-visible:ring-2 peer-focus-visible:ring-black`}>
                        {optLabel}
                      </span>
                    </label>
                  )
                })}
              </div>
            </fieldset>
          )}

          {step === 3 && (
            <textarea
              id="field-comments"
              ref={commentsRef}
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); next() }
              }}
              rows={isMobile ? 6 : 8}
              className="mt-4 w-full px-4 py-3 rounded-2xl bg-black text-white placeholder-white/60 ring-1 ring-white/15 focus:outline-none focus:ring-2 focus:ring-white mx-auto"
              placeholder={t('contact.comments.placeholder')}
              required
            />
          )}

          {!!error && (<p className="text-sm text-red-600 mt-2 font-medium" role="alert">{error}</p>)}
        </div>

        {/* Mobile inline action + progress under inputs */}
        {isMobile && (
          <div className="mt-8 w-full">
            <div className="flex items-center justify-between gap-3 w-full">
              <button type="button" onClick={prev} disabled={step === 0} className="px-5 py-2 rounded-full bg-black text-white hover:bg-black/90 disabled:opacity-40">
                {t('contact.step.back')}
              </button>
              {step < 3 ? (
                <button type="button" onClick={next} className="px-5 py-2 rounded-full bg-black text-white hover:bg-black/90 ml-auto">
                  {t('contact.step.next')}
                </button>
              ) : (
                <button type="submit" disabled={sending} className="px-5 py-2 rounded-full bg-black text-white hover:bg-black/90 ml-auto disabled:opacity-60">
                  {sending ? t('common.loading') : t('contact.step.send')}
                </button>
              )}
            </div>
            <div className="mt-4 h-2 bg-black/10 rounded-full overflow-hidden ring-1 ring-black/15">
              <div className="h-full bg-black transition-all duration-300 ease-out" style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
            </div>
          </div>
        )}
      </div>
    </form>
  )
}


