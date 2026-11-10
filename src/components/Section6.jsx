import React, { useState } from 'react'
import { ArrowDownTrayIcon, PencilSquareIcon } from '@heroicons/react/24/solid'
import { ALPHABET, NUMBERS, SYMBOLS, ACCENTS, ALPHABET_MAP, ALPHABET_META, FONT_WEIGHTS, GLYPH_COUNT, runeFileUrl, fontFileName } from '../lib/runeAlphabet.js'
import { runeFontFamilyFor } from '../lib/installRuneFont.js'
import { playSfx } from '../lib/sfx.js'
import SlimeSlugDOM from './SlimeSlugDOM.jsx'

const FOCUS_RING = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff6644]'

// Título de sección del códice. La explicación va DEBAJO del título, nunca
// un rótulo encima (DESIGN.md §0.7).
function CodexHeading({ title, subtitle }) {
  return (
    <div className="mb-8 sm:mb-12">
      <h2 className="display-title display-title--md">{title}</h2>
      {subtitle && (
        <p className="mt-3 text-white/60 text-sm sm:text-base max-w-xl leading-relaxed">{subtitle}</p>
      )}
    </div>
  )
}

// Las runas se escriben con la fuente real: la misma que se descarga abajo.
const runeStyle = (weight = 'Medium') => ({ fontFamily: runeFontFamilyFor(weight), lineHeight: 1.15 })

// Texto en runas. Los tramos con runa van como un solo texto, para que la
// fuente los escriba de corrido (hilos y doble L); lo que no tiene runa se
// queda en letra normal, tenue.
function RuneLine({ text, weight = 'Medium', size = 64, color = '#ff6644' }) {
  const runs = []
  for (const ch of String(text || '')) {
    const rune = Boolean(ALPHABET_MAP[ch]) || ch === ' '
    const last = runs[runs.length - 1]
    if (last && last.rune === rune) last.text += ch
    else runs.push({ rune, text: ch })
  }
  return (
    <p className="break-words" style={{ ...runeStyle(weight), fontSize: size, color }}>
      {runs.map((r, i) => (r.rune
        ? <span key={i}>{r.text}</span>
        : <span key={i} className="text-white/40 font-black">{r.text}</span>))}
    </p>
  )
}

// Card de un glyph individual para el grid del codex
function GlyphCard({ entry, label }) {
  return (
    <article className="group relative aspect-square border-2 border-white/10 rounded-xl flex flex-col items-center justify-center bg-[#110605] hover:border-[#ff6644] transition-colors p-2">
      <span aria-hidden="true" className="text-[#ff6644] select-none" style={{ ...runeStyle(), fontSize: 'clamp(2.2rem, 5.5vw, 4rem)' }}>
        {entry.char}
      </span>
      <div className="absolute bottom-1.5 right-2 text-[11px] font-bold uppercase tracking-[0.16em] text-white/60 group-hover:text-white transition-colors">
        {label || entry.char}
      </div>
      <div className="absolute top-1.5 left-2 text-[10px] font-bold tabular-nums tracking-[0.08em] text-white/30">
        {String(entry.code).padStart(3, '0')}
      </div>
    </article>
  )
}

const ZIP_FILE = `${ALPHABET_META.slug}.zip`
const TTC_FILE = `${ALPHABET_META.slug}.ttc`
const clickSfx = () => { try { playSfx('click', { volume: 1.0 }) } catch {} }
const hoverSfx = () => { try { playSfx('hover', { volume: 0.9 }) } catch {} }

