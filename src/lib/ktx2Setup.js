/**
 * Shared KTX2 + Draco loader configuration for GLTFLoader.
 *
 * The character.glb (and potentially other models) use KTX2-compressed
 * textures and Draco-compressed geometry. Every call to useGLTF /
 * useGLTF.preload that touches such a model MUST pass this helper as
 * the `extendLoader` callback so the GLTFLoader knows how to handle
 * KTX2 data and Draco meshes.
 *
 * Usage:
 *   import { extendGLTFLoaderKTX2 } from '@/lib/ktx2Setup'
 *   useGLTF(url, true, true, extendGLTFLoaderKTX2)
 *   useGLTF.preload(url, true, true, extendGLTFLoaderKTX2)
 */

import * as THREE from 'three'
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'

// Keep singleton instances to avoid re-downloading WASM each time.
let _ktx2 = null
let _draco = null
let _supportDetected = false

function getThreeVersion() {
  const r = Number.parseInt(THREE.REVISION, 10)
  return Number.isFinite(r) ? `0.${r}.0` : '0.182.0'
}

function getKTX2Loader() {
  if (_ktx2) return _ktx2
  const version = getThreeVersion()
  _ktx2 = new KTX2Loader()
  _ktx2.setTranscoderPath(
    `https://unpkg.com/three@${version}/examples/jsm/libs/basis/`,
  )
  return _ktx2
}

function getDRACOLoader() {
  if (_draco) return _draco
  const version = getThreeVersion()
  _draco = new DRACOLoader()
  _draco.setDecoderPath(
    `https://unpkg.com/three@${version}/examples/jsm/libs/draco/gltf/`,
  )
  _draco.setDecoderConfig({ type: 'js' }) // JS fallback — works everywhere
  return _draco
}

/**
 * Extend a GLTFLoader with KTX2 + Draco support.
 * Pass this directly as the 4th argument of useGLTF / useGLTF.preload.
 */
export function extendGLTFLoaderKTX2(loader) {
  try {
    const ktx2 = getKTX2Loader()
    if (loader.setKTX2Loader) loader.setKTX2Loader(ktx2)
  } catch { /* swallow — loader will still work for non-KTX2 models */ }
  try {
    const draco = getDRACOLoader()
    if (loader.setDRACOLoader) loader.setDRACOLoader(draco)
  } catch { /* swallow — loader will still work for non-Draco models */ }
}

/**
 * Call once from inside a Canvas (where `gl` is available) to let the
 * KTX2Loader detect which compressed-texture formats the GPU supports.
 * Safe to call multiple times — the detection only runs once.
 */
export function detectKTX2Support(gl) {
  if (_supportDetected || !gl) return
  try {
    const ktx2 = getKTX2Loader()
    // r180+ may require init() before detectSupport
    Promise.resolve(gl.init?.())
      .then(() => { try { ktx2.detectSupport(gl) } catch { } })
      .catch(() => { try { ktx2.detectSupport(gl) } catch { } })
    _supportDetected = true
  } catch { }
}
