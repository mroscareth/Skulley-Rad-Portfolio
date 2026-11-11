import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useLanguage } from '../i18n/LanguageContext.jsx'

// Easter egg de Oscar (2026-11-10): al agregar al carrito, el retrato habla en
// una viñeta, una frase por escalón de piezas (1, 5, 10 y 15+). Solo habla al
// subir de escalón, y además la primera vez que agregas en la visita, aunque el
// carrito ya trajera piezas. Al quitar se pone triste (pedido de Oscar): una de
// cartSadPhrases, en orden, y si ya está diciendo una triste no la interrumpe.
// Los avisos llegan con `carrito-agregado` y `carrito-quitado` (addToCart.js).
// El look es el de la viñeta 3D de Skulley (SpeechBubble3D):
// estrella de 12 picos, blanca con trama, contorno negro, sombra dura y
// Luckiest Guy, escrita letra por letra.

const UMBRALES = [1, 5, 10, 15]
const ESCRIBE_CPS = 38
const SALE_MS = 200
// Cuánto más grande que el texto es la estrella: el texto tiene que caber
// dentro de los valles de los picos (radio interior ~0.76 de la caja).
const HOLGURA = 1.9

const escalon = (n) => UMBRALES.reduce((e, u, i) => (n >= u ? i : e), -1)

const reduceMotion = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
}

// La misma estrella que makeBurstGeometry de SpeechBubble3D, en porcentajes de
// la caja para clip-path (y escalada para que ningún pico se salga de ella).
function estrella(picos, interior) {
  const total = picos * 2
  const pts = []
  for (let i = 0; i < total; i += 1) {
    const ang = (i / total) * Math.PI * 2 - Math.PI / 2
    const j = i % 2 === 0 ? 1 + 0.06 * Math.sin(i * 12.9898) : 1 + 0.04 * Math.sin(i * 4.137)
    const r = ((i % 2 === 0 ? 1 : interior) * j) / 1.06
    pts.push(`${(50 + Math.cos(ang) * r * 50).toFixed(2)}% ${(50 + Math.sin(ang) * r * 50).toFixed(2)}%`)
  }
  return `polygon(${pts.join(', ')})`
}
const FORMA = estrella(12, 0.82)

export default function PortraitGlobo({ compact = false }) {
  const { t } = useLanguage()
  const [globo, setGlobo] = useState(null) // { lista, idx, key }
  const [saliendo, setSaliendo] = useState(false)
  const [letras, setLetras] = useState(0)
  const [caja, setCaja] = useState(null)
  const primera = useRef(true)
  const tristes = useRef(0)
  const mideRef = useRef(null)
  // Para que los listeners sepan qué se está diciendo sin re-suscribirse.
  const ahora = useRef({ globo: null, saliendo: false })
  ahora.current = { globo, saliendo }

  const frases = globo ? t(`portrait.${globo.lista}`) : null
  const texto = globo && Array.isArray(frases) ? frases[globo.idx] || '' : ''

  useEffect(() => {
    const onAgregado = (e) => {
      const { antes = 0, despues = 0 } = e.detail || {}
      const nuevo = escalon(despues)
      if (nuevo < 0) return
      if (!primera.current && nuevo <= escalon(antes)) return
      primera.current = false
      setGlobo((g) => ({ lista: 'cartPhrases', idx: nuevo, key: (g?.key || 0) + 1 }))
    }
    const onQuitado = () => {
      const { globo: g, saliendo: s } = ahora.current
      if (g?.lista === 'cartSadPhrases' && !s) return
      const lista = t('portrait.cartSadPhrases')
      const n = Array.isArray(lista) && lista.length ? lista.length : 1
      const idx = tristes.current % n
      tristes.current += 1
      setGlobo((prev) => ({ lista: 'cartSadPhrases', idx, key: (prev?.key || 0) + 1 }))
    }
    window.addEventListener('carrito-agregado', onAgregado)
    window.addEventListener('carrito-quitado', onQuitado)
    return () => {
      window.removeEventListener('carrito-agregado', onAgregado)
      window.removeEventListener('carrito-quitado', onQuitado)
    }
  }, [t])

  useEffect(() => {
    if (!globo || !texto) return undefined
    setSaliendo(false)
    const quieto = reduceMotion()
    setLetras(quieto ? texto.length : 0)
    let escribe = null
    if (!quieto) {
      const t0 = performance.now()
      escribe = setInterval(() => {
        const n = Math.min(texto.length, Math.floor(((performance.now() - t0) / 1000) * ESCRIBE_CPS))
        setLetras(n)
        if (n >= texto.length) clearInterval(escribe)
      }, 30)
    }
    const dura = (quieto ? 0 : (texto.length / ESCRIBE_CPS) * 1000) + Math.min(9000, 2200 + texto.length * 45)
    const sale = setTimeout(() => setSaliendo(true), dura)
    const fin = setTimeout(() => setGlobo(null), dura + SALE_MS)
    return () => { clearInterval(escribe); clearTimeout(sale); clearTimeout(fin) }
  }, [globo, texto])

  // La caja se mide con la frase completa en una copia invisible fuera de la
  // viñeta (la viñeta entra escalada y girada, y eso falsea las medidas). El
  // ancho es el del renglón más largo, no el máximo del párrafo: así una frase
  // corta no queda nadando en una estrella enorme.
  useLayoutEffect(() => {
    const m = mideRef.current
    if (!m) { setCaja(null); return undefined }
    let vivo = true
    const medir = () => {
      if (!vivo || !m.isConnected) return
      const range = document.createRange()
      range.selectNodeContents(m)
      let ancho = 0
      for (const r of range.getClientRects()) ancho = Math.max(ancho, r.width)
      const w = (ancho || m.offsetWidth) * HOLGURA
      const h = Math.max(m.offsetHeight * HOLGURA, w * 0.58)
      setCaja({ w: Math.round(Math.max(w, h * 1.05)), h: Math.round(h) })
    }
    medir()
    try { document.fonts?.load('1em "Luckiest Guy"').then(medir).catch(() => { }) } catch { }
    return () => { vivo = false }
  }, [texto, compact])

  const aviso = <span className="sr-only" role="status">{globo ? texto : ''}</span>
  if (!globo || !texto) return aviso

  return (
    <>
      <div
        key={globo.key}
        className={`portrait-globo${compact ? ' portrait-globo--compacto' : ''}${saliendo ? ' is-saliendo' : ''}`}
        style={caja ? { width: caja.w, height: caja.h } : { visibility: 'hidden' }}
        aria-hidden
      >
        <div className="portrait-globo__flota">
          <div className="portrait-globo__forma">
            <span className="portrait-globo__cola portrait-globo__cola--borde" />
            <span className="portrait-globo__borde" style={{ clipPath: FORMA }} />
            <span className="portrait-globo__fondo" style={{ clipPath: FORMA }} />
            <span className="portrait-globo__cola" />
          </div>
          <p className="portrait-globo__texto">
            {texto.slice(0, letras)}
            <span className="portrait-globo__falta">{texto.slice(letras)}</span>
          </p>
        </div>
      </div>
      <p ref={mideRef} className={`portrait-globo__texto portrait-globo__mide${compact ? ' portrait-globo__mide--compacto' : ''}`} aria-hidden>{texto}</p>
      {aviso}
    </>
  )
}
