// Batch 2: More files
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

// CharacterPortrait.jsx
rep('components/CharacterPortrait.jsx', [
  ['// chequeo inicial: si ya está en estado inválido, evita montar composer', '// initial check: if already invalid, avoid mounting composer'],
  ['// Clonar profundamente para no compartir jerarquías/skin con el jugador', '// Deep clone to avoid sharing hierarchies/skin with the player'],
  ['// Aislar materiales del retrato para que no compartan instancia con el Player', '// Isolate portrait materials so they don\'t share instances with the Player'],
  ['// Seleccionar clip de idle explícito si existe; si no, usar heurística', '// Select explicit idle clip if available; otherwise use heuristic'],
  ['// Glow "additivo" al fragment: si es alto, quema materiales (se ve blanco) con algunos GLB.', '// Additive fragment glow: if too high, burns materials (appears white) with some GLBs.'],
  ['// Posicionar el modelo para que se vea la cabeza dentro de la cápsula', '// Position model so the head is visible inside the capsule'],
  ['// Capturar pose base REAL inmediatamente (antes de que el tracking aplique offsets)', '// Capture REAL base pose immediately (before tracking applies offsets)'],
  ['// y guardarla en el propio objeto para que otros sistemas (HeadNudge) la reutilicen.', '// and store it on the object so other systems (HeadNudge) can reuse it.'],
  ['// (Antes había un "rebase" por timer; eso podía capturar la cabeza ya girada y dejarla chueca.', '// (Previously there was a timer-based rebase; it could capture the already-rotated head.'],
  ['//  Ahora la base se captura inmediatamente al detectar la cabeza.)', '//  Now the base is captured immediately when the head is detected.)'],
  ['// Raycast al plano perpendicular a la cámara que pasa por la cabeza', '// Raycast to camera-perpendicular plane through the head'],
  ['// Mezclar forward de cabeza con -camDir para robustez si el forward no es exacto', '// Mix head forward with -camDir for robustness if forward is not exact'],
  ['// Convertir hit a espacio local del padre para medir yaw/pitch relativos al rig', '// Convert hit to parent local space for relative yaw/pitch'],
  ['// Yaw: derecha positiva; en espacio local el forward suele ser -Z', '// Yaw: right positive; in local space forward is usually -Z'],
  ['// Pitch: arriba positivo', '// Pitch: up positive'],
  ['// Calcular deltas en NDC para una atenuación cruzada estable', '// Calculate NDC deltas for stable cross-attenuation'],
  ['// Clamps base y escalas no lineales: reducir yaw cuando el cursor está muy arriba/abajo', '// Base clamps and non-linear scales: reduce yaw when cursor is very high/low'],
  ['// Capturar rotación base del rig una sola vez para remover offset intrínseco', '// Capture rig base rotation once to remove intrinsic offset'],
  ['// Atenuar por proximidad al retrato: cerca del retrato => menos amplitud y más retraso', '// Attenuate by portrait proximity: near portrait => less amplitude and more delay'],
  ['// Radio de influencia: proporcional a la altura del retrato (~ 18rem ≈ 288px)', '// Influence radius: proportional to portrait height (~18rem ≈ 288px)'],
  ['// Heurística de proximidad al personaje central (player): zona elíptica en tercio inferior', '// Player center proximity heuristic: elliptical zone in lower third'],
  ['// Atenuación combinada: retrato + héroe (player) en pantalla', '// Combined attenuation: portrait + hero (player) on screen'],
  ['// Zona muerta cercana al retrato: desactiva seguimiento y regresa a neutro', '// Dead zone near portrait: disables tracking and returns to neutral'],
  ['// Suavizado: aún más lento dentro de la zona muerta', '// Smoothing: even slower inside the dead zone'],
  ['// No alteramos la cámara; sólo rotamos la cabeza para seguir el cursor', '// We don\'t alter the camera; just rotate the head to follow the cursor'],
  ['// Fijar una pose estable de cámara ortográfica para evitar desviaciones entre recargas', '// Fix a stable ortho camera pose to avoid drift between reloads'],
  ['// restaurar cámara al desmontar', '// restore camera on unmount'],
  ['// Colocar target en la cabeza y apuntar el foco', '// Place target at head and aim the spotlight'],
  ['{/* Luz puntual/spot detrás del modelo para rim light */}', '{/* Spot light behind the model for rim light */}'],
  ['// amortiguador elástico que vuelve a neutro tras el golpe', '// elastic damper that returns to neutral after the hit'],
  ['// localizar cabeza por nombre o heurística', '// locate head by name or heuristic'],
  ['// IMPORTANT: volver siempre a la pose base del retrato (no al estado momentáneo)', '// IMPORTANT: always return to portrait base pose (not momentary state)'],
  ['// Ajustes más rápidos y con amortiguación mayor para acortar la duración', '// Faster adjustments with higher damping to shorten duration'],
  ['// muelle hacia base', '// spring toward base'],
  ['// Criterio de parada más agresivo; al finalizar, fijar exactamente la pose base', '// More aggressive stop criterion; on finish, set exactly the base pose'],
  ['// Forzar recentrado del tracker para evitar que quede un residuo tras spam de clicks', '// Force tracker recenter to prevent residue after click spam'],
  ['// Override opcional: forzar el layout compacto (retrato pequeño) desde App', '// Optional override: force compact layout (small portrait) from App'],
  ['// Clase CSS adicional para animaciones de entrada/salida', '// Extra CSS class for enter/exit animations'],
  ['// Límites de cámara: maximos dados por el usuario', '// Camera limits: user-defined maximums'],
  ['// Breakpoint de UI compacta (alineado con App: ≤1100px)', '// Compact UI breakpoint (aligned with App: ≤1100px)'],
  ['// Detección local de perfil móvil/low\u2010perf para optimizar el retrato', '// Local mobile/low-perf profile detection to optimize the portrait'],
  ['// Controles de luz (ajustables por el usuario)', '// Light controls (user-adjustable)'],
  ['// Cursor personalizado (slap.svg) dentro del retrato', '// Custom cursor (slap.svg) inside the portrait'],
  ['// Cámara libre vertical (sin lookAt forzado) y zoom sin distorsión', '// Free vertical camera (no forced lookAt) and distortion-free zoom'],
  ['// Forzar compacto en iPad/Tesla incluso si el viewport es grande (iPad Pro / Tesla browser)', '// Force compact on iPad/Tesla even if viewport is large (iPad Pro / Tesla browser)'],
  ['// Al entrar en hero mode, fijar cámara estable y bloquear interacciones', '// On hero mode entry, fix stable camera and lock interactions'],
  ['// Bloque extra: recentrar cámara cada frame breve tras entrar para evitar drift inicial', '// Extra: recenter camera briefly after entry to avoid initial drift'],
  ['// Audio de click (punch) con polifonía: pool de instancias', '// Click audio (punch) with polyphony: instance pool'],
  ['// Web Audio: precargar y decodificar el audio para latencia casi cero', '// Web Audio: preload and decode audio for near-zero latency'],
  ['// Burst de shake de cámara del retrato (≈ 480ms)', '// Portrait camera shake burst (~480ms)'],
  ['// Animación de cursor más grande con ligero rebote al hacer click', '// Larger cursor animation with slight bounce on click'],
  ['// Sonido punch (Web Audio preferido para baja latencia)', '// Punch sound (Web Audio preferred for low latency)'],
  ['// Nudge de cabeza', '// Head nudge'],
  ['// Ventana más permisiva para clicks rápidos (mouse/trackpad/touch)', '// More permissive window for fast clicks (mouse/trackpad/touch)'],
  ['// El easter egg se controla vía `eggActive` (sin desarmado del personaje).', '// Easter egg controlled via `eggActive` (no character disassembly).'],
  ['// Disparar frase del easter egg hacia la viñeta 3D (si existe)', '// Fire easter egg phrase to 3D speech bubble (if present)'],
  ['// Intentar reanudar en primer gesto del usuario para eliminar latencia del primer click', '// Try resuming on first user gesture to eliminate first-click latency'],
  ['{/* Wrapper relativo para posicionar botón por fuera del retrato sin enmascararse */}', '{/* Relative wrapper to position button outside portrait without masking */}'],
  ['{/* Mobile 20% más pequeño: 9rem→7.2rem, 13rem→10.4rem */}', '{/* Mobile 20% smaller: 9rem→7.2rem, 13rem→10.4rem */}'],
  ['// Reducir presión de VRAM sin perder postFX: bajar DPR y usar composer a menor resolución.', '// Reduce VRAM pressure without losing postFX: lower DPR and use composer at lower resolution.'],
  ['// Fallback robusto: evitar getContextAttributes() === null (alpha null en postprocessing)', '// Robust fallback: prevent getContextAttributes() === null (alpha null in postprocessing)'],
  ['// Evitar warning si WEBGL_lose_context no existe', '// Avoid warning if WEBGL_lose_context doesn\'t exist'],
  ['{/* Sincronizar cámara ortográfica; en hero la fijamos estática */}', '{/* Sync ortho camera; in hero mode we fix it static */}'],
  ['{/* Mantener cámara ortográfica apuntando al frente */}', '{/* Keep ortho camera facing forward */}'],
  ['{/* Cámara libre: sin lookAt forzado; sin shake para precisión de encuadre */}', '{/* Free camera: no forced lookAt; no shake for framing precision */}'],
  ['// Composer de postproceso del retrato', '// Portrait post-processing composer'],
  ['{/* Bloom del retrato (antes no había pass; al bajar el glow dejó de "leerse") */}', '{/* Portrait bloom (previously no pass; lowered glow became unreadable) */}'],
  ['// Cursor personalizado tipo slap que sigue al mouse dentro del retrato', '// Custom slap cursor following mouse inside the portrait'],
  ['{/* Overlay de frase del easter egg (el texto ahora vive en la viñeta; retirado del retrato) */}', '{/* Easter egg phrase overlay (text now lives in speech bubble; removed from portrait) */}'],
  ['// Barra de cooldown (a la derecha del retrato)', '// Cooldown bar (to the right of the portrait)'],
  ['// Controles de luz (interactivos)', '// Light controls (interactive)'],
  ['// Mantener la versión del transcoder alineada a la versión de three instalada', '// Keep transcoder version aligned with installed three version'],
  ['// Preload del modelo', '// Model preload'],
])

