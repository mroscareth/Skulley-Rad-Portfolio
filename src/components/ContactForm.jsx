import React from 'react'

// Formulario por pasos inspirado en Typeform: una pregunta por pantalla,
// con foco gestionado, validación básica y accesibilidad (labels/fieldset/legend).
// No envía a servidor: muestra un resumen de confirmación al finalizar.

export default function ContactForm() {
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
  const [subject, setSubject] = React.useState('Trabajemos juntos')
  const [comments, setComments] = React.useState('')
  const [submitted, setSubmitted] = React.useState(false)
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

  function next() {
    if (step === 0) {
      if (!name.trim()) return setError('Por favor ingresa tu nombre')
    }
    if (step === 1) {
      if (!email.trim()) return setError('Por favor ingresa tu email')
      if (!isValidEmail(email)) return setError('Email no válido')
    }
    if (step === 3) {
      // último paso: enviar
      if (!comments.trim()) return setError('Cuéntame un poco en comentarios')
      setSubmitted(true)
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
    // En pasos 0 y 1 avanzamos con Enter
    if (step !== 3) {
      e.preventDefault()
      next()
      return
    }
    // En textarea (paso 3): Shift+Enter = salto de línea, Enter = enviar/avanzar
    if (!e.shiftKey) {
      e.preventDefault()
      next()
    }
  }

  // Determinar dirección de animación según cambio de paso
  const prevStep = prevStepRef.current
  const direction = step >= prevStep ? 'forward' : 'backward'
  React.useEffect(() => { prevStepRef.current = step }, [step])

  if (submitted) {
    return (
      <div className="w-full mx-auto text-center" style={{ maxWidth: '840px' }}>
        <h3 className="font-marquee text-black uppercase leading-none text-[clamp(72px,14vw,240px)] inline-block mx-auto ml-[-0.35em]">¡GRACIAS!</h3>
        <p className="mt-4 text-lg text-black/90">He recibido tu mensaje, pronto estaré en contacto contigo.</p>
        <button type="button" className="mt-6 px-6 py-3 rounded-full bg-black text-white hover:bg-black/90" onClick={() => { setSubmitted(false); setStep(0) }}>
          Enviar otro
        </button>
      </div>
    )
  }

  const steps = [
    { id: 'name', label: '¿Cómo te llamas?', desc: 'Escribe tu nombre' },
    { id: 'email', label: '¿Cuál es tu email?', desc: 'Para poder responderte' },
    { id: 'subject', label: '¿Sobre qué quieres hablar?', desc: 'Elige una opción' },
    { id: 'comments', label: 'Cuéntame más', desc: 'Añade detalles, enlaces o ideas' },
  ]

  return (
    <form className="pointer-events-auto" onSubmit={(e) => { e.preventDefault(); next() }}>
      <div className="w-full mx-auto text-black text-center" style={{ maxWidth: '840px' }}>
        {/* Progreso (desktop fijo; mobile inline) */}
        {!isMobile && (
          <div
            className="mb-10 fixed left-1/2 -translate-x-1/2 z-[14000] pointer-events-none"
            aria-live="polite"
            style={{ width: 'min(840px, 92vw)', bottom: 'calc(env(safe-area-inset-bottom, 0px) + 90px)' }}
          >
            <div className="h-2 bg-black/10 rounded-full overflow-hidden ring-1 ring-black/15">
              <div className="h-full bg-black transition-all duration-300 ease-out" style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
            </div>
          </div>
        )}

        {/* Action bar: desktop fijo; en mobile se renderiza inline más abajo */}
        {!isMobile && (
          <div
            className="fixed left-1/2 -translate-x-1/2 z-[14010] pointer-events-auto"
            style={{ width: 'min(840px, 92vw)', bottom: 'calc(env(safe-area-inset-bottom, 0px) + 155px)' }}
          >
            <div className="flex items-center justify-between gap-3 w-full">
              <button type="button" onClick={prev} disabled={step === 0} className="px-5 py-2 rounded-full bg-black text-white hover:bg-black/90 disabled:opacity-40">
                Atrás
              </button>
              {step < 3 ? (
                <button type="button" onClick={next} className="px-5 py-2 rounded-full bg-black text-white hover:bg-black/90 ml-auto">
                  Siguiente
                </button>
              ) : (
                <button type="submit" className="px-5 py-2 rounded-full bg-black text-white hover:bg-black/90 ml-auto">
                  Enviar
                </button>
              )}
            </div>
          </div>
        )}

        {/* Paso actual */}
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
              placeholder="Tu nombre"
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
              placeholder="tu@email.com"
              autoComplete="email"
              required
            />
          )}

          {step === 2 && (
            <fieldset className="mt-2" style={{ marginTop: '30px' }}>
              <legend className="sr-only">Asunto</legend>
              <div className={isMobile ? 'grid grid-cols-1 gap-3 justify-items-stretch' : 'grid grid-cols-1 sm:grid-cols-3 gap-3 justify-items-center'}>
                {['Trabajemos juntos', 'Colaboración', 'Otro'].map((opt, i) => {
                  const selected = subject === opt
                  return (
                    <label key={opt} className="cursor-pointer select-none">
                      <input
                        ref={i === 0 ? firstRadioRef : null}
                        type="radio"
                        name="subject"
                        value={opt}
                        checked={selected}
                        onChange={() => setSubject(opt)}
                        className="sr-only peer"
                      />
                      <span className={`block w-full text-center rounded-full px-6 py-4 transition-all duration-200 ${selected ? 'bg-black text-white ring-2 ring-black scale-[1.02]' : 'bg-transparent text-black ring-2 ring-black hover:bg-black/5'} peer-focus-visible:ring-2 peer-focus-visible:ring-black`}>
                        {opt}
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
              placeholder="Escribe tus comentarios (Shift+Enter para salto de línea)"
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
                Atrás
              </button>
              {step < 3 ? (
                <button type="button" onClick={next} className="px-5 py-2 rounded-full bg-black text-white hover:bg-black/90 ml-auto">
                  Siguiente
                </button>
              ) : (
                <button type="submit" className="px-5 py-2 rounded-full bg-black text-white hover:bg-black/90 ml-auto">
                  Enviar
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


