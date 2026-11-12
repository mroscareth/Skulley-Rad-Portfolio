import React, { useEffect, useRef } from 'react'
import Lenis from 'lenis'
import { XMarkIcon } from '@heroicons/react/24/solid'
import { ProjectDetailArticle, useProjectDetail } from '../work/ProjectDetail.jsx'

// Un proyecto abierto aparte en la versión rápida de escritorio: su propia
// página encima de la home, sin pasar por Work (pedido de Oscar). La ficha es
// la misma del detalle de Work (ProjectDetailArticle, en tinta); aquí solo va
// la página (el azul de Work, su scroll suave con Lenis y la X). La abre y la
// cierra App.jsx con la transición de puntos de la versión completa, que la
// deshace en puntos de su color; Escape también la cierra. La ficha entra
// animada (qp-entra en index.css).
export default function QuickProject({ slug, onCerrar, lang }) {
  const es = lang === 'es'
  const datos = useProjectDetail(slug)
  const raizRef = useRef(null)
  const lenisRef = useRef(null)

  useEffect(() => {
    raizRef.current?.focus({ preventScroll: true })
    const onKey = (e) => { if (e.key === 'Escape') onCerrar?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCerrar])

  // El scroll suave del detalle de Work (Section1): Lenis sobre esta página,
  // con su propio cuadro.
  useEffect(() => {
    const el = raizRef.current
    if (!el) return undefined
    let raf = 0
    let lenis = null
    try {
      lenis = new Lenis({
        wrapper: el,
        content: el.firstElementChild || el,
        lerp: 0.18,
        smoothWheel: true,
        syncTouch: true,
      })
      lenisRef.current = lenis
      const tick = (t) => {
        lenis.raf(t)
        raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    } catch { }
    return () => {
      cancelAnimationFrame(raf)
      try { lenis?.destroy() } catch { }
      lenisRef.current = null
    }
  }, [])

  // Otro proyecto (atrás o adelante del navegador) abre arriba.
  useEffect(() => {
    const lenis = lenisRef.current
    if (lenis) lenis.scrollTo(0, { immediate: true })
    else raizRef.current?.scrollTo?.({ top: 0 })
  }, [slug])

  // Las imágenes llegan después y cambian el alto: Lenis tiene que saberlo para
  // llegar hasta el final.
  useEffect(() => {
    const contenido = raizRef.current?.firstElementChild
    if (!contenido || typeof ResizeObserver === 'undefined') return undefined
    const ro = new ResizeObserver(() => { try { lenisRef.current?.resize() } catch { } })
    ro.observe(contenido)
    return () => ro.disconnect()
  }, [])

  return (
    <div
      ref={raizRef}
      className="qp-raiz no-native-scrollbar"
      role="dialog"
      aria-modal="true"
      aria-labelledby={datos.project?.title ? 'project-detail-title' : undefined}
      tabIndex={-1}
    >
      <ProjectDetailArticle
        slug={slug}
        project={datos.project}
        media={datos.media}
        loading={datos.loading}
        error={datos.error}
        sobreColor
      />
      <button
        type="button"
        className="qp-cerrar h-12 w-12 rounded-full grid place-items-center shadow-elev-lg backdrop-blur-3xl border bg-black/40 border-white/[0.12] text-white hover:bg-white/[0.15] transition-colors"
        onClick={onCerrar}
        aria-label={es ? 'Cerrar proyecto' : 'Close project'}
        data-tip={es ? 'Cerrar' : 'Close'}
        data-tip-side="bottom"
      >
        <XMarkIcon className="w-5 h-5" />
      </button>
    </div>
  )
}
