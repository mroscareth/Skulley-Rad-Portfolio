import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeftIcon, Bars3Icon, MusicalNoteIcon, ShoppingCartIcon, XMarkIcon } from '@heroicons/react/24/solid'
import { useLanguage } from '../../i18n/LanguageContext.jsx'
import { useAuth } from '../../auth/authContext.js'
import useUserProfile from '../../hooks/useUserProfile.js'
import useTicketDiscount from '../../hooks/useTicketDiscount.js'
import { useShopCartCtx } from '../../lib/shopCartContext.jsx'
import useMenuAnimation from '../../hooks/useMenuAnimation.js'
import NavOverlay from '../NavOverlay.jsx'
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
import { preloadSfx, setSfxEnabled, unlockSfx } from '../../lib/sfx.js'
import SectionSwitch from '../SectionSwitch.jsx'
// El cartel va lazy: trae el Canvas y con él three. Así el título y los
// capítulos pintan primero y el personaje entra cuando llega — en un teléfono
// esa diferencia es el arranque completo.
const MobileScrollHome = lazy(() => import('./MobileScrollHome.jsx'))
// La tienda completa del sitio, igual que en App.jsx: el panel del carrito,
// el regreso de Stripe (?pedido=TOKEN) y Mi cuenta (de ahí se bajan los
// digitales).
const ShopCart = lazy(() => import('../shop/ShopCart.jsx'))
const OrderStatusModal = lazy(() => import('../shop/OrderStatusModal.jsx'))
const AccountModal = lazy(() => import('../account/AccountModal.jsx'))
// El DJ deck de escritorio, el mismo modal. Se monta desde el arranque (oculto):
// tiene que existir cuando se pica "Con audio" para reanudar su audio en ese
// mismo tap. No baja ninguna canción hasta que hay audio (autoStart).
const MusicModal = lazy(() => import('../MusicModal.jsx'))

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
  const {
    has: hasAchievement,
    isLoaded: achievementsReady,
    achievements: achievementSet,
    unlockedAt: achievementDates,
  } = useAchievements()

  // Hover/click global en todo lo interactivo, igual que en App.jsx.
  useGlobalSfx()

  // ── Audio ──────────────────────────────────────────────────────────────
  // En escritorio el audio lo destraba el ENTER del preloader; aquí no hay
  // preloader, así que la home pregunta "Con audio / Sin audio" antes de
  // dejar scrollear (sin ese tap el teléfono no deja sonar ni el trueno del
  // rayo). null = todavía no elige. Vive aquí y no en la home para que al
  // regresar de una sección no se vuelva a preguntar; recargar sí pregunta,
  // porque el permiso del navegador se pierde.
  const [audio, setAudio] = useState(null)
  const elegirAudio = useCallback((conAudio) => {
    // Todo esto corre dentro del tap: es lo que el teléfono acepta como
    // permiso para sonar.
    if (conAudio) {
      unlockSfx()
      try { window.dispatchEvent(new CustomEvent('audio-unlock')) } catch { }
      try { preloadSfx(['thunder.mp3']) } catch { }
    } else {
      setSfxEnabled(false)
    }
    setAudio(conAudio ? 'on' : 'off')
  }, [])

  const [showMusic, setShowMusic] = useState(false)
  const [tracks, setTracks] = useState([])
  useEffect(() => {
    let vivo = true
    fetch(`${import.meta.env.BASE_URL}songs/manifest.json`, { cache: 'no-cache' })
      .then((r) => r.json())
      .then((json) => { if (vivo) setTracks(Array.isArray(json) ? json : []) })
      .catch(() => { })
    return () => { vivo = false }
  }, [])
  const [pageHidden, setPageHidden] = useState(false)
  useEffect(() => {
    const onVis = () => setPageHidden(document.visibilityState === 'hidden')
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  // Sesión, perfil y ticket: lo que el carrito necesita para cobrar. El ticket
  // (Silver o Golden) se gana en computadora, pero se puede usar aquí.
  const { login, logout, authenticated, ready: authReady, mountAuth } = useAuth()
  const userProfile = useUserProfile()
  const { goldenTicketAvailable, ticketTier, ticketPct } = useTicketDiscount(userProfile)
  const shopCart = useShopCartCtx()

  // Mismos eventos que App.jsx: el carrito pide sesión para pagar digitales
  // (`auth-login-request`) y el pedido o el correo abren Mi cuenta en
  // Descargas (`account-open-request`). Sin sesión se pide y, al entrar, se
  // abre la pestaña que se pidió.
  const [accountOpen, setAccountOpen] = useState(false)
  const [accountTab, setAccountTab] = useState(null)
  const accountWantedRef = useRef(null)
  useEffect(() => {
    const onAccount = (e) => {
      const wanted = e?.detail?.tab || null
      if (authenticated) { setAccountTab(wanted); setAccountOpen(true) }
      else { accountWantedRef.current = wanted || 'achievements'; login() }
    }
    const onLogin = () => { if (!authenticated) login() }
    window.addEventListener('account-open-request', onAccount)
    window.addEventListener('auth-login-request', onLogin)
    return () => {
      window.removeEventListener('account-open-request', onAccount)
      window.removeEventListener('auth-login-request', onLogin)
    }
  }, [authenticated, login])
  useEffect(() => {
    if (!authenticated || !accountWantedRef.current) return
    setAccountTab(accountWantedRef.current)
    setAccountOpen(true)
    accountWantedRef.current = null
  }, [authenticated])
  // Enlace del correo: ?cuenta=descargas. Se monta el auth para saber si ya
  // hay sesión antes de decidir entre abrir la pestaña o pedir que entre.
  const accountParamRef = useRef(null)
  useEffect(() => {
    try {
      const url = new URL(window.location.href)
      if (url.searchParams.get('cuenta') !== 'descargas') return
      accountParamRef.current = 'downloads'
      url.searchParams.delete('cuenta')
      window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
      mountAuth?.()
    } catch { }
  }, [mountAuth])
  useEffect(() => {
    if (!accountParamRef.current || !(authReady || authenticated)) return
    const wanted = accountParamRef.current
    accountParamRef.current = null
    window.dispatchEvent(new CustomEvent('account-open-request', { detail: { tab: wanted } }))
  }, [authReady, authenticated])

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

  // El menú de hamburguesa del sitio compacto (App.jsx): mismo overlay, mismos
  // tiempos de entrada y salida escalonada.
  const {
    menuOpen,
    menuVisible,
    open: openMenu,
    close: closeMenu,
  } = useMenuAnimation(CHAPTERS.length, { overlayMs: 260, itemOutMs: 200, itemStepMs: 100 })

  useEffect(() => {
    if (!menuOpen) return undefined
    const onKeyDown = (e) => { if (e.key === 'Escape') closeMenu() }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [menuOpen, closeMenu])

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

  // El botón de salir tiene dos modos, como en App.jsx: con un proyecto o un
  // post abierto es "atrás" (cierra el detalle y deja la lista); si no, X
  // (regresa a la home). Las secciones avisan con `portrait-exit-mode`.
  const [closeMode, setCloseMode] = useState('close')
  useEffect(() => {
    const onMode = (e) => {
      const mode = e?.detail?.mode
      if (mode === 'back' || mode === 'close') setCloseMode(mode)
    }
    window.addEventListener('portrait-exit-mode', onMode)
    return () => window.removeEventListener('portrait-exit-mode', onMode)
  }, [])

  const goTo = useCallback((id) => {
    if (id === section) return
    try { navigator.vibrate?.(12) } catch { }
    setCloseMode('close')
    setSection(id)
    syncUrl(id)
    // Cada capítulo abre arriba, no donde quedó el anterior.
    try { scrollerRef.current?.scrollTo?.({ top: 0 }) } catch { }
  }, [section, syncUrl])

  const goHome = useCallback(() => {
    setCloseMode('close')
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
        // De regreso a una lista (o a la home) ya no hay detalle que cerrar.
        if (!extractWorkSlug(path) && !extractShopSlug(path) && !extractBlogSlug(path)) setCloseMode('close')
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

  // Abrir o cerrar un detalle agrega una entrada al historial, igual que en
  // App.jsx: así "atrás" (el botón del teléfono o el gesto) regresa paso a
  // paso, del proyecto a la lista y de la lista a la home.
  const handleWorkSlug = useCallback((slug) => {
    setWorkSlug(slug)
    try {
      const path = slug ? `${baseUrl}work/${slug}` : sectionToPath('section1')
      if (window.location.pathname !== path) window.history.pushState({}, '', path)
    } catch { }
  }, [])

  const handleShopSlug = useCallback((slug) => {
    setShopSlug(slug)
    try {
      const path = slug ? `${baseUrl}lost-and-found-shop/${slug}` : sectionToPath('section3')
      if (window.location.pathname !== path) window.history.pushState({}, '', path)
    } catch { }
  }, [])

  const handleBlogSlug = useCallback((slug) => {
    setBlogSlug(slug)
    try {
      const path = slug ? `${baseUrl}blog/${slug}` : sectionToPath('section5')
      if (window.location.pathname !== path) window.history.pushState({}, '', path)
    } catch { }
  }, [])

  // Las tarjetas de la home (último proyecto, post y pieza de la tienda)
  // entran a su sección con el slug puesto: la sección abre el detalle sola,
  // igual que con un deep link, y la URL queda en /work/slug y compañía.
  const openPiece = useCallback((id, slug) => {
    goTo(id)
    if (!slug) return
    if (id === 'section1') handleWorkSlug(slug)
    else if (id === 'section3') handleShopSlug(slug)
    else if (id === 'section5') handleBlogSlug(slug)
  }, [goTo, handleWorkSlug, handleShopSlug, handleBlogSlug])

  const chapterLabel = useMemo(() => ({
    section1: t('nav.section1'),
    section2: t('nav.section2'),
    section3: t('nav.section3'),
    section4: t('nav.section4'),
    section5: t('nav.section5'),
  }), [t, lang])

  // En la home, antes de elegir con o sin audio, solo se ve el idioma; los
  // demás botones aparecen al elegir, uno tras otro (ver .msh-hud-entra,
  // --i es su turno). Con el deck abierto se oculta todo.
  const antesDeAudio = !inSection && audio === null
  const entra = (i) => (antesDeAudio
    ? { className: 'opacity-0 pointer-events-none', style: undefined }
    : { className: 'msh-hud-entra', style: { '--i': i } })

  return (
    <div className="mobile-shell">
      {/* ===== LA HOME: EL SCROLL DONDE SE DESARMA ===== */}
      {/* Se desmonta al entrar a una sección en vez de quedarse escondida: el
          canvas y las 33 piezas horneadas no tienen por qué seguir vivos
          debajo de un capítulo que ocupa toda la pantalla. */}
      {!inSection && (
        <Suspense fallback={null}>
          <MobileScrollHome
            onGoToSection={goTo}
            onOpenPiece={openPiece}
            audioElegido={audio !== null}
            onElegirAudio={elegirAudio}
          />
        </Suspense>
      )}

      {/* Los botones flotantes. En la home, hasta elegir con o sin audio,
          solo está el idioma: lo único que se puede hacer es elegir (Oscar,
          2026-10-30). En los capítulos siempre están. Todos se ocultan con el
          deck abierto (trae su propia X), como en el HUD compacto de App.jsx. */}

      {/* La hamburguesa, arriba a la derecha. Es su propio switch: con el menú
          abierto sube encima del overlay (999996); cerrado queda arriba de la
          sección pero debajo de los modales (el carrito, la ficha, Mi cuenta),
          que traen su X en esa misma esquina. */}
      <button
        type="button"
        onClick={() => (menuOpen ? closeMenu() : openMenu())}
        className={`msh-hamburguesa fixed h-12 w-12 rounded-full grid place-items-center shadow-elev-lg backdrop-blur-3xl border transition-[opacity,background-color,color] duration-200 ${menuOpen ? 'z-[999998] bg-white border-white text-black' : 'z-[12] bg-black/40 border-white/[0.12] text-white hover:bg-white/[0.15]'} ${showMusic ? 'opacity-0 pointer-events-none' : entra(2).className}`}
        style={entra(2).style}
        aria-expanded={menuOpen ? 'true' : 'false'}
        aria-controls="nav-overlay"
        aria-label={t('a11y.openNavigationMenu')}
      >
        <Bars3Icon className="w-5 h-5" />
      </button>

      {/* Abajo al centro: idioma, carrito y música en la barra de vidrio de
          DesktopNav (Oscar, 2026-10-30), con botones un poco más grandes para
          el dedo. Arriba de la sección pero debajo de los modales, que tienen
          sus botones abajo (Agregar, Pagar). Antes de elegir audio solo trae
          el idioma; al elegir se abre y entran carrito y música. Se oculta con
          el menú o el deck abiertos. */}
      <div className={`msh-barra fixed inset-x-0 z-[12] flex justify-center pointer-events-none transition-opacity duration-200 ${showMusic || menuOpen ? 'opacity-0' : 'opacity-100'}`}>
        <div className={`${showMusic || menuOpen ? '' : 'pointer-events-auto'} bg-black/35 backdrop-blur-3xl rounded-full border border-white/[0.12] shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-1.5 flex items-center gap-0.5`}>
          {/* Idioma: el mismo botón único de DesktopNav (ENG / ESP, alterna). */}
          <button
            type="button"
            onClick={() => setLang(lang === 'es' ? 'en' : 'es')}
            className="px-3 py-2.5 rounded-full text-white hover:bg-white/[0.08] transition-colors text-base font-marquee uppercase tracking-wide leading-5"
            aria-label={t('common.switchLanguage')}
            title={t('common.switchLanguage')}
          >
            {t('nav.langShort')}
          </button>
          {!antesDeAudio && (
            <span className="msh-barra-entra flex items-center" style={{ '--i': 0 }}>
              <span className="mx-0.5 h-5 w-px bg-white/[0.12]" />
              <button
                type="button"
                onClick={() => { try { window.dispatchEvent(new CustomEvent('shop-cart-open-request')) } catch { } }}
                className="relative px-3 py-2.5 rounded-full text-white hover:bg-white/[0.08] transition-colors"
                aria-label={lang === 'es' ? 'Abrir carrito' : 'Open cart'}
              >
                <ShoppingCartIcon className="w-5 h-5" />
                {shopCart?.totalItems > 0 && (
                  <span className="absolute top-0.5 right-0.5 min-w-[16px] h-[16px] px-1 grid place-items-center rounded-full bg-white text-black text-[10px] font-black">
                    {shopCart.totalItems}
                  </span>
                )}
              </button>
            </span>
          )}
          {!antesDeAudio && (
            <span className="msh-barra-entra flex items-center" style={{ '--i': 1 }}>
              <span className="mx-0.5 h-5 w-px bg-white/[0.12]" />
              <button
                type="button"
                onClick={() => setShowMusic((v) => !v)}
                className="px-3 py-2.5 rounded-full text-white hover:bg-white/[0.08] transition-colors"
                aria-label={lang === 'es' ? 'Música' : 'Music'}
              >
                <MusicalNoteIcon className="w-5 h-5" />
              </button>
            </span>
          )}
        </div>
      </div>

      {menuOpen && (
        <NavOverlay
          visible={menuVisible}
          onClose={closeMenu}
          onSelectSection={(id) => { closeMenu(); goTo(id) }}
          sections={CHAPTERS}
          sectionLabel={chapterLabel}
          t={t}
        />
      )}

      {/* ===== LOS CAPÍTULOS ===== */}
      {inSection && (
        <div
          ref={scrollerRef}
          className="mobile-section section-scroll"
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
          className="mobile-close h-12 w-12 rounded-full grid place-items-center shadow-elev-lg backdrop-blur-3xl border bg-black/40 border-white/[0.12] text-white hover:bg-white/[0.15] transition-colors"
          onClick={() => {
            if (closeMode === 'back') {
              try { window.dispatchEvent(new CustomEvent('detail-close')) } catch { }
            } else {
              goHome()
            }
          }}
          aria-label={closeMode === 'back' ? t('common.back') : (t('common.close') || 'Close')}
        >
          {closeMode === 'back' ? <ArrowLeftIcon className="w-5 h-5" /> : <XMarkIcon className="w-5 h-5" />}
        </button>
      )}

      <Suspense fallback={null}>
        <MusicModal
          open={showMusic}
          onClose={() => setShowMusic(false)}
          tracks={tracks}
          audioReady={audio === 'on'}
          pageHidden={pageHidden}
        />
      </Suspense>

      {/* La tienda, montada como en App.jsx: el panel sale por portal a body. */}
      <Suspense fallback={null}>
        <ShopCart
          anchorToPortrait={false}
          goldenTicketAvailable={goldenTicketAvailable}
          ticketTier={ticketTier}
          ticketPct={ticketPct}
        />
        <OrderStatusModal />
      </Suspense>

      {accountOpen && (
        <Suspense fallback={null}>
          <AccountModal
            open={accountOpen}
            initialTab={accountTab}
            onClose={() => { setAccountOpen(false); setAccountTab(null) }}
            userProfile={userProfile}
            achievements={achievementSet}
            unlockedAt={achievementDates}
            onLogout={() => { setAccountOpen(false); logout() }}
            lang={lang}
            t={t}
          />
        </Suspense>
      )}
    </div>
  )
}
