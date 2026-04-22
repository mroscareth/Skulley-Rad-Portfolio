import React, { useMemo, useRef, useState } from 'react'
import { ArrowDownTrayIcon, PencilSquareIcon } from '@heroicons/react/24/solid'
import { ALPHABET, NUMBERS, SYMBOLS, ALPHABET_MAP, ALPHABET_META } from '../lib/runeAlphabet.js'
import { downloadRuneVariableFont, downloadRuneFont, downloadRuneFontZip, FONT_WEIGHTS } from '../lib/generateRuneFont.js'
import { playSfx } from '../lib/sfx.js'

const WEIGHT_STROKE = {
  Light: 3,
  Medium: 6,
  Bold: 10,
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
    <article className="group relative aspect-square border border-white/10 rounded-lg flex flex-col items-center justify-center bg-black/40 hover:border-[#ff6644]/50 transition-colors p-2">
      <RuneGlyph
        segments={entry.segments}
        size="100%"
        strokeWidth={7}
        color="#ff6644"
        style={{ width: '72%', height: '72%' }}
      />
      <div className="absolute bottom-1.5 right-2 text-[10px] uppercase tracking-[0.2em] text-white/50 group-hover:text-white/90 transition-colors">
        {label || entry.char}
      </div>
      <div className="absolute top-1.5 left-2 text-[9px] text-white/20 font-mono">
        {String(entry.code).padStart(3, '0')}
      </div>
    </article>
  )
}

