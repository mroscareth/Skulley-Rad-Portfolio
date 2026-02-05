import fs from 'fs'
import path from 'path'

const BASE = 'd:/Work/mroscar/Website/new/interactive-portal-site/src'

const replacements = [
  // ==================== Environment.jsx ====================
  {
    file: 'components/Environment.jsx',
    pairs: [
      [
        `Importante: mantenerlo también en lowPerf para evitar "oscurecer" la escena.`,
        `Important: keep even in lowPerf to avoid darkening the scene.`,
      ],
      [
        `Problema típico: MeshReflectorMaterial + receiveShadow puede "duplicar" la lectura de sombra
        (real shadow + reflection darkening). Split into two planes:`,
        `Common issue: MeshReflectorMaterial + receiveShadow can double the shadow read
        (real shadow + reflection darkening). Split into two planes:`,
      ],
      [
        `// Este material es MUY caro: mantener resolución moderada incluso en "high".`,
        `// This material is very expensive: keep resolution moderate even in "high" quality.`,
      ],
      [
        `OJO: el grupo está rotado -90° en X, así que el "up" (separación vertical) es el eje Z local.`,
        `Note: the group is rotated -90° on X, so the vertical offset is the local Z axis.`,
      ],
    ],
  },

  // ==================== CameraController.jsx ====================
  {
    file: 'components/CameraController.jsx',
    pairs: [
      [
        `// @ts-ignore internals de OrbitControls`,
        `// @ts-ignore OrbitControls internals`,
      ],
      [
        `// @ts-ignore marca para no parchear dos veces`,
        `// @ts-ignore flag to avoid double-patching`,
      ],
    ],
  },

  // ==================== HomeOrbs.jsx ====================
  {
    file: 'components/HomeOrbs.jsx',
    pairs: [
      [
        `// ============= CONSTANTES GLOBALES =============`,
        `// ============= GLOBAL CONSTANTS =============`,
      ],
      [
        `const PART_CAP = 1200 // Reducido de 2000`,
        `const PART_CAP = 1200`,
      ],
      [
        `// ============= COMPONENTE PRINCIPAL =============`,
        `// ============= MAIN COMPONENT =============`,
      ],
      [
        `// Limpiar`,
        `// Cleanup`,
      ],
      [
        `// API imperativa`,
        `// Imperative API`,
      ],
      [
        `// ============= FUNCIONES OPTIMIZADAS =============`,
        `// ============= OPTIMIZED FUNCTIONS =============`,
      ],
      [
        `{/* Popups de puntaje - Sprites 3D nativos (siempre montados, todo controlado imperativamente) */}`,
        `{/* Score popups — native 3D sprites (always mounted, controlled imperatively) */}`,
      ],
      [
        `{/* Usamos un array fijo de POPUP_CAP elementos para evitar re-renders */}`,
        `{/* Fixed-size array of POPUP_CAP elements to avoid re-renders */}`,
      ],
    ],
  },

  // ==================== FakeGrass.jsx ====================
  {
    file: 'components/FakeGrass.jsx',
    pairs: [
      [
        `// Pasto fake: instancing + "reveal/grow" por distancia al personaje.\n// - 1 drawcall (InstancedMesh)\n// - No external textures\n// - Sin transparencia (evita overdraw); son "blades" finos`,
        `// Fake grass: instancing + distance-based reveal/grow around the player.\n// - 1 drawcall (InstancedMesh)\n// - No external textures\n// - No transparency (avoids overdraw); thin blades`,
      ],
      [
        `// Habilita variación por instancia usando vertex colors (verde "natural")`,
        `// Enable per-instance variation via vertex colors for natural look`,
      ],
      [
        `// Persistencia: el pasto "queda" donde ya pasaste (trail reveal)`,
        `// Persistence: grass stays where the player has walked (trail reveal)`,
      ],
      [
        `// Distancia mínima de movimiento para "pintar" otra vez`,
        `// Minimum movement distance before stamping again`,
      ],
      [
        `// Modo direccional opcional (por defecto apagado). El usuario pidió "radial".`,
        `// Optional directional mode (off by default). Radial is the default.`,
      ],
      [
        `const y = arr[i + 1] // ya está en [0..h] tras el translate`,
        `const y = arr[i + 1] // already in [0..h] after the translate`,
      ],
      [
        `// NO incluir lowPerf - usar valor inicial`,
        `// Do NOT include lowPerf — use initial value`,
      ],
      [
        `// Máscara persistente (CanvasTexture): se "pinta" un círculo alrededor del player.`,
        `// Persistent mask (CanvasTexture): paints a circle around the player.`,
      ],
      [
        `// rotación (x,z) ligeras para añadir "lean", y yaw aleatorio`,
        `// slight tilt in x/z to add lean, plus random yaw`,
      ],
      [
        `// Nota: la máscara es persistente, así que m controla el "ya revelado"`,
        `// The mask is persistent, so m controls "already revealed"`,
      ],
      [
        `float proj = dot(dir, fwd); // <0 detrás, >0 delante`,
        `float proj = dot(dir, fwd); // <0 behind, >0 ahead`,
      ],
      [
        `// Si grow es ~0, descartar fragmento para que NO se vea "pasto en todo el campo"`,
        `// If grow is ~0, discard fragment so grass is not visible across the entire field`,
      ],
      [
        `// "Pintar" máscara persistente (trail) en un radio alrededor del player`,
        `// Paint persistent mask (trail) in a radius around the player`,
      ],
    ],
  },

  // ==================== Portal.jsx ====================
  {
    file: 'components/Portal.jsx',
    pairs: [
      [
        `(+ocasional 0.4–1.2s)`,
        `(+occasional 0.4–1.2s)`,
      ],
      [
        `// El portal es emisivo (glow) y no debe castear sombras: si lo hace, ensucia el suelo con "manchas" extra.`,
        `// The portal is emissive and should not cast shadows to avoid staining the ground.`,
      ],
    ],
  },

  // ==================== CharacterPortrait.jsx ====================
  {
    file: 'components/CharacterPortrait.jsx',
    pairs: [
      [
        `// Easter egg: multi‑click en el retrato (i18n)`,
        `// Easter egg: multi-click on the portrait (i18n)`,
      ],
      [
        `// Fallback a HTMLAudio pool si Web Audio falla`,
        `// Fallback to HTMLAudio pool if Web Audio fails`,
      ],
      [
        `(iPad/Tesla deben forzar layout compacto)`,
        `(iPad/Tesla should force compact layout)`,
      ],
      [
        `{/* Composer de postproceso del retrato */}`,
        `{/* Portrait post-processing composer */}`,
      ],
      [
        `{/* Bloom del retrato (antes no había pass; al bajar el glow dejó de "leerse") */}`,
        `{/* Portrait bloom (needed after lowering glow intensity) */}`,
      ],
      [
        `{/* Cursor personalizado tipo slap que sigue al mouse dentro del retrato */}`,
        `{/* Custom slap cursor that follows the mouse inside the portrait */}`,
      ],
      [
        `{/* Barra de cooldown (a la derecha del retrato) */}`,
        `{/* Cooldown bar (to the right of the portrait) */}`,
      ],
      [
        `{/* Controles de luz (interactivos) */}`,
        `{/* Light controls (interactive) */}`,
      ],
      [
        `// En hero mode, no aplicar reglas de viewport del overlay.`,
        `// In hero mode, don't apply overlay viewport rules.`,
      ],
      [
        `// Si App fuerza el modo compacto, respetarlo sin escuchar viewport.`,
        `// If App forces compact mode, respect it without listening to viewport.`,
      ],
      [
        `// umbral más amplio (≈30% pantalla)`,
        `// wider threshold (~30% of screen)`,
      ],
      [
        `const m = 18 // margen para activar más fácil`,
        `const m = 18 // margin to ease activation`,
      ],
    ],
  },

  // ==================== ContactForm.jsx ====================
  {
    file: 'components/ContactForm.jsx',
    pairs: [
      [
        `{/* Progreso (desktop fijo; mobile inline) */}`,
        `{/* Progress bar (fixed on desktop; inline on mobile) */}`,
      ],
      [
        `{/* Paso actual */}`,
        `{/* Current step */}`,
      ],
    ],
  },

  // ==================== SpeechBubble3D.jsx ====================
  {
    file: 'components/SpeechBubble3D.jsx',
    pairs: [
      [
        `// Offset "cómico": a la derecha y arriba del personaje.`,
        `// Comic-style offset: to the right and above the character.`,
      ],
      [
        `{/* Motion lines (simple, arriba) */}`,
        `{/* Motion lines (simple, above) */}`,
      ],
      [
        `// dejando padding para que no "toque" el borde.`,
        `// leaving padding so text does not touch the edge.`,
      ],
    ],
  },

  // ==================== useSpeechBubbles.js ====================
  {
    file: 'components/useSpeechBubbles.js',
    pairs: [
      [
        ` * - Scheduler simple: muestra frases aleatorias con typing.\n * - i18n: al cambiar idioma, re-traduce la viñeta activa manteniendo el mismo índice.`,
        ` * - Simple scheduler: shows random phrases with a typing effect.\n * - i18n: on language change, re-translates the active bubble keeping the same index.`,
      ],
      [
        `// Egg: solo cuando el override viene de i18n`,
        `// Egg theme: only when the override comes from i18n egg phrases`,
      ],
    ],
  },

  // ==================== useKeyboard.js ====================
  {
    file: 'components/useKeyboard.js',
    pairs: [
      [
        `// Si la ventana pierde foco, evitamos teclas "pegadas"`,
        `// Reset all keys when window loses focus to prevent stuck keys`,
      ],
    ],
  },

  // ==================== MusicPlayer.jsx ====================
  {
    file: 'components/MusicPlayer.jsx',
    pairs: [
      [
        `const fallbackSetRef = useRef(new Set()) // src strings que usarán HTMLAudio fallback`,
        `const fallbackSetRef = useRef(new Set()) // src strings that use HTMLAudio fallback`,
      ],
      [
        `// WebAudio engine (usando ReversibleAudioBufferSourceNode para scratch sin glitches)`,
        `// WebAudio engine (using ReversibleAudioBufferSourceNode for glitch-free scratch)`,
      ],
      [
        `// Store buffer (ReversibleAudioBufferSourceNode maneja el reverso internamente)`,
        `// Store buffer (ReversibleAudioBufferSourceNode handles reverse internally)`,
      ],
      [
        `// uso inmediato si cacheado`,
        `// use immediately if cached`,
      ],
      [
        `// siempre pausa antes del switch`,
        `// always pause before switching`,
      ],
      [
        `// cargar buffer y cover en paralelo`,
        `// load buffer and cover in parallel`,
      ],
      [
        `// HTML fallback: usar elemento nativo`,
        `// HTML fallback: use native audio element`,
      ],
    ],
  },
]

let totalReplacements = 0
let totalFiles = 0

for (const { file, pairs } of replacements) {
  const fullPath = path.join(BASE, file)
  if (!fs.existsSync(fullPath)) {
    console.log(`SKIP (not found): ${file}`)
    continue
  }
  let content = fs.readFileSync(fullPath, 'utf8')
  let count = 0
  for (const [oldStr, newStr] of pairs) {
    if (content.includes(oldStr)) {
      content = content.replace(oldStr, newStr)
      count++
    } else {
      console.log(`  NOT FOUND in ${file}: "${oldStr.substring(0, 60)}..."`)
    }
  }
  if (count > 0) {
    fs.writeFileSync(fullPath, content, 'utf8')
    totalFiles++
    totalReplacements += count
    console.log(`OK ${file}: ${count} replacement(s)`)
  } else {
    console.log(`NO CHANGES: ${file}`)
  }
}

console.log(`\nDone: ${totalReplacements} replacements in ${totalFiles} files`)
