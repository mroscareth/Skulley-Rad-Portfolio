import { useEffect } from 'react'
import { getSkin } from './skinRegistry.js'
import {
  setActiveSkinShader,
  applyCharacterSkinShader,
  materialTakesSkin,
  getSkinForcedColors,
  getCurrentSkinMode,
  SKIN_LINE_COLOR_EVENT,
} from './skinShaders.js'
import { applyCharacterColorsToScene, getCharacterColors, CHARACTER_COLOR_EVENT, EYES_ORB_ONLY } from './characterColors.js'

// La skin activa en cualquier render del personaje, no solo en el juego y el
// retrato: el preloader de escritorio y los dos personajes del teléfono
// (cartel y desarme). Antes esos tres solo tomaban los colores del customizer,
// así que con una skin de shader salía el Skulley "Personalizado".

export const ACTIVE_SKIN_KEY = 'skulley_active_skin'

export function readActiveSkinId() {
  try { return localStorage.getItem(ACTIVE_SKIN_KEY) || 'base' } catch { return 'base' }
}

// Enciende el shader global de una skin (modo, color de líneas y colores
// forzados). En escritorio lo maneja useSkinSystem; el teléfono no lo monta y
// llama esto con la skin guardada.
export function activateSkinShader(id) {
  const skin = getSkin(id)
  const line = skin?.lineColor || [0, 0, 0]
  const forced = skin?.forcedColors || null
  if (skin?.type === 'shader') setActiveSkinShader(skin.shaderMode || 0, skin.amount ?? 1, line, forced)
  else setActiveSkinShader(0, 1, line, forced)
}

// El teléfono escoge skin sin useSkinSystem (no hay logros que la desbloqueen
// ahí): la guarda y la enciende.
export function chooseSkin(id) {
  try { localStorage.setItem(ACTIVE_SKIN_KEY, id) } catch { }
  activateSkinShader(id)
}

// Para los canvas sin bloom (preloader, teléfono): se marcan como el retrato
// para que el shader no compense el bloom de la escena. Va ANTES del banding,
// como en Player y el retrato. Solo Head/Hair llevan skin.
export function prepareSkinMaterial(material) {
  if (!materialTakesSkin(material)) return material
  material.userData = { ...(material.userData || {}), __portraitMaterial: true }
  try { applyCharacterSkinShader(material) } catch { }
  return material
}

// Colores del customizer con lo que la skin manda: si fuerza colores (void,
// slime) o es la dorada, el cuerpo y el pelo los pone la skin y solo se
// recolorean ojos y orb. Misma regla que Player y el retrato.
export function applySkinColorsToScene(root, stored = getCharacterColors()) {
  const forced = getSkinForcedColors()
  const colors = forced ? { ...stored, ...forced } : stored
  const allow = (forced || getCurrentSkinMode() === 6) ? EYES_ORB_ONLY : null
  applyCharacterColorsToScene(root, colors, allow)
}

// Re-aplica al montar, al cambiar los colores y al cambiar de skin.
export function useSkinColors(root) {
  useEffect(() => {
    if (!root) return
    const apply = (e) => {
      const detail = e?.type === CHARACTER_COLOR_EVENT ? e.detail : undefined
      try { applySkinColorsToScene(root, detail || getCharacterColors()) } catch { }
    }
    apply()
    window.addEventListener(CHARACTER_COLOR_EVENT, apply)
    window.addEventListener(SKIN_LINE_COLOR_EVENT, apply)
    return () => {
      window.removeEventListener(CHARACTER_COLOR_EVENT, apply)
      window.removeEventListener(SKIN_LINE_COLOR_EVENT, apply)
    }
  }, [root])
}