// CharacterPortraitHero.jsx
rep('components/CharacterPortraitHero.jsx', [
  ['// asegurar proyección estable', '// ensure stable projection'],
])

// ContactForm.jsx
rep('components/ContactForm.jsx', [
  ['// Formulario por pasos inspirado en Typeform: una pregunta por pantalla,', '// Step-by-step form inspired by Typeform: one question per screen,'],
  ['// con foco gestionado, validación básica y accesibilidad (labels/fieldset/legend).', '// with managed focus, basic validation, and accessibility (labels/fieldset/legend).'],
  ['// No envía a servidor: muestra un resumen de confirmación al finalizar.', '// Sends to server; shows a confirmation summary on completion.'],
  ['// Honeypot anti-spam (bots suelen llenar campos ocultos)', '// Honeypot anti-spam (bots usually fill hidden fields)'],
  ['// último paso: enviar', '// last step: send'],
  ['// En pasos 0 y 1 avanzamos con Enter', '// In steps 0 and 1 we advance with Enter'],
  ['// En textarea (paso 3): Shift+Enter = salto de línea, Enter = enviar/avanzar', '// In textarea (step 3): Shift+Enter = line break, Enter = send/advance'],
  ['// Determinar dirección de animación según cambio de paso', '// Determine animation direction based on step change'],
  ['{/* Honeypot field (oculto). Debe permanecer vacío. */}', '{/* Honeypot field (hidden). Must remain empty. */}'],
  ['// Progreso (desktop fijo; mobile inline)', '// Progress (desktop fixed; mobile inline)'],
  ['{/* Action bar: desktop fijo; en mobile se renderiza inline más abajo */}', '{/* Action bar: desktop fixed; on mobile rendered inline below */}'],
  ['// Paso actual', '// Current step'],
])

