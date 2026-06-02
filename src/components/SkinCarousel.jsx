import { useRef, useState, useEffect, useLayoutEffect, useCallback } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/solid'
import { playSfx } from '../lib/sfx.js'

// Carousel INFINITO de skins para mobile: muestra 3 a la vez, loop modular real
// (índice mod N), con drag/swipe + flechas y animación de slide. Renderiza solo
// una VENTANA de 5 chips (no toda la lista triplicada) → no revienta el límite de
// contextos WebGL de los swatches (cada skin shader es un canvas). Las skins
// repetidas no se duplican en pantalla porque N (7) > 5.
//
// Props: skins (lista), renderChip(skin) → el chip (con su SkinSwatch/label).
const SLOTS = [-2, -1, 0, 1, 2]

export default function SkinCarousel({ skins = [], renderChip, lang = 'en' }) {
  const N = skins.length
  const wrapRef = useRef(null)
  const [itemW, setItemW] = useState(96)
  const [idx, setIdx] = useState(0)
  const [drag, setDrag] = useState(0)
  const [anim, setAnim] = useState(false)
  const dragRef = useRef(null)
  const commitRef = useRef(null)

  useLayoutEffect(() => {
    const measure = () => {
      const el = wrapRef.current
      if (el) setItemW(Math.max(56, Math.round(el.clientWidth / 3)))
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  const mod = useCallback((n) => ((n % N) + N) % N, [N])

  // dir: +1 siguiente, -1 anterior. Anima el track y al terminar normaliza idx.
  const commit = useCallback((dir) => {
    if (commitRef.current || N === 0) return
    setAnim(true)
    setDrag(dir * -itemW)
    commitRef.current = setTimeout(() => {
      setAnim(false)
      setIdx((i) => mod(i + dir))
      setDrag(0)
      commitRef.current = null
    }, 240)
  }, [itemW, mod, N])

  const arrow = (dir) => { try { playSfx('click', { volume: 0.8 }) } catch { }; commit(dir) }

  const ptX = (e) => (e.clientX != null ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : 0))
  const onDown = (e) => {
    if (commitRef.current) return
    dragRef.current = { x: ptX(e), moved: 0 }
    setAnim(false)
  }
  const onMove = (e) => {
    if (!dragRef.current) return
    const dx = ptX(e) - dragRef.current.x
    dragRef.current.moved = dx
    setDrag(dx)
  }
  const onUp = () => {
    const st = dragRef.current
    dragRef.current = null
    if (!st) return
    const dx = st.moved
    if (dx <= -itemW / 3) commit(1)
    else if (dx >= itemW / 3) commit(-1)
    else { setAnim(true); setDrag(0); setTimeout(() => setAnim(false), 200) }
  }

  useEffect(() => () => { if (commitRef.current) clearTimeout(commitRef.current) }, [])

  if (N === 0) return null
  const trackTranslate = -itemW + drag

  return (
    <div className="flex items-center gap-1 select-none">
      <button
        type="button"
        onClick={() => arrow(-1)}
        className="shrink-0 h-9 w-9 rounded-full grid place-items-center bg-black/40 backdrop-blur-md border border-white/[0.16] text-white/90 hover:bg-black/55 transition-colors shadow-elev-sm"
        aria-label={lang === 'es' ? 'Anterior' : 'Previous'}
      >
        <ChevronLeftIcon className="w-5 h-5" />
      </button>
      <div
        ref={wrapRef}
        className="relative flex-1 overflow-hidden py-1"
        style={{ touchAction: 'pan-y' }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onUp}
      >
        <div
          className="flex"
          style={{
            transform: `translateX(${trackTranslate}px)`,
            transition: anim ? 'transform 240ms cubic-bezier(0.16,1,0.3,1)' : 'none',
          }}
        >
          {SLOTS.map((i) => {
            const skin = skins[mod(idx + i)]
            return (
              <div key={skin.id} className="shrink-0 flex justify-center" style={{ width: `${itemW}px` }}>
                {renderChip(skin)}
              </div>
            )
          })}
        </div>
      </div>
      <button
        type="button"
        onClick={() => arrow(1)}
        className="shrink-0 h-9 w-9 rounded-full grid place-items-center bg-black/40 backdrop-blur-md border border-white/[0.16] text-white/90 hover:bg-black/55 transition-colors shadow-elev-sm"
        aria-label={lang === 'es' ? 'Siguiente' : 'Next'}
      >
        <ChevronRightIcon className="w-5 h-5" />
      </button>
    </div>
  )
}
