import React from 'react'
import { MusicalNoteIcon } from '@heroicons/react/24/solid'
import { playSfx } from '../../lib/sfx.js'
import { sectionColors } from '../../lib/appHelpers.js'

// Desktop bottom-center section nav with hover highlight + language + music toggle.
// Presentational. App owns nav state (`navRef`, `navInnerRef`, `navBtnRefs`,
// `navHover` + `updateNavHighlightForEl`) and passes them as props.
export default function DesktopNav({
  uiAnimPhase,
  showSectionUi,
  section,
  sectionLabel,
  sections,
  showMusic,
  onSelectSection,
  onToggleMusic,
  onToggleLang,
  lang,
  t,
  navRef,
  navInnerRef,
  navBtnRefs,
  navHover,
  setNavHover,
  updateNavHighlightForEl,
}) {
  const animClass = uiAnimPhase === 'entering'
    ? 'animate-ui-enter-up'
    : uiAnimPhase === 'exiting' ? 'animate-ui-exit-down' : ''
  return (
    <div
      key="desktop-nav"
      ref={navRef}
      className={`pointer-events-auto fixed inset-x-0 bottom-10 z-[999991] flex items-center justify-center ${animClass}`}
    >
      <div
        ref={navInnerRef}
        className="relative bg-black/35 backdrop-blur-3xl rounded-full border border-white/[0.12] shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-2 flex items-center gap-0.5 overflow-hidden"
      >
        {/* Hover highlight */}
        <div
          className={`absolute rounded-full bg-white/[0.08] transition-all duration-200 ${navHover.visible ? 'opacity-100' : 'opacity-0'}`}
          style={{ left: `${navHover.left}px`, width: `${navHover.width}px`, top: '8px', bottom: '8px' }}
        />
        {sections.map((id) => {
          const isActive = showSectionUi && section === id
          const sColor = sectionColors[id] || '#fff'
          return (
            <button
              key={id}
              type="button"
              ref={(el) => { if (el) navBtnRefs.current[id] = el }}
              onMouseEnter={(e) => { updateNavHighlightForEl(e.currentTarget); try { playSfx('hover', { volume: 0.9 }) } catch { } }}
              onFocus={(e) => updateNavHighlightForEl(e.currentTarget)}
              onMouseLeave={() => setNavHover((h) => ({ ...h, visible: false }))}
              onBlur={() => setNavHover((h) => ({ ...h, visible: false }))}
              onClick={() => onSelectSection(id)}
              className={`relative z-[1] px-3 py-2 rounded-full text-base sm:text-lg font-marquee uppercase tracking-wide transition-all duration-200 text-white`}
              style={isActive ? {
                background: `color-mix(in srgb, ${sColor} 18%, transparent)`,
                boxShadow: `0 0 12px color-mix(in srgb, ${sColor} 25%, transparent)`,
                textShadow: `0 0 10px ${sColor}`,
              } : {}}
            >
              {sectionLabel[id]}
              {/* Active section indicator dot */}
              {isActive && (
                <span
                  className="absolute left-1/2 -translate-x-1/2 -bottom-0.5 h-[3px] w-5 rounded-full animate-section-dot"
                  style={{ background: sColor }}
                />
              )}
            </button>
          )
        })}
        {/* Language switch */}
        <div className="mx-1 h-5 w-px bg-white/[0.12]" />
        <button
          type="button"
          onClick={onToggleLang}
          onMouseEnter={(e) => { updateNavHighlightForEl(e.currentTarget); try { playSfx('hover', { volume: 0.9 }) } catch { } }}
          onFocus={(e) => updateNavHighlightForEl(e.currentTarget)}
          onMouseLeave={() => setNavHover((h) => ({ ...h, visible: false }))}
          onBlur={() => setNavHover((h) => ({ ...h, visible: false }))}
          className="relative z-[1] px-2.5 py-2 rounded-full bg-transparent text-white hover:text-white text-base sm:text-lg font-marquee uppercase tracking-wide transition-colors"
          aria-label={t('common.switchLanguage')}
          title={t('common.switchLanguage')}
        >{t('nav.langShort')}</button>
        {/* Music toggle */}
        <div className="mx-0.5 h-5 w-px bg-white/[0.12]" />
        <button
          type="button"
          onClick={onToggleMusic}
          onMouseEnter={(e) => { updateNavHighlightForEl(e.currentTarget); try { playSfx('hover', { volume: 0.9 }) } catch { } }}
          onFocus={(e) => updateNavHighlightForEl(e.currentTarget)}
          onMouseLeave={() => setNavHover((h) => ({ ...h, visible: false }))}
          onBlur={() => setNavHover((h) => ({ ...h, visible: false }))}
          className={`relative z-[1] px-2.5 py-2 rounded-full transition-all duration-200 ${showMusic ? 'text-white bg-white/[0.12]' : 'text-white hover:bg-white/[0.08]'}`}
          aria-label="Music"
          title="Music"
        >
          <MusicalNoteIcon className={`w-5 h-5 ${showMusic ? 'animate-music-pulse' : ''}`} />
        </button>
      </div>
    </div>
  )
}
