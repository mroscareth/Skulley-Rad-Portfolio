import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ChevronDownIcon } from '@heroicons/react/24/solid'
import { useLanguage } from '../../i18n/LanguageContext.jsx'
import { sectionColors } from '../../lib/appHelpers.js'
import { useShopData } from '../../lib/shopDataContext.jsx'
import { useShopCartCtx } from '../../lib/shopCartContext.jsx'
import { addProductToCart } from '../../lib/addToCart.js'
import WorkCard, { transformApiProject } from '../work/WorkCard.jsx'
import BlogCard from '../blog/BlogCard.jsx'
import ProductCard from '../shop/ProductCard.jsx'
import { SOCIAL_LINKS } from '../NavOverlay.jsx'

// La home de teléfono: un scroll donde Skulley se desarma.
//
// Tres capas fijas, una encima de otra, y el documento scrollea por encima:
//
//   1. El color plano del fondo, que va cambiando al color de cada sección.
//   2. El canvas con el personaje (SkulleyFallRig) — ocupa la pantalla entera
//      y es el "lugar" donde pasa todo, no una ilustración al lado del texto.
//   3. Los beats: pantallas transparentes con el texto.
//
// El progreso del scroll (0 a 1) es el único motor. Se escribe en un ref y lo
// leen el canvas (por useFrame) y el fondo (por mutación directa de estilo).
// Nunca pasa por estado de React: a 60 fps eso remontaría el árbol completo.
//
// El relato: quién fue Skulley Rad (M.A.D.R.E.), y fuera de bromas, quién es
// Oscar. El rayo pega justo en ese beat — el personaje se rompe cuando aparece
// la persona. Después, una pantalla por sección con su texto corto y su botón.

const SkulleyFallRig = React.lazy(() => import('./SkulleyFallRig.jsx'))

// Lo último que Oscar subió: un proyecto, una entrada de Memorias y una pieza
// de la tienda, para la tarjeta de cada sección. Proyectos y piezas por id (el
// orden en que se crearon; el listado viene en el orden de display del CMS) y
// las entradas por fecha de publicación (un borrador viejo publicado hoy es lo
// último). Si algo falla, esa sección se queda sin tarjeta y nada más.
const masReciente = (lista, clave) => lista.reduce((a, x) => (!a || clave(x) > clave(a) ? x : a), null)

function useLoUltimo() {
  const [proyecto, setProyecto] = useState(null)
  const [post, setPost] = useState(null)
  const { products } = useShopData()

  useEffect(() => {
    let vivo = true
    fetch('/api/projects.php?active=1')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!vivo || !d?.ok || !Array.isArray(d.projects)) return
        const p = masReciente(d.projects, (x) => Number(x.id) || 0)
        if (p) setProyecto(transformApiProject(p))
      })
      .catch(() => { })
    fetch('/api/blog.php?limit=50')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!vivo || !d?.ok || !Array.isArray(d.posts)) return
        // MySQL da "YYYY-MM-DD HH:MM:SS": como texto ya ordena por fecha.
        setPost(masReciente(d.posts, (x) => String(x.published_at || x.created_at || '')))
      })
      .catch(() => { })
    return () => { vivo = false }
  }, [])

  // Solo lo que se vende en la región del visitante (useShopData ya filtra).
  const producto = useMemo(() => masReciente(products || [], (x) => Number(x.id) || 0), [products])

  return { proyecto, post, producto }
}

const nada = () => { }

// Tinta oscura del sitio: texto de los botones de color y tinta sobre neón.
const TINTA = '#0a0510'

// Cuánto oscurece el velo (tinta encima del personaje) en los dos primeros
// textos largos. Pedido de Oscar: que se lean mejor sin perder al personaje
// (0.55 se quedaba corto).
const VELO = 0.7

const clamp01 = (v) => Math.min(1, Math.max(0, v))

