// Scene-frame capture helpers (WebGL → THREE.Texture).
// Used by ripple transition to snapshot the previous scene before switching.
// Lives in its own module so that `three` is tree-shaken out of the eager
// App bundle — this file is only loaded via dynamic import at transition time.
import * as THREE from 'three'

// 2D-canvas copy of the GL canvas. Simple but prone to CORS taint on some setups.
export async function captureCanvasFrameAsTexture(glRef) {
  try {
    const gl = glRef.current
    if (!gl || !gl.domElement) return null
    // Wait 2 frames to ensure the canvas has the latest frame drawn
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    const src = gl.domElement
    const off = document.createElement('canvas')
    off.width = src.width
    off.height = src.height
    const ctx2d = off.getContext('2d')
    if (!ctx2d) return null
    ctx2d.drawImage(src, 0, 0)
    const tex = new THREE.CanvasTexture(off)
    tex.minFilter = THREE.LinearFilter
    tex.magFilter = THREE.LinearFilter
    tex.flipY = false
    tex.needsUpdate = true
    return tex
  } catch {
    return null
  }
}

// GPU-side copy via renderer.copyFramebufferToTexture. Preferred (avoids taint).
export async function captureCanvasFrameAsTextureGPU(glRef) {
  try {
    const renderer = glRef.current
    if (!renderer) return null
    // Ensure the current frame is ready
    await new Promise((r) => requestAnimationFrame(r))
    const size = new THREE.Vector2()
    renderer.getSize(size)
    const w = Math.max(1, Math.floor(size.x * (renderer.getPixelRatio?.() || 1)))
    const h = Math.max(1, Math.floor(size.y * (renderer.getPixelRatio?.() || 1)))
    const tex = new THREE.DataTexture(new Uint8Array(w * h * 4), w, h, THREE.RGBAFormat)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.minFilter = THREE.LinearFilter
    tex.magFilter = THREE.LinearFilter
    tex.flipY = false
    renderer.copyFramebufferToTexture(new THREE.Vector2(0, 0), tex, 0)
    return tex
  } catch {
    return null
  }
}

// Lazy factory for a mutable Vec3 "prev player position" buffer. Returns a
// Three.Vector3 the caller can `.copy()` into on demand. Same module so `three`
// is only imported once per chunk boundary.
export function makeVector3() {
  return new THREE.Vector3(0, 0, 0)
}
