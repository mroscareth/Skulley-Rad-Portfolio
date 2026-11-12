import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import { MusicalNoteIcon, ShoppingCartIcon, UserIcon } from '@heroicons/react/24/solid'
import { useTituloOrilla } from '../../hooks/useTituloOrilla.js'
import { useGlitchRunas, useGlitchSolo, textoGlitch } from '../../hooks/useGlitchRunas.js'
import { useShopData } from '../../lib/shopDataContext.jsx'
import { transformApiProject } from '../work/WorkCard.jsx'
import { SOCIAL_LINKS } from '../NavOverlay.jsx'
import GamepadIcon from '../icons/GamepadIcon.jsx'

// La home de la versión rápida de escritorio (la segunda puerta del preloader
// de scroll). De la referencia de Oscar (auge-xp.com) se tomaron la estructura
// y la forma de navegar; lo visual es del sitio: el azul del home, Luckiest Guy
// y Outfit, el amarillo de los botones y el vidrio de los flotantes.
//   · arriba, una tira infinita con proyectos y piezas de la tienda que se
//     desliza sola y la rueda acelera; al pasar el mouse sale la pastilla
//     amarilla pegada al cursor y el nombre debajo de la tarjeta;
//   · abajo a la izquierda, Skulley de cuerpo entero parado sobre su nombre en
//     runas, de orilla a orilla de su bloque (un clic lo glitchea);
//   · a la derecha, "Bienvenido" (se glitchea solo a runas) y el TLDR de su
//     About, que empieza con su nombre;
//   · abajo, el footer como el de la referencia (pedido de Oscar): a la
//     izquierda el copyright con el año en curso, las redes y el idioma; a la
//     derecha la barra de vidrio (carrito, cuenta, música) junto a la
//     hamburguesa de QuickMenu.
// La monta App.jsx en la versión rápida (lib/versionRapida.js), en lugar de la
// escena 3D; el menú (QuickMenu) y las transiciones son los de App.

const SkulleyFallRig = React.lazy(() => import('../mobile/SkulleyFallRig.jsx'))

// Píxeles por segundo que avanza la tira sola, y cuánto le suma la rueda.
const TIRA_VEL = 46
const RUEDA_EMPUJE = 7
const RUEDA_TOPE = 4200
// Alto de cada tarjeta (fracción del alto de la tira), en ciclo: la orilla de
// abajo queda dispareja. El ancho sale de la foto (`--r`, al cargar), así que
// ninguna pieza se recorta (DESIGN.md §14.7); antes de cargar usa PROPORCIONES.
const ALTOS = [1, 0.78, 0.9, 0.7, 0.96, 0.84, 0.74]
const PROPORCIONES = [0.8, 1.3, 1, 1.45, 0.85, 1.15, 1.25]
const PROPORCION_MIN = 0.6
const PROPORCION_MAX = 1.8
const MARCA = 'SKULLEYRAD'
// Las burbujas del footer, de vidrio líquido (.burbuja-vidrio en index.css),
// como la hamburguesa de QuickMenu.
const BURBUJA = 'burbuja-vidrio h-full w-full rounded-full grid place-items-center'
// Dónde van las burbujas cuando hay espacio a la derecha del texto: su centro
// en fracciones de ese espacio, en el orden del DOM (música, idioma, cuenta,
// carrito). En zigzag, de lados alternos, para que se lean como burbujas
// sueltas y no como una fila de botones. Todas miden lo que la hamburguesa
// (Oscar: grandes no).
const BURBUJAS_SUELTAS = [
  { x: 0.75, y: 0.92 },
  { x: 0.2, y: 0.66 },
  { x: 0.72, y: 0.38 },
  { x: 0.25, y: 0.08 },
]
const BURBUJA_TAM = 48
// Lo que mide el racimo, en rem: pegado a la hamburguesa, arriba y a su izquierda.
const RACIMO_ANCHO = 9
const RACIMO_ALTO = 14.5
// Sin ese espacio (ventanas de 1024 px), en columna sobre la hamburguesa: el
// desplazamiento desde su centro, en rem.
const BURBUJAS_COLUMNA = [
  { x: 0.45, y: -4 },
  { x: -0.9, y: -7.6 },
  { x: 0.35, y: -11.2 },
  { x: -0.8, y: -14.8 },
]
// El busto (pedido de Oscar: nunca cuerpo completo, nunca cortado). El canvas
// ocupa todo el alto y bastante más ancho que él, así que nada lo corta; el
// cuerpo sale desde la orilla de abajo de la pantalla.
//   · La barbilla (a ~33 % del cuerpo, contando la cresta) queda arriba de las
//     runas, para que el título no le tape la cara.
//   · La orilla de abajo corta, como mucho, a la cadera (VE_MAX del cuerpo).
//   · La cresta puede pasar un poco por encima de la tira (Oscar: "no me
//     importa"): SOBRE de entrada y hasta SOBRE_MAX si hace falta para lo de
//     arriba; pasado eso, el título le tapa la barbilla.
// Se mide en cada tamaño de ventana.
const BUSTO_BARBILLA = 0.33
const BUSTO_VE_MAX = 0.64
// 0.10 y no 0.04: Oscar lo quiso un poco más grande, y crecer hacia arriba es
// lo que no le tapa la cara.
const BUSTO_SOBRE = 0.1
const BUSTO_SOBRE_MAX = 0.2
const BUSTO_HOLGURA = 6
// Lo más ancho que puede quedar Skulley (los brazos y la esfera), en altos de
// su cuerpo: el canvas mide al menos eso, centrado en el título, para que no
// se corte a los lados mida lo que mida la ventana.
const BUSTO_ANCHO = 1
const BUSTO_CRESTA = 0.38

