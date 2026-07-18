import React from 'react'
import { InformationCircleIcon, UserIcon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/solid'
import { playSfx } from '../lib/sfx.js'
import { sectionColors } from '../lib/appHelpers.js'
import GamepadIcon from './icons/GamepadIcon.jsx'

// Full-screen hamburger navigation overlay (mobile).
// Presentational — App owns animation state (`useMenuAnimation`) and the
// section-select behavior (preserves current "in-section vs HOME" logic).
//
// Props:
//   visible/keep — from useMenuAnimation: `visible` drives opacity/transform,
//                  the parent should render this only while `open` is true.
//   onClose — closes the overlay (wraps closeMenuAnimated + playSfx if needed).
//   onSelectSection(id) — called after the item animation plays; App decides
//                  whether to transition now or queue an auto-enter.
//   sections — list of section ids in display order.
//   sectionLabel — map id → display text.
//   t — i18n translator (used for tooltips).
//   openTutorial — callback when the Info button is clicked.
//   itemAnim — tween timings for staggered enter/exit.
export default function NavOverlay({
  visible,
  onClose,
  onSelectSection,
  sections,
  sectionLabel,
  t,
  openTutorial,
  // Game UI toggle — permite salir del modo compact desde aquí cuando el
  // botón del gear fan no existe (en mobile compacto ese fan no se renderiza).
  forceCompactUi = false,
  onToggleForceCompactUi,
  // Auth: login/logout acccesible desde el menú (en secciones el botón top-right
  // compite con el chrome de la UI; este sirve como entrada siempre visible).
  authenticated = false,
  onLogin,
  onLogout,
  onAccount,
  itemAnim = { inMs: 260, outMs: 200, stepMs: 100 },
}) {
  return (
    <div
      id="nav-overlay"
      role="dialog"
      aria-modal="true"
      className={`fixed inset-0 z-[999996] flex items-center justify-center transition-opacity duration-[260ms] ${visible ? 'opacity-100' : 'opacity-0'} ${visible ? '' : 'pointer-events-none'}`}
      onClick={onClose}
    >
      <style>{`
        @keyframes menuItemIn {
          0% { opacity: 0; transform: translateY(28px); }
          100% { opacity: 1; transform: translateY(0px); }
        }
        @keyframes menuItemOut {
          0% { opacity: 1; transform: translateY(0px); }
          100% { opacity: 0; transform: translateY(28px); }
        }
      `}</style>
      <div className={`absolute inset-0 bg-black/85 backdrop-blur-xl transition-opacity duration-[260ms] ${visible ? 'opacity-100' : 'opacity-0'}`} />
      <div
        className={`relative pointer-events-auto grid gap-10 w-full max-w-3xl px-8 place-items-center transition-all duration-[260ms] ${visible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-2 scale-[0.98]'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {sections.map((id, i) => (
          <button
            key={id}
            type="button"
            style={{
              color: sectionColors[id] || '#ffffff',
              WebkitTextStroke: '1.25px rgba(0,0,0,0.40)',
              textShadow: '0 10px 30px rgba(0,0,0,0.35)',
              animation: visible
                ? `menuItemIn ${itemAnim.inMs}ms cubic-bezier(0.18, 0.95, 0.2, 1) ${i * itemAnim.stepMs}ms both`
                : `menuItemOut ${itemAnim.outMs}ms var(--ease-expo-in) ${(sections.length - 1 - i) * itemAnim.stepMs}ms both`,
              willChange: 'transform, opacity',
            }}
            onClick={() => {
              try { playSfx('click', { volume: 1.0 }) } catch { }
              onSelectSection(id)
            }}
            className="text-center font-marquee uppercase leading-[0.9] tracking-wide text-[clamp(40px,10vw,96px)] hover:opacity-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >{sectionLabel[id]}</button>
        ))}

        {/* Quick actions row — kept inside the overlay to avoid cluttering the bottom-right corner. */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {/* Socials */}
          {[
            { key: 'x', href: 'https://x.com/mroscareth', label: 'X', icon: `${import.meta.env.BASE_URL}x.svg` },
            { key: 'ig', href: 'https://www.instagram.com/mroscar.eth', label: 'Instagram', icon: `${import.meta.env.BASE_URL}instagram.svg` },
            { key: 'be', href: 'https://www.behance.net/mroscar', label: 'Behance', icon: `${import.meta.env.BASE_URL}behance.svg` },
            { key: 'li', href: 'https://www.linkedin.com/in/omoctezuma/', label: 'LinkedIn', icon: `${import.meta.env.BASE_URL}linkedin.svg` },
          ].map((s) => (
            <a
              key={s.key}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              onMouseEnter={() => { try { playSfx('hover', { volume: 0.9 }) } catch { } }}
              onClick={() => { try { playSfx('click', { volume: 1.0 }) } catch { } }}
              className="h-12 w-12 rounded-full bg-black/50 backdrop-blur-xl border border-white/[0.08] text-white hover:bg-white/[0.15] grid place-items-center shadow-elev-lg transition-colors"
              aria-label={s.label}
              title={s.label}
            >
              <img src={s.icon} alt="" aria-hidden className="w-5 h-5 invert" draggable="false" />
            </a>
          ))}
          {/* Tutorial/Info */}
          <button
            type="button"
            onMouseEnter={() => { try { playSfx('hover', { volume: 0.9 }) } catch { } }}
            onClick={() => {
              try { playSfx('click', { volume: 1.0 }) } catch { }
              try { openTutorial?.() } catch { }
            }}
            className="h-12 w-12 rounded-full grid place-items-center shadow-elev-lg backdrop-blur-xl border transition-colors bg-black/50 border-white/[0.08] text-white hover:bg-white/[0.15]"
            aria-label={t('tutorial.showTutorial')}
            title={t('tutorial.showTutorial')}
          >
            <InformationCircleIcon className="w-5 h-5" />
          </button>
          {/* Login / Logout — siempre visible en el menú para que el flujo
              de auth sea accesible desde cualquier sección sin depender del
              botón top-right (que queda pequeño/oculto en mobile). */}
          {typeof onLogin === 'function' && !authenticated && (
            <button
              type="button"
              onMouseEnter={() => { try { playSfx('hover', { volume: 0.9 }) } catch { } }}
              onClick={() => {
                try { playSfx('click', { volume: 1.0 }) } catch { }
                try { onLogin() } catch { }
              }}
              className="h-12 w-12 rounded-full grid place-items-center shadow-elev-lg backdrop-blur-xl border transition-colors bg-black/50 border-white/[0.08] text-white hover:bg-white/[0.15]"
              aria-label="Login"
              title="Login"
            >
              <UserIcon className="w-5 h-5" />
            </button>
          )}
          {/* Game UI: normalmente NO va en el menú (se quitó por pedido). PERO al
              activar "Game UI" en desktop entras a compact UI y el gear fan (su
              único toggle) desaparece → quedarías atrapado. Por eso mostramos el
              botón de SALIDA aquí SOLO cuando forceCompactUi está activo, para
              poder volver a la UI de escritorio. */}
          {forceCompactUi && typeof onToggleForceCompactUi === 'function' && (
            <button
              type="button"
              onMouseEnter={() => { try { playSfx('hover', { volume: 0.9 }) } catch { } }}
              onClick={() => {
                try { playSfx('click', { volume: 1.0 }) } catch { }
                try { onToggleForceCompactUi() } catch { }
                try { onClose?.() } catch { }
              }}
              className="h-12 w-12 rounded-full grid place-items-center shadow-elev-lg backdrop-blur-xl border transition-colors bg-white/20 border-white/40 text-white hover:bg-white/30"
              aria-label={t('common.mobileUiOff')}
              title={t('common.mobileUiOff')}
            >
              <GamepadIcon className="w-5 h-5" />
            </button>
          )}

          {/* My Account removido del menú — ya está afuera (icono de cuenta top-right).
              Logout vive en el modal Mi Cuenta. */}
        </div>
      </div>
    </div>
  )
}
