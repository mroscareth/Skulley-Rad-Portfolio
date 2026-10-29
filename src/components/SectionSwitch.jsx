import React, { lazy, Suspense, useEffect } from 'react'

const Section1 = lazy(() => import('./Section1.jsx'))
const Section2 = lazy(() => import('./Section2.jsx'))
const Section3 = lazy(() => import('./Section3.jsx'))
const Section4 = lazy(() => import('./Section4.jsx'))
const Section5 = lazy(() => import('./Section5.jsx'))
const Section6 = lazy(() => import('./Section6.jsx'))

// Qué componente monta cada sección, con qué props y dentro de qué contenedor
// de ancho. Vive aparte porque hay DOS árboles que montan secciones: el sitio
// completo (App.jsx) y la versión de teléfono (mobile/MobileApp.jsx). Si cada
// uno llevara su propio switch, tarde o temprano una sección recibiría una prop
// en uno y no en el otro.
//
// Lo que NO está acá a propósito: el contenedor que scrollea. En escritorio
// arrastra scrollbar propia, empuje del marquee (DESIGN.md §3.5) y la mezcla de
// ruido de las transiciones; en teléfono es un div con overflow y nada más.
// Eso lo pone cada árbol; lo que no puede divergir es esto.

function SectionReadySignal({ section, onReady }) {
  useEffect(() => {
    if (section === 'home') return
    try { onReady?.() } catch { }
  }, [section, onReady])
  return null
}

export default function SectionSwitch({
  section,
  scrollerRef = null,
  scrollVelocityRef = null,
  lenisRef = null,
  scrollbarOffsetRight = 0,
  workProjectSlug = null,
  onWorkSlugChange,
  shopProductSlug = null,
  onShopSlugChange,
  blogPostSlug = null,
  onBlogPostSlugChange,
  onSectionReady,
}) {
  return (
    <Suspense fallback={null}>
      {/* La tienda corre a sangre completa: cada módulo del shop decide su
          propio ancho (unos full-bleed, otros centrados). El resto de las
          secciones conserva el contenedor angosto. */}
      <div className={`relative ${section === 'section3' ? 'w-full pb-12' : 'mx-auto max-w-5xl px-6 sm:px-8 pt-6 pb-12'}`}>
        {section === 'section1' && (
          <Section1
            scrollerRef={scrollerRef}
            scrollbarOffsetRight={scrollbarOffsetRight}
            scrollVelocityRef={scrollVelocityRef}
            lenisRef={lenisRef}
            initialSlug={workProjectSlug}
            onSlugChange={onWorkSlugChange}
          />
        )}
        {section === 'section2' && <Section2 scrollVelocityRef={scrollVelocityRef} />}
        {section === 'section3' && <Section3 initialSlug={shopProductSlug} onSlugChange={onShopSlugChange} />}
        {section === 'section4' && <Section4 />}
        {section === 'section5' && (
          <Section5 initialPostSlug={blogPostSlug} onPostSlugChange={onBlogPostSlugChange} />
        )}
        {section === 'section6' && <Section6 />}
        <SectionReadySignal section={section} onReady={onSectionReady} />
      </div>
    </Suspense>
  )
}
