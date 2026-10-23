import React, { useState, useEffect, useRef } from 'react'
import {
  ChevronLeftIcon,
  ComputerDesktopIcon,
  DevicePhoneMobileIcon,
  BoltIcon,
  SparklesIcon,
  XMarkIcon,
} from '@heroicons/react/24/solid'
import { playSfx } from '../lib/sfx.js'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import KickIcon from './icons/KickIcon.jsx'

const STORAGE_KEY = 'tutorial_shown'

const FOCUS_RING = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e600ff] focus-visible:outline-offset-2'

/**
 * TutorialModal — onboarding de controles en 5 slides. Lenguaje editorial +
 * toon (DESIGN.md §14): panel plano, borde sólido, display Luckiest Guy, cero
 * glow; pantalla completa en móvil.
 * Slide 0: bienvenida. Slides 1-4: movimiento / poder / patada / cámara, cada
 * uno mostrando los controles reales de escritorio y móvil.
 */
function TutorialModal({ t, open, onClose }) {
  const { lang } = useLanguage()
  const [slide, setSlide] = useState(0)
  const scrollRef = useRef(null)
  const totalSlides = 5

  // Reset slide when opened
  useEffect(() => {
    if (open) setSlide(0)
  }, [open])

  // Las slides comparten el mismo scroll: cada una empieza arriba.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0
  }, [slide])

  // Keyboard nav
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e) => {
      if (e?.key === 'Escape') onClose?.()
      if (e?.key === 'ArrowLeft') setSlide((s) => Math.max(0, s - 1))
      if (e?.key === 'ArrowRight') setSlide((s) => Math.min(totalSlides - 1, s + 1))
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  const isLast = slide === totalSlides - 1
  const close = () => {
    try { playSfx('click', { volume: 0.8 }) } catch { }
    onClose?.()
  }
  const goNext = () => {
    try { playSfx('click', { volume: 0.8 }) } catch { }
    if (slide < totalSlides - 1) setSlide(slide + 1)
    else onClose?.()
  }
  const goPrev = () => {
    try { playSfx('click', { volume: 0.8 }) } catch { }
    setSlide(Math.max(0, slide - 1))
  }
  const goToSlide = (idx) => {
    try { playSfx('click', { volume: 0.8 }) } catch { }
    setSlide(idx)
  }

  return (
    <div
      className="fixed inset-0 z-tutorial flex items-stretch sm:items-center justify-center p-0 sm:p-4 shop-inspect-enter"
      role="dialog"
      aria-modal="true"
      aria-label={t('tutorial.dialogAria')}
      onPointerDown={(e) => { if (e.target === e.currentTarget) onClose?.() }}
    >
      {/* §6.1: con /70 el blur sí se nota */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-xl pointer-events-none" />

      <div className="relative w-full h-full sm:h-auto sm:max-w-[560px] sm:max-h-[92vh] flex flex-col bg-[#0d0714] border-0 sm:border-2 sm:border-white/12 rounded-none sm:rounded-2xl overflow-hidden text-white">
        <button
          type="button"
          onClick={close}
          className={`absolute top-4 right-4 z-[10] w-11 h-11 grid place-items-center rounded-full border-2 border-white/40 bg-black/50 text-white hover:bg-white hover:text-black hover:border-white active:scale-90 transition-all ${FOCUS_RING}`}
          aria-label={t('common.close')}
        >
          <XMarkIcon className="w-5 h-5" aria-hidden />
        </button>

        {/* Todas las slides viven en la misma fila: la más alta fija la altura
            y el panel no brinca al cambiar de slide. */}
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden modal-scroll">
          <div
            className="flex transition-transform duration-300 ease-out"
            style={{ transform: `translateX(-${slide * 100}%)` }}
          >
            <Slide
              active={slide === 0}
              mark={(
                <span className="h-14 w-14 shrink-0 rounded-full bg-[#e600ff] text-[#0a0510] grid place-items-center" aria-hidden>
                  <SparklesIcon className="w-7 h-7" />
                </span>
              )}
              title={t('tutorial.welcome.title')}
              desc={t('tutorial.welcome.desc')}
              hint={t('tutorial.welcome.hint')}
            />

            <Slide active={slide === 1} title={t('tutorial.move.title')} desc={t('tutorial.move.desc')}>
              <PlatformList>
                <PlatformRow t={t} kind="desktop" text={t('tutorial.move.desktop')}>
                  <WasdGlyph />
                </PlatformRow>
                <PlatformRow t={t} kind="mobile" text={t('tutorial.move.mobile')}>
                  <JoystickGlyph />
                </PlatformRow>
              </PlatformList>
            </Slide>

            <Slide
              active={slide === 2}
              title={t('tutorial.power.title')}
              desc={t('tutorial.power.desc')}
              hint={t('tutorial.power.hint')}
            >
              <PlatformList>
                <PlatformRow t={t} kind="desktop" text={t('tutorial.power.desktop')}>
                  <Keycap>E</Keycap>
                </PlatformRow>
                <PlatformRow t={t} kind="mobile" text={t('tutorial.power.mobile')}>
                  <BoltGlyph />
                </PlatformRow>
              </PlatformList>
              {/* Amarillo de la barra de poder in-game (PowerBar), no acento de interfaz */}
              <Meter
                icon={<BoltIcon className="w-5 h-5 text-[#facc15]" />}
                fillClass="bg-[#facc15]"
                value={75}
                label={t('tutorial.power.power')}
              />
            </Slide>

            <Slide
              active={slide === 3}
              title={t('tutorial.kick.title')}
              desc={t('tutorial.kick.desc')}
              hint={t('tutorial.kick.hint')}
            >
              <PlatformList>
                <PlatformRow t={t} kind="desktop" text={t('tutorial.kick.desktop')}>
                  <Keycap className="w-28 text-xs">{lang === 'es' ? 'Espacio' : 'Space'}</Keycap>
                </PlatformRow>
                <PlatformRow t={t} kind="mobile" text={t('tutorial.kick.mobile')}>
                  <KickGlyph />
                </PlatformRow>
              </PlatformList>
              {/* Mismo medidor que KickChargeHud: cian de la patada en 3D y
                  cortes a 25/50/75% para soltar a la potencia que se quiere */}
              <Meter
                icon={<KickIcon className="w-5 h-5 text-[#22d3ee]" />}
                fillClass="bg-[#22d3ee]"
                value={85}
                ticks
                label={t('tutorial.kick.power')}
              />
            </Slide>

            <Slide
              active={slide === 4}
              title={t('tutorial.camera.title')}
              desc={t('tutorial.camera.desc')}
              hint={t('tutorial.camera.hint')}
            >
              <PlatformList>
                <PlatformRow t={t} kind="desktop" text={t('tutorial.camera.desktop')} />
                <PlatformRow t={t} kind="mobile" text={t('tutorial.camera.mobile')} />
              </PlatformList>
            </Slide>
          </div>
        </div>

        {/* En móvil los puntos van en su propia fila arriba de Atrás/Siguiente */}
        <div className="flex flex-wrap items-center justify-between gap-y-2 px-5 sm:px-8 py-4 border-t-2 border-white/10">
          <button
            type="button"
            onClick={goPrev}
            disabled={slide === 0}
            className={`shop-btn shop-btn--ghost w-12 h-12 p-0 ${FOCUS_RING}`}
            aria-label={t('tutorial.prev')}
          >
            <ChevronLeftIcon className="w-5 h-5" aria-hidden />
          </button>

          <div className="order-first w-full sm:order-none sm:w-auto flex justify-center">
            {Array.from({ length: totalSlides }).map((_, idx) => {
              const current = idx === slide
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => goToSlide(idx)}
                  className={`group w-11 h-11 grid place-items-center rounded-full ${FOCUS_RING}`}
                  aria-label={`${t('tutorial.goToSlide')} ${idx + 1}`}
                  aria-current={current ? 'step' : undefined}
                >
                  <span
                    className={`h-2.5 rounded-full transition-all duration-200 ${current
                      ? 'w-7 bg-[#e600ff]'
                      : 'w-2.5 bg-white/25 group-hover:bg-white/60'
                      }`}
                  />
                </button>
              )
            })}
          </div>

          <button
            type="button"
            onClick={goNext}
            className={`shop-btn shop-btn--primary min-h-[48px] px-6 text-sm ${FOCUS_RING}`}
          >
            {isLast ? t('tutorial.gotIt') : t('tutorial.next')}
          </button>
        </div>
      </div>
    </div>
  )
}

