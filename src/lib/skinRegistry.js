// Registro de skins del personaje — fuente única de verdad para qué skins
// existen y cómo se aplican. Cada skin declara su ESTRATEGIA:
//   - 'recolor'  → usa los colores del customizer (characterColors.js). Base.
//   - 'glbSwap'  → cambia de modelo GLB. La dorada (characterGold.glb).
//   - 'shader'   → inyecta un shader animado (skinShaders.js) sobre el modelo
//                  base. Cambiar entre shader skins = escribir un uniform.
//
// Ownership se resuelve fuera (useSkinSystem):
//   - alwaysOwned: base, siempre.
//   - source 'gold_skin': flag del perfil (score ≥ 3000).
//   - achievementKey: logro/quest (sistema de achievements). Ver CHARACTER.md.

export const SKINS = [
  {
    id: 'base',
    type: 'recolor',
    alwaysOwned: true,
    swatch: 'conic-gradient(from 210deg, #ff0000, #ffc500, #00ebff, #ff0000)',
    label: { en: 'Custom', es: 'Personalizada' },
  },
  {
    id: 'gold',
    // Shader procedural (modo 6) sobre el MISMO modelo base — ya NO swap de GLB.
    // Así la viñeta/anchors siguen al hueso de cabeza del modelo base (el GLB
    // dorado rompía el tracking → viñeta atorada en el centro).
    type: 'shader',
    shaderMode: 6,
    amount: 1.0,
    source: 'gold_skin',
    // Cuerpo/pelo = oro (shader); solo ojos + orb editables.
    editableColors: ['eyes', 'orb'],
    swatch: 'linear-gradient(135deg, #fff6c2 0%, #f2cf52 38%, #c79a23 70%, #8a6d1d 100%)',
    label: { en: 'Legendary Gold', es: 'Dorada Legendaria' },
    hint: {
      en: 'Score 5000 in the sphere game to earn it.',
      es: 'Anota 5000 en el juego de esferas para ganarla.',
    },
  },
  {
    id: 'oilslick',
    type: 'shader',
    shaderMode: 1,
    // amount 1.0 = albedo 100% procedural → el color del skin Custom no se
    // asoma por debajo (sin overlap). El banding toon igual lo sombrea.
    amount: 1.0,
    achievementKey: 'skin_oilslick',
    swatch: 'linear-gradient(135deg, #ff00cc 0%, #3333ff 30%, #00ffcc 55%, #ffcc00 80%, #ff00cc 100%)',
    label: { en: 'Oil Slick', es: 'Aceite Iridiscente' },
    hint: {
      en: 'Unlocked through a M.A.D.R.E. quest.',
      es: 'Se desbloquea completando una quest de M.A.D.R.E.',
    },
  },
  {
    id: 'hologram',
    type: 'shader',
    shaderMode: 2,
    amount: 1.0,
    achievementKey: 'skin_hologram',
    swatch: 'linear-gradient(135deg, #00eaff 0%, #7a5cff 50%, #00eaff 100%)',
    label: { en: 'Hologram', es: 'Holograma' },
    hint: {
      en: 'Unlocked through a M.A.D.R.E. quest.',
      es: 'Se desbloquea completando una quest de M.A.D.R.E.',
    },
  },
  {
    id: 'void',
    type: 'shader',
    shaderMode: 3,
    amount: 1.0,
    achievementKey: 'skin_void',
    // Stroke (outline) + ink lines en BLANCO: la superficie es casi negra, el
    // negro por default desaparecería. useSkinSystem lo pasa a setActiveSkinShader.
    lineColor: [1, 1, 1],
    // Ojos y orb SIEMPRE blancos y NO editables (cosmos monocromo). forcedColors
    // los fuerza en el render; editableColors:[] oculta sus pickers en el customizer.
    forcedColors: { eyes: '#ffffff', orb: '#ffffff' },
    editableColors: [],
    swatch: 'radial-gradient(circle at 32% 30%, #4a4a82 0%, #1a1a3a 45%, #05050f 80%)',
    label: { en: 'Void', es: 'Vacío' },
    hint: {
      en: 'Unlocked through a M.A.D.R.E. quest.',
      es: 'Se desbloquea completando una quest de M.A.D.R.E.',
    },
  },
  {
    id: 'slime',
    type: 'shader',
    shaderMode: 5,
    amount: 1.0,
    achievementKey: 'skin_slime',
    // Ojos morados neón forzados (look de la referencia); orb editable.
    forcedColors: { eyes: '#b026ff' },
    editableColors: ['orb'],
    swatch: 'linear-gradient(135deg, #b8ff2e 0%, #16e000 45%, #0a8a16 100%)',
    label: { en: 'Green Slime', es: 'Slime Verde' },
    hint: {
      en: 'Unlocked through a M.A.D.R.E. quest.',
      es: 'Se desbloquea completando una quest de M.A.D.R.E.',
    },
  },
  {
    id: 'lava',
    type: 'shader',
    shaderMode: 4,
    amount: 1.0,
    achievementKey: 'skin_lava',
    // Emite gotas de lava (LavaDrips) mientras está activa.
    swatch: 'linear-gradient(135deg, #2a0a00 0%, #ff3b00 42%, #ffd000 68%, #2a0a00 100%)',
    label: { en: 'Molten Lava', es: 'Lava Fundida' },
    hint: {
      en: 'Unlocked through a M.A.D.R.E. quest.',
      es: 'Se desbloquea completando una quest de M.A.D.R.E.',
    },
  },
]

export function getSkin(id) {
  return SKINS.find((s) => s.id === id) || SKINS[0]
}

export function localizeSkin(skin, lang = 'en') {
  const L = (v) => (v && typeof v === 'object' ? (v[lang] ?? v.en) : v)
  return {
    ...skin,
    label: L(skin.label),
    hint: L(skin.hint),
  }
}
