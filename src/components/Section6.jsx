import React, { useMemo, useState } from 'react'
import { ArrowDownTrayIcon, PencilSquareIcon } from '@heroicons/react/24/solid'
import { ALPHABET, NUMBERS, SYMBOLS, ALPHABET_MAP, ALPHABET_META } from '../lib/runeAlphabet.js'
import { downloadRuneVariableFont, downloadRuneFont, downloadRuneFontZip, FONT_WEIGHTS } from '../lib/generateRuneFont.js'
import { playSfx } from '../lib/sfx.js'
import SlimeSlugDOM from './SlimeSlugDOM.jsx'

const WEIGHT_STROKE = {
  Light: 3,
  Medium: 6,
  Bold: 10,
}

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

// RuneGlyph — SVG inline (4 segmentos SDF en grid 4×4).
function RuneGlyph({ segments, size = 100, strokeWidth = 6, color = 'currentColor', className = '', style }) {
  const pad = 10
  const inner = 100 - pad * 2
  const mapX = (v) => pad + v * inner
  const mapY = (v) => pad + v * inner
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      preserveAspectRatio="xMidYMid meet"
      className={className}
      style={{ display: 'block', ...(style || {}) }}
      aria-hidden="true"
    >
      {segments.map((s, i) => (
        <line
          key={i}
          x1={mapX(s.x1)} y1={mapY(s.y1)}
          x2={mapX(s.x2)} y2={mapY(s.y2)}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
      ))}
    </svg>
  )
}

// Convierte texto → array de items (rune/space/plain). Reconoce letras,
// números y símbolos cubiertos por ALPHABET_MAP.
function toRunes(text) {
  const out = []
  for (const ch of String(text || '')) {
    if (ch === ' ') { out.push({ kind: 'space' }); continue }
    const entry = ALPHABET_MAP[ch] || ALPHABET_MAP[ch.toUpperCase()]
    if (entry) out.push({ kind: 'rune', entry })
    else out.push({ kind: 'plain', value: ch })
  }
  return out
}

function RuneLine({ text, weight = 'Medium', size = 64, color = '#ff6644' }) {
  const items = useMemo(() => toRunes(text), [text])
  const stroke = WEIGHT_STROKE[weight] || 6
  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
      {items.map((it, i) => {
        if (it.kind === 'space') return <span key={i} className="w-4 sm:w-6" />
        if (it.kind === 'plain') return (
          <span key={i} className="text-white/40 font-black" style={{ fontSize: size }}>
            {it.value}
          </span>
        )
        return (
          <RuneGlyph
            key={i}
            segments={it.entry.segments}
            size={size}
            strokeWidth={stroke}
            color={color}
          />
        )
      })}
    </div>
  )
}

// Card de un glyph individual para el grid del codex
function GlyphCard({ entry, label }) {
  return (
    <article className="group relative aspect-square border-2 border-white/10 rounded-xl flex flex-col items-center justify-center bg-[#110605] hover:border-[#ff6644] transition-colors p-2">
      <RuneGlyph
        segments={entry.segments}
        size="100%"
        strokeWidth={7}
        color="#ff6644"
        style={{ width: '72%', height: '72%' }}
      />
      <div className="absolute bottom-1.5 right-2 text-[11px] font-bold uppercase tracking-[0.16em] text-white/60 group-hover:text-white transition-colors">
        {label || entry.char}
      </div>
      <div className="absolute top-1.5 left-2 text-[10px] font-bold tabular-nums tracking-[0.08em] text-white/30">
        {String(entry.code).padStart(3, '0')}
      </div>
    </article>
  )
}

