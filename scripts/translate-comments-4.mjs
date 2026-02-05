// Batch 4: App.jsx, Player.jsx, admin files - remaining Spanish comments
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

function repAll(file, pairs) {
  const p = base + file
  if (!existsSync(p)) { console.log(`SKIP: ${file}`); return }
  let t = readFileSync(p, 'utf8')
  let count = 0
  for (const [old, nw] of pairs) {
    while (t.includes(old)) { t = t.replace(old, nw); count++ }
  }
  if (count > 0) { writeFileSync(p, t, 'utf8'); console.log(`${file}: ${count}`) }
  else { console.log(`${file}: 0`) }
}

// ===== App.jsx =====
repAll('App.jsx', [
  // Inline comments with encoding artifacts
  ["// NO incrementar gridKey aqu\x00ED - causa flash", "// Do NOT increment gridKey here — causes flash"],
  // Try alternate encoding
  ["// NO incrementar gridKey aquí - causa flash", "// Do NOT increment gridKey here — causes flash"],
  // Fallback: match with ? character
  ["// NO incrementar gridKey aqu? - causa flash", "// Do NOT increment gridKey here — causes flash"],
  ["// delay entre inicios de cada bot\x00F3n", "// delay between button start times"],
  ["// delay entre inicios de cada botón", "// delay between button start times"],
  ["// delay entre inicios de cada bot?n", "// delay between button start times"],
  ["// Preloader global de arranque", "// Global boot preloader"],
  ["// cada 60s - no revisar tan frecuentemente", "// every 60s — don't check too often"],
  ["// 180ms despu\x00E9s de dejar de scrollear", "// 180ms after user stops scrolling"],
  ["// 180ms después de dejar de scrollear", "// 180ms after user stops scrolling"],
  ["// 180ms despu?s de dejar de scrollear", "// 180ms after user stops scrolling"],
  ["// Cambia cada 120ms", "// Changes every 120ms"],
  // JSX comments with encoding artifacts
  ["{/* Minimal nav overlay eliminado en WORK para evitar interferencias con WorkCarousel */}", "{/* Minimal nav overlay removed in WORK to avoid interfering with WorkCarousel */}"],
  ["{/* CTA: Cruza el portal (aparece cuando el jugador est\x00E1 cerca del portal) */}", "{/* CTA: Cross the portal (appears when the player is near a portal) */}"],
  ["{/* CTA: Cruza el portal (aparece cuando el jugador está cerca del portal) */}", "{/* CTA: Cross the portal (appears when the player is near a portal) */}"],
  ["{/* CTA: Cruza el portal (aparece cuando el jugador est? cerca del portal) */}", "{/* CTA: Cross the portal (appears when the player is near a portal) */}"],
  // Settings comments
  ["{/* Settings (desktop): m\x00FAsica + c\x00E1mara + modo videojuego (apilados hacia arriba) */}", "{/* Settings (desktop): music + camera + game mode (stacked upward) */}"],
  ["{/* Settings (desktop): música + cámara + modo videojuego (apilados hacia arriba) */}", "{/* Settings (desktop): music + camera + game mode (stacked upward) */}"],
  ["{/* Settings (desktop): m?sica + c?mara + modo videojuego (apilados hacia arriba) */}", "{/* Settings (desktop): music + camera + game mode (stacked upward) */}"],
  // Botón engrane
  ["{/* Bot\x00F3n engrane */}", "{/* Gear button */}"],
  ["{/* Botón engrane */}", "{/* Gear button */}"],
  ["{/* Bot?n engrane */}", "{/* Gear button */}"],
  // HUD
  ["{/* HUD de puntaje - solo mostrar cuando el personaje aterriz\x00F3 */}", "{/* Score HUD - only show after the character has landed */}"],
  ["{/* HUD de puntaje - solo mostrar cuando el personaje aterrizó */}", "{/* Score HUD - only show after the character has landed */}"],
  ["{/* HUD de puntaje - solo mostrar cuando el personaje aterriz? */}", "{/* Score HUD - only show after the character has landed */}"],
  // Joystick
  ["{/* Joystick m\x00F3vil: visible en el mismo breakpoint del men\x00FA hamburguesa (=1100px),", "{/* Mobile joystick: visible at the same breakpoint as the hamburger menu (=1100px),"],
  ["{/* Joystick móvil: visible en el mismo breakpoint del menú hamburguesa (=1100px),", "{/* Mobile joystick: visible at the same breakpoint as the hamburger menu (=1100px),"],
  ["{/* Joystick m?vil: visible en el mismo breakpoint del men? hamburguesa (=1100px),", "{/* Mobile joystick: visible at the same breakpoint as the hamburger menu (=1100px),"],
  // Power UI
  ["{/* UI de poder (barra horizontal + bot\x00F3n Bolt) \x2013 mobile/iPad */}", "{/* Power UI (horizontal bar + Bolt button) — mobile/iPad */}"],
  ["{/* UI de poder (barra horizontal + botón Bolt) – mobile/iPad */}", "{/* Power UI (horizontal bar + Bolt button) — mobile/iPad */}"],
  ["{/* UI de poder (barra horizontal + bot?n Bolt) ? mobile/iPad */}", "{/* Power UI (horizontal bar + Bolt button) — mobile/iPad */}"],
  // Wrapper relativo
  ["{/* Wrapper relativo para superponer el bot\x00F3n sobre la barra */}", "{/* Relative wrapper to overlay the button on the bar */}"],
  ["{/* Wrapper relativo para superponer el botón sobre la barra */}", "{/* Relative wrapper to overlay the button on the bar */}"],
  ["{/* Wrapper relativo para superponer el bot?n sobre la barra */}", "{/* Relative wrapper to overlay the button on the bar */}"],
  // Fondo de preloader
  ["{/* Fondo de preloader como relleno del bot\x00F3n */}", "{/* Preloader background as button fill */}"],
  ["{/* Fondo de preloader como relleno del botón */}", "{/* Preloader background as button fill */}"],
  ["{/* Fondo de preloader como relleno del bot?n */}", "{/* Preloader background as button fill */}"],
  // Marquee
  ["{/* Marquee de t\x00EDtulo de secci\x00F3n (solo visible en HOME) */}", "{/* Section title marquee (only visible in HOME) */}"],
  ["{/* Marquee de título de sección (solo visible en HOME) */}", "{/* Section title marquee (only visible in HOME) */}"],
  ["{/* Marquee de t?tulo de secci?n (solo visible en HOME) */}", "{/* Section title marquee (only visible in HOME) */}"],
  // Socials mobile
  ["{/* Socials (mobile): colapsados en bot\x00F3n + abanico */}", "{/* Socials (mobile): collapsed into button + fan */}"],
  ["{/* Socials (mobile): colapsados en botón + abanico */}", "{/* Socials (mobile): collapsed into button + fan */}"],
  ["{/* Socials (mobile): colapsados en bot?n + abanico */}", "{/* Socials (mobile): collapsed into button + fan */}"],
  // TV static effect
  ["{/* Efecto de estatica de TV - grano blanco */}", "{/* TV static effect - white grain */}"],
  // Preloader paragraphs
  ["{/* T\x00EDtulo grande con typewriter */}", "{/* Large title with typewriter */}"],
  ["{/* Título grande con typewriter */}", "{/* Large title with typewriter */}"],
  ["{/* T?tulo grande con typewriter */}", "{/* Large title with typewriter */}"],
  ["{/* P\x00E1rrafo 1 - aparece cuando step >= 1 */}", "{/* Paragraph 1 - appears when step >= 1 */}"],
  ["{/* Párrafo 1 - aparece cuando step >= 1 */}", "{/* Paragraph 1 - appears when step >= 1 */}"],
  ["{/* P?rrafo 1 - aparece cuando step >= 1 */}", "{/* Paragraph 1 - appears when step >= 1 */}"],
  ["{/* P\x00E1rrafo 2 - aparece cuando step >= 2 */}", "{/* Paragraph 2 - appears when step >= 2 */}"],
  ["{/* Párrafo 2 - aparece cuando step >= 2 */}", "{/* Paragraph 2 - appears when step >= 2 */}"],
  ["{/* P?rrafo 2 - aparece cuando step >= 2 */}", "{/* Paragraph 2 - appears when step >= 2 */}"],
  ["{/* P\x00E1rrafo 3 (opcional) - aparece cuando step >= 3 */}", "{/* Paragraph 3 (optional) - appears when step >= 3 */}"],
  ["{/* Párrafo 3 (opcional) - aparece cuando step >= 3 */}", "{/* Paragraph 3 (optional) - appears when step >= 3 */}"],
  ["{/* P?rrafo 3 (opcional) - aparece cuando step >= 3 */}", "{/* Paragraph 3 (optional) - appears when step >= 3 */}"],
  // Section navigation comments
  ["// En UI de secci\x00F3n, no permitir transici\x00F3n a STORE (coming soon)", "// In section UI, don't allow transition to STORE (coming soon)"],
  ["// En UI de sección, no permitir transición a STORE (coming soon)", "// In section UI, don't allow transition to STORE (coming soon)"],
  ["// En UI de secci?n, no permitir transici?n a STORE (coming soon)", "// In section UI, don't allow transition to STORE (coming soon)"],
  ["// En HOME: permitir viajar al portal STORE (pero sin abrir secci\x00F3n)", "// In HOME: allow traveling to STORE portal (without opening section)"],
  ["// En HOME: permitir viajar al portal STORE (pero sin abrir sección)", "// In HOME: allow traveling to STORE portal (without opening section)"],
  ["// En HOME: permitir viajar al portal STORE (pero sin abrir secci?n)", "// In HOME: allow traveling to STORE portal (without opening section)"],
  // Timer comments
  ["// Timer para entering \x2192 visible", "// Timer for entering → visible"],
  ["// Timer para entering → visible", "// Timer for entering → visible"],
  ["// Timer para entering ? visible", "// Timer for entering → visible"],
  ["// Timer para exiting \x2192 hidden (NO limpiar en useEffect)", "// Timer for exiting → hidden (do NOT clean up in useEffect)"],
  ["// Timer para exiting → hidden (NO limpiar en useEffect)", "// Timer for exiting → hidden (do NOT clean up in useEffect)"],
  ["// Timer para exiting ? hidden (NO limpiar en useEffect)", "// Timer for exiting → hidden (do NOT clean up in useEffect)"],
  // navHeight ref
  ["// Ref para usar en callbacks antes de que navHeight state est\x00E9 declarado", "// Ref for use in callbacks before navHeight state is declared"],
  ["// Ref para usar en callbacks antes de que navHeight state esté declarado", "// Ref for use in callbacks before navHeight state is declared"],
  ["// Ref para usar en callbacks antes de que navHeight state est? declarado", "// Ref for use in callbacks before navHeight state is declared"],
  // Solo despues de entrar
  ["if (showPreloaderOverlay) return // Solo despu\x00E9s de entrar", "if (showPreloaderOverlay) return // Only after entering"],
  ["if (showPreloaderOverlay) return // Solo después de entrar", "if (showPreloaderOverlay) return // Only after entering"],
  ["if (showPreloaderOverlay) return // Solo despu?s de entrar", "if (showPreloaderOverlay) return // Only after entering"],
])