// SpeechBubble3D.jsx
rep('components/SpeechBubble3D.jsx', [
  ['// displayText: lo que se ve (typing)', '// displayText: what is shown (typing)'],
  ['// layoutText: texto completo para medir tamaño (evita jitter mientras escribe)', '// layoutText: full text to measure size (avoids jitter during typing)'],
  ['// theme: permite estilos especiales (easter egg)', '// theme: enables special styles (easter egg)'],
  ['// Offset "cómico": a la derecha y arriba del personaje.', '// Comic-style offset: to the right and above the character.'],
  ['// Ojo: se aplica relativo a cámara (right/up), no al mundo.', '// Note: applied relative to camera (right/up), not world.'],
  ['// Burbuja circular: radio auto\u2010ajustable según el tamaño del texto', '// Circular bubble: auto-adjustable radius based on text size'],
  ['// (Hooks SIEMPRE arriba para respetar Rules of Hooks)', '// (Hooks ALWAYS at top to respect Rules of Hooks)'],
  ['// Aumentado para que la tipografía sea más grande sin recortes.', '// Increased so typography is larger without clipping.'],
  ['// Reset al cambiar frase objetivo (evita heredar tamaño anterior)', '// Reset when target phrase changes (avoids inheriting previous size)'],
  ['// Para suavizado frame-rate independent', '// For frame-rate independent smoothing'],
  ['// posición del anchor suavizada', '// smoothed anchor position'],
  ['// dirección de cámara suavizada', '// smoothed camera direction'],
  ['// Reset suavizado cuando la viñeta aparece/desaparece', '// Reset smoothing when bubble appears/disappears'],
  ['// Forzar re-inicialización del suavizado para evitar "salto" desde posición anterior', '// Force re-init of smoothing to avoid "jump" from previous position'],
  ['// Textura de puntitos estilo cómic (procedural, sin assets)', '// Comic-style dot texture (procedural, no assets)'],
  ['// Fondo transparente', '// Transparent background'],
  ['// gradiente radial: más denso en abajo-derecha', '// radial gradient: denser at bottom-right'],
  ['// Fuerza siempre-visible (sin oclusión) para legibilidad', '// Force always-visible (no occlusion) for readability'],
  ['// cap para tab-out', '// cap for tab-out'],
  ['// Obtener posición raw del anchor', '// Get raw anchor position'],
  ['// Obtener dirección raw de la cámara', '// Get raw camera direction'],
  ['// --- INICIALIZACIÓN ---', '// --- INITIALIZATION ---'],
  ['// --- SUAVIZAR ANCHOR Y CÁMARA POR SEPARADO ---', '// --- SMOOTH ANCHOR AND CAMERA SEPARATELY ---'],
  ['// Lambda muy bajo para el anchor (elimina vibración del personaje)', '// Very low lambda for anchor (eliminates character vibration)'],
  ['// Lambda muy bajo para la dirección de cámara (elimina vibración al girar)', '// Very low lambda for camera direction (eliminates rotation vibration)'],
  ['// --- CALCULAR POSICIÓN FINAL CON VALORES SUAVIZADOS ---', '// --- COMPUTE FINAL POSITION WITH SMOOTHED VALUES ---'],
  ['// Posición final = anchor suavizado + offset relativo a cámara suavizada', '// Final position = smoothed anchor + offset relative to smoothed camera'],
  ['// Escala suavizada', '// Smoothed scale'],
  ['// centro Y local de la burbuja', '// local Y center of the bubble'],
  ['// Evitar cualquier interferencia con controles/clicks: no raycast', '// Avoid any interference with controls/clicks: no raycast'],
  ['// Tipografía igual al retrato (font-marquee): Luckiest Guy', '// Typography matching portrait (font-marquee): Luckiest Guy'],
  ['// Menos "bold visual": quitar outline duro que engruesa y vuelve ilegible', '// Less "bold visual": remove hard outline that thickens and becomes illegible'],
  ['// Convertir bounds del texto (en unidades locales) a radio requerido,', '// Convert text bounds (in local units) to required radius,'],
  ['// dejando padding para que no "toque" el borde.', '// leaving padding so it doesn\'t touch the edge.'],
])

