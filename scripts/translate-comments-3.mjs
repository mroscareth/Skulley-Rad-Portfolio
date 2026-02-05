// Batch 3: Remaining files
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

// TransitionOverlay.jsx
rep('components/TransitionOverlay.jsx', [
  ['// Ripple dissolve material: genera ondas concéntricas y una máscara circular que crece', '// Ripple dissolve material: generates concentric waves and a growing circular mask'],
  ['// Fragment shader: máscara circular con ondas, la zona interior se hace transparente', '// Fragment shader: circular mask with waves, inner zone becomes transparent'],
  ['// Cobertura fuera del círculo, gated por t para que no sea visible con t=0', '// Coverage outside the circle, gated by t so it\'s not visible at t=0'],
  ['// Banda de onda alrededor del frente (visible y "acuosa")', '// Wave band around the front (visible and "watery")'],
  ['// Onda más visible', '// More visible wave'],
  ['// Gate suave de la onda para que aparezca pronto aun con t pequeño', '// Soft gate for the wave to appear early even with small t'],
  ['// Alpha final: cobertura + onda (la cobertura sí escala con t)', '// Final alpha: coverage + wave (coverage does scale with t)'],
  ['// Color ligeramente aclarado para que se lea sobre fondos oscuros', '// Color slightly brightened for readability on dark backgrounds'],
  ['// Prewarm GSAP timeline engine una vez al montar (sin efectos visuales)', '// Prewarm GSAP timeline engine once on mount (no visual effects)'],
  ['// kill tween anterior si existe', '// kill previous tween if any'],
  ['// asegurar transparencia cuando no está activo', '// ensure transparency when not active'],
  ['// Ocultar overlay al finalizar para no oscurecer la escena', '// Hide overlay on completion to avoid darkening the scene'],
])