// El azul del home de escritorio (App.jsx, `sceneColor`: '#022dd6' es su
// baseBg). La home de teléfono arranca ahí y se va oscureciendo con el scroll
// hasta NOCHE, el casi-negro de la pantalla vacía donde cae el rayo.
const AZUL_HOME = '#022dd6'
const NOCHE = '#120a1e'

// ¿Texto negro o blanco encima? Luminancia relativa; los neones del sitio
// (#39ff14, #f5ff00) piden tinta oscura o se vuelven ilegibles.
function inkFor(hex) {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16) / 255
  const g = parseInt(h.slice(2, 4), 16) / 255
  const b = parseInt(h.slice(4, 6), 16) / 255
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
  return L > 0.42 ? TINTA : '#ffffff'
}

function mixHex(a, b, t) {
  const pa = a.replace('#', ''), pb = b.replace('#', '')
  const out = [0, 2, 4].map((i) => {
    const va = parseInt(pa.slice(i, i + 2), 16)
    const vb = parseInt(pb.slice(i, i + 2), 16)
    return Math.round(va + (vb - va) * t).toString(16).padStart(2, '0')
  })
  return `#${out.join('')}`
}

// Tope del cuerpo del título, en fracción del ancho de pantalla. Sin tope, una
// palabra corta ("WORK") se medía para llenar todo el ancho y quedaba de un
// tamaño absurdo; con él, los títulos cortos respiran.
const TOPE_TITULO = 0.3

/**
 * Cada título llena el ancho de su columna —con el padding del sitio, nunca
 * fuera de pantalla— midiendo la línea más larga con la fuente real.
 *
 * Antes era una fórmula (96vw / letras × 0.58) que suponía un ancho promedio
 * por letra de Luckiest Guy; con letras anchas se pasaba y "WORK" se salía
 * por la derecha. Ahora se mide la tinta de cada línea en un canvas 2D
 * (actualBoundingBox, que incluye lo que la letra sobresale de su avance) y se
 * escala para caber. Vuelve a medir al cargar la fuente y al cambiar el ancho.
 */
