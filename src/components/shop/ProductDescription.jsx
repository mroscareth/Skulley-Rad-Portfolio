import React from 'react'

/**
 * La descripción de una pieza, por párrafos. Cada punto y aparte que se
 * escribe en el CMS es un párrafo con aire fijo entre uno y otro; con
 * `whitespace-pre-line` quedaba pegado al anterior o con un renglón vacío
 * entero, según cuántos Enter se dieran. La misma en la destacada y en el
 * detalle.
 */
export default function ProductDescription({ text, className = '' }) {
  const paragraphs = String(text || '')
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
  if (!paragraphs.length) return null

  return (
    <div className={`space-y-[1em] ${className}`}>
      {paragraphs.map((p, i) => <p key={i}>{p}</p>)}
    </div>
  )
}
