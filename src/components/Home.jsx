import React from 'react'
import { useLanguage } from '../i18n/LanguageContext.jsx'

/**
 * Home
 *
 * Displays introductory content on the home section.  You can customise
 * this component later to include your own text, images or interactive
 * elements.  It is positioned centrally within the viewport.
 */
export default function Home() {
  const { t } = useLanguage()
  return (
    <div className="text-center text-gray-100 space-y-4 pointer-events-none">
      <h1 className="heading-1">{t('home.title')}</h1>
      <p className="copy-base max-w-md mx-auto">
        {t('home.instructions.part1')}{' '}
        <strong>W A S D</strong>{' '}
        {t('home.instructions.part2')}
      </p>
    </div>
  )
}