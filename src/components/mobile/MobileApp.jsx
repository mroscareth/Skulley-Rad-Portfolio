import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { XMarkIcon } from '@heroicons/react/24/solid'
import { useLanguage } from '../../i18n/LanguageContext.jsx'
import { sectionColors, sectionBgOverrides } from '../../lib/appHelpers.js'
import {
  baseUrl,
  pathToSection,
  sectionToPath,
  extractWorkSlug,
  extractShopSlug,
  extractBlogSlug,
} from '../../lib/sectionRouting.js'
import useAchievements from '../../hooks/useAchievements.js'
import useGlobalSfx from '../../hooks/useGlobalSfx.js'
import SectionSwitch from '../SectionSwitch.jsx'
// El cartel va lazy: trae el Canvas y con él three. Así el título y los
// capítulos pintan primero y el personaje entra cuando llega — en un teléfono
// esa diferencia es el arranque completo.
const MobileCharacterPoster = lazy(() => import('./MobileCharacterPoster.jsx'))

// La versión de teléfono. Árbol propio, hermano de App.jsx — no una rama
// adentro (ver el plan y los early returns de ?pose=1 / /help).
//
// La home no es un mundo que se camina: es un cartel. Skulley a tamaño
// completo sobre color plano, el título encima y los capítulos como una lista
// que se lee de un tirón. Nada de escena, nada de portales, nada de joystick.
//
// Lo que este árbol NO monta, y es justo el punto: HomeCanvas (escena, pasto,
// orbes, seis portales, PostFX), el segundo canvas del retrato, Argus y su GLB
// de 2 MB, el sistema de transiciones con gsap. En un teléfono nunca se
// descargan.

// Los capítulos, en orden de lectura. section6 (SKULLEYGLYPH) queda fuera a
// propósito: su puerta es el portal del juego, que acá no existe — se llega
// por URL con el logro ya ganado, igual que en el menú de escritorio.
const CHAPTERS = ['section1', 'section2', 'section3', 'section4', 'section5']