/** Una slide: título display (con marca opcional al lado), cuerpo, contenido y nota al pie. */
function Slide({ active, mark, title, desc, hint, children }) {
  return (
    <section className="w-full flex-shrink-0 px-5 sm:px-8 pt-6 sm:pt-8 pb-6" aria-hidden={!active}>
      <div className="flex items-center gap-4 pr-12">
        {mark}
        <h2 className="display-title display-title--md">{title}</h2>
      </div>
      {desc ? <p className="text-white/70 text-base leading-relaxed mt-3">{desc}</p> : null}
      {children}
      {hint ? <p className="text-white/55 text-sm leading-relaxed mt-5">{hint}</p> : null}
    </section>
  )
}

function PlatformList({ children }) {
  return <dl className="mt-6 border-t-2 border-white/10">{children}</dl>
}

/** Fila de ficha: plataforma a la izquierda, glifo del control + instrucción a la derecha. */
function PlatformRow({ t, kind, text, children }) {
  const Icon = kind === 'mobile' ? DevicePhoneMobileIcon : ComputerDesktopIcon
  const label = kind === 'mobile' ? t('tutorial.mobile') : t('tutorial.desktop')
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 py-4 border-b-2 border-white/10">
      <dt className="flex items-center gap-2 sm:w-32 shrink-0 text-sm font-semibold text-white/50">
        <Icon className="w-5 h-5" aria-hidden />
        {label}
      </dt>
      <dd className="flex-1 min-w-0 flex items-center gap-4">
        {children ? <div className="shrink-0" aria-hidden>{children}</div> : null}
        <span className="text-[15px] text-white/85 leading-snug">{text}</span>
      </dd>
    </div>
  )
}

