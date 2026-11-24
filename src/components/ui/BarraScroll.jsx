import React, { useEffect, useRef } from 'react'

// La barra de scroll del detalle de un proyecto (Work y la ficha encima de la
// home). Esas páginas esconden la del navegador (no-native-scrollbar) y nadie
// sabía que bajaban ni dónde iba (Oscar, 2026-11-24). Lee el scroll real del
// contenedor, así sigue también a Lenis (que escribe scrollTop en cada
// cuadro); se arrastra o se pica en el riel. Todo por mutación del DOM, sin
// estado de React por cuadro.
//
// `scrollerRef`: el contenedor que hace scroll (la barra va dentro, después
// del contenido: Lenis usa su primer hijo). `lenisRef`: su Lenis, si tiene;
// con él la barra mueve el scroll por Lenis para no pelearse con su suavizado.
// `tono`: 'oscuro' sobre el velo de tinta de Work, 'color' sobre el azul.
const PULGAR_MIN = 56

// La mano de GlobalCursor (el cursor propio del sitio): abierta encima del
// pulgar y cerrada al arrastrarlo, como al girar la cámara.
const mano = (state) => {
  try { window.dispatchEvent(new CustomEvent('camera-grab', { detail: { state } })) } catch { }
}

export default function BarraScroll({ scrollerRef, lenisRef = null, tono = 'oscuro' }) {
  const barraRef = useRef(null)
  const pulgarRef = useRef(null)

  useEffect(() => {
    const scroller = scrollerRef?.current
    const barra = barraRef.current
    const pulgar = pulgarRef.current
    if (!scroller || !barra || !pulgar) return undefined

    const reducida = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    let alto = 0
    let largo = 0
    let max = 0
    let arrastre = null
    let encima = false

    const recorrido = () => Math.max(1, alto - largo)

    const pintar = () => {
      const t = max > 0 ? Math.min(1, Math.max(0, scroller.scrollTop / max)) : 0
      pulgar.style.transform = `translate3d(0, ${Math.round((alto - largo) * t)}px, 0)`
    }

    const medir = () => {
      const sh = scroller.scrollHeight
      const ch = scroller.clientHeight
      max = Math.max(0, sh - ch)
      alto = barra.clientHeight
      largo = max > 1 ? Math.min(alto, Math.max(PULGAR_MIN, Math.round((alto * ch) / sh))) : alto
      pulgar.style.height = `${largo}px`
      barra.classList.toggle('is-vacia', max <= 1)
      pintar()
    }

    const ir = (y, suave) => {
      const lenis = lenisRef?.current
      const animar = suave && !reducida
      if (lenis) {
        try {
          lenis.scrollTo(y, animar ? { force: true } : { immediate: true, force: true })
          return
        } catch { }
      }
      if (animar) scroller.scrollTo({ top: y, behavior: 'smooth' })
      else scroller.scrollTop = y
    }

    // Lo que corresponde en el scroll a dejar el pulgar con su orilla de
    // arriba en `arriba` (px desde la orilla de arriba del riel).
    const scrollDe = (arriba) => (Math.min(1, Math.max(0, arriba / recorrido())) * max)

    const onDown = (e) => {
      if (max <= 1) return
      if (e.pointerType === 'mouse' && e.button !== 0) return
      e.preventDefault()
      e.stopPropagation()
      // Lenis mide el alto de la página con su propio ResizeObserver (con
      // retraso): si las imágenes acaban de llegar, su tope sigue corto y
      // recortaría el arrastre.
      try { lenisRef?.current?.resize() } catch { }
      const caja = barra.getBoundingClientRect()
      const arribaPulgar = (scroller.scrollTop / Math.max(1, max)) * (alto - largo)
      const enPulgar = pulgar.contains(e.target)
      // Picando el riel, el pulgar va a quedar centrado donde picaste y desde
      // ahí se puede seguir arrastrando.
      const agarre = enPulgar ? e.clientY - caja.top - arribaPulgar : largo / 2
      if (!enPulgar) ir(scrollDe(e.clientY - caja.top - agarre), true)
      arrastre = { id: e.pointerId, arriba: caja.top, agarre }
      try { barra.setPointerCapture(e.pointerId) } catch { }
      barra.classList.add('is-arrastrando')
      mano('grabbing')
    }

    // Sin esperar al evento de scroll: el pulgar sigue al puntero en el mismo cuadro.
    const onMove = (e) => {
      if (!arrastre || e.pointerId !== arrastre.id) return
      ir(scrollDe(e.clientY - arrastre.arriba - arrastre.agarre), false)
      pintar()
    }

    const onUp = (e) => {
      if (!arrastre || e.pointerId !== arrastre.id) return
      arrastre = null
      try { barra.releasePointerCapture(e.pointerId) } catch { }
      barra.classList.remove('is-arrastrando')
      mano(encima ? 'grab' : '')
    }

    const onEntraPulgar = () => { encima = true; if (!arrastre) mano('grab') }
    const onSalePulgar = () => { encima = false; if (!arrastre) mano('') }

    medir()
    scroller.addEventListener('scroll', pintar, { passive: true })
    window.addEventListener('resize', medir)
    barra.addEventListener('pointerdown', onDown)
    barra.addEventListener('pointermove', onMove)
    barra.addEventListener('pointerup', onUp)
    barra.addEventListener('pointercancel', onUp)
    pulgar.addEventListener('pointerenter', onEntraPulgar)
    pulgar.addEventListener('pointerleave', onSalePulgar)

    // Las imágenes llegan después y cambian el alto de la página.
    let ro = null
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(medir)
      ro.observe(scroller)
      if (scroller.firstElementChild) ro.observe(scroller.firstElementChild)
      ro.observe(barra)
    }

    return () => {
      scroller.removeEventListener('scroll', pintar)
      window.removeEventListener('resize', medir)
      barra.removeEventListener('pointerdown', onDown)
      barra.removeEventListener('pointermove', onMove)
      barra.removeEventListener('pointerup', onUp)
      barra.removeEventListener('pointercancel', onUp)
      pulgar.removeEventListener('pointerenter', onEntraPulgar)
      pulgar.removeEventListener('pointerleave', onSalePulgar)
      ro?.disconnect()
      if (arrastre || encima) mano('')
    }
  }, [scrollerRef, lenisRef])

  // aria-hidden: el contenedor ya hace scroll con el teclado y el lector de
  // pantalla; la barra es solo para verse y agarrarse. data-lenis-prevent-touch:
  // arrastrarla con el dedo no es deslizar la página (la rueda sí pasa).
  return (
    <div
      ref={barraRef}
      className={`barra-scroll barra-scroll--${tono} is-vacia`}
      aria-hidden="true"
      data-lenis-prevent-touch
    >
      <div ref={pulgarRef} className="barra-scroll__pulgar" />
    </div>
  )
}
