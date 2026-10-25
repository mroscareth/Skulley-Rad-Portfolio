import React, { useEffect, useMemo } from 'react'
import { ArrowLeftIcon } from '@heroicons/react/24/solid'
import { useLanguage } from '../../i18n/LanguageContext.jsx'
import { useShopData } from '../../lib/shopDataContext.jsx'
import { buildHelp } from './helpContent.js'

const FOCUS_RING = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e600ff] focus-visible:outline-offset-2'

/**
 * Página de ayuda de la tienda: /help (y /ayuda, que abre en español).
 *
 * Vive fuera de la escena 3D, como el CMS (App.jsx la monta sola), para que se
 * pueda enlazar desde los correos, desde Stripe o compartir, y para que cargue
 * rápido en cualquier celular. Es lo que la LFPC (art. 76 bis) pide informar
 * antes de comprar: pagos, envíos, devoluciones, garantías y contacto.
 *
 * Lenguaje de la tienda (DESIGN.md §14): display para el título, Outfit para
 * el texto, magenta solo como acento y secciones separadas por divisor, sin
 * cajas. El contenido vive en helpContent.js; lo que cambia en el CMS (envíos,
 * tickets) llega en vivo del catálogo.
 */
export default function HelpCenter() {
  const { lang, setLang } = useLanguage()
  const { tickets, regions, formatPrice } = useShopData()

  // /ayuda o ?lang=es abren en español; ?lang=en en inglés. Si no, el idioma
  // que la persona ya usa en el sitio.
  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get('lang')
    if (param === 'es' || param === 'en') setLang(param)
    else if (window.location.pathname.replace(/\/+$/, '') === '/ayuda') setLang('es')
  }, [setLang])

  const c = useMemo(() => buildHelp(lang, { tickets }), [lang, tickets])

  useEffect(() => {
    const prev = document.title
    document.title = lang === 'es' ? 'Ayuda — Tiendita | Skulley Rad' : 'Help — Store | Skulley Rad'
    return () => { document.title = prev }
  }, [lang])

  // Un enlace con #returns (desde el carrito, el correo…) llega a su sección.
  // Se espera un cuadro: el contenido se pinta después del primer render.
  useEffect(() => {
    const id = window.location.hash.slice(1)
    if (!id) return undefined
    const raf = requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView())
    return () => cancelAnimationFrame(raf)
  }, [])

  const shippingRows = (regions || []).flatMap((r) => (r.rates || []).map((rate, i) => ({
    key: `${r.code}-${i}`,
    zone: lang === 'es' ? (r.name_es || r.name_en) : (r.name_en || r.name_es),
    method: lang === 'es' ? (rate.name_es || rate.name_en || rate.name) : (rate.name_en || rate.name_es || rate.name),
    cost: formatPrice(Number(rate.amount), r.currency),
    min: Number(rate.min_days) || null,
    max: Number(rate.max_days) || null,
    first: i === 0,
  })))
  const freeNotes = (regions || []).filter((r) => Number(r.free_over) > 0).map((r) => ({
    key: r.code,
    text: `${lang === 'es' ? (r.name_es || r.name_en) : (r.name_en || r.name_es)}: ${c.shippingTable.free(formatPrice(Number(r.free_over), r.currency))}`,
  }))

  return (
    <div className="h-full overflow-y-auto bg-[#0a0510] text-white">
      <header className="sticky top-0 z-10 bg-[#0a0510]/90 backdrop-blur-md border-b-2 border-white/10">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between gap-4">
          <a
            href="/lost-and-found-shop"
            className={`inline-flex items-center gap-2 min-h-[44px] -ml-2 px-2 rounded-full text-sm font-semibold text-white/80 hover:text-white transition-colors ${FOCUS_RING}`}
          >
            <ArrowLeftIcon className="w-4 h-4" aria-hidden />
            {c.back}
          </a>
          <div className="flex gap-2" role="group" aria-label={lang === 'es' ? 'Idioma' : 'Language'}>
            {['es', 'en'].map((l) => (
              <button
                key={l}
                type="button"
                aria-pressed={lang === l}
                onClick={() => setLang(l)}
                className={`shop-chip min-h-[40px] px-4 text-[11px] ${FOCUS_RING}`}
              >
                {l === 'es' ? 'Español' : 'English'}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-5 sm:px-8 pt-12 sm:pt-16 pb-24">
        <h1 className="shop-display shop-display--lg">{c.title}</h1>
        <p className="text-white/75 text-lg leading-relaxed max-w-2xl mt-4">{c.subtitle}</p>
        <p className="text-sm text-white/45 mt-2">{c.updated}</p>

        {/* Lo esencial: las cinco reglas que más cambian la decisión, a la
            vista antes de leer nada (H06). Divisores, no tarjetas. */}
        <section aria-labelledby="help-essentials" className="mt-10 py-6 border-y-2 border-white/10">
          <h2 id="help-essentials" className="text-sm font-bold text-white/60 mb-4">{c.summaryTitle}</h2>
          <dl className="grid grid-cols-2 lg:grid-cols-5 gap-x-6 gap-y-5">
            {c.summary.map(([k, v]) => (
              <div key={k} className="min-w-0 lg:pl-6 lg:border-l-2 lg:border-white/10 lg:first:pl-0 lg:first:border-l-0">
                <dt className="text-sm text-white/55">{k}</dt>
                <dd className="text-base font-bold text-white mt-1 leading-snug">{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        <div className="mt-10 lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-14">
          <nav aria-label={c.tocLabel} className="mb-10 lg:mb-0">
            <div className="lg:sticky lg:top-24">
              <p className="text-sm font-bold text-white/60 mb-3">{c.tocLabel}</p>
              <ul className="flex flex-wrap gap-2 lg:flex-col lg:gap-1">
                {c.sections.map((s) => (
                  <li key={s.id}>
                    <a
                      href={`#${s.id}`}
                      className={`inline-flex items-center min-h-[40px] px-4 lg:px-3 rounded-full border-2 border-white/12 lg:border-0 text-sm text-white/70 hover:text-white hover:bg-white/[0.06] transition-colors ${FOCUS_RING}`}
                    >
                      {s.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </nav>

          <div className="min-w-0 max-w-3xl">
            {c.sections.map((s, si) => (
              <section
                key={s.id}
                id={s.id}
                aria-labelledby={`${s.id}-title`}
                className={`scroll-mt-24 ${si > 0 ? 'mt-14 pt-12 border-t-2 border-white/10' : ''}`}
              >
                <h2 id={`${s.id}-title`} className="text-2xl sm:text-3xl font-bold text-white">{s.title}</h2>
                <div className="mt-2">
                  {s.items.map((it) => (
                    <div key={it.q} className="py-5 border-b border-white/10 last:border-b-0">
                      <h3 className="text-lg font-semibold text-white">{it.q}</h3>
                      {(it.a || []).map((p, i) => (
                        <p key={i} className="text-white/75 text-[0.9375rem] sm:text-base leading-relaxed mt-2">{p}</p>
                      ))}
                      {it.steps && (
                        <ol className="mt-3 space-y-2 list-decimal pl-5 marker:text-white/40 marker:font-bold text-white/75 text-[0.9375rem] sm:text-base leading-relaxed">
                          {it.steps.map((st) => <li key={st} className="pl-1">{st}</li>)}
                        </ol>
                      )}
                      {it.table === 'shipping' && shippingRows.length > 0 && (
                        <div className="mt-4 overflow-x-auto">
                          <table className="w-full min-w-[30rem] text-left text-sm">
                            <thead>
                              <tr className="border-b-2 border-white/10 text-white/55">
                                <th scope="col" className="py-2.5 pr-4 font-semibold">{c.shippingTable.zone}</th>
                                <th scope="col" className="py-2.5 pr-4 font-semibold">{c.shippingTable.method}</th>
                                <th scope="col" className="py-2.5 pr-4 font-semibold">{c.shippingTable.cost}</th>
                                <th scope="col" className="py-2.5 font-semibold">{c.shippingTable.transit}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {shippingRows.map((r) => (
                                <tr key={r.key} className="border-b border-white/10">
                                  <td className="py-3 pr-4 font-semibold text-white">{r.first ? r.zone : ''}</td>
                                  <td className="py-3 pr-4 text-white/80">{r.method}</td>
                                  <td className="py-3 pr-4 text-white/80 tabular-nums whitespace-nowrap">{r.cost}</td>
                                  <td className="py-3 text-white/80 whitespace-nowrap">{r.min || r.max ? c.shippingTable.days(r.min || r.max, r.max || r.min) : '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {freeNotes.map((n) => (
                            <p key={n.key} className="text-sm text-white/60 mt-3">{n.text}</p>
                          ))}
                        </div>
                      )}
                      {it.cta && (
                        <a href={it.cta.href} className={`shop-btn shop-btn--primary inline-flex min-h-[44px] px-6 text-xs mt-4 ${FOCUS_RING}`}>
                          {it.cta.label}
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
