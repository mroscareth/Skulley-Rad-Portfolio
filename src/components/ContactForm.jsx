import React from 'react'
import { useLanguage } from '../i18n/LanguageContext.jsx'

// Step-by-step contact form (one question at a time) in the editorial + toon
// language of the Store (DESIGN.md §14): flat surfaces, 2px solid borders, no
// shadows or halos. Accent = Contact yellow (`section-contact` token).
// Preserves the original logic: validation, honeypot anti-spam, server submission, i18n.

// `shop` = la tienda o un pedido (desde 2026-10-25). La ayuda de la tienda
// (/help) enlaza aquí con ?topic=shop para que llegue ya elegido.
const SUBJECT_OPTIONS = ['workTogether', 'collaboration', 'shop', 'other']

const initialSubject = () => {
  try {
    const topic = new URLSearchParams(window.location.search).get('topic')
    return SUBJECT_OPTIONS.includes(topic) ? topic : ''
  } catch { return '' }
}

const isValidEmail = (v) => /.+@.+\..+/.test(String(v || '').toLowerCase())

const FOCUS_RING = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-section-contact'
const TITLE = 'block display-title display-title--md text-white'
const HELP = 'mt-3 text-base text-white/55'
const FIELD = 'mt-6 w-full rounded-xl border-2 border-white/15 bg-[#150a1d] px-4 py-3 text-lg text-white placeholder:text-white/30 caret-section-contact outline-none transition-colors focus:border-section-contact aria-[invalid=true]:border-red-400'
// Entrance via @starting-style: no keyframes, and it degrades to "no animation".
const ENTER = 'transition-[opacity,translate] duration-300 ease-expo-out starting:translate-y-2 starting:opacity-0 motion-reduce:transition-none'

