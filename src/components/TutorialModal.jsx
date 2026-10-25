import React, { useState, useEffect } from 'react'
import {
  ComputerDesktopIcon,
  DevicePhoneMobileIcon,
  BoltIcon,
  XMarkIcon,
} from '@heroicons/react/24/solid'
import { playSfx } from '../lib/sfx.js'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import KickIcon from './icons/KickIcon.jsx'

const STORAGE_KEY = 'tutorial_shown'

const FOCUS_RING = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e600ff] focus-visible:outline-offset-2'

/**
 * TutorialModal — los controles del juego. Modal estándar del sitio
 * (.site-modal, alto según el contenido) con la anatomía de los demás:
 * nombre + una línea de detalle, el contenido y una barra fija con la acción
 * de color al final.
 * Antes eran 5 slides que se pasaban de una en una, y la primera era una
 * bienvenida sin controles. Con el ancho del modal estándar los cuatro
 * controles (movimiento, patada, poder, cámara) caben juntos: se ven de un
 * vistazo y se cierra con un solo clic (H06, H08). La idea de la bienvenida
 * quedó como línea de detalle.
 */
function TutorialModal({ t, open, onClose }) {
  const { lang } = useLanguage()

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e) => { if (e?.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  const close = () => {
    try { playSfx('click', { volume: 0.8 }) } catch { }
    onClose?.()
  }

  return (
    <div
      className="fixed inset-0 z-tutorial flex items-stretch sm:items-center justify-center p-0 sm:p-4 lg:p-8 shop-inspect-enter"
      role="dialog"
      aria-modal="true"
      aria-label={t('tutorial.dialogAria')}
      onPointerDown={(e) => { if (e.target === e.currentTarget) onClose?.() }}
    >
      {/* §6.1: con /70 el blur sí se nota */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-xl pointer-events-none" />

      <div className="site-modal site-modal--fit text-white" onPointerDown={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={close}
          className={`absolute top-4 right-4 z-[10] w-11 h-11 grid place-items-center rounded-full border-2 border-white/40 bg-black/50 text-white hover:bg-white hover:text-black hover:border-white active:scale-90 transition-all ${FOCUS_RING}`}
          aria-label={t('common.close')}
        >
          <XMarkIcon className="w-5 h-5" aria-hidden />
        </button>

        <header className="px-5 sm:px-8 lg:px-10 pt-6 sm:pt-8 pb-5 border-b-2 border-white/10 pr-16">
          <h2 className="shop-detail__title">{t('tutorial.title')}</h2>
          <p className="shop-meta shop-meta--lg mt-1 !whitespace-normal">{t('tutorial.subtitle')}</p>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto modal-scroll px-5 sm:px-8 lg:px-10 py-6 sm:py-7">
          {/* Dos columnas que crecen cada una por su lado (una cuadrícula de
              filas dejaba un hueco bajo Movimiento, más corto que Patada). En
              mobile se leen en orden: movimiento, patada, poder, cámara. */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-9 items-start">
            <div className="space-y-9">
            <ControlSection title={t('tutorial.move.title')} desc={t('tutorial.move.desc')}>
              <PlatformList>
                <PlatformRow t={t} kind="desktop" text={t('tutorial.move.desktop')}>
                  <WasdGlyph />
                </PlatformRow>
                <PlatformRow t={t} kind="mobile" text={t('tutorial.move.mobile')}>
                  <JoystickGlyph />
                </PlatformRow>
              </PlatformList>
            </ControlSection>

            <ControlSection title={t('tutorial.kick.title')} desc={t('tutorial.kick.desc')} hint={t('tutorial.kick.hint')}>
              <PlatformList>
                <PlatformRow t={t} kind="desktop" text={t('tutorial.kick.desktop')}>
                  <Keycap className="w-28 text-xs">{lang === 'es' ? 'Espacio' : 'Space'}</Keycap>
                </PlatformRow>
                {/* En celular no hay botón de patada: se empuja caminando. */}
                <PlatformRow t={t} kind="mobile" text={t('tutorial.kick.mobile')}>
                  <JoystickGlyph />
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
            </ControlSection>
            </div>

            <div className="space-y-9">

            <ControlSection title={t('tutorial.power.title')} desc={t('tutorial.power.desc')} hint={t('tutorial.power.hint')}>
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
            </ControlSection>

            <ControlSection title={t('tutorial.camera.title')} desc={t('tutorial.camera.desc')} hint={t('tutorial.camera.hint')}>
              <PlatformList>
                <PlatformRow t={t} kind="desktop" text={t('tutorial.camera.desktop')} />
                <PlatformRow t={t} kind="mobile" text={t('tutorial.camera.mobile')} />
              </PlatformList>
            </ControlSection>
            </div>
          </div>
        </div>

        {/* Barra fija: el aviso de que se puede volver a ver a la izquierda y
            la acción de color al final (DESIGN.md §4.6). */}
        <div className="shrink-0 border-t-2 border-white/10 px-5 sm:px-8 lg:px-10 py-4 flex items-center justify-between gap-4">
          <p className="text-sm text-white/55 min-w-0">{t('tutorial.replayHint')}</p>
          <button
            type="button"
            onClick={close}
            className={`shop-btn shop-btn--primary shrink-0 min-h-[44px] px-6 text-xs ${FOCUS_RING}`}
          >
            {t('tutorial.gotIt')}
          </button>
        </div>
      </div>
    </div>
  )
}

/** Un control: nombre, para qué sirve, cómo se hace en cada plataforma y una nota. */
function ControlSection({ title, desc, hint, children }) {
  return (
    <section>
      <h3 className="text-lg sm:text-xl font-bold text-white">{title}</h3>
      {desc ? <p className="text-white/70 text-[0.9375rem] leading-relaxed mt-1.5">{desc}</p> : null}
      {children}
      {hint ? <p className="text-white/55 text-sm leading-relaxed mt-3">{hint}</p> : null}
    </section>
  )
}

function PlatformList({ children }) {
  return <dl className="mt-4 border-t-2 border-white/10">{children}</dl>
}

/** Fila de ficha: plataforma a la izquierda, glifo del control + instrucción a la derecha. */
function PlatformRow({ t, kind, text, children }) {
  const Icon = kind === 'mobile' ? DevicePhoneMobileIcon : ComputerDesktopIcon
  const label = kind === 'mobile' ? t('tutorial.mobile') : t('tutorial.desktop')
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 py-3 border-b-2 border-white/10">
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

/** Medidor ilustrativo: ícono + barra plana + nombre. */
function Meter({ icon, fillClass, value, ticks = false, label }) {
  return (
    <div className="mt-4 flex items-center gap-3" aria-hidden>
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