// useSpeechBubbles.js
rep('components/useSpeechBubbles.js', [
  ['// Scheduler simple: muestra frases aleatorias con typing.', '// Simple scheduler: shows random phrases with typing.'],
  ['// i18n: al cambiar idioma, re-traduce la viñeta activa manteniendo el mismo índice.', '// i18n: on language change, re-translates the active bubble keeping the same index.'],
  ['// Tema de la viñeta (ej. egg override para burbuja 3D)', '// Bubble theme (e.g. egg override for 3D bubble)'],
  ['// guardamos override para re-traducir en cambio de idioma', '// save override for re-translation on language change'],
  ['// Overrides externos (ej. easter egg del retrato) para mostrar frase específica unos segundos', '// External overrides (e.g. portrait easter egg) to show specific phrase for a few seconds'],
  ['// Re-traducir viñeta visible al cambiar idioma', '// Re-translate visible bubble on language change'],
  ['// Si hay override activo (con key+idx), re-resolver desde i18n egg phrases', '// If there\'s an active override (with key+idx), re-resolve from i18n egg phrases'],
])

// useKeyboard.js
rep('components/useKeyboard.js', [
  ['// Evitar re-renders por key-repeat del SO (muy frecuente en Windows)', '// Avoid re-renders from OS key-repeat (very frequent on Windows)'],
  ['// Mantener una tecla presionada NO debería disparar setState continuamente.', '// Holding a key should NOT trigger setState continuously.'],
  ['// Si la ventana pierde foco, evitamos teclas "pegadas"', '// If window loses focus, prevent "stuck" keys'],
])

