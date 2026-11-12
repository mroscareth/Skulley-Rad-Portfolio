import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ChevronDownIcon, ForwardIcon, PlayIcon, SpeakerWaveIcon, SpeakerXMarkIcon } from '@heroicons/react/24/solid'
import { useLanguage } from '../../i18n/LanguageContext.jsx'
import { sectionColors } from '../../lib/appHelpers.js'
import { useShopData } from '../../lib/shopDataContext.jsx'
import { useShopCartCtx } from '../../lib/shopCartContext.jsx'
import { addProductToCart } from '../../lib/addToCart.js'
import WorkCard, { transformApiProject } from '../work/WorkCard.jsx'
import BlogCard from '../blog/BlogCard.jsx'
import ProductCard from '../shop/ProductCard.jsx'
import { SOCIAL_LINKS } from '../NavOverlay.jsx'
import MobileCustomizer from './MobileCustomizer.jsx'
import GlitchName, { GLITCH_NAME_WORDS } from '../GlitchName.jsx'
import useTitulosAjustados from '../../hooks/useTitulosAjustados.js'
import useHistoriaMadre from '../../hooks/useHistoriaMadre.js'
import SubtituloMadre from '../SubtituloMadre.jsx'
import { OSCURO, TOMAS_TELEFONO } from '../../lib/historiaMadre.js'

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
// El relato: Skulley Rad te cuenta quién es y quién lo inventó (Oscar). El
// rayo pega al terminar ese beat — el personaje se rompe cuando aparece la
// persona. Después, una pantalla por sección con su texto corto y su botón.

const SkulleyFallRig = React.lazy(() => import('./SkulleyFallRig.jsx'))

// "Conocer la historia": alto de cada barra de cine, en fracción de la
// pantalla (= --dsp-barra de .msh-root). Más alta que en escritorio: en un
// teléfono el subtítulo ocupa hasta tres renglones.
const BARRA_HISTORIA = 0.14

// Lo último que Oscar subió, hasta 4 de cada sección (proyectos, entradas de
// Memorias y piezas de la tienda), para el carrusel de cada una. Proyectos y
// piezas por id (el orden en que se crearon; el listado viene en el orden de
// display del CMS) y las entradas por fecha de publicación (un borrador viejo
// publicado hoy es lo último). Si algo falla, esa sección se queda sin
// carrusel y nada más.
const POR_SECCION = 4
const masRecientes = (lista, clave) =>
  [...lista].sort((a, b) => (clave(b) > clave(a) ? 1 : clave(b) < clave(a) ? -1 : 0)).slice(0, POR_SECCION)

// Lo último ya cargado, para la próxima vez que se monte la home (se desmonta
// al entrar a un capítulo): así los carruseles están desde el primer cuadro y
// la página mide lo mismo cuando se regresa a donde ibas.
const ultimoCargado = { proyectos: null, posts: null }

function useLoUltimo() {
  const [proyectos, setProyectos] = useState(() => ultimoCargado.proyectos || [])
  const [posts, setPosts] = useState(() => ultimoCargado.posts || [])
  const { products } = useShopData()

  useEffect(() => {
    let vivo = true
    fetch('/api/projects.php?active=1')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!vivo || !d?.ok || !Array.isArray(d.projects)) return
        ultimoCargado.proyectos = masRecientes(d.projects, (x) => Number(x.id) || 0).map(transformApiProject)
        setProyectos(ultimoCargado.proyectos)
      })
      .catch(() => { })
    fetch('/api/blog.php?limit=50')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!vivo || !d?.ok || !Array.isArray(d.posts)) return
        // MySQL da "YYYY-MM-DD HH:MM:SS": como texto ya ordena por fecha.
        ultimoCargado.posts = masRecientes(d.posts, (x) => String(x.published_at || x.created_at || ''))
        setPosts(ultimoCargado.posts)
      })
      .catch(() => { })
    return () => { vivo = false }
  }, [])

  // Solo lo que se vende en la región del visitante (useShopData ya filtra).
  const productos = useMemo(() => masRecientes(products || [], (x) => Number(x.id) || 0), [products])

  return { proyectos, posts, productos }
}

