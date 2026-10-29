import React, { useEffect, useId, useState } from 'react'
import { useShopData } from '../../lib/shopDataContext.jsx'
import { useLanguage } from '../../i18n/LanguageContext.jsx'
import { TicketArt } from '../GoldenTicketBadge.jsx'

// MobileArgusPrizes — los dos boletos del juego de esferas, en la home de
// teléfono. DOM puro: ni Canvas, ni three, ni el GLB de Argus.
//
// En un teléfono el juego no se puede jugar (se apunta con el mouse), pero el
// premio no se esconde: se muestran los dos niveles con sus números REALES
// (los del backend, no escritos a mano) y Argus dice de frente dónde se ganan.
//
// Por qué nada de 3D: el diálogo de escritorio (ZoidianDialog) monta un
// <Canvas> con ZoidianModel y eso arrastra zoidian.glb — 2.0 MB para un
// retrato. Acá la presencia de Argus es SVG: su ojo, el mismo de la pleca
// amarilla de SphereGameModal. El boleto ya era SVG (TicketArt).

// La línea del teléfono, en la voz de Argus: corta, hechos concretos, sin
// disculpa y sin fecha. Local a propósito — LanguageContext.jsx lo está
// tocando otra sesión; de aquí se integra al i18n después (clave sugerida:
// `zoidian.noPhone`).
const PHONE_NOTICE = {
  es: 'Las esferas se patean apuntando con el mouse, así que en un teléfono no hay partida. Los boletos se ganan en computadora; aquí están.',
  en: 'You kick the spheres by aiming with a mouse, so there is no game on a phone. The tickets are won on a computer; here they are.',
}

// El metal de cada boleto. Mismos valores que la pestaña Premios de Argus.
const TIER_COLOR = { gold: '#FFC21A', silver: '#DCE2EA' }

const ALMOND = 'M4 20 Q 20 3 32 3 Q 44 3 60 20 Q 44 37 32 37 Q 20 37 4 20 Z'

// Copia del ojo toon de SphereGameModal (allá es local al módulo). Vive de las
// clases .argus-eye de index.css, así que el parpadeo, la mirada y su
// prefers-reduced-motion son los mismos. El párpado es amarillo porque baja
// sobre la pleca amarilla: ese color es su "piel".
function ArgusEye({ width = 44 }) {
  const clipId = useId()
  return (
    <svg className="argus-eye" viewBox="0 0 64 40" style={{ width, height: width * 0.65 }} aria-hidden="true">
      <defs>
        <clipPath id={clipId}><path d={ALMOND} /></clipPath>
      </defs>
      <path d={ALMOND} fill="#fff" />
      <circle className="argus-eye-pupil" cx="32" cy="20" r="8" fill="#0a0510" />
      <g clipPath={`url(#${clipId})`}>
        <path
          className="argus-eye-lid"
          d="M -8 -24 L 72 -24 L 72 24 Q 52 31 32 31 Q 12 31 -8 24 Z"
          fill="#f5ff00" stroke="#0a0510" strokeWidth="4" strokeLinejoin="round"
        />
      </g>
      <path d={ALMOND} fill="none" stroke="#0a0510" strokeWidth="4" strokeLinejoin="round" />
    </svg>
  )
}

const fmtNum = (n, lang) => Number(n || 0).toLocaleString(lang === 'es' ? 'es-MX' : 'en-US')

// "2026-11-01" → "1 de noviembre" / "November 1"
function fmtResetDate(iso, lang) {
  if (!iso) return ''
  const [y, m] = String(iso).split('-').map(Number)
  if (!y || !m) return ''
  return new Date(y, m - 1, 1).toLocaleDateString(lang === 'es' ? 'es-MX' : 'en-US', { day: 'numeric', month: 'long' })
}

// Cuánto pide y da cada boleto sale del catálogo (game-tickets.php vía
// useShopData); cuántos Golden quedan del mes se piden aparte, porque el
// conteo cambia mientras otros juegan. Mismo patrón que useTicketStats del
// diálogo de escritorio, sin el prop `open`: esta tarjeta vive montada.
function useTicketStats() {
  const { tickets } = useShopData()
  const [stats, setStats] = useState(null)
  useEffect(() => {
    let alive = true
    fetch('/api/profile.php?action=tickets')
      .then((r) => r.json())
      .then((j) => { if (alive && j?.ok) setStats(j) })
      .catch(() => { /* sin conteo: se muestran solo los niveles */ })
    return () => { alive = false }
  }, [])
  const tiers = stats?.tiers || tickets
  return { gold: tiers.gold, silver: tiers.silver, resetsAt: stats?.resets_at || null }
}