// MobileJoystick.jsx
rep('components/MobileJoystick.jsx', [
  ['// Analog vector (global) para consumo suave en Player (x: derecha+, y: abajo+)', '// Analog vector (global) for smooth Player consumption (x: right+, y: down+)'],
  ['// publicar vector normalizado y magnitud', '// publish normalized vector and magnitude'],
  ['// y positivo es hacia abajo en pantalla; Player invierte el eje Y para z-forward', '// positive y is screen-down; Player inverts Y axis for z-forward'],
  ['// Nota: se mantiene también el fallback de teclas para compatibilidad', '// Note: key fallback is also maintained for compatibility'],
  ['// Map a 8 direcciones pero emite 4 booleans como fallback', '// Map to 8 directions but emit 4 booleans as fallback'],
])

// MusicPlayer.jsx
rep('components/MusicPlayer.jsx', [
  ['// Librería profesional para scratch con playbackRate negativo sin glitches', '// Professional library for scratch with negative playbackRate without glitches'],
  ['// Permite al padre alinear el "modo mobile" con el breakpoint del menú hamburguesa', '// Allows parent to align "mobile mode" with hamburger menu breakpoint'],
  ['// Override opcional (útil si el layout depende de UI, no solo de viewport)', '// Optional override (useful if layout depends on UI, not just viewport)'],
  ['// Solo necesitamos un buffer, la librería maneja el reverso', '// Only need one buffer, the library handles reverse'],
  ['// Track del playback rate actual', '// Track current playback rate'],
  ['// Si el padre fuerza el modo, respetarlo sin escuchar viewport', '// If parent forces mode, respect it without listening to viewport'],
  ['// descargar imagen (o ID3) y cachear solo para readiness', '// download image (or ID3) and cache for readiness only'],
  ['// ReversibleAudioBufferSourceNode usa stop() igual que el nativo', '// ReversibleAudioBufferSourceNode uses stop() same as native'],
  ['// Fallback: usar elemento de audio si el track actual está marcado', '// Fallback: use audio element if current track is marked'],
  ['// Usar ReversibleAudioBufferSourceNode para scratch sin glitches', '// Use ReversibleAudioBufferSourceNode for glitch-free scratch'],
  ['// Autoplay gateado por botón "Entrar" (prop autoStart)', '// Autoplay gated by "Enter" button (autoStart prop)'],
  ['// Marcar fallback y reproducir con HTMLAudio', '// Mark fallback and play with HTMLAudio'],
  ['// precarga WA si posible; no marcar fallback aquí', '// preload WA if possible; don\'t mark fallback here'],
  ['// No scratch ni cambio de velocidad en fallback HTML; mantener reproducción normal', '// No scratch or speed changes in HTML fallback; keep normal playback'],
  ['// Easter egg: detectar si está activo (baja los BPMs a 60, o sea playbackRate 0.5)', '// Easter egg: detect if active (lowers BPMs to 60, i.e. playbackRate 0.5)'],
  ['// CLAVE: Durante reproducción normal (no scratch), NO tocar el playbackRate', '// KEY: During normal playback (no scratch), do NOT touch playbackRate'],
  ['// EXCEPTO cuando el estado del easter egg cambia', '// EXCEPT when the easter egg state changes'],
  ['// Detectar cambio en el estado del easter egg', '// Detect easter egg state change'],
  ['// Si acabamos de terminar un scratch, restaurar rate (considerando easter egg)', '// If we just finished a scratch, restore rate (considering easter egg)'],
  ['// No hacer nada más durante reproducción normal', '// Do nothing more during normal playback'],
  ['// Marcar que estamos haciendo scratch', '// Mark that we\'re scratching'],
  ['// DEBOUNCING: Limitar actualizaciones durante scratch a max 30/segundo (cada ~33ms)', '// DEBOUNCING: Limit updates during scratch to max 30/sec (~33ms each)'],
  ['// Esto previene sobrecarga de la API de audio', '// This prevents audio API overload'],
  ['// Durante scratch: calcular el rate con el signo correcto', '// During scratch: calculate rate with correct sign'],
  ['// Clampear y aplicar eggSlow (el easter egg también afecta al scratch)', '// Clamp and apply eggSlow (easter egg also affects scratch)'],
  ['// THRESHOLD MÁS GRANDE: Solo actualizar si hay cambio significativo (> 5%)', '// LARGER THRESHOLD: Only update if significant change (> 5%)'],
  ['// Esto evita micro-ajustes que causan glitches', '// This avoids micro-adjustments that cause glitches'],
  ['// ReversibleAudioBufferSourceNode acepta valores negativos directamente', '// ReversibleAudioBufferSourceNode accepts negative values directly'],
  ['// Avance de pista: al cambiar index, cargar buffers WA y resetear ángulo/tiempo para mantener sincronía cover/sonido', '// Track advance: on index change, load WA buffers and reset angle/time to keep cover/sound in sync'],
  ['// Fallback por pista: usar HTMLAudio directamente si ya está marcada', '// Per-track fallback: use HTMLAudio directly if already marked'],
  ['// Marcar fallback y reproducir esta MISMA pista con HTMLAudio', '// Mark fallback and play this SAME track with HTMLAudio'],
  ['// reset angular/UI y reproducir sólo cuando todo listo', '// reset angle/UI and play only when everything is ready'],
  ['// Mantener currentTime sincronizado con HTMLAudio en fallback', '// Keep currentTime synchronized with HTMLAudio in fallback'],
  ['// Detectar reversa basado en el cambio de ángulo (umbral pequeño para evitar falsos positivos)', '// Detect reverse based on angle change (small threshold to avoid false positives)'],
  ['// Pasar isDragging para que solo permita scratch real durante drag', '// Pass isDragging so only real scratch is allowed during drag'],
  ['// En mobile no togglear crecimiento en click; crecimiento es sólo mientras se presiona', '// On mobile don\'t toggle growth on click; growth is only while pressing'],
  ['// Nota: evitar mezclar `padding` (shorthand) con `paddingBottom` para no disparar warning de React.', '// Note: avoid mixing `padding` (shorthand) with `paddingBottom` to prevent React warning.'],
  ['// Fallback: navegar directamente a la URL (permite "Guardar como")', '// Fallback: navigate directly to URL (allows "Save As")'],
  ['// Auto-next solo cuando termina naturalmente (no en pauses/stop manual)', '// Auto-next only on natural end (not on pause/manual stop)'],
  ['// Evitar rebotes: sólo auto-next si no estamos en switching o stop manual', '// Avoid bounces: only auto-next if not switching or manual stop'],
  ['// Si hubo scratch recientemente, no saltar automáticamente', '// If there was a recent scratch, don\'t auto-skip'],
  ['{ /* ignorar; CoverFromMeta seguirá intentando */ }', '{ /* ignore; CoverFromMeta will keep trying */ }'],
  ['/* ignorar; CoverFromMeta seguirá intentando */', '/* ignore; CoverFromMeta will keep trying */'],
])

