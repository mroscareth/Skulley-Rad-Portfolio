import React from 'react'
import ContactForm from './ContactForm.jsx'

/**
 * Section4
 *
 * Contact section: step-by-step form in the editorial + toon language (DESIGN.md §14).
 * Uses fixed positioning + overflow-hidden to prevent scrolling.
 */
export default function Section4() {
  return (
    <div className="contact-section fixed inset-0 grid place-items-center px-4 overflow-hidden">
      <div className="contact-wrap w-full max-w-3xl mx-auto">
        <ContactForm />
      </div>
    </div>
  )
}
