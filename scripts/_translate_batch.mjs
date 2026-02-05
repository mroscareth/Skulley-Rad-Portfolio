import fs from 'fs'

const BASE = 'd:/Work/mroscar/Website/new/interactive-portal-site/src'

function fix(file, pairs) {
  const p = `${BASE}/${file}`
  if (!fs.existsSync(p)) { console.log(`SKIP: ${file}`); return }
  let c = fs.readFileSync(p, 'utf8')
  let count = 0
  for (const [o, n] of pairs) {
    if (c.includes(o)) { c = c.replace(o, n); count++ }
    else console.log(`  NOT FOUND in ${file}: ${o.substring(0, 60)}`)
  }
  if (count) fs.writeFileSync(p, c, 'utf8')
  console.log(`${file}: ${count} replacement(s)`)
}

// Section2.jsx
fix('components/Section2.jsx', [
  ['offset para no solaparse con el marquee fixed (14vw \u2248 font-size del banner + margen)', 'offset to avoid overlapping the fixed marquee (14vw \u2248 banner font-size + margin)'],
])

// GridRevealOverlay.jsx
fix('components/GridRevealOverlay.jsx', [
  ['La animaci\u00f3n se controla directamente por las props phase y active.', 'Animation is controlled directly by the phase and active props.'],
  ["// 'in' = cubrir (0\u21921), 'out' = revelar (1\u21920)", "// 'in' = cover (0\u21921), 'out' = reveal (1\u21920)"],
])

// sfx.js
fix('lib/sfx.js', [
  ['\u00datil para subir \u201cclick/hover\u201d sin afectar part\u00edculas/otros FX.', 'Useful for boosting click/hover volume without affecting other SFX.'],
])

// useSceneTransition.js
fix('lib/useSceneTransition.js', [
  ['Hook principal para manejar transiciones', 'Main hook for managing scene transitions'],
  ['@param {React.RefObject} options.glRef - Referencia al renderer de Three.js', '@param {React.RefObject} options.glRef - Reference to the Three.js renderer'],
  ['@param {Function} options.onSectionChange - Callback para cambiar la secci\u00f3n', '@param {Function} options.onSectionChange - Callback to change the section'],
  ['@param {Function} options.onTransitionStart - Callback al iniciar transici\u00f3n', '@param {Function} options.onTransitionStart - Callback when transition starts'],
  ['@param {Function} options.onTransitionMid - Callback a mitad de transici\u00f3n (pantalla cubierta)', '@param {Function} options.onTransitionMid - Callback at mid-transition (screen covered)'],
  ['@param {Function} options.onTransitionEnd - Callback al terminar transici\u00f3n', '@param {Function} options.onTransitionEnd - Callback when transition ends'],
  ['@param {string} toSection - ID de la secci\u00f3n destino', '@param {string} toSection - Target section ID'],
  ['@param {string} effectType - Tipo de efecto (TransitionEffect.*)', '@param {string} effectType - Effect type (TransitionEffect.*)'],
  ['@param {Object} effectConfig - Configuraci\u00f3n adicional del efecto', '@param {Object} effectConfig - Additional effect configuration'],
  ['// Estado del overlay', '// Overlay state'],
])

console.log('\nBatch 4-5 done')
