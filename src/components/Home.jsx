import React from 'react'

/**
 * Home
 *
 * Displays introductory content on the home section.  You can customise
 * this component later to include your own text, images or interactive
 * elements.  It is positioned centrally within the viewport.
 */
export default function Home() {
  return (
    <div className="text-center text-gray-100 space-y-4 pointer-events-none">
      <h1 className="text-4xl font-bold">Bienvenido</h1>
      <p className="text-lg max-w-md mx-auto">
        Usa las teclas <strong>W A S D</strong> o las flechas del teclado para mover al
        personaje.  Explora el escenario e ingresa a los portales brillantes
        para cambiar de sección.
      </p>
    </div>
  )
}