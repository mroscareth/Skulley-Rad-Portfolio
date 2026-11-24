import React from 'react'
import IconoTinta from '../ui/IconoTinta.jsx'
import { playSfx } from '../../lib/sfx.js'
import { sectionColors } from '../../lib/appHelpers.js'

// Avisa a la escena 3D qué sección está bajo el cursor, para que el portal de
// esa sección arme su cristal (ver components/fx/PortalCrystal.jsx). Va por
// CustomEvent y no por estado de App: el hover de un botón no tiene por qué
// re-renderizar el árbol entero. `source: 'nav'` porque el marquee solo
// reacciona al hover de los portales en 3D: en la nav el nombre ya está escrito.
const emitPortalHover = (id) => {
  try { window.dispatchEvent(new CustomEvent('portal-hover', { detail: { id, source: 'nav' } })) } catch { }
}

// Desktop bottom-center section nav + language + la bocina (lib/silencioSitio.js:
// calla la música y los efectos; la música se abre con el botón amarillo del
// retrato). Tinta sólida (2026-11-21): una placa blanca levantada como las
// teclas, con los nombres impresos en tinta; el que señalas y la sección activa
// se levantan como tecla en el color de su sección (.nav-tinta en index.css).
// El idioma y la bocina son teclas.
// Presentational. App owns nav state (`navRef`, `navInnerRef`, `navBtnRefs`,
// `navHover` + `updateNavHighlightForEl`) and passes them as props.
export default function DesktopNav({
  uiAnimPhase,
  // 'oculta' durante la partida del juego de esferas, 'volviendo' al terminar.
  juego = null,
  showSectionUi,
  section,
  sectionLabel,
  sections,
  silencio,
  onSelectSection,
  onToggleSilencio,
  onToggleLang,
  t,
  navRef,
  navInnerRef,
  navBtnRefs,
  setNavHover,
  updateNavHighlightForEl,
}) {
  const animClass = juego === 'oculta' || uiAnimPhase === 'exiting'
    ? 'animate-ui-exit-down'
    : juego === 'volviendo' || uiAnimPhase === 'entering' ? 'animate-ui-enter-up' : ''
  return (
    <div
      key="desktop-nav"
      ref={navRef}
      className="pointer-events-auto fixed inset-x-0 bottom-10 z-[999991] flex items-center justify-center"
      inert={juego === 'oculta'}
    >
      <div ref={navInnerRef} className={`nav-tinta ${animClass}`}>
        <div className="nav-tinta__placa nav-tinta__placa--tecla">
          {sections.map((id) => {
            const isActive = showSectionUi && section === id
            const sColor = sectionColors[id] || '#fff'
            return (
              <button
                key={id}
                type="button"
                ref={(el) => { if (el) navBtnRefs.current[id] = el }}
                onMouseEnter={(e) => { updateNavHighlightForEl(e.currentTarget); emitPortalHover(id); try { playSfx('hover', { volume: 0.9 }) } catch { } }}
                onFocus={(e) => { updateNavHighlightForEl(e.currentTarget); emitPortalHover(id) }}
                onMouseLeave={() => { setNavHover((h) => ({ ...h, visible: false })); emitPortalHover(null) }}
                onBlur={() => { setNavHover((h) => ({ ...h, visible: false })); emitPortalHover(null) }}
                onClick={() => onSelectSection(id)}
                className={`nav-tinta__item font-marquee${isActive ? ' es-activa' : ''}`}
                style={{ '--cara-encima': sColor }}
                aria-current={isActive ? 'page' : undefined}
              >
                {sectionLabel[id]}
              </button>
            )
          })}
        </div>
        <button
          type="button"
          onClick={onToggleLang}
          onMouseEnter={() => { try { playSfx('hover', { volume: 0.9 }) } catch { } }}
          className="burbuja-vidrio nav-tinta__tecla font-marquee"
          aria-label={t('common.switchLanguage')}
          data-tip={t('common.switchLanguage')}
        >{t('nav.langShort')}</button>
        <button
          type="button"
          onClick={onToggleSilencio}
          onMouseEnter={() => { try { playSfx('hover', { volume: 0.9 }) } catch { } }}
          className="burbuja-vidrio nav-tinta__tecla"
          aria-label={silencio ? t('nav.unmute') : t('nav.mute')}
          data-tip={silencio ? t('nav.unmute') : t('nav.mute')}
        >
          <IconoTinta nombre={silencio ? 'mudo' : 'bocina'} tam={34} />
        </button>
      </div>
    </div>
  )
}