// ===== Player.jsx =====
rep('components/Player.jsx', [
  ["const eggDetachList = [] // lista de nodos raíz Egg_* a detachear (Object3D)", "const eggDetachList = [] // list of root Egg_* nodes to detach (Object3D)"],
  ["// ~200ms máx acumulable (OPTIMIZADO: era 6)", "// ~200ms max accumulable (OPTIMIZED: was 6)"],
  ["const minStep = 0.015 // umbral de cambio mínimo", "const minStep = 0.015 // minimum change threshold"],
  // Additional Spanish without accents
  ["maxDelayS: 0, // para sincronizar fin de caída cuando hay stagger", "maxDelayS: 0, // to sync fall end when staggered"],
  ["hold: false, // no pasar a assemble/cleanup", "hold: false, // don't proceed to assemble/cleanup"],
  ["normalMaterial: false, // forzar MeshNormalMaterial para visibilidad", "normalMaterial: false, // force MeshNormalMaterial for visibility"],
  ["noDepthTest: false, // render por encima", "noDepthTest: false, // render on top"],
  ["axes: false, // mostrar ejes en el root de piezas", "axes: false, // show axes on pieces root"],
  ["proxy: false, // reemplazar cada pieza por una caja (debug de geometría)", "proxy: false, // replace each piece with a box (geometry debug)"],
  ["wire: false, // wireframe unlit para confirmar tris", "wire: false, // unlit wireframe to confirm tris"],
  ["// boneTransform escribe el vertex ya \"skinned\" en el espacio local del mesh", "// boneTransform writes the skinned vertex in the mesh's local space"],
  ["// Aceptar prefijo y también \"contains\" por si el export agrega prefijos/sufijos.", "// Accept prefix and also \"contains\" in case the export adds prefixes/suffixes."],
  ["// Convención: nombres con prefijo \"Rigid_\" o parent que contenga \"RigidPieces\".", "// Convention: names prefixed \"Rigid_\" or parent containing \"RigidPieces\"."],
  ["const fadeInTRef = useRef(1) // Empieza en 1 para que el personaje sea opaco desde el inicio", "const fadeInTRef = useRef(1) // Start at 1 so the character is opaque from the start"],
  ["if (diff < 0.01) return // Sin cambio significativo", "if (diff < 0.01) return // No significant change"],
  ["const modelRootRef = useRef(null) // wrapper (mismo scale que el modelo)", "const modelRootRef = useRef(null) // wrapper (same scale as the model)"],
  ["const piecesRootRef = useRef(null) // donde montamos meshes rígidas", "const piecesRootRef = useRef(null) // where we mount rigid meshes"],
])