// UnifiedTransitionOverlay.jsx
rep('components/UnifiedTransitionOverlay.jsx', [
  ['* UnifiedTransitionOverlay - Overlay único con shader multi-efecto', '* UnifiedTransitionOverlay - Single overlay with multi-effect shader'],
  ['* Soporta los siguientes efectos:', '* Supports the following effects:'],
  ['* - FADE: Fade a color sólido', '* - FADE: Fade to solid color'],
  ['* - DISSOLVE: Disolución con ruido procedural', '* - DISSOLVE: Dissolution with procedural noise'],
  ['* - GRID: Grid de celdas animado (shader, no CSS)', '* - GRID: Animated cell grid (shader, not CSS)'],
  ['* - WIPE: Barrido direccional', '* - WIPE: Directional wipe'],
  ['* - MASK: Máscara de imagen', '* - MASK: Image mask'],
  ['// Vertex shader común', '// Common vertex shader'],
  ['// Fragment shader unificado con todos los efectos', '// Unified fragment shader with all effects'],
  ['uniform sampler2D uTexA;      // Escena A (origen)', 'uniform sampler2D uTexA;      // Scene A (source)'],
  ['uniform sampler2D uTexB;      // Escena B (destino)', 'uniform sampler2D uTexB;      // Scene B (destination)'],
  ['uniform sampler2D uNoise;     // Textura de ruido', 'uniform sampler2D uNoise;     // Noise texture'],
  ['uniform sampler2D uMask;      // Textura de máscara', 'uniform sampler2D uMask;      // Mask texture'],
  ['uniform float uProgress;      // 0..1 (cubriendo) o 1..2 (revelando para dissolve/mask)', 'uniform float uProgress;      // 0..1 (covering) or 1..2 (revealing for dissolve/mask)'],
  ['uniform vec2 uCenter;         // Centro del efecto (0..1)', 'uniform vec2 uCenter;         // Effect center (0..1)'],
  ['uniform vec3 uColor;          // Color para fade', 'uniform vec3 uColor;          // Fade color'],
  ['uniform float uCellSize;      // Tamaño de celda para grid', 'uniform float uCellSize;      // Cell size for grid'],
  ['uniform float uEdge;          // Borde suave para dissolve', 'uniform float uEdge;          // Soft edge for dissolve'],
  ['uniform float uSoftness;      // Suavidad para mask/wipe', 'uniform float uSoftness;      // Softness for mask/wipe'],
  ['uniform vec2 uDirection;      // Dirección para wipe', 'uniform vec2 uDirection;      // Direction for wipe'],
  ['uniform int uEffect;          // Tipo de efecto', 'uniform int uEffect;          // Effect type'],
  ['// Función de ruido simple', '// Simple noise function'],
  ['// Ruido de valor suavizado', '// Smoothed value noise'],
  ['// Efecto FADE: oscurece a color y vuelve', '// Effect FADE: darken to color and back'],
  ['// 0→1: fade de A hacia negro', '// 0→1: fade A toward black'],
  ['// 1→2: fade de negro hacia B', '// 1→2: fade black toward B'],
  ['// Cubrir: mezclar A con negro', '// Cover: blend A with black'],
  ['// Revelar: mezclar negro con B', '// Reveal: blend black with B'],
  ['// Efecto DISSOLVE: mezcla con ruido animado', '// Effect DISSOLVE: blend with animated noise'],
  ['// Normalizar progress a 0..1 para la mezcla', '// Normalize progress to 0..1 for blending'],
  ['// Durante la fase de cubierta (p < 1), mostrar negro', '// During cover phase (p < 1), show black'],
  ['// Durante la fase de revelado (p >= 1), mezclar hacia B', '// During reveal phase (p >= 1), blend toward B'],
  ['// Efecto GRID: celdas que aparecen/desaparecen radialmente', '// Effect GRID: cells appearing/disappearing radially'],
  ['// Calcular posición de la celda', '// Calculate cell position'],
  ['// Distancia desde el centro del efecto', '// Distance from effect center'],
  ['// Ajustar por aspect ratio', '// Adjust for aspect ratio'],
  ['// Distancia máxima aproximada', '// Approximate max distance'],
  ['// Variación aleatoria por celda (efecto escalonado)', '// Random per-cell variation (staggered effect)'],
  ['// p de 0→1 es cubierta, p de 1→2 es revelado', '// p 0→1 is cover, p 1→2 is reveal'],
  ['// FASE CUBIERTA: celdas desde afuera hacia adentro', '// COVER PHASE: cells from outside to inside'],
  ['// threshold bajo = se cubre antes (con p pequeño)', '// low threshold = covered earlier (with small p)'],
  ['// celdas lejanas (dist alto) deben cubrirse PRIMERO → threshold bajo', '// far cells (high dist) should cover FIRST → low threshold'],
  ['// Transición rápida por celda para efecto de "aparición"', '// Fast per-cell transition for "appearance" effect'],
  ['// FASE REVELADO: celdas desde el centro hacia afuera', '// REVEAL PHASE: cells from center outward'],
  ['// celdas cercanas (dist bajo) deben revelarse PRIMERO → threshold bajo', '// close cells (low dist) should reveal FIRST → low threshold'],
  ['// Elegir textura: durante cubierta mostramos A, durante revelado mostramos B', '// Select texture: during cover show A, during reveal show B'],
  ['// Mezclar: cellOpacity=0 → textura, cellOpacity=1 → negro', '// Blend: cellOpacity=0 → texture, cellOpacity=1 → black'],
  ['// Efecto WIPE: barrido direccional', '// Effect WIPE: directional wipe'],
  ['// Proyección sobre la dirección del wipe', '// Projection along wipe direction'],
  ['// Durante cubierta: ir a negro', '// During cover: go to black'],
  ['// Durante revelado: mostrar B', '// During reveal: show B'],
  ['// Efecto MASK: basado en imagen de máscara', '// Effect MASK: based on image mask'],
  ['// Durante cubierta', '// During cover'],
  ['// Durante revelado', '// During reveal'],
  ['// Seleccionar efecto', '// Select effect'],
  ['// Mapeo de efectos a índices del shader', '// Effect-to-shader-index mapping'],
  ['// Crear textura de ruido una sola vez', '// Create noise texture once'],
  ['// Textura negra de fallback', '// Black fallback texture'],
  ['// Material del shader', '// Shader material'],
  ['// Actualizar uniforms cada frame', '// Update uniforms every frame'],
  ['// Texturas', '// Textures'],
  ['// Progress y tiempo', '// Progress and time'],
  ['// Configuración del efecto', '// Effect configuration'],
  ['// Color: si es array [0-255], dividir; si es [0-1], usar directo', '// Color: if array [0-255], divide; if [0-1], use directly'],
  ['// Limpiar al desmontar', '// Cleanup on unmount'],
  ['* Componente de overlay unificado', '* Unified overlay component'],
  ['// Estado para fade out suave al terminar', '// State for smooth fade out on completion'],
  ['// Pequeño delay para que el DOM esté listo antes del fade in', '// Small delay so DOM is ready before fade in'],
  ['// Fade out antes de desmontar', '// Fade out before unmounting'],
])

