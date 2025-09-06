import React from 'react'
import ContactForm from './ContactForm.jsx'

/**
 * Section4
 *
 * Placeholder for the fourth section.  Fill this area with your
 * desired content when the user reaches the last portal.
 */
export default function Section4() {
  return (
    <div className="contact-section text-black fixed inset-0 grid place-items-center px-4 overflow-hidden">
      <div className="contact-wrap">
        <ContactForm />
      </div>
    </div>
  )
}