function useTitulosAjustados(scrollerRef, deps) {
  useLayoutEffect(() => {
    const raiz = scrollerRef.current
    if (!raiz) return undefined
    const ctx = document.createElement('canvas').getContext('2d')
    if (!ctx) return undefined
    let vivo = true

    const ajustar = () => {
      if (!vivo) return
      const tope = window.innerWidth * TOPE_TITULO
      raiz.querySelectorAll('.msh-title').forEach((h) => {
        const ancho = h.clientWidth
        if (!ancho) return
        ctx.font = `100px ${getComputedStyle(h).fontFamily}`
        let mayor = 1
        for (const linea of (h.dataset.texto || h.textContent || '').split('\n')) {
          const m = ctx.measureText(linea)
          const tinta = (m.actualBoundingBoxLeft || 0) + (m.actualBoundingBoxRight || 0)
          mayor = Math.max(mayor, tinta, m.width)
        }
        // 0.97: margen para el redondeo del navegador al pintar.
        h.style.fontSize = `${Math.min(tope, (ancho / mayor) * 100 * 0.97)}px`
      })
    }

    ajustar()
    document.fonts?.ready?.then(() => ajustar())
    window.addEventListener('resize', ajustar)
    return () => {
      vivo = false
      window.removeEventListener('resize', ajustar)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

// Los beats, en orden de bajada. section6 (SKULLEYGLYPH) no está: su puerta es
// el portal del juego, que en teléfono no existe.
//
// El texto sale del copy que ya existe y aprobó Oscar: la historia es la del
// preloader (`pre.p1`, `pre.p2`); "fuera de bromas" es `about.p2` (la versión
// en inglés, en primera persona, que en español estaba en tercera); los textos
// de cada sección son sus descripciones de page-prerender.php, y la tienda
// conserva el chiste de WelcomeNote.
function buildBeats(lang, t) {
  const es = lang === 'es'
  return [
    {
      key: 'hero',
      kind: 'hero',
      bg: AZUL_HOME,
      title: 'SKULLEY\nRAD',
      sub: es ? 'El último diseñador de la humanidad' : 'The last designer of humankind',
      // "Desliza" y no "haz scroll": es lo que se dice en un teléfono.
      hint: es ? 'Desliza para leer más' : 'Scroll to read more',
    },
    {
      key: 'historia',
      kind: 'story',
      bg: '#120a1e',
      title: es ? 'EL ÚLTIMO\nDISEÑADOR' : 'THE LAST\nDESIGNER',
      // El segundo párrafo es el de `pre.p2` (el preloader de escritorio), con
      // M.A.D.R.E. presentándose como la superinteligencia artificial que
      // construyó el mausoleo (redacción de Oscar para esta versión). En
      // escritorio sigue el original.
      body: [
        t('pre.p1'),
        es
          ? 'Soy M.A.D.R.E., la superinteligencia artificial que construyó este mausoleo digital para honrarlo — un lugar de archivos perdidos y memorias fracturadas, donde aún persisten su oficio y los hermosos errores de su mente humana.'
          : 'I am M.A.D.R.E., the artificial superintelligence that built this digital mausoleum to honor him — a place of lost files and fractured memories, where his craft and the beautiful errors of his human mind still linger.',
      ],
    },
    {
      key: 'oscar',
      kind: 'oscar',
      bg: TINTA,
      section: 'section2',
      title: es ? 'FUERA DE\nBROMAS' : 'JOKES\nASIDE',
      body: [es
        ? 'Me llamo Oscar Moctezuma Rodríguez: diseñador creativo, frontend developer y artista 3D en Monterrey, México. Con mi hermano fundé The Heritage Design, un estudio que ha colaborado con marcas como Valve, Koto Studio y Pinturas Berel.'
        : 'My name is Oscar Moctezuma Rodríguez, a creative designer, frontend developer and 3D artist working from Monterrey, Mexico. With my brother I co-founded The Heritage Design, a studio that has collaborated with brands like Valve, Koto Studio and Pinturas Berel.'],
      cta: es ? 'Sobre mí' : 'About me',
    },
    {
      // Una pantalla sin texto: es donde se ve el desarme después del rayo.
      // Antes llevaba el aviso de computadora; Oscar lo movió a la tienda y
      // pidió conservar el espacio.
      key: 'pausa',
      kind: 'pausa',
      bg: NOCHE,
    },
    {
      key: 'section1',
      kind: 'section',
      section: 'section1',
      bg: sectionColors.section1,
      title: t('nav.section1'),
      body: [es
        ? 'Identidad de marca, arte 3D, diseño de personajes y web interactiva, hechos para marcas y agencias.'
        : 'Brand identity, 3D art, character design and interactive web, made for brands and agencies.'],
      cta: es ? 'Ver todos los proyectos' : 'View all projects',
    },
    {
      key: 'section3',
      kind: 'section',
      section: 'section3',
      bg: sectionColors.section3,
      title: t('nav.section3'),
      body: [
        es
          ? 'Estamos vendiendo todo lo que tuvo, para financiar un nuevo data center en la luna.'
          : 'We are selling everything he owned, to fund a new data center on the moon.',
        // Pedido de Oscar: que quien llega por teléfono sepa que los
        // descuentos se ganan jugando, y que el juego está en computadora.
        es
          ? 'Para ganar descuentos, juega en la versión de computadora: un boleto Silver vale 10 % y uno Golden, 35 %.'
          : 'To win discounts, play the game on the computer version: a Silver ticket is worth 10% off and a Golden one, 35%.',
      ],
      cta: es ? 'Ver toda la tienda' : 'View the whole store',
    },
    {
      key: 'section5',
      kind: 'section',
      section: 'section5',
      bg: sectionColors.section5,
      title: t('nav.section5'),
      body: [es
        ? 'Textos sobre práctica de diseño, arte 3D, dirección creativa y trabajar junto a la IA.'
        : 'Writing on design practice, 3D art, creative direction and working alongside AI.'],
      cta: es ? 'Ver todas las memorias' : 'View all memories',
    },
    {
      key: 'section4',
      kind: 'section',
      section: 'section4',
      bg: sectionColors.section4,
      title: t('nav.section4'),
      body: [es
        ? 'Disponible para proyectos de marca, 3D e interactivos. Desde Monterrey, México, para todo el mundo.'
        : 'Available for brand, 3D and interactive projects. Based in Monterrey, Mexico, working worldwide.'],
      cta: es ? 'Escríbeme' : 'Get in touch',
    },
  ]
}

export default function MobileScrollHome({ onGoToSection, onOpenPiece }) {
  const { lang, setLang, t } = useLanguage()
  const scrollerRef = useRef(null)
  const bgRef = useRef(null)
  const flashRef = useRef(null)
  const progressRef = useRef(0)
  const rafRef = useRef(0)
  const veloRef = useRef(null)
  // Cuándo se dibuja y cuándo pega el rayo, en progreso 0–1, medido del DOM
  // en cada scroll (las tarjetas cambian el alto de la página al llegar).
  const timingRef = useRef({ hit: null, draw: null })

  // El flash del impacto del rayo. Es el de escritorio (App.jsx, `bolt-strike`):
  // blanco en `screen`, a 0.92. Se reinicia la animación quitando y poniendo
  // la clase; el reflow de en medio es lo que la hace arrancar de cero si el
  // rayo vuelve a pegar (subiste y bajaste otra vez).
  const onStrike = useCallback(() => {
    const el = flashRef.current
    if (!el) return
    el.classList.remove('is-on')
    void el.offsetWidth
    el.classList.add('is-on')
  }, [])

  const beats = useMemo(() => buildBeats(lang, t), [lang, t])
  // El footer cierra la escala de color: vuelve al casi-negro del sitio, que es
  // donde aterrizan los huesos.
  const stops = useMemo(() => [...beats.map((b) => b.bg), TINTA], [beats])

  useTitulosAjustados(scrollerRef, [lang])
  const ultimo = useLoUltimo()
  const cart = useShopCartCtx()

  // El aviso del hero también se puede tocar: baja una pantalla. Sin animación
  // de scroll si el sistema pide movimiento reducido.
  const bajarUno = useCallback(() => {
    const el = scrollerRef.current
    if (!el) return
    let quieto = false
    try { quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { }
    el.scrollBy({ top: el.clientHeight * 0.9, behavior: quieto ? 'auto' : 'smooth' })
  }, [])

  const onScroll = useCallback(() => {
    if (rafRef.current) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0
      const el = scrollerRef.current
      if (!el) return
      const max = Math.max(1, el.scrollHeight - el.clientHeight)
      progressRef.current = Math.min(1, Math.max(0, el.scrollTop / max))

      // El color lo manda el beat que está en el CENTRO de la pantalla, medido
      // en el DOM. Antes se repartía el progreso en partes iguales, pero los
      // beats no miden lo mismo (el footer es más bajo) y el color se iba
      // adelantando: en MEMORIES ya estaba el amarillo de CONTACT.
      const bloques = el.querySelectorAll('.msh-beat, .msh-footer')
      const centro = el.scrollTop + el.clientHeight / 2
      let i = 0
      for (let k = 0; k < bloques.length; k++) {
        if (bloques[k].offsetTop <= centro) i = k
      }
      const b = bloques[i]
      const local = b ? (centro - b.offsetTop) / Math.max(1, b.offsetHeight) : 0

      // Cambio corto, solo en la frontera entre dos beats (±10 %): color plano
      // casi todo el tiempo. Entre dos colores opuestos —el verde de About y el
      // magenta de la tienda— la mezcla es gris, y con el reparto anterior el
      // fondo se quedaba en ese gris media pantalla.
      let color = stops[Math.min(i, stops.length - 1)]
      if (local > 0.9 && i + 1 < stops.length) color = mixHex(stops[i], stops[i + 1], (local - 0.9) / 0.2)
      else if (local < 0.1 && i > 0) color = mixHex(stops[i - 1], stops[i], (local + 0.1) / 0.2)

      // El rayo y el velo se miden contra la pantalla vacía (la pausa) que
      // sigue a "Fuera de bromas". Ese texto deja la pantalla por arriba
      // cuando la pausa todavía asoma un 35 %: ahí empieza a dibujarse el
      // rayo, y pega cuando la pausa llena la vista. Así nada lo tapa.
      const H = el.clientHeight
      const st = el.scrollTop
      const historia = el.querySelector('[data-beat="historia"]')
      const pausa = el.querySelector('[data-beat="pausa"]')
      if (historia && pausa) {
        const T1 = historia.offsetTop
        const T3 = pausa.offsetTop
        const empiezaRayo = T3 - 0.35 * H
        timingRef.current.hit = Math.min(0.9, T3 / max)
        timingRef.current.draw = Math.max(0, empiezaRayo / max)
        // Hasta que empieza el rayo, el fondo no va por beats: baja continuo
        // del azul del home a la noche, como si oscureciera para la tormenta.
        if (st < empiezaRayo) {
          const u = clamp01(st / Math.max(1, empiezaRayo))
          color = mixHex(AZUL_HOME, NOCHE, u * u * (3 - 2 * u))
        }
        // Velo oscuro sobre el personaje mientras se leen "El último
        // diseñador" y "Fuera de bromas": entra con el primero y se va antes
        // de que el rayo empiece a dibujarse.
        const entra = clamp01((st - (T1 - 0.8 * H)) / (0.5 * H))
        const sale = clamp01((st - (T3 - 0.65 * H)) / (0.3 * H))
        if (veloRef.current) veloRef.current.style.opacity = String(VELO * entra * (1 - sale))
      }
      // Mutación directa de estilo, igual que el disco del reproductor.
      if (bgRef.current) bgRef.current.style.backgroundColor = color
    })
  }, [stops])

  useEffect(() => {
    onScroll()
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [onScroll])

  return (
    <div className="msh-root">
      <div ref={bgRef} className="msh-bg" style={{ backgroundColor: stops[0] }} />

      <React.Suspense fallback={null}>
        <div className="msh-stage">
          <SkulleyFallRig progressRef={progressRef} timingRef={timingRef} onStrike={onStrike} />
        </div>
      </React.Suspense>

      {/* Entre el personaje y el texto: oscurece fondo y personaje mientras se
          leen los dos primeros textos largos. Lo mueve onScroll. */}
      <div ref={veloRef} className="msh-velo" aria-hidden="true" />

      <div ref={scrollerRef} className="msh-scroller" onScroll={onScroll}>
        {beats.map((b) => {
          const ink = inkFor(b.bg)
          // Botón de sección (DESIGN.md §4.2, "primary de sección"): fill del
          // color de la sección con texto en tinta. Cuando el FONDO del beat ya
          // es ese color, el botón desaparecería sobre él, así que se invierte:
          // fill de tinta con el texto del color. Mismo par, contraste máximo.
          const acento = b.section ? sectionColors[b.section] : null
          const sobreColor = acento && acento.toLowerCase() === b.bg.toLowerCase()
          return (
            <section key={b.key} data-beat={b.key} className={`msh-beat msh-beat--${b.kind}`} style={{ color: ink }}>
              {/* Idioma: el control segmentado del preloader (una píldora
                  EN | ES) sobre el glass del botón flotante (§6.1), porque cae
                  encima del personaje. Por el glass el texto apagado va en /70
                  y no en /60 (§6.1). Vive en el hero y se va con él al
                  scrollear. */}
              {b.kind === 'hero' && (
                <div
                  className="msh-lang inline-flex h-11 p-1 rounded-full border-2 border-white/20 bg-black/40 backdrop-blur-xl"
                  role="group"
                  aria-label={t('common.switchLanguage')}
                >
                  {['en', 'es'].map((code) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => setLang(code)}
                      aria-pressed={lang === code}
                      className={`h-full min-w-[3.25rem] px-4 rounded-full text-xs font-bold uppercase tracking-[0.16em] inline-flex items-center justify-center transition-colors ${lang === code
                        ? 'bg-white text-black'
                        : 'text-white/70 hover:text-white'
                        }`}
                    >{code.toUpperCase()}</button>
                  ))}
                </div>
              )}
              {b.title && <h2 className="msh-title" data-texto={b.title}>{b.title}</h2>}

              {b.sub && <p className="msh-sub">{b.sub}</p>}

              {b.hint && (
                <button type="button" className="msh-scroll-hint" onClick={bajarUno}>
                  <span className="msh-scroll-hint__flechas" aria-hidden="true">
                    {[0, 1, 2].map((i) => <ChevronDownIcon key={i} style={{ '--i': i }} />)}
                  </span>
                  {b.hint}
                </button>
              )}

              {b.body && (
                <div className="msh-copy">
                  {b.body.filter(Boolean).map((parrafo, i) => <p key={i}>{parrafo}</p>)}
                </div>
              )}

              {/* La tarjeta de lo último, la misma de cada sección. Tocarla
                  abre esa pieza dentro de su sección. */}
              {b.section === 'section1' && ultimo.proyecto && (
                <div className="msh-pieza">
                  <WorkCard
                    item={ultimo.proyecto}
                    idx={0}
                    onEnter={nada}
                    onMove={nada}
                    onLeave={nada}
                    setHoveredIdx={nada}
                    hideImage={false}
                    onOpenDetail={(slug) => onOpenPiece?.('section1', slug)}
                  />
                </div>
              )}
              {b.section === 'section3' && ultimo.producto && (
                <div className="msh-pieza">
                  {/* Agregar hace lo mismo que en la tienda (Shop.handleAdd):
                      con talla o color abre la ficha para escoger; si no, va
                      directo al carrito. */}
                  <ProductCard
                    product={ultimo.producto}
                    lang={lang}
                    onInspect={(p) => onOpenPiece?.('section3', p.handle)}
                    onAdd={(p) => (p.hasOptions ? onOpenPiece?.('section3', p.handle) : addProductToCart(cart, p))}
                  />
                </div>
              )}
              {b.section === 'section5' && ultimo.post && (
                <div className="msh-pieza">
                  <BlogCard post={ultimo.post} onSelect={(p) => onOpenPiece?.('section5', p.slug)} />
                </div>
              )}

              {b.cta && (
                <div className="msh-actions">
                  <button
                    type="button"
                    className={`shop-btn msh-btn ${sobreColor ? 'msh-btn--sobre-color' : 'msh-btn--seccion'}`}
                    style={{ '--msh-acento': acento }}
                    onClick={() => onGoToSection?.(b.section)}
                  >
                    {b.cta}
                  </button>
                </div>
              )}
            </section>
          )
        })}

        <footer className="msh-footer">
          <h2 className="msh-title msh-title--footer" data-texto={lang === 'es' ? 'AQUÍ\nTERMINA' : 'THIS IS\nTHE END'}>
            {lang === 'es' ? 'AQUÍ\nTERMINA' : 'THIS IS\nTHE END'}
          </h2>
          <p className="msh-footer-line">
            {lang === 'es'
              ? 'Pero puedes seguir lo que hago día a día en mis redes.'
              : 'But you can still follow my daily stuff on my social media.'}
          </p>
          {/* Las mismas redes y el mismo botón redondo del menú (NavOverlay). */}
          <ul className="msh-redes">
            {SOCIAL_LINKS.map((s) => (
              <li key={s.key}>
                <a
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-12 w-12 rounded-full bg-black/50 backdrop-blur-xl border border-white/[0.08] text-white hover:bg-white/[0.15] grid place-items-center shadow-elev-lg transition-colors"
                  aria-label={s.label}
                  title={s.label}
                >
                  <img src={s.icon} alt="" aria-hidden className="w-5 h-5 invert" draggable="false" />
                </a>
              </li>
            ))}
          </ul>
        </footer>
      </div>

      <div ref={flashRef} className="msh-flash" aria-hidden="true" />
    </div>
  )
}