// GlobalCursor.jsx
rep('components/GlobalCursor.jsx', [
  ['// ocultar si el path contiene un nodo con data-hide-cursor="true"', '// hide if the path contains a node with data-hide-cursor="true"'],
])

// TutorialModal.jsx
rep('components/TutorialModal.jsx', [
  ['// Icono de gamepad inline (mismo que en App.jsx)', '// Inline gamepad icon (same as in App.jsx)'],
  ['* TutorialModal - Modal slideshow con instrucciones de controles', '* TutorialModal - Modal slideshow with control instructions'],
  ['// Reset slide cuando se abre', '// Reset slide when opened'],
  ['// Escape para cerrar', '// Escape to close'],
  ['/** Componente de tecla individual */', '/** Individual key component */'],
  ['/** Componente de barra espaciadora */', '/** Spacebar component */'],
  ['/** Hook para manejar si el tutorial ya fue mostrado */', '/** Hook to manage whether the tutorial has been shown */'],
])

// ScoreHUD.jsx
rep('components/ScoreHUD.jsx', [
  ['* ScoreHUD - Componente aislado para mostrar el score', '* ScoreHUD - Isolated component for displaying the score'],
  ['// Suscribirse al store', '// Subscribe to store'],
  ['// Iniciar el hold', '// Start hold'],
  ['// Completado', '// Completed'],
  ['// Detener el hold', '// Stop hold'],
  ['// Escape para cerrar modal', '// Escape to close modal'],
  ['{/* HUD del score */}', '{/* Score HUD */}'],
  ['Manteniendo presionado...', 'Holding...'],
])

