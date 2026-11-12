import React, { useEffect } from 'react'
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/solid'
import NavOverlay from '../NavOverlay.jsx'
import useMenuAnimation from '../../hooks/useMenuAnimation.js'

// El menú de la versión rápida de escritorio: la hamburguesa de vidrio líquido
// de la esquina, que flota como las burbujas de QuickHome, abre el menú de
// pantalla completa del sitio (NavOverlay, el del teléfono; pedido de Oscar),
// con las palabras entrando en runas que se glitchean a su letra
// (`runasAlEntrar`). Abierto, la hamburguesa es la X blanca encima del overlay,
// como en el teléfono. Escape lo cierra.
const ANIM = { overlayMs: 260, itemOutMs: 200, itemStepMs: 100 }

export default function QuickMenu({ sections = [], labels = {}, onIr, lang, t, authenticated = false, onLogin, onInicio }) {
  const es = lang === 'es'
  const { menuOpen, menuVisible, open, close } = useMenuAnimation(sections.length, ANIM)
  const abierto = menuOpen && menuVisible

  useEffect(() => {
    if (!menuOpen) return undefined
    const onKey = (e) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen, close])

  return (
    <>
      {menuOpen && (
        <NavOverlay
          visible={menuVisible}
          onClose={close}
          onSelectSection={(id) => { close(); onIr?.(id) }}
          sections={sections}
          sectionLabel={labels}
          t={t}
          authenticated={authenticated}
          onLogin={onLogin ? () => { close(); onLogin() } : undefined}
          onInicio={onInicio ? () => { close(); onInicio() } : undefined}
          inicioLabel={es ? 'Volver al inicio' : 'Back to start'}
          runasAlEntrar
        />
      )}
      <div className={`qm-raiz ${abierto ? 'is-abierto' : ''}`}>
        <span className="qm-flota">
          <button
            type="button"
            className={`qm-boton h-12 w-12 rounded-full grid place-items-center ${abierto ? 'shadow-elev-lg border bg-white border-white text-black transition-colors duration-200' : 'burbuja-vidrio'}`}
            onClick={() => (abierto ? close() : open())}
            aria-expanded={abierto ? 'true' : 'false'}
            aria-controls="nav-overlay"
            aria-label={abierto ? (es ? 'Cerrar menú' : 'Close menu') : (es ? 'Abrir menú' : 'Open menu')}
          >
            {abierto ? <XMarkIcon className="w-5 h-5" /> : <Bars3Icon className="w-5 h-5" />}
          </button>
        </span>
      </div>
    </>
  )
}