export default function MobileApp() {
  const { t, lang, setLang } = useLanguage()
  const { has: hasAchievement, isLoaded: achievementsReady } = useAchievements()

  // Hover/click global en todo lo interactivo, igual que en App.jsx.
  useGlobalSfx()

  const [section, setSection] = useState(() => {
    try { return pathToSection(window.location.pathname) } catch { return 'home' }
  })
  const [entered, setEntered] = useState(false)

  // Slugs de detalle: las secciones los reciben para abrir una pieza, un
  // proyecto o un post directo desde la URL.
  const [workSlug, setWorkSlug] = useState(() => {
    try { return extractWorkSlug(window.location.pathname) } catch { return null }
  })
  const [shopSlug, setShopSlug] = useState(() => {
    try { return extractShopSlug(window.location.pathname) } catch { return null }
  })
  const [blogSlug, setBlogSlug] = useState(() => {
    try { return extractBlogSlug(window.location.pathname) } catch { return null }
  })

  const scrollerRef = useRef(null)
  const inSection = section !== 'home'

  // Entrada escalonada del cartel: un frame después del montaje para que la
  // animación arranque desde el estado inicial y no se la coma el primer
  // paint.
  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(id)
  }, [])

  // SKULLEYGLYPH está cerrado hasta que se gana el logro. Mismo candado que
  // App.jsx, acá en una sola capa: si alguien llega por URL sin él, a la home.
  useEffect(() => {
    if (!achievementsReady || section !== 'section6') return
    if (hasAchievement('section6_unlocked')) return
    setSection('home')
    try { window.history.replaceState({}, '', baseUrl) } catch { }
  }, [achievementsReady, hasAchievement, section])

  const syncUrl = useCallback((id) => {
    try { window.history.pushState({}, '', sectionToPath(id)) } catch { }
  }, [])

  const goTo = useCallback((id) => {
    if (id === section) return
    try { navigator.vibrate?.(12) } catch { }
    setSection(id)
    syncUrl(id)
    // Cada capítulo abre arriba, no donde quedó el anterior.
    try { scrollerRef.current?.scrollTo?.({ top: 0 }) } catch { }
  }, [section, syncUrl])

  const goHome = useCallback(() => {
    setSection('home')
    setWorkSlug(null)
    setShopSlug(null)
    setBlogSlug(null)
    syncUrl('home')
  }, [syncUrl])

  // Atrás del navegador y los `navigate-section` que disparan componentes
  // compartidos (el carrito manda a la tienda así).
  useEffect(() => {
    const onPop = () => {
      try {
        const path = window.location.pathname
        setSection(pathToSection(path))
        setWorkSlug(extractWorkSlug(path))
        setShopSlug(extractShopSlug(path))
        setBlogSlug(extractBlogSlug(path))
      } catch { }
    }
    const onNavigate = (e) => {
      const target = e?.detail?.section
      if (target) goTo(target)
    }
    window.addEventListener('popstate', onPop)
    window.addEventListener('navigate-section', onNavigate)
    return () => {
      window.removeEventListener('popstate', onPop)
      window.removeEventListener('navigate-section', onNavigate)
    }
  }, [goTo])

  // Salir de una sección con la tecla de atrás lógica del sitio.
  useEffect(() => {
    const onExit = () => goHome()
    window.addEventListener('exit-section', onExit)
    return () => window.removeEventListener('exit-section', onExit)
  }, [goHome])

  const handleWorkSlug = useCallback((slug) => {
    setWorkSlug(slug)
    try {
      const path = slug ? `${baseUrl}work/${slug}` : sectionToPath('section1')
      window.history.replaceState({}, '', path)
    } catch { }
  }, [])

  const handleShopSlug = useCallback((slug) => {
    setShopSlug(slug)
    try {
      const path = slug ? `${baseUrl}lost-and-found-shop/${slug}` : sectionToPath('section3')
      window.history.replaceState({}, '', path)
    } catch { }
  }, [])

  const handleBlogSlug = useCallback((slug) => {
    setBlogSlug(slug)
    try {
      const path = slug ? `${baseUrl}blog/${slug}` : sectionToPath('section5')
      window.history.replaceState({}, '', path)
    } catch { }
  }, [])

  const chapterLabel = useMemo(() => ({
    section1: t('nav.section1'),
    section2: t('nav.section2'),
    section3: t('nav.section3'),
    section4: t('nav.section4'),
    section5: t('nav.section5'),
  }), [t, lang])

  return (
    <div className="mobile-shell">
      {/* ===== EL CARTEL ===== */}
      <div className={`poster ${entered ? 'is-in' : ''} ${inSection ? 'is-away' : ''}`}>
        {/* El personaje va detrás de todo y deja de renderizar cuando hay una
            sección encima: no se ve y no tiene por qué seguir gastando. */}
        <Suspense fallback={null}>
          <MobileCharacterPoster paused={inSection} />
        </Suspense>

        <div className="poster__layer">
          <header className="poster__head">
            <h1 className="poster-title">
              <span className="poster-title__line" style={{ '--i': 0 }}>Skulley</span>
              <span className="poster-title__line" style={{ '--i': 1 }}>Rad</span>
            </h1>
            <p className="poster__by" style={{ '--i': 2 }}>
              Oscar Moctezuma Rodríguez
            </p>
          </header>

          <nav className="poster__nav" aria-label={lang === 'es' ? 'Capítulos' : 'Chapters'}>
            {CHAPTERS.map((id, i) => (
              <button
                key={id}
                type="button"
                className="chapter"
                style={{ '--i': i + 3, '--accent': sectionColors[id] || '#ffffff' }}
                onClick={() => goTo(id)}
              >
                <span className="chapter__n">{String(i + 1).padStart(2, '0')}</span>
                <span className="chapter__name">{chapterLabel[id]}</span>
              </button>
            ))}
          </nav>

          <footer className="poster__foot" style={{ '--i': 8 }}>
            <button
              type="button"
              className="poster__lang"
              onClick={() => {
                            setLang(lang === 'es' ? 'en' : 'es')
              }}
              aria-label={t('nav.langSwitch')}
            >
              {t('nav.langShort')}
            </button>
          </footer>
        </div>
      </div>

      {/* ===== LOS CAPÍTULOS ===== */}
      {inSection && (
        <div
          ref={scrollerRef}
          className="mobile-section"
          data-section={section}
          style={{
            backgroundColor: sectionBgOverrides[section] || sectionColors[section] || '#000000',
          }}
        >
          <SectionSwitch
            section={section}
            scrollerRef={scrollerRef}
            workProjectSlug={workSlug}
            onWorkSlugChange={handleWorkSlug}
            shopProductSlug={shopSlug}
            onShopSlugChange={handleShopSlug}
            blogPostSlug={blogSlug}
            onBlogPostSlugChange={handleBlogSlug}
          />
        </div>
      )}

      {inSection && (
        <button
          type="button"
          className="mobile-close"
          onClick={goHome}
          aria-label={t('common.close') || 'Close'}
        >
          <XMarkIcon className="w-6 h-6" />
        </button>
      )}
    </div>
  )
}
