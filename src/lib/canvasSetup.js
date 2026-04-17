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

// Compute the dpr range based on environment flags.
// Keep identical to the original inline expression in App.jsx.
export function computeCanvasDpr({ pageHidden, degradedMode, isMobilePerf }) {
  const top = pageHidden ? 1.0 : (degradedMode ? 1.0 : (isMobilePerf ? 1.0 : 1.1))
  return [1, top]
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
      // Robust fallback: prevent getContextAttributes() === null (null alpha in postprocessing)
      const orig = gl.getContextAttributes?.bind(gl)
      const cached = (typeof orig === 'function') ? orig() : null
      const safe = cached || {
        alpha: true,
        antialias: false,
        depth: true,
        stencil: false,
        premultipliedAlpha: true,
        preserveDrawingBuffer: false,
        powerPreference: 'high-performance',
        failIfMajorPerformanceCaveat: false,
        desynchronized: false,
      }
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
