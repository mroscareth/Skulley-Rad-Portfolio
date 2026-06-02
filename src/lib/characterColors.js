// Personalización de color del personaje (Skulley) — slot único en localStorage,
// igual patrón que useActiveDiscount.js: una sola fuente de verdad + un
// CustomEvent que notifica a TODOS los lugares donde se renderiza el personaje
// (escena principal, retrato, hero, piezas del desarme).
//
// Por qué es barato: applyToonBanding (ver src/lib/toonBanding.js) cuantiza la
// luminancia y reescala el RGB con esa razón → conserva el tono y solo escalona
// la intensidad. Por eso cambiar material.color MANTIENE el look toon sin tocar
// el shader. Cambiar .color/.emissive es un uniform → NO requiere needsUpdate
// (no recompila el programa) → preview instantáneo arrastrando el picker.
//
// Materiales del GLB (character.glb) que personalizamos, por NOMBRE:
//   "Head"        → cuerpo/esqueleto (la mayoría de los meshes)
//   "Eyes"        → ojos (color + emissive; el emissive dispara el bloom)
//   "Hair"        → pelo
//   "Emisive mat" → esfera luminosa en la mano (color + emissive, emissive fuerte)
// Se deja intacto: "Pupils" (negro plano).

const STORAGE_KEY = 'skulley_character_colors'
export const CHARACTER_COLOR_EVENT = 'character-colors-changed'

// Defaults = colores originales del GLB convertidos a sRGB (lo que el <input
// type=color> entrega). material.color.set(hex) interpreta el hex como sRGB y
// lo pasa a linear → reproduce el look de fábrica. El baseColorFactor del glTF
// es linear: Head [1,0,0], Eyes [1,0.565,0], Hair [0,0.831,1].
export const DEFAULT_CHARACTER_COLORS = Object.freeze({
  head: '#ff0000', // esqueleto/cuerpo
  eyes: '#ffc500', // ojos brillantes
  hair: '#00ebff', // pelo
  orb: '#00ff00',  // esfera luminosa en la mano
})

let cache = null

function sanitize(obj) {
  const out = { ...DEFAULT_CHARACTER_COLORS }
  if (obj && typeof obj === 'object') {
    for (const k of Object.keys(DEFAULT_CHARACTER_COLORS)) {
      const v = obj[k]
      if (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)) out[k] = v
    }
  }
  return out
}

function readStore() {
  if (cache) return cache
  try {
    const raw = (typeof localStorage !== 'undefined') ? localStorage.getItem(STORAGE_KEY) : null
    cache = sanitize(raw ? JSON.parse(raw) : null)
  } catch {
    cache = { ...DEFAULT_CHARACTER_COLORS }
  }
  return cache
}

export function getCharacterColors() {
  return { ...readStore() }
}

export function setCharacterColors(next) {
  cache = sanitize({ ...readStore(), ...next })
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cache)) } catch { }
  try { window.dispatchEvent(new CustomEvent(CHARACTER_COLOR_EVENT, { detail: { ...cache } })) } catch { }
  return { ...cache }
}

export function resetCharacterColors() {
  return setCharacterColors({ ...DEFAULT_CHARACTER_COLORS })
}

// Aplica los colores a UN material según su nombre. Idempotente y barato.
// `colors` opcional para reusar el detail del evento sin re-leer el store.
// `allow` (opcional): array de keys permitidas (ej. ['eyes','orb']). Si se pasa,
// solo esos materiales se recolorean → en gold / skins shader el cuerpo y pelo
// los define la skin, así que el user solo cambia ojos y orb.
export function applyCharacterColorsToMaterial(material, colors = getCharacterColors(), allow = null) {
  if (!material || !material.isMaterial || !material.name) return
  const ok = (key) => !allow || allow.includes(key)
  const name = material.name
  if (/^Eyes$/i.test(name)) {
    if (!ok('eyes')) return
    // Ojos: color + emissive. Se conserva emissiveIntensity del GLB (strength 2)
    // → siguen "brillando" con el bloom, solo cambia el tono.
    if (material.color) material.color.set(colors.eyes)
    if (material.emissive) material.emissive.set(colors.eyes)
    return
  }
  if (/^Head$/i.test(name)) {
    if (!ok('head')) return
    if (material.color) material.color.set(colors.head)
    return
  }
  if (/^Hair$/i.test(name)) {
    if (!ok('hair')) return
    if (material.color) material.color.set(colors.hair)
    return
  }
  // "Emisive mat" (typo del GLB) = esfera luminosa en la mano. Color + emissive
  // (mantiene el emissiveIntensity fuerte del GLB → sigue brillando).
  if (/emis+ive/i.test(name)) {
    if (!ok('orb')) return
    if (material.color) material.color.set(colors.orb)
    if (material.emissive) material.emissive.set(colors.orb)
    return
  }
}

// Recorre una escena clonada del personaje y recolorea todos los materiales que
// matcheen. Se llama al montar (estado inicial) y en cada CHARACTER_COLOR_EVENT.
// `allow` se reenvía a applyCharacterColorsToMaterial (ver arriba).
export function applyCharacterColorsToScene(root, colors = getCharacterColors(), allow = null) {
  if (!root || typeof root.traverse !== 'function') return
  try {
    root.traverse((obj) => {
      if (!obj || !obj.material) return
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
      mats.forEach((m) => applyCharacterColorsToMaterial(m, colors, allow))
    })
  } catch { }
}

// Keys de color que el usuario puede editar según la skin activa: en base, las 4;
// en cualquier otra skin (gold / shader) solo ojos y orb (el cuerpo/pelo los
// define la skin). Fuente única para UI (customizer) y aplicación (Player/retrato).
export const EYES_ORB_ONLY = ['eyes', 'orb']
export function colorKeysForSkin(skinId) {
  return skinId === 'base' ? null : EYES_ORB_ONLY
}
