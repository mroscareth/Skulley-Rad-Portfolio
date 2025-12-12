import React from 'react'
import { useLanguage } from '../i18n/LanguageContext.jsx'

export default function WorkDotsIndicator({
  items = [],
  activeIndex = 0,
  onSelect,
}) {
  const { t } = useLanguage()
  const DOT = 12 // base
  const DOT_ACTIVE = DOT + 10
  const HIT = Math.max(32, DOT_ACTIVE + 8)
  const GAP = 28
  const height = items.length > 0 ? (DOT + (items.length - 1) * (DOT + GAP)) : DOT
  const [tooltip, setTooltip] = React.useState({ visible: false, text: '', top: 0 })

  const handleSelect = (i) => {
    try { if (typeof onSelect === 'function') onSelect(i) } catch {}
  }

  const showTooltip = (text, topPx) => setTooltip({ visible: true, text, top: topPx })
  const hideTooltip = () => setTooltip({ visible: false, text: '', top: 0 })

  return (
    <div
      className="hidden sm:block z-[12060]"
      style={{
        position: 'fixed',
        top: '50%',
        right: '30px',
        transform: 'translateY(-50%)',
        height: `${height}px`,
        width: '24px',
      }}
      aria-label={t('work.dots.navLabel')}
      role="navigation"
    >
      <div
        aria-hidden
        className="absolute left-1/2 -translate-x-1/2 rounded-full pointer-events-none"
        style={{ top: 0, bottom: 0, width: '2px', backgroundColor: '#000000' }}
      />
      <div className="relative h-full w-full">
        {items.map((it, idx) => {
          const isActive = idx === activeIndex
          const top = idx * (DOT + GAP)
          const fallbackTitle = t('work.dots.projectFallback', { n: idx + 1 })
          const title = it?.title || fallbackTitle
          return (
            <button
              key={`dot-${idx}`}
              type="button"
              onClick={() => handleSelect(idx)}
              onMouseEnter={() => showTooltip(title, top + DOT / 2)}
              onMouseLeave={hideTooltip}
              aria-label={t('work.dots.goTo', { title })}
              aria-current={isActive ? 'true' : 'false'}
              className="absolute left-1/2 -translate-x-1/2 rounded-full cursor-pointer"
              style={{
                top: `${top - (HIT - DOT) / 2}px`,
                width: `${HIT}px`,
                height: `${HIT}px`,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                padding: 0,
                pointerEvents: 'auto',
              }}
            >
              <span
                className="block rounded-full"
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: `${isActive ? DOT_ACTIVE : DOT}px`,
                  height: `${isActive ? DOT_ACTIVE : DOT}px`,
                  backgroundColor: '#000000',
                  transition: 'width 160ms ease, height 160ms ease',
                }}
              />
            </button>
          )
        })}
      </div>
      {tooltip.visible && (
        <div
          className="absolute z-[2] pointer-events-none px-3 py-2 rounded-full bg-black text-white text-xs font-semibold shadow-[0_8px_24px_rgba(0,0,0,0.35)] border border-black"
          style={{
            right: 'calc(100% + 12px)',
            top: `${tooltip.top}px`,
            transform: 'translateY(-50%)',
            maxWidth: '320px',
            whiteSpace: 'nowrap',
            textAlign: 'left',
          }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  )
}


