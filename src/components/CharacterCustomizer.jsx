import React, { useEffect, useState } from 'react'
import { XMarkIcon, ArrowPathIcon, SparklesIcon } from '@heroicons/react/24/solid'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import { playSfx } from '../lib/sfx.js'
import {
  getCharacterColors,
  setCharacterColors,
  resetCharacterColors,
  DEFAULT_CHARACTER_COLORS,
  CHARACTER_COLOR_EVENT,
} from '../lib/characterColors.js'

// Panel de personalización de color del personaje (lado derecho de la pantalla;
// la cámara del mundo se posa al frente con el personaje a la izquierda, ver
// CameraController `customizeActive`). Escribe en el slot global characterColors
// → todos los renders de Skulley (escena, retrato, hero) se actualizan en vivo.
export default function CharacterCustomizer({ open = false, onClose }) {
  const { t } = useLanguage()
  const [colors, setColors] = useState(() => getCharacterColors())

  // Re-sync inputs if the store changes elsewhere (e.g. reset, otra pestaña).
  useEffect(() => {
    const onChange = (e) => setColors(e?.detail ? { ...e.detail } : getCharacterColors())
    window.addEventListener(CHARACTER_COLOR_EVENT, onChange)
    return () => window.removeEventListener(CHARACTER_COLOR_EVENT, onChange)
  }, [])

  // Al abrir, re-lee el slot por si cambió mientras estaba cerrado.
  useEffect(() => { if (open) setColors(getCharacterColors()) }, [open])

  const update = (key, value) => {
    setColors((prev) => ({ ...prev, [key]: value }))
    setCharacterColors({ [key]: value })
  }

  const onReset = () => {
    try { playSfx('click', { volume: 1.0 }) } catch { }
    setColors(resetCharacterColors())
  }

  const onRandomize = () => {
    // Efecto de magia: burst de runas que brota del personaje (lo dispara
    // HomeOrbs vía evento) + sonido de casteo.
    try { window.dispatchEvent(new CustomEvent('character-color-burst')) } catch { }
    try { playSfx('magiaInicia', { volume: 0.9 }) } catch { }
    try { playSfx('sparkleBom', { volume: 0.7 }) } catch { }
    // Vívido vía HSL (saturación/luminosidad altas) → nunca colores lodosos.
    const vivid = () => {
      const h = Math.random() * 360
      const s = 0.82 + Math.random() * 0.18
      const l = 0.46 + Math.random() * 0.14
      const c = (1 - Math.abs(2 * l - 1)) * s
      const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
      const m = l - c / 2
      const [r, g, b] = (
        h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] :
          h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]
      )
      const hex = (v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')
      return `#${hex(r)}${hex(g)}${hex(b)}`
    }
    const next = { head: vivid(), eyes: vivid(), hair: vivid(), orb: vivid() }
    setColors(setCharacterColors(next))
  }

  const rows = [
    { key: 'eyes', label: t('customizer.eyes'), default: DEFAULT_CHARACTER_COLORS.eyes },
    { key: 'head', label: t('customizer.skeleton'), default: DEFAULT_CHARACTER_COLORS.head },
    { key: 'hair', label: t('customizer.hair'), default: DEFAULT_CHARACTER_COLORS.hair },
    { key: 'orb', label: t('customizer.orb'), default: DEFAULT_CHARACTER_COLORS.orb },
  ]

  return (
    <div
      className={`fixed top-0 right-0 h-full z-[999996] flex items-center pointer-events-none pr-4 md:pr-10 transition-all duration-300 ease-out ${open ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8 pointer-events-none'}`}
      aria-hidden={!open}
    >
      <div className="pointer-events-auto w-[min(64vw,260px)] md:w-[320px] rounded-2xl bg-black/55 backdrop-blur-2xl border border-white/[0.10] text-white shadow-[0_8px_40px_rgba(0,0,0,0.55)] p-4 md:p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-semibold tracking-wide uppercase opacity-90">{t('customizer.title')}</h2>
          <button
            type="button"
            onClick={() => { try { playSfx('click', { volume: 1.0 }) } catch { }; onClose?.() }}
            onMouseEnter={() => { try { playSfx('hover', { volume: 0.9 }) } catch { } }}
            className="h-9 w-9 -mr-1 rounded-full grid place-items-center text-white/80 hover:text-white hover:bg-white/[0.12] transition-colors"
            aria-label={t('common.close')}
            title={t('common.close')}
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
        <p className="text-[11px] leading-snug opacity-55 mb-4">{t('customizer.hint')}</p>

        {/* Color rows */}
        <div className="space-y-3">
          {rows.map((row) => (
            <label
              key={row.key}
              className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.07] transition-colors cursor-pointer"
            >
              <span className="text-[13px] font-medium">{row.label}</span>
              <span className="relative inline-flex items-center">
                <span
                  className="h-7 w-10 rounded-md border border-white/20 shadow-inner"
                  style={{ backgroundColor: colors[row.key] }}
                  aria-hidden
                />
                <input
                  type="color"
                  value={colors[row.key]}
                  onChange={(e) => update(row.key, e.target.value)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  aria-label={row.label}
                />
              </span>
            </label>
          ))}
        </div>

        {/* Actions */}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onRandomize}
            onMouseEnter={() => { try { playSfx('hover', { volume: 0.9 }) } catch { } }}
            className="flex-1 flex items-center justify-center gap-2 py-2 text-[12px] font-medium rounded-xl bg-sky-400/15 hover:bg-sky-400/25 border border-sky-400/30 text-white transition-colors"
          >
            <SparklesIcon className="w-4 h-4" />
            {t('customizer.randomize')}
          </button>
          <button
            type="button"
            onClick={onReset}
            onMouseEnter={() => { try { playSfx('hover', { volume: 0.9 }) } catch { } }}
            className="flex items-center justify-center gap-2 px-3 py-2 text-[12px] font-medium rounded-xl bg-white/[0.06] hover:bg-white/[0.14] border border-white/[0.08] transition-colors"
            aria-label={t('customizer.reset')}
            title={t('customizer.reset')}
          >
            <ArrowPathIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