// El saludo de la derecha y el TLDR del About. El arranque del TLDR es de
// Oscar; el resto sale de los párrafos 2 y 5 del About del CMS.
const SALUDO = { es: 'Bienvenido', en: 'Welcome' }
const TLDR = {
  es: 'Mi nombre es Oscar Moctezuma: diseñador, ilustrador, artista 3D, desarrollador frontend y creador de Skulley Rad. Vivo en Monterrey, México, y llevo más de diez años haciendo marcas, sitios y objetos. Cofundé The Heritage Design, que ha trabajado con Valve, Koto Studio y Pinturas Berel.',
  en: 'My name is Oscar Moctezuma: designer, illustrator, 3D artist, frontend developer and creator of Skulley Rad. I live in Monterrey, Mexico, and have spent over ten years making brands, websites and objects. I co-founded The Heritage Design, which has worked with Valve, Koto Studio and Pinturas Berel.',
}
// El saludo se glitchea solo de Luckiest Guy a runas y regresa, cada 4 s como
// la firma de M.A.D.R.E. en la tienda (useGlitchSolo).
const SALUDO_GLITCH = { primeraMs: 1800, cadaMs: 4000, sostieneMs: 1600 }

function useTarjetas(es) {
  const [proyectos, setProyectos] = React.useState([])
  const { products } = useShopData()
  useEffect(() => {
    let vivo = true
    fetch('/api/projects.php?active=1')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!vivo || !d?.ok || !Array.isArray(d.projects)) return
        setProyectos(d.projects.map(transformApiProject))
      })
      .catch(() => { })
    return () => { vivo = false }
  }, [])
  return useMemo(() => {
    const pr = proyectos.filter((p) => p.image).map((p) => ({ tipo: 'proyecto', id: `p-${p.slug}`, titulo: p.title, imagen: p.image, slug: p.slug }))
    const ti = (products || []).filter((p) => p.image).map((p) => ({ tipo: 'pieza', id: `s-${p.handle}`, titulo: (es ? p.title_es : p.title_en) || p.title_es || p.title_en, imagen: p.image, slug: p.handle }))
    // Dos proyectos por cada pieza de la tienda, hasta que se acaben.
    const out = []
    let i = 0
    let j = 0
    while (i < pr.length || j < ti.length) {
      if (i < pr.length) out.push(pr[i++])
      if (i < pr.length) out.push(pr[i++])
      if (j < ti.length) out.push(ti[j++])
    }
    return out
  }, [proyectos, products, es])
}