// PowerBar.jsx
rep('components/PowerBar.jsx', [
  ['// Opcional: usar un valor "live" sin re-render del padre (ej: window.__powerFillLive)', '// Optional: use a "live" value without parent re-render (e.g. window.__powerFillLive)'],
  ['// Estado de press (mobile): crecer + stroke blanco', '// Press state (mobile): grow + white stroke'],
  ['// multiplicador (1 = normal). Útil para mobile.', '// multiplier (1 = normal). Useful for mobile.'],
  ['// Live fill: actualizar el DOM por RAF (sin re-render) para evitar "sloppy/step".', '// Live fill: update DOM via RAF (no re-render) to avoid sloppy/stepped animation.'],
  ['{/* Track (blur + backdrop opaco) */}', '{/* Track (blur + opaque backdrop) */}'],
  ['{/* Bolt: superpuesto abajo (wrapper fija posición; botón escala desde centro) */}', '{/* Bolt: overlaid at bottom (wrapper fixes position; button scales from center) */}'],
  ['aria-label="Cargar poder"', 'aria-label="Charge power"'],
  ['{/* Bolt: superpuesto al inicio (wrapper fija posición; botón escala desde centro) */}', '{/* Bolt: overlaid at start (wrapper fixes position; button scales from center) */}'],
])