export default function Section6() {
  const [sampleText, setSampleText] = useState('YOUR NAME')

  return (
    <div className="relative w-full text-white">
      {/* Babosa de slime oculta (#1) — cerca del portal/códice SKULLEYGLYPH.
          Reto: no se anuncia. */}
      <SlimeSlugDOM id="portal" size={30} style={{ position: 'absolute', top: '14px', right: '18px' }} />
      {/* HERO */}
      <section className="pt-8 sm:pt-16 pb-10 sm:pb-20 border-b-2 border-white/10">
        <div className="max-w-5xl mx-auto px-4 sm:px-8">
          <h1 className="display-title text-[2.5rem] sm:text-[5rem] lg:text-[7rem] mb-6">
            Skulley Glyph<br />
            <span className="text-[#ff6644]">Variable</span>
          </h1>
          <p className="text-base sm:text-xl text-white/75 max-w-2xl leading-relaxed">
            {ALPHABET_META.description}
          </p>
        </div>
      </section>

      {/* TYPE SPECIMEN — A-Z */}
      <section className="py-12 sm:py-20 border-b-2 border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-8">
          <CodexHeading title="Letters A–Z" subtitle="Lowercase is the same rune at x-height." />
          <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8 gap-4 sm:gap-6">
            {ALPHABET.map((entry) => <GlyphCard key={entry.code} entry={entry} />)}
          </div>
        </div>
      </section>

      {/* NUMBERS 0-9 */}
      <section className="py-12 sm:py-20 border-b-2 border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-8">
          <CodexHeading title="Numbers 0–9" subtitle="Maya numerals. A drop is one, a bar is five, the ensō is zero." />
          <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-7 xl:grid-cols-10 gap-4 sm:gap-6">
            {NUMBERS.map((entry) => <GlyphCard key={entry.code} entry={entry} />)}
          </div>
        </div>
      </section>

      {/* SYMBOLS */}
      <section className="py-12 sm:py-20 border-b-2 border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-8">
          <CodexHeading title="Symbols" subtitle="Punctuation and operators." />
          <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-4 sm:gap-6">
            {SYMBOLS.map((entry) => <GlyphCard key={entry.code} entry={entry} label={entry.char} />)}
          </div>
        </div>
      </section>

      {/* ACCENTS */}
      <section className="py-12 sm:py-20 border-b-2 border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-8">
          <CodexHeading title="Accents" subtitle="A smaller, thinner brush mark above the rune, so it never reads as part of it." />
          <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-4 sm:gap-6">
            {ACCENTS.slice(0, 16).map((entry) => <GlyphCard key={entry.code} entry={entry} />)}
          </div>
        </div>
      </section>

      {/* WRITE YOUR NAME */}
      <section className="py-12 sm:py-20 border-b-2 border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-8">
          <CodexHeading
            title="Write your name in runes"
            subtitle="Letters, numbers, accents and common symbols are supported. The preview updates live in the 3 weights below."
          />

          <label htmlFor="runeInput" className="flex items-center gap-2 mb-3 text-sm font-bold text-white/80">
            <PencilSquareIcon className="w-4 h-4 text-[#ff6644]" aria-hidden="true" />
            <span>Your text</span>
          </label>
          <div className="relative">
            <input
              id="runeInput"
              type="text"
              value={sampleText}
              onChange={(e) => setSampleText(e.target.value.slice(0, 32))}
              placeholder="YOUR NAME"
              maxLength={32}
              autoComplete="off"
              spellCheck="false"
              className="w-full bg-[#1a0a07] border-2 border-[#ff6644]/40 hover:border-[#ff6644]/70 focus:border-[#ff6644] rounded-2xl font-display text-3xl sm:text-5xl py-5 sm:py-7 px-5 sm:pl-7 sm:pr-24 text-white outline-none tracking-widest transition-colors placeholder:text-white/20"
            />
            <span className="absolute top-1/2 right-5 -translate-y-1/2 text-white/45 text-xs font-bold tabular-nums hidden sm:block pointer-events-none">
              {sampleText.length}/32
            </span>
          </div>

          {/* Preview en los 3 weights */}
          <div className="mt-10 space-y-8 sm:space-y-10">
            {FONT_WEIGHTS.map((w) => (
              <div key={w.name} className="border-l-2 border-[#ff6644]/40 pl-4 sm:pl-6">
                <div className="flex items-baseline gap-3 mb-3 sm:mb-4">
                  <span className="text-[#ff6644] text-sm font-bold">{w.name}</span>
                  <span className="text-white/45 text-xs font-bold tabular-nums">Weight {w.usWeightClass}</span>
                </div>
                <RuneLine text={sampleText || 'YOUR NAME'} weight={w.name} size={56} color="#ff6644" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PANGRAM */}
      <section className="py-12 sm:py-20 border-b-2 border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-8">
          <CodexHeading title="Specimen pangram" />
          <figure className="bg-[#110605] border-2 border-white/10 rounded-2xl p-6 sm:p-12">
            <RuneLine text="THE QUICK BROWN FOX JUMPS OVER 10 LAZY DOGS - 2026!" size={40} color="#ff6644" />
            <figcaption className="mt-6 sm:mt-8 pt-5 border-t-2 border-white/10 text-sm sm:text-base text-white/60">
              The quick brown fox jumps over 10 lazy dogs — 2026!
            </figcaption>
          </figure>
        </div>
      </section>

      {/* DOWNLOAD */}
      <section className="py-14 sm:py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-8 text-center">
          <h2 className="display-title display-title--md mb-5">Download the family</h2>
          <p className="text-white/70 text-base sm:text-lg mb-8 max-w-2xl mx-auto leading-relaxed">
            One ZIP, everything inside. The .ttc with all 3 weights, each weight as a separate .otf,
            and a README with installation notes. Pick whatever fits your workflow.
          </p>

          {/* Primary CTA — ZIP con todo */}
          <a
            href={runeFileUrl(ZIP_FILE)}
            download={ZIP_FILE}
            onClick={clickSfx}
            onMouseEnter={hoverSfx}
            className={`shop-btn min-h-14 px-8 text-sm sm:text-base bg-[#ff6644] text-[#0a0510] hover:bg-[#ff8a70] active:scale-95 ${FOCUS_RING}`}
          >
            <ArrowDownTrayIcon className="w-5 h-5" aria-hidden="true" />
            <span>Download ZIP</span>
          </a>

          <p className="mt-5 text-sm text-white/55">
            {ZIP_FILE} · v{ALPHABET_META.version} · {GLYPH_COUNT} glyphs · .ttc + 3 weights + README
          </p>

          {/* Contenido del ZIP: una sola caja, filas separadas por divisor */}
          <ul className="mt-10 max-w-xl mx-auto border-2 border-white/10 rounded-2xl bg-[#110605] text-left divide-y-2 divide-white/10">
            <li className="flex items-center justify-between gap-4 px-5 py-4">
              <div className="min-w-0">
                <div className="text-sm text-white font-bold break-all">{TTC_FILE}</div>
                <div className="text-xs text-white/55">Variable · 3 weights in 1 file</div>
              </div>
              <span className="shrink-0 rounded-full border-2 border-[#ff6644] bg-[#ff6644] px-3 py-0.5 text-[11px] font-bold text-[#0a0510]">Primary</span>
            </li>
            {FONT_WEIGHTS.map((w) => (
              <li key={w.name} className="flex items-center justify-between gap-4 px-5 py-4">
                <div className="min-w-0">
                  <div className="text-sm text-white/90 font-bold break-all">{fontFileName(w)}</div>
                  <div className="text-xs text-white/55 tabular-nums">Weight {w.usWeightClass}</div>
                </div>
                <span className="shrink-0 rounded-full border-2 border-white/15 px-3 py-0.5 text-[11px] font-bold text-white/60">Standalone</span>
              </li>
            ))}
            <li className="flex items-center justify-between gap-4 px-5 py-4">
              <div className="min-w-0">
                <div className="text-sm text-white/90 font-bold">README.txt</div>
                <div className="text-xs text-white/55">Install notes · glyph coverage</div>
              </div>
              <span className="shrink-0 rounded-full border-2 border-white/15 px-3 py-0.5 text-[11px] font-bold text-white/60">Reference</span>
            </li>
          </ul>

          {/* Fallback: individual quick downloads */}
          <div className="mt-12 border-t-2 border-white/10 pt-10">
            <p className="text-white/60 text-sm sm:text-base mb-5">
              Or grab a single file.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <a
                href={runeFileUrl(TTC_FILE)}
                download={TTC_FILE}
                onClick={clickSfx}
                onMouseEnter={hoverSfx}
                className={`shop-btn shop-btn--ghost min-h-11 px-5 text-xs active:scale-95 ${FOCUS_RING}`}
              >
                <ArrowDownTrayIcon className="w-4 h-4" aria-hidden="true" />
                <span>.ttc only</span>
              </a>
              {FONT_WEIGHTS.map((w) => (
                <a
                  key={w.name}
                  href={runeFileUrl(fontFileName(w))}
                  download={fontFileName(w)}
                  onClick={clickSfx}
                  onMouseEnter={hoverSfx}
                  className={`shop-btn shop-btn--ghost min-h-11 px-5 text-xs active:scale-95 ${FOCUS_RING}`}
                >
                  <ArrowDownTrayIcon className="w-4 h-4" aria-hidden="true" />
                  <span>{w.name} .otf</span>
                </a>
              ))}
            </div>
          </div>

          <p className="mt-10 text-xs text-white/45 max-w-lg mx-auto leading-relaxed">
            The .ttc packages three static weights into one file. Installed once, they behave as a
            single family in Word, Figma, Adobe apps, etc.
          </p>
        </div>
      </section>
    </div>
  )
}
