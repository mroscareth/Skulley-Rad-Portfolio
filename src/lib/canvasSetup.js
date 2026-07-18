// Canvas setup helpers extracted from App.jsx.
// These encapsulate the verbose WebGL pre-warm + context-lost handling that
// used to live inline in the <Canvas onCreated={...}> prop.

// Static GL options for the main <Canvas>. Keep in sync with App.jsx usage.
export const canvasGLOptions = {
  antialias: false,
  powerPreference: 'high-performance',
  alpha: true,
  stencil: false,
  // preserveDrawingBuffer=true greatly increases VRAM usage and can cause Context Lost.
  preserveDrawingBuffer: false,
  failIfMajorPerformanceCaveat: false,
}

// Compute the dpr range [floor, ceiling] for the main <Canvas>.
//
// El techo se ata al devicePixelRatio REAL del aparato (cap 2): en pantallas
// 2x/3x renderizar muy por debajo del nativo estira el buffer. ANTES eso se
// veía "mordido" porque `<AdaptiveDpr pixelated>` upscaleaba con nearest; ahora
// AdaptiveDpr va SIN `pixelated` (bilinear) → bajar el DPR solo suaviza, no
// rompe las toon-lines. Por eso el piso vuelve a 1: AdaptiveDpr puede regresar
// ahí bajo carga (caminar) para ahorrar GPU sin que las líneas se mordisqueen,
// e idle restaura el techo (nítido). Cap 2 (no 3) acota fillrate/VRAM en
// retina — el costo ×9 del nativo 3 era justo el patrón de los OOM en mobile.
//
// Nota: `degradedMode` arranca en true y hoy NADIE lo vuelve a false (el
// PerformanceMonitor que lo apagaba fue removido, ver HomeScene), así que ya no
// es señal útil de degradación real — solo pageHidden pinea el DPR a 1.0 para
// ahorrar batería con la pestaña oculta.
export function computeCanvasDpr({ pageHidden, degradedMode, isMobilePerf }) {
  if (pageHidden) return [1, 1.0]
  const deviceDpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1
  const top = Math.min(deviceDpr, 2)
  return [1, top]
}

// Defaults seguros para getContextAttributes() cuando el contexto está
// perdido. Por spec WebGL, un contexto perdido devuelve null en
// getContextAttributes() — estos valores son los que Chrome/Firefox usan
// como default real para un contexto WebGL1 no-perdido.
const SAFE_CONTEXT_ATTRIBUTES = Object.freeze({
  alpha: true,
  antialias: false,
  depth: true,
  stencil: false,
  premultipliedAlpha: true,
  preserveDrawingBuffer: false,
  desynchronized: false,
  failIfMajorPerformanceCaveat: false,
  powerPreference: 'default',
  xrCompatible: false,
})

// Parcha getContextAttributes() sobre el CONTEXTO WEBGL NATIVO (no el wrapper
// THREE.WebGLRenderer) para que nunca devuelva null.
//
// Por qué: la lib `postprocessing` (EffectComposer.setRenderer, addPass,
// Pass.get alpha) llama `renderer.getContext().getContextAttributes().alpha`
// directo sobre el contexto nativo, sin null-check. Con el contexto perdido,
// getContextAttributes() devuelve null por spec → `.alpha` de null revienta
// con TypeError en cada rAF (pantalla negra + spam de errores). Los guards
// viejos parchaban `gl.getContextAttributes` sobre el WRAPPER de THREE, que
// nadie lee — letra muerta para este crash específico.
//
// Idempotente: usa una flag en el propio contexto nativo para no doble-parchar
// si varios consumidores (canvasSetup, PostFX, CharacterPortrait) llaman esto
// sobre el mismo renderer.
export function hardenContextAttributes(renderer) {
  try {
    const raw = renderer?.getContext?.()
    if (!raw || raw.__contextAttrsHardened) return
    const orig = raw.getContextAttributes?.bind(raw)
    if (typeof orig !== 'function') return
    raw.getContextAttributes = () => {
      try {
        return orig() || SAFE_CONTEXT_ATTRIBUTES
      } catch {
        return SAFE_CONTEXT_ATTRIBUTES
      }
    }
    raw.__contextAttrsHardened = true
  } catch { }
}

// Build the onCreated callback. Wraps the GL context with safe fallbacks,
// styles the canvas element, and wires webglcontextlost → degraded mode.
//
// Params:
//   glRef: mutable ref to receive the renderer.
//   setDegradedMode: state setter called on webglcontextlost.
export function createOnCanvasCreated({ glRef, setDegradedMode }) {
  return ({ gl }) => {
    // Pre-warm shaders/pipelines to avoid first interaction jank
    try {
      // Avoid warning if WEBGL_lose_context doesn't exist (some drivers/browsers)
      try {
        const ctx = gl?.getContext?.()
        const ext = ctx?.getExtension?.('WEBGL_lose_context')
        if (!ext) {
          // @ts-ignore
          gl.forceContextLoss = () => { }
          // @ts-ignore
          gl.forceContextRestore = () => { }
        }
      } catch { }
      // Parche sobre el wrapper THREE (inofensivo, lo dejamos por si algo lo
      // lee) + el parche que realmente importa: el contexto nativo.
      const orig = gl.getContextAttributes?.bind(gl)
      const cached = (typeof orig === 'function') ? orig() : null
      const safe = cached || SAFE_CONTEXT_ATTRIBUTES
      if (typeof orig === 'function') {
        // @ts-ignore
        gl.__cachedContextAttributes = safe
        // @ts-ignore
        gl.getContextAttributes = () => {
          try {
            const cur = orig()
            return cur || safe
          } catch {
            return safe
          }
        }
      }
      hardenContextAttributes(gl)
    } catch { }
    if (glRef) glRef.current = gl
    // Ensure canvas covers viewport but respects scrollbar gutter when sections are open
    try {
      const el = gl.domElement
      el.style.position = 'fixed'
      el.style.top = '0'
      el.style.left = '0'
      el.style.bottom = '0'
      el.style.right = '0'
      // Prevent gray <body> from showing when canvas isn't painting (paused frameloop / overlay).
      // This is CSS only; doesn't affect <color attach="background" ...> in WebGL.
      el.style.background = '#000'
      // Mobile: allow drag for OrbitControls (prevents browser from capturing gestures and killing rotate)
      el.style.touchAction = 'none'
      // WebGL context lost/restored handlers
      const onLost = (e) => {
        try { e.preventDefault() } catch { }
        // Enter degraded mode to recover context.
        try { setDegradedMode?.(true) } catch { }
      }
      const onRestored = () => { try { /* no-op; R3F will recover */ } catch { } }
      el.addEventListener('webglcontextlost', onLost, { passive: false })
      el.addEventListener('webglcontextrestored', onRestored)
    } catch { }
  }
}
