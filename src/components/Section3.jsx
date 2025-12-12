import React from 'react'
import { useLanguage } from '../i18n/LanguageContext.jsx'

/**
 * Section3
 *
 * Placeholder for the third section.  Replace the text with your
 * actual content.
 */
export default function Section3() {
  const { t } = useLanguage()
  return (
    <div className="text-center text-gray-100 space-y-4 pointer-events-none">
      <h2 className="heading-2">{t('section3.title')}</h2>
      <p className="copy-base max-w-md mx-auto">
        {t('section3.p1')}
      </p>
    </div>
  )
}