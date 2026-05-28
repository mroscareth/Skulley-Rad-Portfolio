import { useMemo, useRef, useEffect } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { characterNormalTexture } from '../../lib/toonInkBuffer.js'

// Renderiza SOLO los meshes del personaje a un render target con normales
// geométricas (MeshNormalMaterial, respeta skinning). EdgeInk (PostFX) lee esta
// textura para entintar los creases del personaje sin tocar el resto de la
// escena. Corre con priority 0 → antes que el EffectComposer (priority 1).
// `target`: holder donde publicar la textura/escala (characterNormalTexture por
// defecto; el retrato pasa portraitNormalTexture).
// `fixedScale`: si true, scale=1 siempre (framing constante, ej. retrato ortho)
// → sin declutter por distancia.
// `allMeshes`: si true, mete TODOS los meshes (no solo skinned/piezas) al
// normal-pass — para modelos estáticos como los housebirds.
export default function CharacterNormalPass({ playerRef, enabled = true, target = characterNormalTexture, fixedScale = false, allMeshes = false, nearest = false }) {
  const { gl, camera, size } = useThree()

  const fbo = useMemo(() => {
    // NearestFilter: el fondo queda en 0 limpio (sin blend bilineal con la
    // geometría en la silueta) → el EdgeInk detecta bien el borde de silueta y
    // su maskSilhouette puede excluirla sin dibujar la doble línea.
    const filter = nearest ? THREE.NearestFilter : THREE.LinearFilter
    const rt = new THREE.WebGLRenderTarget(1, 1, {
      minFilter: filter,
      magFilter: filter,
      type: THREE.UnsignedByteType,
      depthBuffer: true,
    })
    return rt
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nearest])
  useEffect(() => {
    const dpr = gl.getPixelRatio()
    fbo.setSize(Math.max(2, Math.floor(size.width * dpr)), Math.max(2, Math.floor(size.height * dpr)))
  }, [fbo, gl, size])
  useEffect(() => () => { try { fbo.dispose() } catch { } }, [fbo])

  // Materiales normales por-mesh (cada SkinnedMesh compila su skinning).
  const normalMats = useRef(new Map())
  useEffect(() => () => {
    try { normalMats.current.forEach((m) => m.dispose()) } catch { }
    normalMats.current.clear()
  }, [])

  const _clearColor = useRef(new THREE.Color())
  const _footPos = useRef(new THREE.Vector3())
  const _headPos = useRef(new THREE.Vector3())

  // Altura aprox del personaje en mundo (para medir su tamaño en pantalla).
  const CHAR_WORLD_HEIGHT = 3.5
  // Altura en píxeles a la que el ink va a grosor/detalle base (≈ close-up).
  // KNOB: súbelo para que el ink solo se vea muy de cerca; bájalo para verlo
  // a más distancia.
  const REF_PX = 480

  // Priority 0.5: corre DESPUÉS de movimiento/cámara (priority 0) y ANTES del
  // EffectComposer (priority 1) → el normal-buffer usa la misma pose/cámara que
  // el render final (evita el "fantasma" duplicado al caminar).
  useFrame(() => {
    const root = playerRef?.current
    if (!enabled || !root || !root.visible) return

    // Escala por TAMAÑO EN PANTALLA del personaje (robusto, sin adivinar
    // distancia/FOV). Chico en pantalla → escala baja → limpieza agresiva.
    if (fixedScale) {
      target.scale = 1
    } else {
      try {
        root.getWorldPosition(_footPos.current)
        _headPos.current.copy(_footPos.current); _headPos.current.y += CHAR_WORLD_HEIGHT
        _footPos.current.project(camera)
        _headPos.current.project(camera)
        const pxHeight = Math.abs(_headPos.current.y - _footPos.current.y) * 0.5 * size.height
        target.scale = THREE.MathUtils.clamp(pxHeight / REF_PX, 0.2, 1.0)
      } catch { }
    }

    // Swap a normal material en los meshes del CUERPO (skinned, no-outline);
    // oculta todo lo demás (outline, orb, voxel, bolt) para aislar al personaje.
    const restore = []
    root.traverse((o) => {
      if (!o) return
      const renderable = o.isMesh || o.isSkinnedMesh || o.isInstancedMesh
      if (!renderable) return
      const isOutline = o.name && o.name.endsWith('_outline')
      // ¿es pieza del disassemble? (el flag puede estar en el mesh o en un grupo
      // ancestro, ej. headGroup/eyeGroup). Caminamos hacia arriba unos niveles.
      let isPiece = false
      for (let p = o, hops = 0; p && hops < 6; p = p.parent, hops += 1) {
        if (p.userData?.__disassembleOwned === true) { isPiece = true; break }
      }
      // Cuerpo skinned (personaje armado) O piezas rígidas → al normal-pass.
      // PERO si el mesh está casi transparente (orb mode usa applyModelOpacity(0)
      // → opacity ~0 con visible=true), lo OCULTAMOS: así en modo esfera no se
      // entinta el personaje oculto. Las piezas del disassemble tienen opacity 1.
      const mat0 = Array.isArray(o.material) ? o.material[0] : o.material
      const effOpacity = mat0 && typeof mat0.opacity === 'number' ? mat0.opacity : 1
      const isBody = !isOutline && effOpacity > 0.1 && (allMeshes || o.isSkinnedMesh || isPiece)
      if (isBody) {
        let nm = normalMats.current.get(o)
        if (!nm) { nm = new THREE.MeshNormalMaterial(); normalMats.current.set(o, nm) }
        restore.push([o, 'mat', o.material])
        o.material = nm
      } else {
        restore.push([o, 'vis', o.visible])
        o.visible = false
      }
    })

    const prevTarget = gl.getRenderTarget()
    const prevAutoClear = gl.autoClear
    _clearColor.current.copy(gl.getClearColor(new THREE.Color()))
    const prevAlpha = gl.getClearAlpha()
    gl.setRenderTarget(fbo)
    gl.autoClear = true
    gl.setClearColor(0x000000, 0)
    gl.clear(true, true, true)
    try { gl.render(root, camera) } catch { }
    gl.setRenderTarget(prevTarget)
    gl.setClearColor(_clearColor.current, prevAlpha)
    gl.autoClear = prevAutoClear

    // Restaurar materiales/visibilidad.
    for (let i = 0; i < restore.length; i += 1) {
      const [o, type, val] = restore[i]
      if (type === 'mat') o.material = val
      else o.visible = val
    }

    target.current = fbo.texture
  }, 0.5)

  return null
}