// NoiseTransitionOverlay.jsx
rep('components/NoiseTransitionOverlay.jsx', [
  ['// r182: LuminanceFormat fue removido → usar RedFormat (1 canal)', '// r182: LuminanceFormat was removed — use RedFormat (single channel)'],
])

// SimpleTransitionOverlay.jsx
rep('components/SimpleTransitionOverlay.jsx', [
  ['* SimpleTransitionOverlay - Overlay de transición simple y eficiente', '* SimpleTransitionOverlay - Simple and efficient transition overlay'],
  ['* Usa CSS puro para el efecto de grid, sin Three.js ni captura de frames.', '* Uses pure CSS for grid effect, no Three.js or frame capture.'],
  ['* Hook para manejar transiciones simples', '* Hook for managing simple transitions'],
  ['* Componente de overlay - versión simplificada con fade', '* Overlay component - simplified version with fade'],
  ['// Estado para controlar la animación', '// State to control animation'],
  ['// Limpiar timers', '// Clean up timers'],
  ['// Manejar fase covering', '// Handle covering phase'],
  ['// Fade a negro', '// Fade to black'],
  ['// Después de la animación, llamar callback', '// After animation, call callback'],
  ['// Manejar fase revealing', '// Handle revealing phase'],
  ['// Fade desde negro', '// Fade from black'],
  ['// Manejar desactivación', '// Handle deactivation'],
  ['// Determinar duración de la transición CSS', '// Determine CSS transition duration'],
])

// GridRevealOverlay.jsx
rep('components/GridRevealOverlay.jsx', [
  ['* GridRevealOverlay - Overlay de transición con retícula animada', '* GridRevealOverlay - Animated grid transition overlay'],
  ['* SIMPLIFICADO: Usa CSS puro sin estado complejo.', '* SIMPLIFIED: Uses pure CSS without complex state.'],
  ['// La animación se controla directamente por las props phase y active.', '// Animation is controlled directly by phase and active props.'],
  ['// Calcular grid', '// Calculate grid'],
  ['// Cuando se activa, esperar un frame para que las celdas se monten', '// When activated, wait one frame for cells to mount'],
  ['// antes de iniciar la animación', '// before starting the animation'],
  ['// Esperar 2 frames para que React monte las celdas', '// Wait 2 frames for React to mount cells'],
  ['// Notificar fin de fase', '// Notify phase end'],
  ['// IN: celdas van a 1 (negro), OUT: celdas van a 0 (transparente)', '// IN: cells go to 1 (black), OUT: cells go to 0 (transparent)'],
  ['// IN: lejanas primero (1-d), OUT: cercanas primero (d)', '// IN: far first (1-d), OUT: near first (d)'],
  ['// Cuando ready=false, las celdas están en su estado inicial (0 para IN, 1 para OUT)', '// When ready=false, cells are in initial state (0 for IN, 1 for OUT)'],
  ['// Cuando ready=true, las celdas animan hacia el target', '// When ready=true, cells animate toward target'],
])

// scoreStore.js
rep('lib/scoreStore.js', [
  ['* ScoreStore - Store ligero para el score del juego', '* ScoreStore - Lightweight store for game score'],
  ['* Usa refs y suscripciones manuales para evitar re-renders de React.', '* Uses refs and manual subscriptions to avoid React re-renders.'],
  ['* Solo los componentes suscritos se actualizan cuando cambia el score.', '* Only subscribed components update when the score changes.'],
  ['// Estado interno (no es estado de React - no causa re-renders)', '// Internal state (not React state — does not cause re-renders)'],
  ['/** Obtener el score actual */', '/** Get current score */'],
  ['/** Establecer el score */', '/** Set the score */'],
  ['// Notificar a todos los listeners', '// Notify all listeners'],
  ['/** Agregar delta al score */', '/** Add delta to score */'],
  ['/** Reset a cero */', '/** Reset to zero */'],
  ['/** Suscribirse a cambios (retorna función para desuscribirse) */', '/** Subscribe to changes (returns unsubscribe function) */'],
  ['// Llamar inmediatamente con el valor actual', '// Call immediately with current value'],
])

