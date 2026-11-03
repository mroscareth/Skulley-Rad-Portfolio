import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useLanguage } from '../../i18n/LanguageContext.jsx'
import { playSfx } from '../../lib/sfx.js'
import { getCharacterColors, setCharacterColors, randomVividColor, CHARACTER_COLOR_EVENT } from '../../lib/characterColors.js'
import { getSkin } from '../../lib/skinRegistry.js'
import { chooseSkin, readActiveSkinId } from '../../lib/characterSkin.js'
import SkinChip from '../SkinChip.jsx'
import ColorWell from '../ColorWell.jsx'

// La versión ligera del personalizador de escritorio (CharacterCustomizer) para
// la home de teléfono: cuatro skins, un color por parte y a Skulley se le gira
// con el dedo. Skins y colores usan los mismos controles que escritorio
// (SkinChip, ColorWell). Armarlo y encuadrarlo es cosa del rig (PERSONALIZA_*
// en SkulleyFallRig); aquí solo se escribe en personalizaRef: el giro, si hay
// dedo encima y cuánto tapa el panel.
const SKINS_TELEFONO = ['base', 'slime', 'void', 'oilslick']

const PARTES = [
  { key: 'head', label: 'customizer.skeleton' },
  { key: 'hair', label: 'customizer.hair' },
  { key: 'eyes', label: 'customizer.eyes' },
  { key: 'orb', label: 'customizer.orb' },
]

// Qué se puede pintar con cada skin: la regla del registro (vacío nada, slime
// solo la esfera) o, si no dice, todo en Personalizada y ojos + esfera en las
// demás. La misma que usa el panel de escritorio.
function partesDe(skinId) {
  const skin = getSkin(skinId)
  const keys = skin.editableColors ?? (skinId === 'base' ? ['head', 'hair', 'eyes', 'orb'] : ['eyes', 'orb'])
  return PARTES.filter((p) => keys.includes(p.key))
}

// Radianes por pixel de arrastre: un ancho de teléfono es un poco más de media
// vuelta. El giro sigue al dedo sin más; solo un flick (soltar todavía en
// movimiento) le deja inercia, medida con lo que se movió el dedo en los
// últimos VENTANA_MS.
const GIRO_POR_PX = 0.0105
const VEL_MAX = 8
const VENTANA_MS = 100
const FLICK_MS = 60

function DiceIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <circle cx="8" cy="8" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="16" cy="8" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="8" cy="16" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="16" cy="16" r="1.25" fill="currentColor" stroke="none" />
    </svg>
  )
}

