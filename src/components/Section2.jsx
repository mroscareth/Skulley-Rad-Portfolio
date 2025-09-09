import React from 'react'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import CharacterPortrait from './CharacterPortrait.jsx'

// About section: scrolleable content with a hero anchor where the Portrait will be portalized in hero mode
export default function Section2() {
  const { t } = useLanguage()
  return (
    <div className="pointer-events-auto relative">
      {/* Hero anchor for the CharacterPortrait (portal target). Non-sticky so it scrolls with content and avoids overlap */}
      <div id="about-hero-anchor" className="relative w-full flex items-start justify-center pt-2" style={{ minHeight: 'min(56vh, 560px)' }}>
        <CharacterPortrait showUI={false} mode="hero" zIndex={10} />
      </div>

      {/* Text content */}
      <div className="relative z-[10] max-w-[min(960px,92vw)] mx-auto px-4 sm:px-8 pt-2 pb-10 text-black">
        <article className="space-y-6 text-lg sm:text-xl leading-relaxed">
          <p>{t('about.p1')}</p>
          <p>{t('about.p2')}</p>
          <p>{t('about.p3')}</p>
        </article>
        <div className="h-24" />
      </div>
    </div>
  )
}