// Un boleto. Columna a todo lo ancho (a 390px no caben dos), en el orden de la
// card de la tienda: la foto, el nombre, qué da y cómo se gana. Sin tarjeta
// propia ni sombra (§14.2): las separa una pleca dura.
function PrizeRow({ tier, info, lang, t, children }) {
  return (
    <div className="min-w-0">
      {/* Paspartú plano, como el marco de la foto de un producto: el boleto se
          ve completo y sin borde propio (§14.7). */}
      <div className="rounded-2xl bg-[#150a1d] grid place-items-center py-7 px-4">
        <TicketArt tier={tier} pct={info.pct} className="golden-ticket--idle w-[76%] max-w-[15rem]" />
      </div>
      <h3
        className="display-title text-[2.125rem] leading-[0.86] mt-5"
        style={{ color: TIER_COLOR[tier] }}
      >
        {info.name}
      </h3>
      <p className="text-white font-bold text-[1.0625rem] leading-snug mt-2">
        {t('zoidian.pctOff', { pct: info.pct })}
      </p>
      <p className="text-white/70 text-[0.9375rem] leading-relaxed mt-1">
        {t('zoidian.howTo', { score: fmtNum(info.score, lang) })}
      </p>
      {children}
    </div>
  )
}

export default function MobileArgusPrizes({ className = '' }) {
  const { t, lang } = useLanguage()
  const { gold, silver, resetsAt } = useTicketStats()

  const goldLeft = gold?.left_this_month
  const goldCap = gold?.monthly_cap || 0
  const goldScore = fmtNum(gold.score, lang)
  // Sin conteo todavía (o sin red) no se promete nada: solo los niveles.
  const stockText = goldLeft === undefined || goldLeft === null
    ? null
    : goldLeft > 0
      ? t('zoidian.goldLeft', { left: goldLeft, cap: goldCap })
      : t('zoidian.goldSoldOut', { date: fmtResetDate(resetsAt, lang) })

  // El 6º renglón puede no existir en un idioma: `t` devuelve la clave y se
  // cae solo, sin dejar "zoidian.rule6" a la vista.
  const rules = ['rule1', 'rule2', 'rule3', 'rule4', 'rule5', 'rule6']
    .map((k) => t(`zoidian.${k}`, { gold: goldScore }))
    .filter((s) => typeof s === 'string' && !s.startsWith('zoidian.'))

  return (
    <section
      className={`bg-[#0d0714] border-2 border-white/12 rounded-[1.5rem] text-white ${className}`}
      aria-labelledby="mobile-prizes-title"
      style={{
        // El notch en horizontal: el padding nunca baja del valor de diseño.
        paddingLeft: 'max(1.25rem, env(safe-area-inset-left))',
        paddingRight: 'max(1.25rem, env(safe-area-inset-right))',
      }}
    >
      <h2 id="mobile-prizes-title" className="display-title display-title--lg text-white pt-7">
        {t('zoidian.tabPrizes')}
      </h2>

      {/* Argus habla: pleca amarilla plana con su ojo, la misma del tutorial.
          Fill plano y texto negro — el contraste hace el trabajo, no un glow. */}
      <div className="mt-5 flex items-start gap-4 rounded-2xl bg-[#f5ff00] text-[#0a0510] px-4 py-4">
        <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
          <ArgusEye />
          <span className="display-title text-[1.05rem] leading-none">{t('zoidian.title')}</span>
        </div>
        <p className="font-semibold text-[0.9375rem] leading-snug">
          {PHONE_NOTICE[lang] || PHONE_NOTICE.es}
        </p>
      </div>

      <div className="mt-8 flex flex-col gap-8">
        <PrizeRow tier="gold" info={gold} lang={lang} t={t}>
          {/* Un talón por Golden del mes; los ganados quedan arrancados. */}
          {stockText && (
            <div className="mt-4">
              {goldCap > 0 && (
                <div className="ticket-stock" aria-hidden>
                  {Array.from({ length: goldCap }, (_, i) => (
                    <span key={i} className={`ticket-stock__stub ${i >= goldLeft ? 'ticket-stock__stub--taken' : ''}`} />
                  ))}
                </div>
              )}
              <p className={`text-sm font-bold mt-2.5 ${goldLeft > 0 ? 'text-[#FFC21A]' : 'text-white/60'}`}>
                {stockText}
              </p>
            </div>
          )}
        </PrizeRow>

        <div className="border-t-2 border-white/10" />

        <PrizeRow tier="silver" info={silver} lang={lang} t={t}>
          <p className="text-sm font-bold text-white/60 mt-4">{t('zoidian.noLimit')}</p>
        </PrizeRow>
      </div>

      <section aria-labelledby="mobile-prizes-rules" className="mt-8 pt-6 pb-7 border-t-2 border-white/10">
        <h3 id="mobile-prizes-rules" className="text-base font-bold text-white">{t('zoidian.rulesTitle')}</h3>
        <ul className="mt-3 space-y-2.5 list-disc pl-5 marker:text-white/30 text-white/70 text-[0.9375rem] leading-relaxed">
          {rules.map((line) => (<li key={line}>{line}</li>))}
        </ul>
      </section>
    </section>
  )
}
