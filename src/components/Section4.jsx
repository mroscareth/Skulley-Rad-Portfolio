import React from 'react'
import ContactForm from './ContactForm.jsx'
import { useLanguage } from '../i18n/LanguageContext.jsx'

/**
 * Section4
 *
 * Contact section: step-by-step form in the editorial + toon language (DESIGN.md §14).
 * Uses fixed positioning + overflow-hidden to prevent scrolling.
 */
export default function Section4() {
  const { lang } = useLanguage()
  return (
    <div className="contact-section fixed inset-0 grid place-items-center px-4 overflow-hidden">
      {/* El título visible es el marquee; este es el H1 que lee Google. */}
      <h1 className="sr-only">
        {lang === 'es' ? 'Contacto: trabaja con Oscar Moctezuma' : 'Contact: work with Oscar Moctezuma'}
      </h1>
      <div className="contact-wrap w-full max-w-3xl mx-auto">
        <ContactForm />
      </div>
    </div>
  )
}