export default function Section6() {
  const [sampleText, setSampleText] = useState('YOUR NAME')
  const [downloading, setDownloading] = useState(null)
  const inputRef = useRef(null)

  const focusInput = () => { try { inputRef.current?.focus() } catch {} }

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
    <div className="relative w-full text-white" style={{ fontFamily: '"Cascadia Code", "Fira Code", monospace' }}>
      {/* HERO */}
      <section className="pt-8 sm:pt-16 pb-10 sm:pb-20 border-b border-white/10">
        <div className="max-w-5xl mx-auto px-4 sm:px-8">
          <div className="text-xs sm:text-sm uppercase tracking-[0.35em] text-[#ff6644]/80 mb-4">
            ⟐ ANTIMATTER CODEX / ENTRY 001
          </div>
          <h1
            className="text-[2.5rem] sm:text-[5rem] lg:text-[7rem] font-black leading-[0.95] tracking-tight mb-6"
            style={{ fontFamily: "'Luckiest Guy', 'Archivo Black', system-ui, sans-serif", color: '#fff' }}
          >
            SKULLEY GLYPH<br />
            <span className="text-[#ff6644]">VARIABLE</span>
          </h1>
          <p className="text-base sm:text-xl text-white/75 max-w-2xl leading-relaxed">
            {ALPHABET_META.description}
          </p>
        </div>
      </section>

      {/* TYPE SPECIMEN — A-Z */}
      <section className="py-12 sm:py-20 border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-8">
          <div className="flex items-baseline gap-4 mb-8 sm:mb-12">
            <span className="text-[#ff6644] text-xs uppercase tracking-[0.3em]">§ I</span>
            <h2 className="text-xl sm:text-2xl uppercase tracking-widest">Letters · A–Z</h2>
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8 gap-4 sm:gap-6">
            {ALPHABET.map((entry) => <GlyphCard key={entry.code} entry={entry} />)}
          </div>
        </div>
      </section>

      {/* NUMBERS 0-9 */}
      <section className="py-12 sm:py-20 border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-8">
          <div className="flex items-baseline gap-4 mb-8 sm:mb-12">
            <span className="text-[#ff6644] text-xs uppercase tracking-[0.3em]">§ II</span>
            <h2 className="text-xl sm:text-2xl uppercase tracking-widest">Numbers · 0–9</h2>
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-7 xl:grid-cols-10 gap-4 sm:gap-6">
            {NUMBERS.map((entry) => <GlyphCard key={entry.code} entry={entry} />)}
          </div>
        </div>
      </section>

      {/* SYMBOLS */}
      <section className="py-12 sm:py-20 border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-8">
          <div className="flex items-baseline gap-4 mb-8 sm:mb-12">
            <span className="text-[#ff6644] text-xs uppercase tracking-[0.3em]">§ III</span>
            <h2 className="text-xl sm:text-2xl uppercase tracking-widest">Symbols · Punctuation &amp; Operators</h2>
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-4 sm:gap-6">
            {SYMBOLS.map((entry) => <GlyphCard key={entry.code} entry={entry} label={entry.char} />)}
          </div>
        </div>
      </section>

      {/* WRITE YOUR NAME */}
      <section className="py-12 sm:py-20 border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-8">
          <div className="flex items-baseline gap-4 mb-4">
            <span className="text-[#ff6644] text-xs uppercase tracking-[0.3em]">§ IV</span>
            <h2 className="text-xl sm:text-2xl uppercase tracking-widest">Write Your Name in Runes</h2>
          </div>
          <p className="text-white/60 text-sm sm:text-base mb-6 max-w-xl">
            Tap the field and type. Letters, numbers and common symbols are supported. Preview updates live in the 3 weights below.
          </p>

          <label htmlFor="runeInput" className="block cursor-text" onClick={focusInput}>
            <div className="flex items-center gap-3 mb-3 text-[#ff6644]/80 text-xs uppercase tracking-[0.3em]">
              <PencilSquareIcon className="w-4 h-4" />
              <span>your text → glyphs ↓</span>
            </div>
            <div className="relative">
              <input
                id="runeInput"
                ref={inputRef}
                type="text"
                value={sampleText}
                onChange={(e) => setSampleText(e.target.value.slice(0, 32))}
                placeholder="YOUR NAME"
                maxLength={32}
                autoComplete="off"
                spellCheck="false"
                className="w-full bg-[#1a0a07] border-2 border-[#ff6644]/30 hover:border-[#ff6644]/60 focus:border-[#ff6644] rounded-2xl text-3xl sm:text-5xl py-5 sm:py-7 px-5 sm:px-7 text-white outline-none uppercase tracking-widest transition-all placeholder:text-white/20"
                style={{ fontFamily: "'Luckiest Guy', system-ui, sans-serif", boxShadow: '0 0 32px rgba(255,102,68,0.12)' }}
              />
              <span className="absolute top-1/2 right-5 -translate-y-1/2 text-[#ff6644]/50 text-xs uppercase tracking-[0.25em] hidden sm:block pointer-events-none">
                {sampleText.length}/32
              </span>
            </div>
          </label>

          {/* Preview en los 3 weights */}
          <div className="mt-10 space-y-8 sm:space-y-10">
            {FONT_WEIGHTS.map((w) => (
              <div key={w.name} className="border-l-2 border-[#ff6644]/25 pl-4 sm:pl-6">
                <div className="flex items-baseline justify-between mb-3 sm:mb-4">
                  <div className="flex items-baseline gap-3">
                    <span className="text-[#ff6644] text-[11px] sm:text-xs uppercase tracking-[0.3em] font-bold">
                      {w.name}
                    </span>
                    <span className="text-white/30 text-[10px] sm:text-xs uppercase tracking-widest">
                      weight {w.usWeightClass}
                    </span>
                  </div>
                </div>
                <RuneLine text={sampleText || 'YOUR NAME'} weight={w.name} size={56} color="#ff6644" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PANGRAM */}
      <section className="py-12 sm:py-20 border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-8">
          <div className="flex items-baseline gap-4 mb-6">
            <span className="text-[#ff6644] text-xs uppercase tracking-[0.3em]">§ V</span>
            <h2 className="text-xl sm:text-2xl uppercase tracking-widest">Specimen Pangram</h2>
          </div>
          <div className="bg-black/60 border border-white/10 rounded-xl p-6 sm:p-12">
            <p className="text-xs sm:text-sm text-white/50 uppercase tracking-[0.25em] mb-5">
              THE QUICK BROWN FOX JUMPS OVER 10 LAZY DOGS — 2026!
            </p>
            <RuneLine text="THE QUICK BROWN FOX JUMPS OVER 10 LAZY DOGS - 2026!" weight="Medium" size={40} color="#ff6644" />
          </div>
        </div>
      </section>

      {/* DOWNLOAD */}
      <section className="py-14 sm:py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-8 text-center">
          <div className="flex items-baseline gap-4 mb-6 justify-center">
            <span className="text-[#ff6644] text-xs uppercase tracking-[0.3em]">§ VI</span>
            <h2 className="text-xl sm:text-2xl uppercase tracking-widest">Download the Family</h2>
          </div>
          <p className="text-white/70 text-base sm:text-lg mb-8 max-w-2xl mx-auto leading-relaxed">
            One ZIP · everything inside. The variable font (.ttc with all 3 weights), each weight
            as a separate .otf, and a README with installation notes. Pick whatever fits your workflow.
          </p>

          {/* Primary CTA — ZIP con todo */}
          <button
            type="button"
            onClick={handleDownloadZip}
            disabled={downloading !== null}
            onMouseEnter={() => { try { playSfx('hover', { volume: 0.9 }) } catch {} }}
            className="inline-flex items-center gap-3 px-8 py-5 text-base sm:text-xl font-black uppercase tracking-widest border-2 border-[#ff6644] text-[#ff6644] rounded-full hover:bg-[#ff6644] hover:text-black active:scale-95 transition-all disabled:opacity-40"
            style={{ fontFamily: "'Luckiest Guy', system-ui, sans-serif", boxShadow: '0 0 40px rgba(255,102,68,0.3)' }}
          >
            <ArrowDownTrayIcon className="w-6 h-6" />
            <span>{downloading === 'zip' ? 'Packing…' : `Download ${ALPHABET_META.slug}.zip`}</span>
          </button>

          <p className="mt-5 text-xs text-white/50 uppercase tracking-[0.2em]">
            v{ALPHABET_META.version} · 69 glyphs · variable + 3 static weights + README
          </p>

          {/* ZIP contents breakdown */}
          <div className="mt-10 max-w-xl mx-auto">
            <div className="border border-white/10 rounded-xl bg-black/40 text-left divide-y divide-white/5">
              <div className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="text-sm text-white font-bold">{ALPHABET_META.slug}.ttc</div>
                  <div className="text-[11px] text-white/50 uppercase tracking-widest">variable · 3 weights in 1 file</div>
                </div>
                <span className="text-[10px] text-[#ff6644]/80 uppercase tracking-widest">primary</span>
              </div>
              {FONT_WEIGHTS.map((w) => (
                <div key={w.name} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <div className="text-sm text-white/90">{ALPHABET_META.slug}-{w.name}.otf</div>
                    <div className="text-[11px] text-white/40 uppercase tracking-widest">weight {w.usWeightClass}</div>
                  </div>
                  <span className="text-[10px] text-white/40 uppercase tracking-widest">standalone</span>
                </div>
              ))}
              <div className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="text-sm text-white/90">README.txt</div>
                  <div className="text-[11px] text-white/40 uppercase tracking-widest">install notes · glyph coverage</div>
                </div>
                <span className="text-[10px] text-white/40 uppercase tracking-widest">reference</span>
              </div>
            </div>
          </div>

          {/* Fallback: individual quick downloads */}
          <div className="mt-12 border-t border-white/10 pt-10">
            <p className="text-white/50 text-sm mb-5 uppercase tracking-[0.25em]">
              Or grab a single file
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={handleDownloadVariable}
                disabled={downloading !== null}
                onMouseEnter={() => { try { playSfx('hover', { volume: 0.9 }) } catch {} }}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-xs uppercase tracking-widest border border-[#ff6644]/40 text-[#ff6644] rounded-full hover:bg-[#ff6644]/10 hover:border-[#ff6644] active:scale-95 transition-all disabled:opacity-40"
              >
                <ArrowDownTrayIcon className="w-3.5 h-3.5" />
                <span>{downloading === 'variable' ? '…' : '.ttc only'}</span>
              </button>
              {FONT_WEIGHTS.map((w) => (
                <button
                  key={w.name}
                  type="button"
                  onClick={() => handleDownloadWeight(w)}
                  disabled={downloading !== null}
                  onMouseEnter={() => { try { playSfx('hover', { volume: 0.9 }) } catch {} }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-xs uppercase tracking-widest border border-white/20 text-white/70 rounded-full hover:bg-white/10 hover:text-white hover:border-white/50 active:scale-95 transition-all disabled:opacity-40"
                >
                  <ArrowDownTrayIcon className="w-3.5 h-3.5" />
                  <span>{downloading === w.name ? '…' : `${w.name} .otf`}</span>
                </button>
              ))}
            </div>
          </div>

          <p className="mt-10 text-[10px] sm:text-xs text-white/30 italic max-w-lg mx-auto leading-relaxed">
            True variable fonts (single file with axis-driven weight interpolation) aren't possible to
            write in-browser with the current tooling. The .ttc packages three static weights into
            one file — installed once, they behave as a single family in Word, Figma, Adobe apps, etc.
          </p>
        </div>
      </section>
    </div>
  )
}