// SkyStars.jsx
rep('components/SkyStars.jsx', [
  ['* Campo de estrellas de muy bajo costo:', '* Very low-cost star field:'],
  ['* - Cielo estático: sin seguimiento de cámara ni animaciones.', '* - Static sky: no camera tracking or animations.'],
  ['* - Tres capas de Points fijas con muy poca densidad.', '* - Three fixed Points layers with very low density.'],
  ['// Pequeñas variaciones mágicas (tonos fríos/pasteles)', '// Small magical variations (cool/pastel tones)'],
  ['// evita estrellas bajo horizonte', '// avoid stars below horizon'],
  ['// Anclar a la cámara: evita parallax y la sensación de "partículas"', '// Anchor to camera: avoids parallax and "particle" feel'],
])

// PsychoOverlay.jsx
rep('components/PsychoOverlay.jsx', [
  ['// Overlay DOM que no depende del compositor. Usa backdrop-filter (para levantar luminancia)', '// DOM overlay independent of compositor. Uses backdrop-filter (to boost luminance)'],
  ['// y capas con gradientes/mix-blend para un look ácido visible en fondos oscuros.', '// and layers with gradients/mix-blend for an acid look visible on dark backgrounds.'],
  ['{/* Estilos locales para animaciones */}', '{/* Local styles for animations */}'],
  ['{/* Capa de ajuste global: levantar brillo/contraste/saturación del fondo */}', '{/* Global adjustment layer: boost brightness/contrast/saturation of background */}'],
  ['{/* Capa blob 1 (radial + gradiente), mezcla en screen */}', '{/* Blob layer 1 (radial + gradient), screen blend */}'],
  ['{/* Capa blob 2 */}', '{/* Blob layer 2 */}'],
  ['{/* Sutil patrón de puntos para reforzar "psicodélico" */}', '{/* Subtle dot pattern to reinforce "psychedelic" feel */}'],
])

// DissolveOverlay.jsx
rep('components/DissolveOverlay.jsx', [
  ['// Máscara: agujero central que crece (revela la nueva escena bajo el overlay)', '// Mask: growing center hole (reveals new scene beneath overlay)'],
  ['// Un leve atenuado global para que no se note el corte exterior', '// Slight global fade so the outer edge cut isn\'t visible'],
])

// Section2.jsx
rep('components/Section2.jsx', [
  ['// Fetch contenido dinámico desde la API (con fallback a traducciones estáticas)', '// Fetch dynamic content from API (with fallback to static translations)'],
  ['// Silenciar errores - usar fallback estático', '// Silence errors — use static fallback'],
  ['// Helper: obtener texto de párrafo (dinámico o fallback)', '// Helper: get paragraph text (dynamic or fallback)'],
  ['// Primero intentar contenido dinámico', '// First try dynamic content'],
  ['// Fallback a traducciones estáticas', '// Fallback to static translations'],
  ['// Generar lista de párrafos (p1-p10)', '// Generate paragraph list (p1-p10)'],
  ['// Text content - offset para no solaparse con el marquee fixed (14vw ≈ font-size del banner + margen)', '// Text content — offset to avoid overlapping the fixed marquee (14vw ≈ banner font-size + margin)'],
])

console.log('--- Batch 2 done ---')