export default function MobileCustomizer({ open = false, onClose, personalizaRef }) {
  const { t, lang } = useLanguage()
  const panelRef = useRef(null)
  const listoRef = useRef(null)
  const [skinId, setSkinId] = useState(readActiveSkinId)
  const [colors, setColors] = useState(getCharacterColors)
  // El aviso de "arrástralo" se va con el primer giro y ya no regresa.
  const [yaGiro, setYaGiro] = useState(false)

  useEffect(() => {
    if (!open) return
    setSkinId(readActiveSkinId())
    setColors(getCharacterColors())
    const id = requestAnimationFrame(() => { try { listoRef.current?.focus({ preventScroll: true }) } catch { } })
    return () => cancelAnimationFrame(id)
  }, [open])

  useEffect(() => {
    const onChange = (e) => setColors(e?.detail ? { ...e.detail } : getCharacterColors())
    window.addEventListener(CHARACTER_COLOR_EVENT, onChange)
    return () => window.removeEventListener(CHARACTER_COLOR_EVENT, onChange)
  }, [])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // El rig encuadra a Skulley en lo que el panel deja libre arriba.
  useEffect(() => {
    const el = panelRef.current
    if (!el || !personalizaRef) return undefined
    const medir = () => {
      personalizaRef.current.abajo = el.offsetHeight / Math.max(1, window.innerHeight)
    }
    medir()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(medir) : null
    ro?.observe(el)
    window.addEventListener('resize', medir)
    return () => {
      ro?.disconnect()
      window.removeEventListener('resize', medir)
    }
  }, [personalizaRef])

  const partes = partesDe(skinId)

  const elegirSkin = (id) => {
    if (id === skinId) return
    chooseSkin(id)
    setSkinId(id)
    try { navigator.vibrate?.(10) } catch { }
  }

  const pintar = (key, hex) => {
    setColors(setCharacterColors({ [key]: hex }))
  }

  const alAzar = () => {
    const next = {}
    for (const p of partes) next[p.key] = randomVividColor()
    setColors(setCharacterColors(next))
    try { playSfx('magiaInicia', { volume: 0.9 }) } catch { }
    try { navigator.vibrate?.(14) } catch { }
  }

  // ── Girar con el dedo ──────────────────────────────────────────────────
  // Solo escribe en el ref; el rig hace que lo que se ve persiga al dedo
  // (GIRO_SIGUE) y frena la inercia de un flick.
  const arrastre = useRef(null)
  const giroAvisado = useRef(false)
  const onDown = useCallback((e) => {
    const pz = personalizaRef?.current
    if (!pz) return
    arrastre.current = { x: e.clientX, muestras: [{ t: performance.now(), giro: pz.giro }] }
    pz.arrastrando = true
    pz.vel = 0
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { }
  }, [personalizaRef])
  const onMove = useCallback((e) => {
    const a = arrastre.current
    const pz = personalizaRef?.current
    if (!a || !pz) return
    const dx = e.clientX - a.x
    a.x = e.clientX
    pz.giro += dx * GIRO_POR_PX
    const ahora = performance.now()
    a.muestras.push({ t: ahora, giro: pz.giro })
    while (a.muestras.length > 2 && ahora - a.muestras[0].t > VENTANA_MS) a.muestras.shift()
    if (!giroAvisado.current && Math.abs(dx) > 2) {
      giroAvisado.current = true
      setYaGiro(true)
    }
  }, [personalizaRef])
  const onUp = useCallback(() => {
    const pz = personalizaRef?.current
    const a = arrastre.current
    arrastre.current = null
    if (!pz) return
    pz.arrastrando = false
    pz.vel = 0
    if (!a) return
    const ultima = a.muestras[a.muestras.length - 1]
    const primera = a.muestras[0]
    const tramo = ultima.t - primera.t
    if (performance.now() - ultima.t < FLICK_MS && tramo > 16) {
      const v = (ultima.giro - primera.giro) / (tramo / 1000)
      pz.vel = Math.max(-VEL_MAX, Math.min(VEL_MAX, v))
    }
  }, [personalizaRef])

  return (
    <div className={`mcz ${open ? 'is-open' : ''}`} aria-hidden={!open}>
      <div
        className="mcz-escenario"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <p className={`mcz-pista ${yaGiro ? 'is-off' : ''}`}>{t('customizer.dragHint')}</p>
      </div>

      <section ref={panelRef} className="mcz-panel" role="dialog" aria-label={t('customizer.title')}>
        <div className="mcz-cabeza">
          <h2 className="mcz-titulo">{t('customizer.title')}</h2>
          <div className="mcz-acciones">
            {partes.length > 0 && (
              <button
                type="button"
                className="mcz-redondo"
                onClick={alAzar}
                aria-label={t('customizer.randomize')}
                data-tip={t('customizer.randomize')}
              >
                <DiceIcon className="w-5 h-5" />
              </button>
            )}
            <button
              ref={listoRef}
              type="button"
              className="shop-btn shop-btn--primary mcz-listo"
              onClick={() => onClose?.()}
            >
              {t('customizer.done')}
            </button>
          </div>
        </div>

        <fieldset className="mcz-skins">
          <legend className="sr-only">{t('customizer.skin')}</legend>
          {SKINS_TELEFONO.map((id) => (
            <SkinChip
              key={id}
              skin={getSkin(id)}
              lang={lang}
              active={skinId === id}
              live={open}
              onSelect={elegirSkin}
            />
          ))}
        </fieldset>

        {partes.length > 0 ? (
          <fieldset className="mcz-colores">
            <legend className="sr-only">{t('customizer.color')}</legend>
            {partes.map((p) => (
              <ColorWell
                key={p.key}
                label={t(p.label)}
                value={colors[p.key] || '#ffffff'}
                onChange={(hex) => pintar(p.key, hex)}
              />
            ))}
          </fieldset>
        ) : (
          <p className="mcz-nota">{t('customizer.ownColors')}</p>
        )}
      </section>
    </div>
  )
}
