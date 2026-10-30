/**
 * Shared KTX2 + Draco loader configuration for GLTFLoader.
 *
 * Every call to useGLTF / useGLTF.preload MUST pass this helper as the
 * `extendLoader` callback so the GLTFLoader knows how to handle KTX2 data.
 *
 * Usage:
 *   import { extendGLTFLoaderKTX2 } from '@/lib/ktx2Setup'
 *   useGLTF(url, true, true, extendGLTFLoaderKTX2)
 *   useGLTF.preload(url, true, true, extendGLTFLoaderKTX2)
 *
 * OJO con KTX2: el KTX2Loader solo funciona después de `detectKTX2Support`,
 * y todos los componentes la llaman en un useEffect que no corre hasta que
 * useGLTF dejó de suspender, o sea, con el modelo ya cargado. Por eso la
 * única textura KTX2 de character.glb (rugosidad del pelo) nunca cargó y se
 * quitó del archivo el 2026-10-30. Si un modelo vuelve a traer KTX2, primero
 * hay que detectar el soporte antes de la primera carga.
 */

import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'
import { useGLTF } from '@react-three/drei'

// Keep singleton instances to avoid re-downloading WASM each time.
let _ktx2 = null
let _supportDetected = false

// Decoders AUTO-HOSPEDADOS en public/three/ (copiados de
// node_modules/three/examples/jsm/libs/). character.glb usa
// KHR_draco_mesh_compression: sin esto el preloader no termina de parsear el
// modelo hasta resolver DNS + TLS + fetch contra un tercero.
const DECODER_BASE = `${import.meta.env.BASE_URL || '/'}three/`

// El Draco lo pone drei, no nosotros: con `useDraco` en true (todas las
// llamadas) su extensions() corre DESPUÉS de extendLoader y pisa cualquier
// DRACOLoader propio con el suyo, que por default baja de gstatic.com. Hasta
// el 2026-10-30 así salía, aunque aquí se configuraba uno local.
useGLTF.setDecoderPath(`${DECODER_BASE}draco/gltf/`)

function getKTX2Loader() {
  if (_ktx2) return _ktx2
  _ktx2 = new KTX2Loader()
  _ktx2.setTranscoderPath(`${DECODER_BASE}basis/`)
  return _ktx2
}

/**
 * Extend a GLTFLoader with KTX2 support.
 * Pass this directly as the 4th argument of useGLTF / useGLTF.preload.
 */
export function extendGLTFLoaderKTX2(loader) {
  try {
    const ktx2 = getKTX2Loader()
    if (loader.setKTX2Loader) loader.setKTX2Loader(ktx2)
  } catch { /* swallow — loader will still work for non-KTX2 models */ }
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
