import React from 'react'
import { useLanguage } from '../i18n/LanguageContext.jsx'

// About section: scrolleable content with a hero anchor where the Portrait will be portalized in hero mode
export default function Section2() {
  const { t } = useLanguage()
  return (
    <div className="pointer-events-auto relative">
      {/* Text content */}
      <div className="relative z-[10] max-w-[min(960px,92vw)] mx-auto px-4 sm:px-8 pt-2 pb-10 text-black">
        <article className="space-y-7 copy-xl">
          <p>{t('about.p1')}</p>
          <p>{t('about.p2')}</p>
          <p>{t('about.p3')}</p>
          {(() => { const v = t('about.p4'); return v !== 'about.p4' ? (<p>{v}</p>) : null })()}
          {(() => { const v = t('about.p5'); return v !== 'about.p5' ? (<p>{v}</p>) : null })()}
        </article>
        <div className="h-24" />
      </div>
    </div>
  )
}