// ===== Admin files =====
// AboutEditor.jsx
rep('admin/AboutEditor.jsx', [
  ["* Editor del contenido About\n * - Una sola textarea para inglés\n * - Traducción automática al español\n * - Vista previa editable de la traducción", "* About content editor\n * - Single textarea for English\n * - Automatic translation to Spanish\n * - Editable translation preview"],
  ["// Contenido en texto plano (párrafos separados por doble salto de línea)", "// Content as plain text (paragraphs separated by double line break)"],
  ["// Fetch contenido actual", "// Fetch current content"],
  ["// Convertir párrafos a texto plano", "// Convert paragraphs to plain text"],
  ["// Convertir texto a objeto de párrafos", "// Convert text to paragraphs object"],
  ["// Doble salto de línea = nuevo párrafo", "// Double line break = new paragraph"],
  ["// Traducir automáticamente", "// Translate automatically"],
  ["// Guardar cambios", "// Save changes"],
  ["// Fallback a inglés si no hay español", "// Fallback to English if no Spanish"],
  ["// Preview de párrafos", "// Paragraphs preview"],
])

// AdminApp.jsx
rep('admin/AdminApp.jsx', [
  ["* Layout principal del Admin Dashboard\n * Diseño futurista con glassmorphism", "* Main Admin Dashboard layout\n * Futuristic design with glassmorphism"],
  ["// Lazy load de vistas", "// Lazy load views"],
  ["// Rutas internas del admin", "// Internal admin routes"],
  ["{/* Logo / Title - Estilo del sitio */}", "{/* Logo / Title - Site style */}"],
  ["{/* Nav - Solo Proyectos y About */}", "{/* Nav - Projects and About only */}"],
  ["// Wrapper con provider", "// Wrapper with provider"],
])

