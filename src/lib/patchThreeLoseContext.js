import * as THREE from 'three'

// Some browsers/drivers don't support WEBGL_lose_context. three.js logs a
// warning if `renderer.forceContextLoss()` is called in that case. Patch the
// prototype to no-op those calls (avoids noise and side-effects).
// Idempotent — safe to call multiple times.
export default function patchThreeLoseContext() {
  try {
    const proto = THREE?.WebGLRenderer?.prototype
    // @ts-ignore
    if (!proto || proto.__patchedLoseContextSafe) return
    // @ts-ignore
    proto.__patchedLoseContextSafe = true
    const origForceLoss = proto.forceContextLoss
    const origForceRestore = proto.forceContextRestore
    proto.forceContextLoss = function () {
      try {
        const ctx = this?.getContext?.()
        const ext = ctx?.getExtension?.('WEBGL_lose_context')
        if (!ext?.loseContext) return
      } catch { return }
      try { return typeof origForceLoss === 'function' ? origForceLoss.call(this) : undefined } catch { return }
    }
    proto.forceContextRestore = function () {
      try {
        const ctx = this?.getContext?.()
        const ext = ctx?.getExtension?.('WEBGL_lose_context')
        if (!ext?.restoreContext) return
      } catch { return }
      try { return typeof origForceRestore === 'function' ? origForceRestore.call(this) : undefined } catch { return }
    }
  } catch { }
}
