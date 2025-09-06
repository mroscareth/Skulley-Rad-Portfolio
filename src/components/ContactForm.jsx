import React from 'react'

// Formulario por pasos inspirado en Typeform: una pregunta por pantalla,
// con foco gestionado, validación básica y accesibilidad (labels/fieldset/legend).
// No envía a servidor: muestra un resumen de confirmación al finalizar.

export default function ContactForm() {
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
      <div className="max-w-xl mx-auto text-left space-y-4">
        <h3 className="text-2xl font-bold">¡Gracias!</h3>
        <p className="opacity-90">He recibido tu mensaje. Resumen:</p>
        <ul className="text-sm space-y-1">
          <li><span className="font-semibold">Nombre:</span> {name}</li>
          <li><span className="font-semibold">Email:</span> {email}</li>
          <li><span className="font-semibold">Asunto:</span> {subject}</li>
          <li><span className="font-semibold">Comentarios:</span> {comments}</li>
        </ul>
        <button type="button" className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-white/90 text-black hover:bg-white transition-colors" onClick={() => { setSubmitted(false); setStep(0) }}>
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
      <div className="w-full text-left mx-auto" style={{ maxWidth: '840px' }}>
        {/* Progreso */}
        <div className="mb-6" aria-live="polite">
          <div className="flex items-center justify-between text-sm opacity-80 mb-2">
            <span>Paso {step + 1} de {steps.length}</span>
            <span>{steps[step].id}</span>
          </div>
          <div className="h-2 bg-white/20 rounded-full overflow-hidden">
            <div className="h-full bg-white/80" style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
          </div>
        </div>

        {/* Paso actual */}
        <div key={step} className={`space-y-2 will-change-transform ${direction === 'forward' ? 'animate-[slideleft_260ms_ease]' : 'animate-[slideright_260ms_ease]'}`}>
          <label className="block text-2xl font-bold" htmlFor={`field-${steps[step].id}`}>{steps[step].label}</label>
          <p className="text-sm opacity-80">{steps[step].desc}</p>

          {step === 0 && (
            <input
              id="field-name"
              ref={nameRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={onKeyDown}
              className="mt-3 w-full px-4 py-3 rounded-md bg-white/95 text-black placeholder-black/50 focus:outline-none focus:ring-2 focus:ring-white"
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
              className="mt-3 w-full px-4 py-3 rounded-md bg-white/95 text-black placeholder-black/50 focus:outline-none focus:ring-2 focus:ring-white"
              placeholder="tu@email.com"
              autoComplete="email"
              required
            />
          )}

          {step === 2 && (
            <fieldset className="mt-2">
              <legend className="sr-only">Asunto</legend>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                      <span className={`block w-full rounded-full px-5 py-4 bg-white/10 hover:bg-white/15 text-white ring-1 ring-white/25 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-white ${selected ? 'bg-white/20 ring-2 ring-white' : ''}`}>
                        <span className="inline-flex items-center gap-3">
                          <span className={`relative inline-flex h-4 w-4 items-center justify-center rounded-full ring-2 ${selected ? 'ring-white' : 'ring-white/80'}`}>
                            <span className={`absolute inset-1 rounded-full ${selected ? 'bg-black opacity-100' : 'bg-black opacity-0'} transition-opacity`} />
                          </span>
                          <span>{opt}</span>
                        </span>
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
              rows={8}
              className="mt-3 w-full px-4 py-3 rounded-md bg-white/95 text-black placeholder-black/50 focus:outline-none focus:ring-2 focus:ring-white"
              placeholder="Escribe tus comentarios (Shift+Enter para salto de línea)"
              required
            />
          )}

          {!!error && (<p className="text-sm text-red-200 mt-2" role="alert">{error}</p>)}
        </div>

        {/* Controles */}
        <div className="mt-6 flex items-center gap-3">
          <button type="button" onClick={prev} disabled={step === 0} className="px-4 py-2 rounded-md bg-white/20 hover:bg-white/30 disabled:opacity-40">
            Atrás
          </button>
          {step < 3 ? (
            <button type="button" onClick={next} className="px-4 py-2 rounded-md bg-white/90 text-black hover:bg-white">
              Siguiente
            </button>
          ) : (
            <button type="submit" className="px-4 py-2 rounded-md bg-white/90 text-black hover:bg-white">
              Enviar
            </button>
          )}
        </div>
      </div>
    </form>
  )
}