/** Tecla plana: borde sólido, Outfit 700. */
function Keycap({ children, className = '' }) {
  return (
    <span className={`h-8 min-w-8 px-2 inline-grid place-items-center rounded-md border-2 border-white/25 bg-[#150a1d] text-sm font-bold leading-none text-white ${className}`}>
      {children}
    </span>
  )
}

/** Cruz WASD (escritorio: movimiento). */
function WasdGlyph() {
  return (
    <div className="flex flex-col items-center gap-1">
      <Keycap>W</Keycap>
      <div className="flex gap-1">
        <Keycap>A</Keycap>
        <Keycap>S</Keycap>
        <Keycap>D</Keycap>
      </div>
    </div>
  )
}

/** Joystick (móvil: movimiento). */
function JoystickGlyph() {
  return (
    <span className="h-10 w-10 rounded-full border-2 border-white/25 bg-[#150a1d] grid place-items-center">
      <span className="h-4 w-4 rounded-full bg-white" />
    </span>
  )
}

/** Botón de rayo (móvil: poder) — el mismo amarillo del botón in-game. */
function BoltGlyph() {
  return (
    <span className="h-10 w-10 rounded-full bg-[#facc15] text-[#0a0510] grid place-items-center">
      <BoltIcon className="w-5 h-5" />
    </span>
  )
}

/** Botón de patada (móvil) — el cian de la patada en 3D. */
function KickGlyph() {
  return (
    <span className="h-10 w-10 rounded-full bg-[#22d3ee] text-[#0a0510] grid place-items-center">
      <KickIcon className="w-5 h-5" />
    </span>
  )
}

/** Medidor ilustrativo: ícono + barra plana + nombre. */
function Meter({ icon, fillClass, value, ticks = false, label }) {
  return (
    <div className="mt-6 flex items-center gap-3" aria-hidden>
      <span className="shrink-0 grid place-items-center">{icon}</span>
      <div className="relative h-3 flex-1 max-w-[16rem] rounded-full bg-white/10 overflow-hidden">
        <div className={`absolute inset-y-0 left-0 ${fillClass}`} style={{ width: `${value}%` }} />
        {ticks && [25, 50, 75].map((p) => (
          <span key={p} className="absolute inset-y-0 w-[2px] -ml-px bg-[#0d0714]" style={{ left: `${p}%` }} />
        ))}
      </div>
      <span className="text-sm font-bold text-white/60">{label}</span>
    </div>
  )
}

/** Hook to manage whether the tutorial has been shown */
export function useTutorialShown() {
  const [shown, setShown] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true'
    } catch {
      return false
    }
  })

  const markAsShown = () => {
    try {
      localStorage.setItem(STORAGE_KEY, 'true')
      setShown(true)
    } catch { }
  }

  const reset = () => {
    try {
      localStorage.removeItem(STORAGE_KEY)
      setShown(false)
    } catch { }
  }

  return { shown, markAsShown, reset }
}

export default TutorialModal
