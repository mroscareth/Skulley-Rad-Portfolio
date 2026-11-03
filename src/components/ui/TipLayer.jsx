import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'

// Tooltip propio del sitio (DESIGN.md §14.12). Cualquier elemento con
// `data-tip="texto"` lo muestra al pasar el mouse (con un respiro) o al
// llegarle el foco con teclado; reemplaza al `title` nativo. Va arriba del
// elemento y se voltea solo si no cabe; `data-tip-side="bottom"` lo pide
// abajo. Vive en la capa superior del navegador (popover="manual"), así que
// ningún overflow ni z-index del sitio lo tapa. En pantallas táctiles no
// aparece. El texto no le da nombre accesible al elemento: ese sigue siendo
// su aria-label.

const SHOW_DELAY_MS = 350
// Recién cerrado uno, el siguiente sale sin esperar: pasar de tecla en tecla.
const WARM_MS = 500
const GAP = 10
const EDGE = 8

const canPopover = typeof HTMLElement !== 'undefined' && 'showPopover' in HTMLElement.prototype

export default function TipLayer() {
  const nodeRef = useRef(null)
  const [tip, setTip] = useState(null)
  const tipRef = useRef(null)
  tipRef.current = tip

  useEffect(() => {
    let timer = 0
    let pending = null
    let lastHide = 0
    const anchorOf = (t) => (t instanceof Element ? t.closest('[data-tip]') : null)
    const show = (el, now) => {
      if (pending === el || tipRef.current?.el === el) return
      clearTimeout(timer)
      pending = el
      const go = () => {
        pending = null
        const text = el.getAttribute('data-tip')
        if (text && el.isConnected) setTip({ el, text, side: el.getAttribute('data-tip-side') })
      }
      if (now || tipRef.current || performance.now() - lastHide < WARM_MS) go()
      else timer = setTimeout(go, SHOW_DELAY_MS)
    }
    const hide = () => {
      clearTimeout(timer)
      pending = null
      if (tipRef.current) lastHide = performance.now()
      setTip(null)
    }
    const onOver = (e) => {
      if (e.pointerType !== 'mouse') return
      const el = anchorOf(e.target)
      if (el) show(el, false)
    }
    const onOut = (e) => {
      if (e.pointerType !== 'mouse') return
      const el = anchorOf(e.target)
      if (!el || (e.relatedTarget instanceof Node && el.contains(e.relatedTarget))) return
      hide()
    }
    const onFocusIn = (e) => {
      const el = anchorOf(e.target)
      if (el && e.target.matches?.(':focus-visible')) show(el, true)
    }
    // Enter/Espacio cambian el estado del botón y Escape cierra lo que sea:
    // la burbuja se va. Tab la mueve con el foco.
    const onKey = (e) => { if (e.key !== 'Tab' && e.key !== 'Shift') hide() }
    document.addEventListener('pointerover', onOver)
    document.addEventListener('pointerout', onOut)
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', hide)
    document.addEventListener('pointerdown', hide, true)
    document.addEventListener('keydown', onKey, true)
    window.addEventListener('scroll', hide, true)
    window.addEventListener('resize', hide)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('pointerover', onOver)
      document.removeEventListener('pointerout', onOut)
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', hide)
      document.removeEventListener('pointerdown', hide, true)
      document.removeEventListener('keydown', onKey, true)
      window.removeEventListener('scroll', hide, true)
      window.removeEventListener('resize', hide)
    }
  }, [])

  // Se abre antes de medir (cerrada no ocupa caja) y se coloca antes de
  // pintar: no hay cuadro en la posición vieja.
  useLayoutEffect(() => {
    const node = nodeRef.current
    if (!node) return
    const r = tip?.el.isConnected ? tip.el.getBoundingClientRect() : null
    if (!r || (!r.width && !r.height)) {
      if (canPopover) { try { node.hidePopover() } catch { } } else node.dataset.open = 'false'
      return
    }
    if (canPopover) { try { node.showPopover() } catch { } } else node.dataset.open = 'true'
    const w = node.offsetWidth
    const h = node.offsetHeight
    const vw = document.documentElement.clientWidth
    const vh = window.innerHeight
    let side = tip.side === 'bottom' ? 'bottom' : 'top'
    let top = side === 'top' ? r.top - GAP - h : r.bottom + GAP
    if (side === 'top' && top < EDGE) { side = 'bottom'; top = r.bottom + GAP }
    else if (side === 'bottom' && top + h > vh - EDGE) { side = 'top'; top = r.top - GAP - h }
    const cx = r.left + r.width / 2
    const left = Math.max(EDGE, Math.min(cx - w / 2, vw - EDGE - w))
    const arrow = Math.max(14, Math.min(cx - left, w - 14))
    node.style.left = `${Math.round(left)}px`
    node.style.top = `${Math.round(top)}px`
    node.style.setProperty('--tip-arrow', `${Math.round(arrow)}px`)
    node.dataset.side = side
  }, [tip])

  return (
    <div
      ref={nodeRef}
      className="site-tip"
      role="tooltip"
      popover={canPopover ? 'manual' : undefined}
      data-open="false"
    >
      {tip?.text}
    </div>
  )
}