export default function ContactForm() {
  const { t, lang } = useLanguage()
  const es = lang === 'es'
  const uid = React.useId()
  const [step, setStep] = React.useState(0)
  const [name, setName] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [subject, setSubject] = React.useState(initialSubject)
  const [comments, setComments] = React.useState('')
  // Honeypot anti-spam (bots usually fill hidden fields)
  const [company, setCompany] = React.useState('')
  const [submitted, setSubmitted] = React.useState(false)
  const [sending, setSending] = React.useState(false)
  const [error, setError] = React.useState('')

  const fieldRef = React.useRef(null)
  const choicesRef = React.useRef(null)
  const successRef = React.useRef(null)

  // Each step focuses its own field; on the subject step, the chosen option or the first one.
  React.useEffect(() => {
    setError('')
    const timer = setTimeout(() => {
      const el = step === 2
        ? (choicesRef.current?.querySelector('input:checked') || choicesRef.current?.querySelector('input'))
        : fieldRef.current
      el?.focus({ preventScroll: true })
    }, 80)
    return () => clearTimeout(timer)
  }, [step])

  React.useEffect(() => {
    if (submitted) successRef.current?.focus({ preventScroll: true })
  }, [submitted])

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
    if (sending) return
    if (step === 0) {
      if (!name.trim()) return setError(t('contact.errors.emptyName'))
      setStep(1)
    } else if (step === 1) {
      const val = email.trim()
      if (!val) return setError(t('contact.errors.emptyEmail'))
      if (!isValidEmail(val)) return setError(t('contact.errors.invalidEmail'))
      setStep(2)
    } else if (step === 2) {
      if (!SUBJECT_OPTIONS.includes(subject)) {
        return setError(es ? 'Elige una opción para seguir.' : 'Pick an option to continue.')
      }
      setStep(3)
    } else if (step === 3) {
      if (!comments.trim()) return setError(t('contact.errors.emptyComments'))
      setError('')
      sendToServer({
        name: name.trim(),
        email: email.trim(),
        subject,
        comments: comments.trim(),
      })
    }
  }

  function back() {
    if (sending || step === 0) return
    setStep(step - 1)
  }

  function handleEnter(e) {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return
    if (e.currentTarget.tagName === 'TEXTAREA') {
      if (e.shiftKey) return // allow newline
      // Touch keyboards have no Shift+Enter: there Enter is a newline and the Send button submits.
      if (window.matchMedia?.('(pointer: coarse)')?.matches) return
    }
    e.preventDefault()
    next()
  }

  function edit(setter) {
    return (e) => {
      setter(e.target.value)
      if (error) setError('')
    }
  }

  function reset() {
    setSubmitted(false)
    setStep(0)
    setName('')
    setEmail('')
    setSubject('')
    setComments('')
    setError('')
  }

  const steps = [
    { id: 'name', title: t('contact.name.label'), help: t('contact.name.desc') },
    { id: 'email', title: t('contact.email.label'), help: t('contact.email.desc') },
    { id: 'subject', title: t('contact.subject.question'), help: t('contact.subject.desc') },
    // Sobre la tienda, lo primero que hace falta para ayudar es el número de pedido.
    { id: 'comments', title: t('contact.comments.label'), help: t(subject === 'shop' ? 'contact.comments.descShop' : 'contact.comments.desc') },
  ]
  const current = steps[step]
  const isLast = step === steps.length - 1
  const fieldId = `${uid}-${current.id}`
  const helpId = `${fieldId}-help`
  const errorId = `${uid}-error`
  const describedBy = error ? `${helpId} ${errorId}` : helpId
  const invalid = error ? true : undefined
  const sendingLabel = es ? 'Enviando…' : 'Sending…'

  const summary = [
    [es ? 'Nombre' : 'Name', name.trim()],
    ['Email', email.trim()],
    [t('contact.subject.label'), subject ? t(`contact.subject.options.${subject}`) : ''],
    [es ? 'Mensaje' : 'Message', comments.trim()],
  ]

  return (
    <form
      className="pointer-events-auto mx-auto flex w-full max-w-2xl flex-col rounded-3xl border-2 border-white/10 bg-[#0d0714] p-6 text-white sm:p-10"
      onSubmit={(e) => e.preventDefault()}
      noValidate
      aria-label={es ? 'Formulario de contacto' : 'Contact form'}
      aria-busy={sending || undefined}
    >
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

      <p className="sr-only" aria-live="polite">{sending ? sendingLabel : ''}</p>

      {submitted ? (
        <div className={ENTER}>
          <h2 ref={successRef} tabIndex={-1} className="display-title display-title--md text-white outline-none">
            {t('contact.thanks')}
          </h2>
          <p className="mt-4 text-base text-white/70 sm:text-lg">{t('contact.thanksDesc')}</p>

          <dl className="mt-8 grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-3 border-t-2 border-white/10 pt-6">
            {summary.map(([label, value]) => (
              <React.Fragment key={label}>
                <dt className="shop-kicker pt-1.5 text-white/55">{label}</dt>
                <dd className="line-clamp-4 whitespace-pre-wrap break-words text-base text-white">{value}</dd>
              </React.Fragment>
            ))}
          </dl>

          <button
            type="button"
            onClick={reset}
            className={`shop-btn shop-btn--ghost mt-8 h-12 px-6 text-sm ${FOCUS_RING}`}
          >
            {t('contact.sendAnother')}
          </button>
        </div>
      ) : (
        <>
          {/* Progress: flat segmented bar + "n / 4" */}
          <div className="flex items-center gap-4">
            <div
              role="progressbar"
              aria-label={es ? 'Progreso' : 'Progress'}
              aria-valuemin={1}
              aria-valuemax={steps.length}
              aria-valuenow={step + 1}
              aria-valuetext={es ? `Paso ${step + 1} de ${steps.length}` : `Step ${step + 1} of ${steps.length}`}
              className="flex flex-1 gap-1.5"
            >
              {steps.map((s, i) => (
                <span
                  key={s.id}
                  className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${i <= step ? 'bg-section-contact' : 'bg-white/12'}`}
                />
              ))}
            </div>
            <span aria-hidden="true" className="text-sm font-bold tabular-nums text-white/55">
              {step + 1} / {steps.length}
            </span>
          </div>

          {/* Desktop reserves the tallest step's height (textarea) so the panel doesn't jump between questions */}
          <div className="mt-8 flex-1 sm:mt-10 sm:min-h-[16rem]">
            <div key={current.id} className={ENTER}>
              {step === 2 ? (
                <fieldset aria-describedby={describedBy}>
                  <legend className={TITLE}>{current.title}</legend>
                  <p id={helpId} className={HELP}>{current.help}</p>
                  <div ref={choicesRef} className="mt-6 flex flex-wrap gap-3">
                    {SUBJECT_OPTIONS.map((optId) => {
                      const on = subject === optId
                      return (
                        <label
                          key={optId}
                          className={`relative inline-flex min-h-12 items-center rounded-full border-2 px-5 text-sm font-bold uppercase tracking-[0.14em] transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-section-contact ${on
                            ? 'border-section-contact bg-section-contact text-[#0a0510]'
                            : 'border-white/15 text-white/70 hover:border-white/50 hover:text-white'}`}
                        >
                          <input
                            type="radio"
                            name="subject"
                            value={optId}
                            checked={on}
                            onChange={() => {
                              setSubject(optId)
                              if (error) setError('')
                            }}
                            onKeyDown={handleEnter}
                            className="sr-only"
                          />
                          {t(`contact.subject.options.${optId}`)}
                        </label>
                      )
                    })}
                  </div>
                </fieldset>
              ) : (
                <>
                  <label htmlFor={fieldId} className={TITLE}>{current.title}</label>
                  <p id={helpId} className={HELP}>{current.help}</p>

                  {step === 3 ? (
                    <textarea
                      ref={fieldRef}
                      id={fieldId}
                      name="comments"
                      value={comments}
                      onChange={edit(setComments)}
                      onKeyDown={handleEnter}
                      readOnly={sending}
                      rows={4}
                      placeholder={t('contact.comments.placeholder')}
                      aria-describedby={describedBy}
                      aria-invalid={invalid}
                      className={`${FIELD} resize-none leading-relaxed`}
                    />
                  ) : (
                    <input
                      ref={fieldRef}
                      id={fieldId}
                      type={step === 1 ? 'email' : 'text'}
                      name={current.id}
                      value={step === 0 ? name : email}
                      onChange={edit(step === 0 ? setName : setEmail)}
                      onKeyDown={handleEnter}
                      placeholder={step === 0 ? t('contact.name.placeholder') : t('contact.email.placeholder')}
                      autoComplete={step === 0 ? 'name' : 'email'}
                      autoCapitalize={step === 0 ? 'words' : 'off'}
                      inputMode={step === 1 ? 'email' : undefined}
                      enterKeyHint="next"
                      spellCheck={false}
                      aria-describedby={describedBy}
                      aria-invalid={invalid}
                      className={FIELD}
                    />
                  )}
                </>
              )}
            </div>

            <p id={errorId} role="alert" className="mt-3 min-h-6 text-base text-red-400">{error}</p>
          </div>

          {/* La acción principal va al final, a la derecha (DESIGN.md §4.6);
              la pista del teclado se queda del lado izquierdo. */}
          <div className="mt-6 flex items-center justify-end gap-3">
            <span className="hidden mr-auto text-sm text-white/55 pointer-fine:inline">
              {es ? 'También funciona con Enter' : 'Enter works too'}
            </span>
            {step > 0 && (
              <button
                type="button"
                onClick={back}
                disabled={sending}
                className={`shop-btn shop-btn--ghost h-12 px-6 text-sm ${FOCUS_RING}`}
              >
                {t('contact.step.back')}
              </button>
            )}
            <button
              type="button"
              onClick={next}
              aria-disabled={sending || undefined}
              className={`shop-btn h-12 flex-1 bg-section-contact px-8 text-sm text-[#0a0510] hover:bg-[#faff66] sm:flex-none ${FOCUS_RING}`}
            >
              {sending ? sendingLabel : isLast ? t('contact.step.send') : t('contact.step.next')}
            </button>
          </div>
        </>
      )}
    </form>
  )
}