// El carrusel de cada sección: scroll horizontal nativo con snap, así el
// arrastre con el dedo, la inercia y el rebote los pone el sistema (nada de JS
// de gestos peleándose con el scroll vertical de la página). La pista se sale
// a los márgenes de la pantalla para que asome la siguiente tarjeta: eso es lo
// que dice "esto se desliza". Los puntos dicen en cuál vas y también llevan a
// cada una.
function Carrusel({ items, llave, etiqueta, lang, render }) {
  const pistaRef = useRef(null)
  const rafRef = useRef(0)
  const [actual, setActual] = useState(0)
  const es = lang === 'es'
  const n = items.length

  const onScroll = useCallback(() => {
    if (rafRef.current) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0
      const pista = pistaRef.current
      const primera = pista?.children[0]
      const segunda = pista?.children[1]
      if (!primera || !segunda) return
      const paso = segunda.offsetLeft - primera.offsetLeft
      const i = Math.round(pista.scrollLeft / Math.max(1, paso))
      setActual(Math.min(n - 1, Math.max(0, i)))
    })
  }, [n])

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }, [])

  const irA = (i) => {
    const pista = pistaRef.current
    if (!pista?.children[i]) return
    let quieto = false
    try { quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { }
    pista.scrollTo({
      left: pista.children[i].offsetLeft - pista.children[0].offsetLeft,
      behavior: quieto ? 'auto' : 'smooth',
    })
  }

  if (!n) return null
  return (
    <div className="msh-pieza" role="region" aria-roledescription={es ? 'carrusel' : 'carousel'} aria-label={etiqueta}>
      <div ref={pistaRef} className="msh-carrusel" onScroll={onScroll}>
        {items.map((item, i) => (
          <div
            key={llave(item, i)}
            className="msh-carrusel__slide"
            role="group"
            aria-roledescription={es ? 'tarjeta' : 'slide'}
            aria-label={es ? `${i + 1} de ${n}` : `${i + 1} of ${n}`}
          >
            {render(item, i)}
          </div>
        ))}
      </div>
      {n > 1 && (
        <div className="msh-carrusel__puntos">
          {items.map((item, i) => (
            <button
              key={llave(item, i)}
              type="button"
              className={`msh-carrusel__punto ${i === actual ? 'is-actual' : ''}`}
              aria-label={es ? `Ver la ${i + 1} de ${n}` : `Show ${i + 1} of ${n}`}
              aria-current={i === actual ? 'true' : undefined}
              onClick={() => irA(i)}
            />
          ))}
        </div>
      )}
    </div>
  )
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

// Título y texto de los beats, en blanco (Oscar, 2026-10-30), salvo Contacto:
// sobre su amarillo #f5ff00 el blanco no se lee y ahí va la tinta oscura.
// En qué parte del tramo quieto del final entra el pie, y por debajo de cuál
// se va otra vez (ver onScroll).
const PIE_ENTRA = 0.95
const PIE_SALE = 0.85

// Al salir de Personalizar (ver "De regreso a la home"). Lo que tarda el panel
// en irse (.mcz-panel); el respiro entre que Skulley llega y entra la home, que
// además cubre el golpe por reloj (GOLPE_S en el rig) si iba apenas pasado el
// rayo; el tope de la espera; y lo que dura la entrada (.is-entrando).
const REGRESO_PANEL_MS = 260
const REGRESO_RESPIRO_MS = 400
const REGRESO_TOPE_MS = 6000
const ENTRADA_MS = 1000

const TEXTO = '#ffffff'
const textoDe = (b) => (b.section === 'section4' ? TINTA : TEXTO)

function mixHex(a, b, t) {
  const pa = a.replace('#', ''), pb = b.replace('#', '')
  const out = [0, 2, 4].map((i) => {
    const va = parseInt(pa.slice(i, i + 2), 16)
    const vb = parseInt(pb.slice(i, i + 2), 16)
    return Math.round(va + (vb - va) * t).toString(16).padStart(2, '0')
  })
  return `#${out.join('')}`
}

// Cuánto se queda SKULLEY RAD en runas antes de empezar a traducirse.
const TITULO_EN_RUNAS_MS = 900

// Los beats, en orden de bajada. section6 (SKULLEYGLYPH) no está: su puerta es
// el portal del juego, que en teléfono no existe.
//
// En estas pantallas el que habla es Skulley Rad (decisión de Oscar,
// 2026-11-03); M.A.D.R.E. solo cuenta "Conocer la historia", desde la primera
// (Oscar, 2026-11-11). La historia es una sola pantalla con texto de Oscar; los textos
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
      // Antes eran dos pantallas, "El último diseñador" (con M.A.D.R.E.) y
      // "Fuera de bromas" (Oscar en primera persona); Oscar las unió en una,
      // con Skulley hablando. Quién es Oscar lo cuenta el About (el botón
      // lleva ahí); el rayo pega en cuanto termina esta pantalla. La llave
      // sigue siendo 'historia' porque el rayo y el velo se miden con ella.
      key: 'historia',
      kind: 'story',
      bg: '#120a1e',
      section: 'section2',
      // El mismo título que la sección About: el home es de Skulley y el
      // About ya aclara quién es Oscar.
      title: t('nav.section2'),
      body: es
        ? [
          'Skulley Rad, ese soy yo. Tal vez te preguntes cómo es que llegué a verme de esta manera tan decrépita.',
          'Todo comenzó cuando las máquinas se quedaron con todo el jale creativo, me despidieron de mi trabajo y me morí de hambre. Así de sencillo, pero este sitio no es completamente sobre mí, hay alguien al que deberías de conocer...',
        ]
        : [
          'Skulley Rad, that’s me. You might be wondering how I ended up looking this decrepit.',
          'It all started when the machines took over all the creative work, I got fired from my job and I starved to death. Simple as that. But this site isn’t entirely about me: there’s someone you should meet...',
        ],
      cta: es ? 'Seguir leyendo' : 'Keep reading',
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

export default function MobileScrollHome({ onGoToSection, onOpenPiece, audioElegido = true, onElegirAudio, scrollInicial = 0, saltarHistoria = false, onSalir, personalizando = false, regresando = false, onCerrarPersonalizar, onHomeDeVuelta, onHistoria }) {
  const { lang, t } = useLanguage()
  const scrollerRef = useRef(null)
  const bgRef = useRef(null)
  const flashRef = useRef(null)
  const progressRef = useRef(0)
  const rafRef = useRef(0)
  const veloRef = useRef(null)
  // Cuándo se dibuja y cuándo pega el rayo, en progreso 0–1, medido del DOM
  // en cada scroll (las tarjetas cambian el alto de la página al llegar).
  const timingRef = useRef({ hit: null, draw: null })
  // SKULLEY RAD llega escrito en runas, como en el preloader de escritorio
  // (pedido de Oscar, 2026-11-10), solo al llegar: antes de elegir audio. De
  // regreso de una sección la home se vuelve a montar y ya no se repite.
  const [runasTitulo] = useState(() => (audioElegido ? 0 : TITULO_EN_RUNAS_MS))

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

  // El aviso del hero también se puede tocar: lleva a la pantalla que sigue
  // con su contenido (título, texto y botón) centrado en vertical. Antes
  // bajaba un 90 % de pantalla a ciegas y la dejaba cortada. Sin animación de
  // scroll si el sistema pide movimiento reducido.
  const bajarUno = useCallback((e) => {
    const el = scrollerRef.current
    if (!el) return
    let quieto = false
    try { quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { }
    const behavior = quieto ? 'auto' : 'smooth'
    const pantallas = [...el.querySelectorAll('[data-beat]')]
    const siguiente = pantallas[pantallas.indexOf(e?.currentTarget?.closest('[data-beat]')) + 1]
    const hijos = siguiente ? [...siguiente.children] : []
    if (!hijos.length) {
      el.scrollBy({ top: el.clientHeight * 0.9, behavior })
      return
    }
    const arriba = Math.min(...hijos.map((h) => h.getBoundingClientRect().top))
    const abajo = Math.max(...hijos.map((h) => h.getBoundingClientRect().bottom))
    const caja = el.getBoundingClientRect()
    const centro = caja.top + el.clientHeight / 2
    el.scrollTo({ top: Math.max(0, el.scrollTop + (arriba + abajo) / 2 - centro), behavior })
  }, [])

  // Dónde iba el scroll, para regresar ahí después de un capítulo (ver abajo).
  const ultimoScroll = useRef(scrollInicial)

  const onScroll = useCallback(() => {
    if (scrollerRef.current) ultimoScroll.current = scrollerRef.current.scrollTop
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
      // sigue a la historia. Ese texto deja la pantalla por arriba
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
        // Desde dónde el pie se queda quieto: ese tramo es el final de la
        // cabeza en el rig.
        const fin = el.querySelector('.msh-fin')
        if (fin) timingRef.current.fin = fin.offsetTop / max
        // El hueco libre del pie para la cabeza, en fracción del alto de la
        // pantalla (el pie mide una pantalla y ahí se queda quieto).
        const arriba = el.querySelector('.msh-footer-arriba')
        const redes = el.querySelector('.msh-redes')
        const pie = el.querySelector('.msh-footer')
        if (arriba && redes && pie && pie.clientHeight) {
          timingRef.current.huecoFinal = {
            arriba: (arriba.offsetTop + arriba.offsetHeight) / pie.clientHeight,
            abajo: redes.offsetTop / pie.clientHeight,
          }
        }
        // El pie (título, frase, redes) entra cuando termina lo de la cabeza:
        // el ojo deja de rodar hacia el 96 % del tramo quieto. Con margen de
        // regreso para que no parpadee en la orilla. Clase y no estado: esto
        // corre en cada scroll.
        if (fin && pie) {
          const enFin = (st - fin.offsetTop) / Math.max(1, max - fin.offsetTop)
          if (personalizaRef.current.sinHome) pie.classList.remove('is-visible')
          else if (enFin >= PIE_ENTRA) pie.classList.add('is-visible')
          else if (enFin < PIE_SALE) pie.classList.remove('is-visible')
        }
        // Hasta que empieza el rayo, el fondo no va por beats: baja continuo
        // del azul del home a la noche, como si oscureciera para la tormenta.
        if (st < empiezaRayo) {
          const u = clamp01(st / Math.max(1, empiezaRayo))
          color = mixHex(AZUL_HOME, NOCHE, u * u * (3 - 2 * u))
        }
        // Velo oscuro sobre el personaje mientras se lee la historia: entra
        // con ella y se va antes de que el rayo empiece a dibujarse.
        const entra = clamp01((st - (T1 - 0.8 * H)) / (0.5 * H))
        const sale = clamp01((st - (T3 - 0.65 * H)) / (0.3 * H))
        // Personalizando no hay nada que leer: el scroll tardío que deja iOS al
        // tocar justo después de deslizar lo regresaba con el panel abierto.
        if (veloRef.current && !personalizaRef.current.sinHome) veloRef.current.style.opacity = String(VELO * entra * (1 - sale))
      }
      // Mutación directa de estilo, igual que el disco del reproductor.
      // Personalizando manda el fondo del wallpaper (pintarFondo).
      if (bgRef.current && !personalizaRef.current.activo) bgRef.current.style.backgroundColor = color
    })
  }, [stops])

  useEffect(() => {
    onScroll()
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [onScroll])

  // ── Personalizar ───────────────────────────────────────────────────────
  // El rig arma a Skulley mezclando su progreso con 0 (SkulleyFallRig); la
  // página no se mueve mientras tanto. Al cerrar, el scroll es el mismo y la
  // historia regresa sola a donde iba. Por si el navegador lo movió al
  // bloquearlo, se guarda y se repone.
  // `fondo`: el azul de la primera escena, el fondo de wallpaper de quien no ha
  // elegido otro. `wall`: el marco del wallpaper; `marco`: dónde cae, lo mide el
  // personalizador; `plano`: un atajo de encuadre por aplicar; `quieto`: Skulley
  // en la pose del archivo; `captura`: el pedido en curso. Los tres últimos los
  // atiende el rig. `sinHome`: el texto y el velo están fuera. `alRegresar`: lo
  // llama el rig cuando Skulley llegó a donde iba.
  const personalizaRef = useRef({ activo: false, sinHome: false, alRegresar: null, giro: 0, giroVisto: 0, vel: 0, arrastrando: false, zoom: 1, panX: 0, panY: 0, pellizcando: false, mezcla: 0, m: 0, arriba: 0, abajo: 0.42, cerrando: false, fondo: AZUL_HOME, wall: false, wallVisto: false, marco: null, plano: null, quieto: false, captura: null })
  const scrollGuardado = useRef(null)
  const pintarFondo = useCallback((hex) => {
    if (bgRef.current) bgRef.current.style.backgroundColor = hex
  }, [])

  // ── Conocer la historia ────────────────────────────────────────────────
  // La de escritorio (hooks/useHistoriaMadre.js), contada por M.A.D.R.E., en
  // la primera pantalla junto a Con/Sin audio (Oscar, 2026-11-11). Planos
  // para pantalla vertical (TOMAS_TELEFONO): el abierto del numerito más
  // lejos y la cámara siguiendo a Skulley casi completo, porque el cuadro es
  // angosto. La página no se mueve: antes de elegir audio no scrollea. Al
  // regresar, el personalizador recupera sus medidas (la barra y el panel).
  const alRegresarHistoria = useCallback(() => {
    Object.assign(personalizaRef.current, { arriba: 0, abajo: 0.42 })
    onScroll()
  }, [onScroll])
  const historia = useHistoriaMadre({
    lang, poseRef: personalizaRef, barra: BARRA_HISTORIA, tomas: TOMAS_TELEFONO,
    zoomMin: 0.5, alRegresar: alRegresarHistoria,
  })
  const faseHistoria = historia.fase
  const onHistoriaRef = useRef(onHistoria)
  onHistoriaRef.current = onHistoria
  useEffect(() => {
    onHistoriaRef.current?.(faseHistoria !== 'inicio')
    if (faseHistoria === 'historia') pintarFondo(OSCURO)
    else if (faseHistoria === 'regreso') pintarFondo(AZUL_HOME)
  }, [faseHistoria, pintarFondo])
  useEffect(() => () => onHistoriaRef.current?.(false), [])
  useEffect(() => {
    personalizaRef.current.activo = personalizando
    personalizaRef.current.sinHome = personalizando || regresando
    const el = scrollerRef.current
    if (personalizando) {
      scrollGuardado.current = el ? el.scrollTop : null
      if (veloRef.current) veloRef.current.style.opacity = '0'
    } else if (scrollGuardado.current != null) {
      if (el && Math.abs(el.scrollTop - scrollGuardado.current) > 1) el.scrollTop = scrollGuardado.current
      if (!regresando) scrollGuardado.current = null
      onScroll()
    }
  }, [personalizando, regresando, onScroll])

  // ── De regreso a la home ───────────────────────────────────────────────
  // Al cerrar, si Skulley iba roto el rig cuenta otra vez la historia hasta
  // donde iba, y el texto y los botones le taparían el rayo y el despiece: la
  // home entra cuando él termina (Oscar, 2026-11-04), con un respiro para ver
  // dónde quedó. Si iba entero no hay nada que esperar y entra en cuanto el
  // panel se fue. El tope es por si el rig nunca llega (sin WebGL, un teléfono
  // muy lento): la home no se puede quedar fuera.
  const [entrando, setEntrando] = useState(false)
  useEffect(() => {
    if (!regresando) return undefined
    const pz = personalizaRef.current
    let t = 0
    const listo = () => {
      setEntrando(true)
      onHomeDeVuelta?.()
    }
    if (progressRef.current > timingRef.current.hit) {
      t = setTimeout(listo, REGRESO_TOPE_MS)
      pz.alRegresar = () => {
        clearTimeout(t)
        t = setTimeout(listo, REGRESO_RESPIRO_MS)
      }
    } else {
      t = setTimeout(listo, REGRESO_PANEL_MS)
    }
    return () => {
      clearTimeout(t)
      pz.alRegresar = null
    }
  }, [regresando, onHomeDeVuelta])
  useEffect(() => {
    if (!entrando) return undefined
    const t = setTimeout(() => setEntrando(false), ENTRADA_MS)
    return () => clearTimeout(t)
  }, [entrando])

  // ── Regresar a donde ibas ──────────────────────────────────────────────
  // La home se desmonta al entrar a un capítulo, así que al salir de él
  // volvía hasta arriba (Oscar, 2026-10-30). Al desmontarse avisa dónde iba
  // (onSalir) y al montarse otra vez regresa ahí. Si la página todavía no
  // alcanza esa altura (lo que viene del servidor), lo intenta cada cuadro
  // hasta 2.5 s; si el dedo se adelanta, lo deja en paz.
  const onSalirRef = useRef(onSalir)
  onSalirRef.current = onSalir
  useEffect(() => () => { onSalirRef.current?.(ultimoScroll.current) }, [])
  // `saltarHistoria`: llegando desde la versión rápida del preloader de
  // escritorio, que ya contó el rayo, se arranca en la primera sección.
  useLayoutEffect(() => {
    const el = scrollerRef.current
    const metaDe = () => (saltarHistoria ? (el?.querySelector('[data-beat="section1"]')?.offsetTop || 0) : scrollInicial)
    if (!el || !(metaDe() > 0)) return undefined
    let raf = 0
    let suelto = false
    const soltar = () => { suelto = true }
    el.addEventListener('touchstart', soltar, { passive: true })
    el.addEventListener('wheel', soltar, { passive: true })
    const t0 = performance.now()
    const intentar = () => {
      if (suelto) return
      const meta = metaDe()
      el.scrollTop = meta
      onScroll()
      if (Math.abs(el.scrollTop - meta) > 2 && performance.now() - t0 < 2500) raf = requestAnimationFrame(intentar)
    }
    intentar()
    return () => {
      cancelAnimationFrame(raf)
      el.removeEventListener('touchstart', soltar)
      el.removeEventListener('wheel', soltar)
    }
    // Solo al montarse: scrollInicial es dónde ibas la vez pasada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className={`msh-root ${personalizando ? 'is-personalizando' : ''} ${regresando ? 'is-regresando' : ''} ${entrando ? 'is-entrando' : ''} ${faseHistoria === 'historia' ? 'is-historia' : ''} ${faseHistoria === 'regreso' ? 'is-historia-regreso' : ''}`}>
      <div ref={bgRef} className="msh-bg" style={{ backgroundColor: stops[0] }} />

      <React.Suspense fallback={null}>
        <div className="msh-stage">
          <SkulleyFallRig progressRef={progressRef} timingRef={timingRef} onStrike={onStrike} personalizaRef={personalizaRef} escenaRef={historia.escenaRef} />
        </div>
      </React.Suspense>

      {/* Entre el personaje y el texto: oscurece fondo y personaje mientras se
          leen los dos primeros textos largos. Lo mueve onScroll. */}
      <div ref={veloRef} className="msh-velo" aria-hidden="true" />

      <div ref={scrollerRef} className={`msh-scroller modal-scroll ${audioElegido && !personalizando && !regresando ? '' : 'is-bloqueado'}`} onScroll={onScroll}>
        {beats.map((b) => {
          // Botón de sección (DESIGN.md §4.2, "primary de sección"): fill del
          // color de la sección con texto en tinta. Cuando el FONDO del beat ya
          // es ese color, el botón desaparecería sobre él, así que se invierte:
          // fill de tinta con el texto del color. Mismo par, contraste máximo.
          const acento = b.section ? sectionColors[b.section] : null
          const sobreColor = acento && acento.toLowerCase() === b.bg.toLowerCase()
          return (
            <section key={b.key} data-beat={b.key} className={`msh-beat msh-beat--${b.kind}`} style={{ color: textoDe(b) }}>
              {/* El nombre de la portada lleva el glitch del preloader de
                  escritorio (deja ver OSCAR MOCTEZUMA). SKULLEY RAD llena la
                  columna como los demás títulos; mientras se rompe, baja a lo
                  que quepa MOCTE█UMA (ver .msh-beat--hero en index.css). */}
              {b.kind === 'hero'
                ? <GlitchName as="h2" className="msh-title" runesUntil={runasTitulo} data-texto={b.title} data-texto-glitch={GLITCH_NAME_WORDS.join('\n')} />
                : b.title && <h2 className="msh-title" data-texto={b.title}>{b.title}</h2>}

              {b.sub && <p className="msh-sub">{b.sub}</p>}

              {/* Antes de scrollear, con o sin audio. Es el permiso del
                  teléfono para sonar (ver MobileApp); hasta elegir, el scroll
                  está bloqueado y el aviso de deslizar no sale. Van abajo,
                  encima de la barra, y la de color es Conocer la historia
                  (Oscar, 2026-11-11); las dos de audio, de vidrio. */}
              {b.kind === 'hero' && !audioElegido && (
                <div className="msh-audio" role="group" aria-label={lang === 'es' ? 'Audio' : 'Sound'}>
                  {/* Arriba de las dos, a lo ancho de ellas: la historia
                      enciende el sonido y al terminar regresa aquí. */}
                  <button type="button" className="shop-btn shop-btn--primary msh-btn msh-btn--audio msh-btn--historia" onClick={historia.verHistoria} onPointerDown={historia.prepararVoz} onFocus={historia.prepararVoz}>
                    <PlayIcon className="w-5 h-5" aria-hidden="true" />
                    {lang === 'es' ? 'Conocer la historia' : 'Watch the story'}
                  </button>
                  <button type="button" className="shop-btn msh-btn msh-btn--audio msh-btn--vidrio" onClick={() => onElegirAudio?.(false)}>
                    <SpeakerXMarkIcon className="w-5 h-5" aria-hidden="true" />
                    {lang === 'es' ? 'Sin audio' : 'No sound'}
                  </button>
                  <button type="button" className="shop-btn msh-btn msh-btn--audio msh-btn--vidrio" onClick={() => onElegirAudio?.(true)}>
                    <SpeakerWaveIcon className="w-5 h-5" aria-hidden="true" />
                    {lang === 'es' ? 'Con audio' : 'Sound on'}
                  </button>
                </div>
              )}

              {b.hint && audioElegido && (
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

              {/* Las tarjetas de lo último, las mismas de cada sección. Tocar
                  una abre esa pieza dentro de su sección. */}
              {b.section === 'section1' && (
                <Carrusel
                  items={ultimo.proyectos}
                  llave={(p) => p.id}
                  etiqueta={b.title.replace(/\n/g, ' ')}
                  lang={lang}
                  render={(p, i) => (
                    <WorkCard
                      item={p}
                      idx={i}
                      onEnter={nada}
                      onMove={nada}
                      onLeave={nada}
                      setHoveredIdx={nada}
                      hideImage={false}
                      onOpenDetail={(slug) => onOpenPiece?.('section1', slug)}
                    />
                  )}
                />
              )}
              {/* Agregar hace lo mismo que en la tienda (Shop.handleAdd): con
                  talla o color abre la ficha para escoger; si no, va directo
                  al carrito. */}
              {b.section === 'section3' && (
                <Carrusel
                  items={ultimo.productos}
                  llave={(p) => p.id}
                  etiqueta={b.title.replace(/\n/g, ' ')}
                  lang={lang}
                  render={(p) => (
                    <ProductCard
                      product={p}
                      lang={lang}
                      onInspect={(x) => onOpenPiece?.('section3', x.handle)}
                      onAdd={(x) => (x.hasOptions ? onOpenPiece?.('section3', x.handle) : addProductToCart(cart, x))}
                    />
                  )}
                />
              )}
              {b.section === 'section5' && (
                <Carrusel
                  items={ultimo.posts}
                  llave={(p) => p.id ?? p.slug}
                  etiqueta={b.title.replace(/\n/g, ' ')}
                  lang={lang}
                  render={(p) => <BlogCard post={p} onSelect={(x) => onOpenPiece?.('section5', x.slug)} />}
                />
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

        {/* El pie se queda quieto abajo (sticky) mientras se scrollea un tramo
            más: ahí pasa lo último de la cabeza. Ver .msh-fin. */}
        <div className="msh-fin">
          <footer className="msh-footer">
            {/* Arriba el remate y la frase, abajo las redes; en medio queda el hueco
                de la cabeza, que el rig mide para centrarla (timingRef.huecoFinal). */}
            <div className="msh-footer-arriba">
              <h2 className="msh-title msh-title--footer" data-texto={lang === 'es' ? 'AQUÍ\nTERMINA' : 'THIS IS\nTHE END'}>
                {lang === 'es' ? 'AQUÍ\nTERMINA' : 'THIS IS\nTHE END'}
              </h2>
              <p className="msh-footer-line">
                {lang === 'es'
                  ? 'Pero puedes seguir lo que hago día a día en mis redes.'
                  : 'But you can still follow my daily stuff on my social media.'}
              </p>
            </div>
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
                    data-tip={s.label}
                  >
                    <img src={s.icon} alt="" aria-hidden className="w-5 h-5 invert" draggable="false" />
                  </a>
                </li>
              ))}
            </ul>
          </footer>
        </div>
      </div>

      {/* Conocer la historia: el negro de los cortes de cámara, las barras de
          cine con los subtítulos (el lector de pantalla lee el texto limpio)
          y, arriba, Saltar y el sonido, donde va la hamburguesa. */}
      <div ref={historia.corteRef} className="dsp-corte" aria-hidden="true" />
      <div className="dsp-barra dsp-barra--arriba" aria-hidden="true" />
      <div className="dsp-barra dsp-barra--abajo" aria-hidden="true" />
      <div className="dsp-subtitulos" aria-hidden="true">
        {historia.linea && <SubtituloMadre key={historia.linea.i} texto={historia.linea.texto} sale={historia.linea.sale} />}
      </div>
      <div className="sr-only" aria-live="polite">{historia.linea?.texto || ''}</div>
      {faseHistoria === 'historia' && (
        <div className="dsp-arriba">
          <button type="button" className="shop-btn msh-btn msh-btn--vidrio dsp-saltar" onClick={historia.terminarHistoria}>
            {lang === 'es' ? 'Saltar' : 'Skip'}
            <ForwardIcon aria-hidden="true" />
          </button>
          <button
            type="button"
            className="h-12 w-12 rounded-full bg-black/50 backdrop-blur-xl border border-white/[0.08] text-white hover:bg-white/[0.15] grid place-items-center shadow-elev-lg transition-colors"
            onClick={historia.alternarSonido}
            aria-pressed={historia.conSonido}
            aria-label={historia.conSonido ? (lang === 'es' ? 'Quitar el sonido' : 'Mute') : (lang === 'es' ? 'Con sonido' : 'Sound on')}
          >
            {historia.conSonido ? <SpeakerWaveIcon className="w-5 h-5" aria-hidden="true" /> : <SpeakerXMarkIcon className="w-5 h-5" aria-hidden="true" />}
          </button>
        </div>
      )}

      <MobileCustomizer open={personalizando} onClose={onCerrarPersonalizar} personalizaRef={personalizaRef} onFondo={pintarFondo} />

      <div ref={flashRef} className="msh-flash" aria-hidden="true" />
    </div>
  )
}