// sfx.js
rep('lib/sfx.js', [
  ['// Pequeño util para reproducir SFX desde /public', '// Small utility for playing SFX from /public'],
  ['// Intenta primero en public/fx y luego en la raíz de public como fallback', '// Tries public/fx first, then root of public as fallback'],
  ['// Pool simple de instancias HTMLAudio por clip para evitar crear objetos en cada play', '// Simple HTMLAudio instance pool per clip to avoid creating objects on each play'],
  ['// WebAudio (mejor latencia y menor jank)', '// WebAudio (better latency, less jank)'],
  ['// Ganancia por SFX (antes del masterVolume).', '// Per-SFX gain (before masterVolume).'],
  ['// Útil para subir "click/hover" sin afectar partículas/otros FX.', '// Useful for raising "click/hover" without affecting particles/other FX.'],
  ['// Esperar metadata suficiente para poder reproducir rápido', '// Wait for enough metadata to play quickly'],
  ['// fallback timeout para no colgar', '// fallback timeout to avoid hanging'],
  ['// Inicializar pool del clip si no existe', '// Initialize clip pool if not exists'],
  ['// Avanzar silenciosamente a 0 para calentar', '// Silently advance to 0 for warmup'],
  ['// probar siguiente candidato', '// try next candidate'],
  ['// último recurso: guardar el primero aun si no se pudo precargar', '// last resort: save first one even if preload failed'],
  ['// Intentar WebAudio primero', '// Try WebAudio first'],
  ['// Reanudar contexto si está suspendido (algunas plataformas)', '// Resume context if suspended (some platforms)'],
  ['// Limpieza básica', '// Basic cleanup'],
  ['// Fallback HTMLAudio con pool', '// Fallback HTMLAudio with pool'],
  ['// Reutilizar aunque esté reproduciendo: reiniciar desde 0 da "overlap" mínimamente', '// Reuse even if playing: resetting to 0 gives minimal "overlap"'],
  ['// Fallback si no hay pool disponible', '// Fallback if no pool available'],
  ['// silencio en error', '// silence on error'],
  ['// Predecodificar en WebAudio si está disponible', '// Pre-decode in WebAudio if available'],
])

