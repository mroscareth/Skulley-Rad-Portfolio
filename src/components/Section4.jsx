import React from 'react'
import ContactForm from './ContactForm.jsx'

/**
 * Section4
 *
 * Contact section with terminal-themed form.
 * Uses fixed positioning + overflow-hidden to prevent scrolling.
 */
export default function Section4() {
  return (
    <div className="contact-section fixed inset-0 grid place-items-center px-4 overflow-hidden">
      <div className="contact-wrap w-full max-w-xl mx-auto">
        <ContactForm />
      </div>
    </div>
  )
}