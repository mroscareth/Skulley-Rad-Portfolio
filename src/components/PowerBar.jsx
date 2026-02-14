import React from 'react'
import { BoltIcon } from '@heroicons/react/24/solid'

export default function PowerBar({
  orientation = 'horizontal', // 'horizontal' | 'vertical'
  fill = 0, // 0..1
  // Optional: use a live value without re-rendering the parent (e.g. window.__powerFillLive)
  liveFillKey,
  glowOn = false,
  boltScale = 1, // multiplier (1 = normal). Useful for mobile.
  // Press state (mobile): grow + white stroke
  pressScale = 1, // e.g. 1.3
  pressStroke = false,
  pressStrokeWidth = 4,
  onPressStart,
  onPressEnd,
  className = '',
  style,
}) {
  const [isPressing, setIsPressing] = React.useState(false)
  const fillElRef = React.useRef(null)
  const clamped = Math.max(0, Math.min(1, Number.isFinite(fill) ? fill : 0))
  const boltPx = Math.max(32, Math.min(84, Math.round(44 * (Number.isFinite(boltScale) ? boltScale : 1))))
  const boltIconPx = Math.max(18, Math.min(56, Math.round(24 * (Number.isFinite(boltScale) ? boltScale : 1))))
  const glow = glowOn
    ? '0 0 12px 3px rgba(250,204,21,0.75), 0 0 30px 8px rgba(250,204,21,0.45)'
    : 'none'

  // Live fill: update DOM via RAF (no re-render) for smooth transitions.
  React.useEffect(() => {
    if (!liveFillKey) return () => { }
    let raf = 0
    let prev = -1
    const tick = () => {
      try {
        const el = fillElRef.current
        if (el) {
          const v = (typeof window !== 'undefined') ? window[liveFillKey] : null
          const n = (typeof v === 'number' && isFinite(v)) ? Math.max(0, Math.min(1, v)) : null
          if (n != null && Math.abs(n - prev) > 0.0005) {
            prev = n
            const pct = `${Math.round(n * 1000) / 10}%` // 0.1% steps (smooth)
            if (orientation === 'vertical') el.style.height = pct
            else el.style.width = pct
          }
        }
      } catch { }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => { try { cancelAnimationFrame(raf) } catch { } }
  }, [liveFillKey, orientation])

  const handlePointerDown = (e) => {
    try { e?.stopPropagation?.() } catch { }
    try { onPressStart?.() } catch { }
    try { setIsPressing(true) } catch { }
    let released = false
    const release = () => {
      if (released) return
      released = true
      try { onPressEnd?.() } catch { }
      try { setIsPressing(false) } catch { }
      try { window.removeEventListener('pointerup', release) } catch { }
      try { window.removeEventListener('pointercancel', release) } catch { }
      try { window.removeEventListener('blur', release) } catch { }
      try { document.removeEventListener('visibilitychange', onVis) } catch { }
    }
    const onVis = () => { try { if (document.hidden) release() } catch { release() } }
    try { window.addEventListener('pointerup', release, { once: true }) } catch { }
    try { window.addEventListener('pointercancel', release, { once: true }) } catch { }
    try { window.addEventListener('blur', release, { once: true }) } catch { }
    try { document.addEventListener('visibilitychange', onVis) } catch { }
  }

  if (orientation === 'vertical') {
    const pressedStyle = pressStroke && isPressing
      ? { border: `${pressStrokeWidth}px solid rgba(255,255,255,0.98)`, boxShadow: '0 10px 26px rgba(255,255,255,0.22), 0 8px 22px rgba(0,0,0,0.25)' }
      : undefined
    const pressedTransform = (isPressing && pressScale && isFinite(pressScale) && pressScale !== 1)
      ? `scale(${pressScale})`
      : undefined
    return (
      <div className={`relative w-11 ${className}`} style={style}>
        {/* Track (blur + opaque backdrop) */}
        <div
          className="mx-auto h-[150px] w-[15px] rounded-full bg-black/50 backdrop-blur-xl border border-white/[0.08] overflow-hidden relative"
          aria-hidden
          style={{ boxShadow: glow || '0 4px 20px rgba(0,0,0,0.4)', transition: 'box-shadow 180ms ease', willChange: 'box-shadow' }}
        >
          <div
            ref={fillElRef}
            className="absolute left-0 right-0 bottom-0"
            style={{
              backgroundColor: '#facc15',
              height: `${Math.round(clamped * 100)}%`,
              transition: liveFillKey ? 'none' : 'height 120ms linear',
            }}
          />
        </div>

        {/* Bolt: overlaid at bottom (wrapper fixes position; button scales from center) */}
        <div className="pointer-events-auto absolute left-1/2 bottom-0 translate-y-1/2 -translate-x-1/2">
          <button
            type="button"
            className="rounded-full bg-yellow-400 hover:bg-yellow-300 text-black shadow-lg border border-black/20 grid place-items-center active:scale-[0.98] transition-transform outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 ring-offset-0 focus-visible:ring-offset-0 [-webkit-tap-highlight-color:transparent]"
            style={{
              width: `${boltPx}px`,
              height: `${boltPx}px`,
              transform: pressedTransform || undefined,
              transformOrigin: 'center',
              transition: 'transform 110ms ease, border-color 110ms ease, box-shadow 110ms ease',
              ...(pressedStyle || {}),
            }}
            aria-label="Charge power"
            onPointerDown={handlePointerDown}
            onPointerUp={() => { try { onPressEnd?.() } catch { } try { setIsPressing(false) } catch { } }}
            onPointerCancel={() => { try { onPressEnd?.() } catch { } try { setIsPressing(false) } catch { } }}
          >
            <BoltIcon style={{ width: `${boltIconPx}px`, height: `${boltIconPx}px` }} />
          </button>
        </div>
      </div>
    )
  }

  const pressedStyle = pressStroke && isPressing
    ? { border: `${pressStrokeWidth}px solid rgba(255,255,255,0.98)`, boxShadow: '0 10px 26px rgba(255,255,255,0.22), 0 8px 22px rgba(0,0,0,0.25)' }
    : undefined
  const pressedTransform = (isPressing && pressScale && isFinite(pressScale) && pressScale !== 1)
    ? `scale(${pressScale})`
    : undefined

  return (
    <div className={`relative w-full ${className}`} style={style}>
      {/* Track (blur + opaque backdrop) */}
      <div
        className="pointer-events-auto relative h-3 w-full rounded-full bg-black/50 backdrop-blur-xl border border-white/[0.08] overflow-hidden"
        style={{
          boxShadow: glow || '0 4px 20px rgba(0,0,0,0.4)',
          transition: 'box-shadow 180ms ease',
          willChange: 'box-shadow',
        }}
        aria-hidden
      >
        <div
          ref={fillElRef}
          className="absolute left-0 top-0 bottom-0 rounded-full"
          style={{
            width: `${Math.round(clamped * 100)}%`,
            backgroundColor: '#facc15',
            transition: liveFillKey ? 'none' : 'width 120ms linear',
          }}
        />
      </div>

      {/* Bolt: overlaid at start (wrapper fixes position; button scales from center) */}
      <div className="pointer-events-auto absolute left-0 top-1/2 -translate-y-1/2">
        <button
          type="button"
          className="rounded-full bg-yellow-400 hover:bg-yellow-300 text-black shadow-lg border border-black/20 grid place-items-center active:scale-[0.98] transition-transform outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 ring-offset-0 focus-visible:ring-offset-0 [-webkit-tap-highlight-color:transparent]"
          style={{
            width: `${boltPx}px`,
            height: `${boltPx}px`,
            transform: pressedTransform || undefined,
            transformOrigin: 'center',
            transition: 'transform 110ms ease, border-color 110ms ease, box-shadow 110ms ease',
            ...(pressedStyle || {}),
          }}
          aria-label="Charge power"
          onPointerDown={handlePointerDown}
          onPointerUp={() => { try { onPressEnd?.() } catch { } try { setIsPressing(false) } catch { } }}
          onPointerCancel={() => { try { onPressEnd?.() } catch { } try { setIsPressing(false) } catch { } }}
        >
          <BoltIcon style={{ width: `${boltIconPx}px`, height: `${boltIconPx}px` }} />
        </button>
      </div>
    </div>
  )
}