export default function QuickHome({ lang, onAbrirPieza, onIdioma, onCarrito, onCuenta, onMusica, totalCarrito = 0, autenticado = false, cargandoCuenta = false, pausado = false, inerte = false, onCompleta, onLista }) {
  const es = lang === 'es'
  const rootRef = useRef(null)
  const tiraRef = useRef(null)
  const pistaRef = useRef(null)
  const pastillaRef = useRef(null)
  const sobreRef = useRef(null)
  const velRef = useRef(0)
  const pausadoRef = useRef(pausado)
  pausadoRef.current = pausado
  const tarjetas = useTarjetas(es)

  // El título de orilla a orilla del sitio (useTituloOrilla + .titulo-orilla,
  // como el nombre de Argus): la caja mide la tinta de las runas, así que los
  // pies de Skulley caen justo encima. Un clic lo glitchea a Luckiest Guy.
  const orilla = useTituloOrilla(MARCA)
  // useTituloOrilla mide en cqi, pero el título va en la fila de abajo junto al
  // TLDR (alineados por su base) y ahí no puede tener un @container: un
  // contenedor no exporta su línea base. Su ancho es --qh-marca-ancho, así que
  // 1cqi es la centésima parte de él.
  const orillaFila = useMemo(() => (orilla
    ? Object.fromEntries(Object.entries(orilla).map(([k, v]) => [k, v.replace(/(-?[\d.]+)cqi/, (_, n) => `calc(var(--qh-marca-ancho) * ${n} / 100)`)]))
    : null), [orilla])
  const glitch = useGlitchRunas(true)
  const saludoRef = useRef(null)
  const saludo = useGlitchSolo(saludoRef, SALUDO_GLITCH)

  // La proporción real de cada foto, por su URL; fuera de rango la pieza queda
  // completa sobre el paspartú (object-fit: contain) en vez de recortarse. Vive
  // en el estado y no escrita en el DOM: cuando llegan las piezas de la tienda
  // la tira se reordena, React volvía a poner la proporción de relleno de la
  // nueva posición y la foto, ya cargada, no la corregía (franjas a los lados).
  const [proporciones, setProporciones] = React.useState({})
  const alCargar = useCallback((e) => {
    const img = e.currentTarget
    if (!img.naturalWidth || !img.naturalHeight) return
    const r = Math.min(PROPORCION_MAX, Math.max(PROPORCION_MIN, img.naturalWidth / img.naturalHeight))
    const src = img.getAttribute('src')
    setProporciones((antes) => (antes[src] === r ? antes : { ...antes, [src]: r }))
  }, [])

  // ── La tira ──────────────────────────────────────────────────────────────
  // La pista lleva las tarjetas dos veces y se mueve por transform en un solo
  // loop (nada de estado de React por cuadro). Con el mouse encima de una
  // tarjeta va a un cuarto de velocidad; la rueda le da un empujón que se
  // apaga solo. Con movimiento reducido no avanza sola.
  useEffect(() => {
    let quieto = false
    try { quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { }
    let raf = 0
    let antes = performance.now()
    let x = 0
    const loop = (t) => {
      const dt = Math.min(0.05, (t - antes) / 1000)
      antes = t
      const pista = pistaRef.current
      if (pista && !pausadoRef.current) {
        const mitad = pista.scrollWidth / 2
        const base = quieto ? 0 : TIRA_VEL * (sobreRef.current ? 0.25 : 1)
        velRef.current *= Math.exp(-2.6 * dt)
        x -= (base + velRef.current) * dt
        if (mitad > 0) {
          while (x <= -mitad) x += mitad
          while (x > 0) x -= mitad
        }
        pista.style.transform = `translate3d(${x.toFixed(2)}px, 0, 0)`
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    const onWheel = (e) => {
      velRef.current = Math.max(-RUEDA_TOPE, Math.min(RUEDA_TOPE, velRef.current + (e.deltaY + e.deltaX) * RUEDA_EMPUJE))
    }
    const raiz = rootRef.current
    raiz?.addEventListener('wheel', onWheel, { passive: true })
    return () => {
      cancelAnimationFrame(raf)
      raiz?.removeEventListener('wheel', onWheel)
    }
  }, [])

  const etiquetaDe = useCallback((tipo) => (tipo === 'pieza'
    ? (es ? 'Ver pieza' : 'View piece')
    : (es ? 'Ver proyecto' : 'View project')), [es])

  // La pastilla sigue al cursor por transform; su texto se pone directo.
  const moverPastilla = useCallback((e) => {
    const p = pastillaRef.current
    const tira = tiraRef.current
    if (!p || !tira) return
    const caja = tira.getBoundingClientRect()
    p.style.transform = `translate3d(${(e.clientX - caja.left).toFixed(1)}px, ${(e.clientY - caja.top).toFixed(1)}px, 0)`
  }, [])
  const entrarTarjeta = useCallback((t) => {
    sobreRef.current = t
    const p = pastillaRef.current
    if (!p) return
    p.textContent = etiquetaDe(t.tipo)
    p.classList.add('is-visible')
  }, [etiquetaDe])
  const salirTarjeta = useCallback(() => {
    sobreRef.current = null
    pastillaRef.current?.classList.remove('is-visible')
  }, [])

  // ── Skulley en la esquina ────────────────────────────────────────────────
  // El rig del teléfono en su modo de personalizar: de frente y en idle, con
  // el progreso en 0 (sin rayo), en busto (pedido de Oscar) detrás del título.
  // Se gira arrastrándolo, como en el personalizador del teléfono.
  const progresoRef = useRef(0)
  const tiempoRef = useRef({ hit: 0.98, draw: 0.97 })
  // `abajo` casi en 0 y no 0: el rig lee `abajo || 0.42` (el panel del
  // personalizador del teléfono) y con 0 le reservaba media pantalla.
  const poseRef = useRef({
    activo: true, sinHome: false, alRegresar: null, giro: 0, giroVisto: 0, vel: 0, arrastrando: false,
    zoom: 1.4, panX: 0, panY: 0.1, pellizcando: false, mezcla: 1, m: 1, arriba: 0, abajo: 0.0001, cerrando: false,
    fondo: null, wall: false, wallVisto: false, marco: null, plano: null, quieto: false, captura: null,
  })
  const arrastreRef = useRef(null)

  // Avisa a App que la home ya se puede ver (Skulley medido y las fuentes
  // cargadas): la llegada desde la experiencia completa abre el iris entonces.
  const avisadaRef = useRef(false)
  const rigListo = useCallback(() => {
    if (avisadaRef.current) return
    avisadaRef.current = true
    const fuentes = document.fonts?.ready || Promise.resolve()
    fuentes.catch(() => { }).then(() => requestAnimationFrame(() => requestAnimationFrame(() => onLista?.())))
  }, [onLista])

  // Las burbujas habitan el espacio libre a la derecha del texto (Oscar: "que
  // llenen mejor ese espacio"): del final del TLDR a la orilla de la
  // hamburguesa, y de la tira a la hamburguesa. Se mide en cada tamaño de
  // ventana y cuando cambia el texto (idioma); si el espacio no alcanza,
  // suben en columna sobre la hamburguesa.
  useEffect(() => {
    const raiz = rootRef.current
    if (!raiz) return undefined
    const acomodar = () => {
      const caja = raiz.getBoundingClientRect()
      const burbujas = [...raiz.querySelectorAll('.qh-burbuja')]
      const texto = raiz.querySelector('.qh-info-texto')
      const agarre = raiz.querySelector('.qh-agarre')
      if (!burbujas.length || !texto || !agarre || !caja.width) return
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
      // La hamburguesa vive en App (QuickMenu); si todavía no monta, donde va.
      const margen = Math.min(44, Math.max(20, caja.width * 0.025))
      // .qm-raiz y no el botón: el botón flota y su caja se mueve con él.
      const menu = document.querySelector('.qm-raiz')?.getBoundingClientRect()
        || { left: caja.right - margen - 48, right: caja.right - margen, top: caja.bottom - margen - 0.125 * rem - 48, width: 48, height: 48 }
      const rango = document.createRange()
      rango.selectNodeContents(texto)
      const lineas = [...rango.getClientRects()]
      const finTexto = lineas.length ? Math.max(...lineas.map((l) => l.right)) : texto.getBoundingClientRect().right
      const x0 = finTexto - caja.left + 2 * rem
      const x1 = menu.right - caja.left
      const y0 = agarre.getBoundingClientRect().top - caja.top + 1.5 * rem
      const y1 = menu.top - caja.top - rem
      const ancho = x1 - x0
      const alto = y1 - y0
      const tam = BURBUJA_TAM
      const sueltas = ancho >= tam * 2.4 && alto >= tam * 2.8
      // El racimo, en la esquina de ese espacio junto a la hamburguesa y no
      // repartido en todo su alto (Oscar: "muy separados hacia arriba").
      const anchoRacimo = Math.min(ancho, RACIMO_ANCHO * rem)
      const altoRacimo = Math.min(alto, RACIMO_ALTO * rem)
      const rx0 = x1 - anchoRacimo
      const ry0 = y1 - altoRacimo
      burbujas.forEach((el, i) => {
        let x, y, t
        if (sueltas) {
          const b = BURBUJAS_SUELTAS[i] || BURBUJAS_SUELTAS[0]
          t = tam
          x = rx0 + t / 2 + b.x * (anchoRacimo - t)
          y = ry0 + t / 2 + b.y * (altoRacimo - t)
        } else {
          const b = BURBUJAS_COLUMNA[i] || BURBUJAS_COLUMNA[0]
          t = tam
          x = menu.left - caja.left + menu.width / 2 + b.x * rem
          y = menu.top - caja.top + menu.height / 2 + b.y * rem
        }
        el.style.setProperty('--x', `${Math.round(x)}px`)
        el.style.setProperty('--y', `${Math.round(y)}px`)
        el.style.setProperty('--tam', `${Math.round(t)}px`)
      })
    }
    acomodar()
    const ro = new ResizeObserver(acomodar)
    ro.observe(raiz)
    // Con la fuente ya cargada el texto mide otra cosa.
    document.fonts?.ready?.then(acomodar).catch(() => { })
    return () => ro.disconnect()
  }, [lang, orillaFila])

  // El encuadre del busto en el rig: zoom 1 enseña el cuerpo entero en el 90 %
  // del alto del canvas, centrado; panY sube el cuadro en altos de ese cuadro.
  // Todo en px desde la orilla de arriba del canvas: `cresta` es donde queda la
  // punta de la cresta y `cuerpo`, lo que mide Skulley entero.
  useEffect(() => {
    const raiz = rootRef.current
    if (!raiz) return undefined
    const encuadrar = () => {
      const lienzo = raiz.querySelector('.qh-skulley')
      const caja = lienzo?.getBoundingClientRect()
      const titulo = raiz.querySelector('.qh-marca')?.getBoundingClientRect()
      const agarre = raiz.querySelector('.qh-agarre')?.getBoundingClientRect()
      if (!caja?.height || !titulo?.height || !agarre) return
      const alto = caja.height
      const tira = agarre.top - caja.top
      const barbilla = titulo.top - caja.top - BUSTO_HOLGURA
      const deEntrada = tira - BUSTO_SOBRE * alto
      let cuerpo = Math.max(
        (barbilla - deEntrada) / BUSTO_BARBILLA,
        (alto - barbilla) / (BUSTO_VE_MAX - BUSTO_BARBILLA),
      )
      let cresta = barbilla - BUSTO_BARBILLA * cuerpo
      const tope = tira - BUSTO_SOBRE_MAX * alto
      if (cresta < tope) {
        cresta = tope
        cuerpo = (alto - cresta) / BUSTO_VE_MAX
      }
      const zoom = Math.min(4, Math.max(1, cuerpo / (0.9 * alto)))
      const centro = titulo.left + titulo.width / 2 - raiz.getBoundingClientRect().left
      const ancho = Math.max(raiz.clientWidth * 0.64, cuerpo * BUSTO_ANCHO)
      lienzo.style.width = `${Math.round(ancho)}px`
      lienzo.style.left = `${Math.round(centro - ancho / 2)}px`
      const pz = poseRef.current
      pz.zoom = zoom
      pz.panY = BUSTO_CRESTA + (0.9 * cresta) / cuerpo - 0.5 / zoom
    }
    encuadrar()
    const ro = new ResizeObserver(encuadrar)
    ro.observe(raiz)
    return () => ro.disconnect()
  }, [orillaFila])
  const alBajar = useCallback((e) => {
    const pz = poseRef.current
    arrastreRef.current = { x: e.clientX, t: performance.now(), vel: 0 }
    pz.arrastrando = true
    pz.vel = 0
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { }
  }, [])
  const alMover = useCallback((e) => {
    const a = arrastreRef.current
    if (!a) return
    const ahora = performance.now()
    const dx = e.clientX - a.x
    const pz = poseRef.current
    pz.giro += dx * 0.012
    a.vel = (dx * 0.012) / Math.max(0.001, (ahora - a.t) / 1000)
    a.x = e.clientX
    a.t = ahora
  }, [])
  const alSoltar = useCallback(() => {
    const a = arrastreRef.current
    const pz = poseRef.current
    pz.arrastrando = false
    pz.vel = a ? Math.max(-12, Math.min(12, a.vel)) : 0
    arrastreRef.current = null
  }, [])

  return (
    // `inerte`: con una sección encima (la home se queda montada y en pausa
    // detrás, como en la versión completa) nada de aquí recibe foco ni clics.
    <div ref={rootRef} className="qh-root" inert={inerte || undefined}>
      <div ref={tiraRef} className="qh-tira" onMouseMove={moverPastilla}>
        <div ref={pistaRef} className="qh-pista">
          {[0, 1].map((copia) => tarjetas.map((t, i) => (
            <button
              key={`${copia}-${t.id}`}
              type="button"
              className="qh-tarjeta"
              style={{ '--h': ALTOS[i % ALTOS.length], '--r': proporciones[t.imagen] ?? PROPORCIONES[i % PROPORCIONES.length] }}
              onClick={() => onAbrirPieza?.(t.tipo === 'pieza' ? 'section3' : 'section1', t.slug)}
              onMouseEnter={() => entrarTarjeta(t)}
              onMouseLeave={salirTarjeta}
              onFocus={() => entrarTarjeta(t)}
              onBlur={salirTarjeta}
              tabIndex={copia ? -1 : 0}
              aria-hidden={copia ? 'true' : undefined}
              aria-label={`${t.titulo}: ${etiquetaDe(t.tipo)}`}
            >
              <span className="qh-tarjeta-imagen">
                <img src={t.imagen} alt="" loading="lazy" decoding="async" draggable="false" onLoad={alCargar} />
              </span>
              <span className="qh-tarjeta-nombre" aria-hidden="true">
                {t.titulo}
                <small>{t.tipo === 'pieza' ? (es ? 'Tienda' : 'Shop') : (es ? 'Proyecto' : 'Project')}</small>
              </span>
            </button>
          )))}
        </div>
        <span ref={pastillaRef} className="qh-pastilla shop-btn shop-btn--primary" aria-hidden="true" />
      </div>

      {/* El busto de Skulley, detrás del título. El canvas no recibe el
          puntero (pasa por encima de la tira); se gira desde .qh-agarre, que
          cubre su cuerpo debajo de la tira. */}
      <div className="qh-skulley" aria-hidden="true">
        <React.Suspense fallback={null}>
          <SkulleyFallRig progressRef={progresoRef} timingRef={tiempoRef} personalizaRef={poseRef} pausado={pausado} onListo={rigListo} />
        </React.Suspense>
      </div>
      <div
        className="qh-agarre"
        onPointerDown={alBajar}
        onPointerMove={alMover}
        onPointerUp={alSoltar}
        onPointerCancel={alSoltar}
        aria-hidden="true"
      />

      {/* El título y el TLDR en una fila alineada por la base (last baseline):
          la base de las runas cae en la de la última línea del texto. */}
      <div className="qh-fila">
        <h1
          className={`qh-marca display-title select-none ${orillaFila ? 'titulo-orilla' : 'display-title--lg'}${glitch.fase?.letras ? '' : ' display-title--runas'}${glitch.fase?.tiembla ? ' glitch-runas' : ''}`}
          style={orillaFila || undefined}
          onClick={glitch.disparar}
          aria-label="Skulley Rad"
        >
          <span aria-hidden="true">{textoGlitch(MARCA, glitch.fase)}</span>
        </h1>
        <div className="qh-info">
          <h2
            ref={saludoRef}
            className={`qh-info-nombre display-title${saludo?.letras ? ' display-title--runas' : ''}${saludo?.tiembla ? ' glitch-runas' : ''}`}
          >
            {textoGlitch(es ? SALUDO.es : SALUDO.en, saludo)}
          </h2>
          <p className="qh-info-texto">{es ? TLDR.es : TLDR.en}</p>
        </div>
      </div>

      <footer className="qh-pie">
        <nav className="qh-pie-links" aria-label={es ? 'Redes e idioma' : 'Social and language'}>
          <span>© {new Date().getFullYear()} Skulley Rad</span>
          {SOCIAL_LINKS.map((s) => (
            <React.Fragment key={s.key}>
              <span className="qh-pie-sep" aria-hidden="true">|</span>
              <a href={s.href} target="_blank" rel="noopener noreferrer">{s.label}</a>
            </React.Fragment>
          ))}
        </nav>

      </footer>

      {/* Música, idioma, cuenta y carrito: burbujas de vidrio líquido (como la
          hamburguesa de QuickMenu), cada una con su vaivén (pedido de Oscar:
          en una barra se veían "solo puestas ahí"). Su lugar y su tamaño
          (--x, --y, --tam) los pone el efecto de arriba: sueltas en el espacio
          libre a la derecha del texto, o en columna sobre la hamburguesa. Tres
          capas: el lugar y la entrada, el vaivén y el botón, para que el hover
          del botón no pelee con las animaciones. */}
      <div className="qh-burbujas">
        <span className="qh-burbuja" style={{ '--i': 0, '--dur': '6.4s', '--retraso': '-1.2s' }}>
          <span className="qh-burbuja-flota">
            <button
              type="button"
              onClick={onMusica}
              className={BURBUJA}
              aria-label={es ? 'Música' : 'Music'}
              data-tip={es ? 'Música' : 'Music'}
            >
              <MusicalNoteIcon className="w-5 h-5" />
            </button>
          </span>
        </span>
        {/* El idioma, como el selector del sitio: ENG / ESP en Luckiest Guy. */}
        <span className="qh-burbuja" style={{ '--i': 1, '--dur': '6.9s', '--retraso': '-4.6s' }}>
          <span className="qh-burbuja-flota">
            <button
              type="button"
              onClick={onIdioma}
              className={`${BURBUJA} qh-burbuja-idioma`}
              aria-label={es ? 'Cambiar a inglés' : 'Switch to Spanish'}
              data-tip={es ? 'English' : 'Español'}
            >
              {es ? 'ENG' : 'ESP'}
            </button>
          </span>
        </span>
        <span className="qh-burbuja" style={{ '--i': 2, '--dur': '7.6s', '--retraso': '-3.4s' }}>
          <span className="qh-burbuja-flota">
            <button
              type="button"
              onClick={onCuenta}
              className={`relative ${BURBUJA}`}
              aria-label={autenticado ? (es ? 'Mi cuenta' : 'My account') : 'Login'}
              data-tip={autenticado ? (es ? 'Mi cuenta' : 'My account') : 'Login'}
            >
              {cargandoCuenta && !autenticado
                ? <span className="block w-5 h-5 border-2 border-white/70 border-t-transparent rounded-full animate-spin" aria-hidden />
                : <UserIcon className="w-5 h-5" />}
              {autenticado && (
                <span className="absolute bottom-1.5 right-1.5 w-[9px] h-[9px] rounded-full bg-green-500 ring-2 ring-[#0a0510] pointer-events-none" />
              )}
            </button>
          </span>
        </span>
        <span className="qh-burbuja" style={{ '--i': 3, '--dur': '7s', '--retraso': '-0.6s' }}>
          <span className="qh-burbuja-flota">
            <button
              type="button"
              onClick={onCarrito}
              className={`relative ${BURBUJA}`}
              aria-label={es ? 'Abrir carrito' : 'Open cart'}
              data-tip={es ? 'Carrito' : 'Cart'}
            >
              <ShoppingCartIcon className="w-5 h-5" />
              {totalCarrito > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 grid place-items-center rounded-full bg-white text-black text-[10px] font-black">
                  {totalCarrito}
                </span>
              )}
            </button>
          </span>
        </span>
      </div>

      {/* La puerta a la experiencia completa (Oscar): fija arriba a la
          izquierda, siempre amarilla; quieta es el control de videojuegos y al
          pasar el mouse (o con foco) se abre y dice a dónde lleva. */}
      {onCompleta && (
        <button
          type="button"
          className="puerta-modo qh-completa"
          onClick={onCompleta}
          aria-label={es ? 'Lanzar experiencia completa' : 'Launch full experience'}
        >
          <GamepadIcon className="puerta-modo-icono" />
          <span className="puerta-modo-texto" aria-hidden="true">{es ? 'Lanzar experiencia completa' : 'Launch full experience'}</span>
        </button>
      )}
    </div>
  )
}