// useSceneTransition.js
rep('lib/useSceneTransition.js', [
  ['* useSceneTransition - Sistema unificado de transiciones entre secciones', '* useSceneTransition - Unified transition system between sections'],
  ['* Arquitectura basada en Render Targets:', '* Render Target-based architecture:'],
  ['* 1. Captura escena A (actual) → textura', '* 1. Capture scene A (current) → texture'],
  ['* 2. Cambia sección internamente (invisible bajo el overlay)', '* 2. Switch section internally (invisible under the overlay)'],
  ['* 3. Captura escena B (nueva) → textura', '* 3. Capture scene B (new) → texture'],
  ['* 4. Shader mezcla A→B con el efecto elegido', '* 4. Shader blends A→B with chosen effect'],
  ['* 5. Al terminar, muestra escena B directamente', '* 5. On completion, shows scene B directly'],
  ['// Tipos de efectos disponibles', '// Available effect types'],
  ['// Fade simple a negro y back', '// Simple fade to black and back'],
  ['// Disolución con ruido', '// Noise dissolution'],
  ['// Grid de celdas (shader, no CSS)', '// Cell grid (shader, not CSS)'],
  ['// Barrido direccional', '// Directional wipe'],
  ['// Máscara de imagen', '// Image mask'],
  ['// Configuración por defecto de cada efecto (duraciones más largas para que se vea la animación)', '// Default config per effect (longer durations so animation is visible)'],
  ['// Estado del overlay', '// Overlay state'],
  ['// Refs para animación', '// Refs for animation'],
  ['* Captura el frame actual del canvas WebGL como textura', '* Captures the current WebGL canvas frame as a texture'],
  ['// Esperar a que el frame esté listo', '// Wait for the frame to be ready'],
  ['console.warn(\'[useSceneTransition] Error capturando frame:\', e)', 'console.warn(\'[useSceneTransition] Error capturing frame:\', e)'],
  ['* Limpia texturas y estado', '* Cleans up textures and state'],
  ['* Cancela la transición actual', '* Cancels the current transition'],
  ['* Inicia una transición a una nueva sección', '* Starts a transition to a new section'],
  ['// Evitar transiciones simultáneas', '// Prevent simultaneous transitions'],
  ['console.warn(\'[useSceneTransition] Transición ya en progreso\')', 'console.warn(\'[useSceneTransition] Transition already in progress\')'],
  ['// Configuración del efecto', '// Effect configuration'],
  ['// Notificar inicio', '// Notify start'],
  ['console.warn(\'[useSceneTransition] No se pudo capturar frame A, haciendo fallback\')', 'console.warn(\'[useSceneTransition] Could not capture frame A, falling back\')'],
  ['// Fallback: cambiar sección directamente', '// Fallback: change section directly'],
  ['// Activar overlay y comenzar fase de cubierta', '// Activate overlay and start cover phase'],
  ['// Animación: cubrir (0 → 1)', '// Animation: cover (0 → 1)'],
  ['// Mantener la pantalla cubierta un momento para que sea visible', '// Keep screen covered briefly so it\'s visible'],
  ['// Cambiar sección (invisible para el usuario)', '// Switch section (invisible to user)'],
  ['// Notificar mitad de transición (configurar UI)', '// Notify mid-transition (configure UI)'],
  ['// Esperar varios frames para que React renderice completamente la nueva sección', '// Wait several frames for React to fully render the new section'],
  ['// Delay adicional para garantizar que la textura B esté lista', '// Extra delay to ensure texture B is ready'],
  ['// El shader interpreta: 0→1 = cubrir, 1→2 = revelar', '// The shader interprets: 0→1 = cover, 1→2 = reveal'],
  ['// Continuar animación de 1 a 2 (revelar la nueva escena)', '// Continue animation 1 to 2 (reveal the new scene)'],
  ['// Transición completa - el overlay hará fade out via CSS', '// Transition complete — overlay will fade out via CSS'],
  ['* Verifica si hay una transición activa', '* Checks if there is an active transition'],
  ['// Acciones', '// Actions'],
  ['// Refs para acceso externo', '// Refs for external access'],
  ['// Inicialmente igual para evitar flash', '// Initially the same to avoid flash'],
  ['// FASE 1: Capturar escena actual (A)', '// PHASE 1: Capture current scene (A)'],
  ['// FASE 2: Pantalla completamente cubierta', '// PHASE 2: Screen fully covered'],
  ['// FASE 3: Capturar nueva escena (B)', '// PHASE 3: Capture new scene (B)'],
  ['// FASE 4: Revelar (1 → 2 para todos los efectos)', '// PHASE 4: Reveal (1 → 2 for all effects)'],
])

// main.jsx
rep('main.jsx', [
  ['// Patch global: algunos navegadores/drivers no soportan WEBGL_lose_context.', '// Global patch: some browsers/drivers don\'t support WEBGL_lose_context.'],
  ['// three loguea warning si alguien llama renderer.forceContextLoss().', '// three logs a warning if someone calls renderer.forceContextLoss().'],
  ['// Lo convertimos en no-op si no existe la extensión, para evitar ruido y side-effects.', '// We convert it to a no-op if the extension is missing, to avoid noise and side-effects.'],
  ['// Guardar referencia original SIN bind (necesitamos el renderer real como `this`)', '// Save original reference WITHOUT bind (we need the real renderer as `this`)'],
  ['// OJO: StrictMode en DEV monta/desmonta dos veces, lo cual con R3F incrementa', '// NOTE: StrictMode in DEV mounts/unmounts twice, which with R3F increases'],
  ['// mucho el riesgo de Context Lost (y dispara forceContextLoss en cleanup).', '// the risk of Context Lost significantly (and triggers forceContextLoss in cleanup).'],
])

// i18n/LanguageContext.jsx
rep('i18n/LanguageContext.jsx', [])

// admin files
rep('admin/AboutEditor.jsx', [
  ['{/* Preview inglés */}', '{/* English preview */}'],
  ['{/* Preview español */}', '{/* Spanish preview */}'],
])

rep('admin/ProjectEditor.jsx', [
  ['{/* Seleccionar de imágenes existentes */}', '{/* Select from existing images */}'],
])

console.log('--- Batch 3 done ---')