// AdminDashboard.jsx
rep('admin/AdminDashboard.jsx', [
  ["* Dashboard principal - Grid de proyectos con drag & drop para reordenar", "* Main dashboard - Project grid with drag & drop reordering"],
  ["distance: 8, // 8px de movimiento antes de iniciar drag", "distance: 8, // 8px movement before starting drag"],
  ["// Ordenar por display_order", "// Sort by display_order"],
  ["// Guardar nuevo orden en el servidor", "// Save new order to server"],
  ["// Guardar en el servidor", "// Save to server"],
  ["// Crear proyecto borrador para poder subir imágenes inmediatamente", "// Create draft project so images can be uploaded immediately"],
])

// AdminLogin.jsx
rep('admin/AdminLogin.jsx', [
  ["* Pantalla de Login con Google OAuth\n * Diseño futurista con glassmorphism", "* Login screen with Google OAuth\n * Futuristic design with glassmorphism"],
  ["// SVG de Google", "// Google SVG"],
  ["// Verificar errores en URL (de callback OAuth)", "// Check for errors in URL (from OAuth callback)"],
  ["// Limpiar URL", "// Clean URL"],
])

// FileUploader.jsx
rep('admin/FileUploader.jsx', [
  ["* Componente de upload de archivos con drag & drop\n * Incluye reordenamiento de archivos existentes con drag & drop", "* File upload component with drag & drop\n * Includes reordering of existing files with drag & drop"],
  ["// Reordenar archivos", "// Reorder files"],
  ["// Notificar al padre", "// Notify parent"],
  ["// Guardar en el servidor", "// Save to server"],
])

// ProjectEditor.jsx
rep('admin/ProjectEditor.jsx', [
  ["* Editor de proyectos - Crear/Editar", "* Project editor - Create/Edit"],
  ["// Normalizar archivos: asegurar que tengan 'path' además de 'file_path'", "// Normalize files: ensure they have 'path' in addition to 'file_path'"],
  ["// Usar path si existe, sino file_path", "// Use path if it exists, otherwise file_path"],
  ["{/* External URL (solo para tipo link) */}", "{/* External URL (only for link type) */}"],
  ["{/* Gallery files (solo para tipo gallery) */}", "{/* Gallery files (only for gallery type) */}"],
])

// useAdminAuth.jsx
rep('admin/useAdminAuth.jsx', [
  ["* Hook de autenticación para el admin", "* Authentication hook for admin"],
  ["// Verificar sesión al cargar", "// Check session on load"],
  ["// Redirige al servidor para OAuth", "// Redirect to server for OAuth"],
])

console.log('--- Batch 4 done ---')