export default function Section6() {
  const [sampleText, setSampleText] = useState('YOUR NAME')
  const [downloading, setDownloading] = useState(null)

  const handleDownloadZip = async () => {
    try { playSfx('click', { volume: 1.0 }) } catch {}
    setDownloading('zip')
    await new Promise((r) => setTimeout(r, 60))
    try { await downloadRuneFontZip() }
    catch (e) { console.error('ZIP download failed', e) }
    finally { setTimeout(() => setDownloading(null), 1200) }
  }

  const handleDownloadVariable = async () => {
    try { playSfx('click', { volume: 1.0 }) } catch {}
    setDownloading('variable')
    await new Promise((r) => setTimeout(r, 60))
    try { downloadRuneVariableFont() }
    catch (e) { console.error('TTC download failed', e) }
    finally { setTimeout(() => setDownloading(null), 800) }
  }

  const handleDownloadWeight = async (weight) => {
    try { playSfx('click', { volume: 1.0 }) } catch {}
    setDownloading(weight.name)
    await new Promise((r) => setTimeout(r, 60))
    try { downloadRuneFont(weight) }
    catch (e) { console.error('OTF download failed', e) }
    finally { setTimeout(() => setDownloading(null), 600) }
  }

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
          <CodexHeading title="Letters A–Z" />
          <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8 gap-4 sm:gap-6">
            {ALPHABET.map((entry) => <GlyphCard key={entry.code} entry={entry} />)}
          </div>
        </div>
      </section>

      {/* NUMBERS 0-9 */}
      <section className="py-12 sm:py-20 border-b-2 border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-8">
          <CodexHeading title="Numbers 0–9" />
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

      {/* WRITE YOUR NAME */}
      <section className="py-12 sm:py-20 border-b-2 border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-8">
          <CodexHeading
            title="Write your name in runes"
            subtitle="Letters, numbers and common symbols are supported. The preview updates live in the 3 weights below."
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
              className="w-full bg-[#1a0a07] border-2 border-[#ff6644]/40 hover:border-[#ff6644]/70 focus:border-[#ff6644] rounded-2xl font-display text-3xl sm:text-5xl py-5 sm:py-7 px-5 sm:pl-7 sm:pr-24 text-white outline-none uppercase tracking-widest transition-colors placeholder:text-white/20"
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
            <RuneLine text="THE QUICK BROWN FOX JUMPS OVER 10 LAZY DOGS - 2026!" weight="Medium" size={40} color="#ff6644" />
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
            One ZIP, everything inside. The variable font (.ttc with all 3 weights), each weight
            as a separate .otf, and a README with installation notes. Pick whatever fits your workflow.
          </p>

          {/* Primary CTA — ZIP con todo */}
          <button
            type="button"
            onClick={handleDownloadZip}
            disabled={downloading !== null}
            onMouseEnter={() => { try { playSfx('hover', { volume: 0.9 }) } catch {} }}
            className={`shop-btn min-h-14 px-8 text-sm sm:text-base bg-[#ff6644] text-[#0a0510] hover:bg-[#ff8a70] active:scale-95 ${FOCUS_RING}`}
          >
            <ArrowDownTrayIcon className="w-5 h-5" aria-hidden="true" />
            <span>{downloading === 'zip' ? 'Packing…' : 'Download ZIP'}</span>
          </button>

          <p className="mt-5 text-sm text-white/55">
            {ALPHABET_META.slug}.zip · v{ALPHABET_META.version} · 69 glyphs · variable + 3 static weights + README
          </p>

          {/* Contenido del ZIP: una sola caja, filas separadas por divisor */}
          <ul className="mt-10 max-w-xl mx-auto border-2 border-white/10 rounded-2xl bg-[#110605] text-left divide-y-2 divide-white/10">
            <li className="flex items-center justify-between gap-4 px-5 py-4">
              <div className="min-w-0">
                <div className="text-sm text-white font-bold break-all">{ALPHABET_META.slug}.ttc</div>
                <div className="text-xs text-white/55">Variable · 3 weights in 1 file</div>
              </div>
              <span className="shrink-0 rounded-full border-2 border-[#ff6644] bg-[#ff6644] px-3 py-0.5 text-[11px] font-bold text-[#0a0510]">Primary</span>
            </li>
            {FONT_WEIGHTS.map((w) => (
              <li key={w.name} className="flex items-center justify-between gap-4 px-5 py-4">
                <div className="min-w-0">
                  <div className="text-sm text-white/90 font-bold break-all">{ALPHABET_META.slug}-{w.name}.otf</div>
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
              <button
                type="button"
                onClick={handleDownloadVariable}
                disabled={downloading !== null}
                onMouseEnter={() => { try { playSfx('hover', { volume: 0.9 }) } catch {} }}
                className={`shop-btn shop-btn--ghost min-h-11 px-5 text-xs active:scale-95 ${FOCUS_RING}`}
              >
                <ArrowDownTrayIcon className="w-4 h-4" aria-hidden="true" />
                <span>{downloading === 'variable' ? '…' : '.ttc only'}</span>
              </button>
              {FONT_WEIGHTS.map((w) => (
                <button
                  key={w.name}
                  type="button"
                  onClick={() => handleDownloadWeight(w)}
                  disabled={downloading !== null}
                  onMouseEnter={() => { try { playSfx('hover', { volume: 0.9 }) } catch {} }}
                  className={`shop-btn shop-btn--ghost min-h-11 px-5 text-xs active:scale-95 ${FOCUS_RING}`}
                >
                  <ArrowDownTrayIcon className="w-4 h-4" aria-hidden="true" />
                  <span>{downloading === w.name ? '…' : `${w.name} .otf`}</span>
                </button>
              ))}
            </div>
          </div>

          <p className="mt-10 text-xs text-white/45 max-w-lg mx-auto leading-relaxed">
            True variable fonts (single file with axis-driven weight interpolation) aren't possible to
            write in-browser with the current tooling. The .ttc packages three static weights into
            one file — installed once, they behave as a single family in Word, Figma, Adobe apps, etc.
          </p>
        </div>
      </section>
    </div>
  )
}
