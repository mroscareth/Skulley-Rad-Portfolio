// Batch 5: Remaining Spanish comments across all files
import { readFileSync, writeFileSync, existsSync } from 'fs'
const base = 'd:/Work/mroscar/Website/new/interactive-portal-site/src/'

function rep(file, pairs) {
  const p = base + file
  if (!existsSync(p)) { console.log(`SKIP: ${file}`); return }
  let t = readFileSync(p, 'utf8')
  let count = 0
  for (const [old, nw] of pairs) {
    if (t.includes(old)) { t = t.replace(old, nw); count++ }
  }
  if (count > 0) { writeFileSync(p, t, 'utf8'); console.log(`${file}: ${count}`) }
  else { console.log(`${file}: 0`) }
}

// sfx.js
rep('lib/sfx.js', [
  ['// Útil para subir "click/hover" sin afectar partículas/otros FX.', '// Useful for raising "click/hover" without affecting particles/other FX.'],
])

// SimpleTransitionOverlay.jsx
rep('components/SimpleTransitionOverlay.jsx', [
  ['// Después de la animación, llamar callback', '// After animation, call callback'],
])

// SkyStars.jsx
rep('components/SkyStars.jsx', [
  ['// Anclar a la cámara: evita parallax y la sensación de "partículas"', '// Anchor to camera: avoids parallax and the "particles" feeling'],
])

// MusicPlayer.jsx
rep('components/MusicPlayer.jsx', [
  ['// Easter egg: detectar si está activo (baja los BPM a 60, o sea playbackRate 0.5)', '// Easter egg: detect if active (lowers BPM to 60, i.e. playbackRate 0.5)'],
  ['// Play/Pause wiring (resumir AudioContext si está suspendido)', '// Play/Pause wiring (resume AudioContext if suspended)'],
])

// FakeGrass.jsx
rep('components/FakeGrass.jsx', [
  ['// Habilita variación por instancia usando vertex colors (verde "natural")', '// Enables per-instance variation using vertex colors ("natural" green)'],
  ['// Distancia mínima de movimiento para "pintar" otra vez', '// Minimum movement distance to "paint" again'],
  ['// Modo direccional opcional (por defecto apagado). El usuario pidió "radial".', '// Optional directional mode (off by default). User requested "radial".'],
  ['// Máscara persistente (CanvasTexture): se "pinta" un círculo alrededor del player.', '// Persistent mask (CanvasTexture): paints a circle around the player.'],
  ['// rotación (x,z) ligeras para añadir "lean", y yaw aleatorio', '// slight (x,z) rotation to add "lean", plus random yaw'],
  ['// Nota: la máscara es persistente, así que m controla el "ya revelado"', '// Note: the mask is persistent, so m controls the "already revealed" state'],
  ['// "Pintar" máscara persistente (trail) en un radio alrededor del player', '// Paint persistent mask (trail) in a radius around the player'],
])

// SpeechBubble3D.jsx
rep('components/SpeechBubble3D.jsx', [
  ['// Offset "cómico": a la derecha y arriba del personaje.', '// "Comic" offset: to the right and above the character.'],
  ['// Burbuja circular: radio auto\u200B\u2011ajustable según el tamaño del texto', '// Circular bubble: auto-adjustable radius based on text size'],
  ['// Burbuja circular: radio auto\u2011ajustable según el tamaño del texto', '// Circular bubble: auto-adjustable radius based on text size'],
  ['// Burbuja circular: radio auto‑ajustable según el tamaño del texto', '// Circular bubble: auto-adjustable radius based on text size'],
])

// HomeOrbs.jsx
rep('components/HomeOrbs.jsx', [
  ['// Integración por orb', '// Per-orb integration'],
])

// CharacterPortrait.jsx
rep('components/CharacterPortrait.jsx', [
  ['// Detección local de perfil móvil/low\u2011perf para optimizar el retrato', '// Local mobile/low-perf profile detection to optimize the portrait'],
  ['// Detección local de perfil móvil/low‑perf para optimizar el retrato', '// Local mobile/low-perf profile detection to optimize the portrait'],
  ['// Easter\u2011egg: al activarse, SOLO dispara la viñeta 3D (la viñeta del retrato está deprecada)', '// Easter-egg: when activated, ONLY triggers the 3D speech bubble (portrait speech bubble is deprecated)'],
  ['// Easter‑egg: al activarse, SOLO dispara la viñeta 3D (la viñeta del retrato está deprecada)', '// Easter-egg: when activated, ONLY triggers the 3D speech bubble (portrait speech bubble is deprecated)'],
  ['{/* Bloom del retrato (antes no había pass; al bajar el glow dejó de "leerse") */}', '{/* Portrait bloom (previously there was no pass; lowering the glow made it unreadable) */}'],
  ['{/* Cámara */}', '{/* Camera */}'],
])

// PostFX.jsx
rep('components/PostFX.jsx', [
  ['// Si el DPR baja, el halftone se ve "más grande". Compensamos escalando con baseDpr/currentDpr.', '// If DPR drops, halftone appears larger; compensate by scaling with baseDpr/currentDpr.'],
])

// Environment.jsx
rep('components/Environment.jsx', [
  ['// Este material es MUY caro: mantener resolución moderada incluso en "high".', '// This material is VERY expensive: keep resolution moderate even in "high" mode.'],
])

// PsychoOverlay.jsx
rep('components/PsychoOverlay.jsx', [
  ['{/* Sutil patrón de puntos para reforzar "psicodélico" */}', '{/* Subtle dot pattern to reinforce the "psychedelic" look */}'],
])

console.log('--- Batch 5 done ---')
