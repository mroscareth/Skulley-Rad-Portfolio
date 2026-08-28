import React, { useMemo, useRef, useEffect } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// SilhouetteShadow — sombra de contacto con la FORMA REAL del personaje.
// En vez de un disco abstracto, una cámara ortográfica CENITAL renderiza solo
// al personaje como mancha blanca a un render target; un plano en el piso
// (alineado 1:1 con el encuadre de esa cámara) lo pinta como sombra negra
// difuminada. Se deforma con la pose/animación (brazos, piernas, cabeza).
//
// Alineación (clave): cámara cenital con up=(0,0,-1) → eje X de pantalla ↔ +X
// mundo, eje Y de pantalla ↔ -Z mundo. Un planeGeometry rotado -90° en X mapea
// su U ↔ +X y V ↔ -Z → coincide exacto, sin espejeos. Ambos centrados en el
// jugador y del mismo tamaño FOOT → el footprint cae donde debe.
//
// Reusa el patrón de CharacterNormalPass (swap material → render a RT →
// restaurar). Un render extra del personaje por frame; RT chico + blur barato.
export default function SilhouetteShadow({
  playerRef,
  enabled = true,
  // Lado del cuadro de proyección en el piso (debe contener brazos/piernas).
  size = 3.2,
  opacity = 0.5,
  // Resolución del RT (chica = más suave y barata).
  resolution = 160,
  // Radio del anti-alias en téxeles (sombra dura: solo para suavizar el filo).
  blur = 1.0,
  // Altura de la cámara cenital sobre el piso (debe superar la estatura).
  height = 6,
  // Y del piso donde se apoya la sombra.
  groundY = 0,
  // Pre-compila whiteMat/planeMat durante el preloader (ver efecto abajo).
  prewarm = false,
}) {
  const { gl, camera, scene } = useThree()

  const fbo = useMemo(() => new THREE.WebGLRenderTarget(resolution, resolution, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    type: THREE.UnsignedByteType,
    depthBuffer: true,
  }), [resolution])
  useEffect(() => () => { try { fbo.dispose() } catch { } }, [fbo])

  // Cámara cenital ortográfica que cubre un cuadrado FOOT centrado en el jugador.
  const shadowCam = useMemo(() => {
    const cam = new THREE.OrthographicCamera(-size / 2, size / 2, size / 2, -size / 2, 0.1, height + 4)
    cam.up.set(0, 0, -1)
    return cam
  }, [size, height])

  // Material blanco plano para la silueta (skinning automático en SkinnedMesh).
  const whiteMat = useMemo(() => new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), [])
  useEffect(() => () => { try { whiteMat.dispose() } catch { } }, [whiteMat])

  // Material del plano de sombra: blur 5x5 del coverage (canal alpha) → negro.
  const planeMat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -2,
    uniforms: {
      uTex: { value: fbo.texture },
      uOpacity: { value: opacity },
      uTexel: { value: new THREE.Vector2(1 / resolution, 1 / resolution) },
      uSpread: { value: blur },
    },
    vertexShader: `
      varying vec2 vUv;
      void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
    `,
    fragmentShader: `
      precision highp float;
      uniform sampler2D uTex;
      uniform float uOpacity;
      uniform vec2 uTexel;
      uniform float uSpread;
      varying vec2 vUv;
      void main(){
        // Cell shading: sombra DURA. El box 3x3 (spread chico) es solo
        // anti-alias para que el filo no quede pixeleado; el smoothstep angosto
        // lo recorta a un borde nitido tipo toon (plano, sin gradiente).
        float acc = 0.0;
        for (int y = -1; y <= 1; y++) {
          for (int x = -1; x <= 1; x++) {
            vec2 off = vec2(float(x), float(y)) * uTexel * uSpread;
            acc += texture2D(uTex, vUv + off).a;
          }
        }
        acc /= 9.0;
        float a = smoothstep(0.45, 0.55, acc); // banda angosta = filo duro
        gl_FragColor = vec4(0.0, 0.0, 0.0, a * uOpacity);
      }
    `,
  }), [fbo, resolution, opacity, blur])
  useEffect(() => () => { try { planeMat.dispose() } catch { } }, [planeMat])
  useEffect(() => { planeMat.uniforms.uOpacity.value = opacity }, [planeMat, opacity])

  const planeRef = useRef()
  const _pos = useRef(new THREE.Vector3())
  const _clearColor = useRef(new THREE.Color())
  const last = useRef({ baseY: 0, init: false })
  const frameParity = useRef(0)

  // PREWARM: compila whiteMat (silueta skinned) y planeMat DURANTE el preloader.
  // Esta sombra está gateada por `enabled` (orb mode OFF) → durante la caída no
  // corre, así que sin prewarm sus shaders compilan en el frame del aterrizaje
  // (parte del freeze al tocar el piso). Frameloop pausado en el preloader → rAF
  // + gl.compile. whiteMat (MeshBasic) y planeMat (ShaderMaterial sin luces) son
  // independientes de iluminación → mismo programa que el render real.
  const didPrewarmRef = useRef(false)
  useEffect(() => {
    if (!prewarm || didPrewarmRef.current) return
    let raf = 0
    let tries = 0
    const run = () => {
      const root = playerRef?.current
      let hasBody = false
      if (root) root.traverse((o) => { if (o.isSkinnedMesh) hasBody = true })
      if (!hasBody) {
        if (tries++ < 180) raf = requestAnimationFrame(run)
        return
      }
      didPrewarmRef.current = true
      const restore = []
      root.traverse((o) => {
        if (!o.isSkinnedMesh) return
        restore.push([o, o.material])
        o.material = whiteMat
      })
      try { gl.compile(root, shadowCam, scene) } catch { }
      for (let i = 0; i < restore.length; i += 1) restore[i][0].material = restore[i][1]
      // planeMat: el plano de sombra (su propio mesh). gl.compile sobre él basta.
      try { if (planeRef.current) gl.compile(planeRef.current, camera, scene) } catch { }
    }
    raf = requestAnimationFrame(run)
    return () => { try { cancelAnimationFrame(raf) } catch { } }
  }, [prewarm, playerRef, gl, camera, scene, shadowCam, whiteMat])

  useFrame(() => {
    const root = playerRef?.current
    const plane = planeRef.current
    if (!plane) return
    if (!enabled || !root || !root.visible) { plane.visible = false; return }

    root.getWorldPosition(_pos.current)
    const px = _pos.current.x, py = _pos.current.y, pz = _pos.current.z
    if (!last.current.init) { last.current.baseY = py; last.current.init = true }

    // Lift: cuando el personaje flota/salta, la sombra se encoge y se atenúa.
    const lift = THREE.MathUtils.clamp((py - last.current.baseY) / 2.2, 0, 1)
    const liftScale = 1 - lift * 0.5
    const liftAlpha = 1 - lift * 0.7

    // Coloca el plano en el piso bajo el jugador.
    plane.position.set(px, groundY + 0.02, pz)
    plane.scale.set(liftScale, liftScale, 1)
    plane.visible = true
    planeMat.uniforms.uOpacity.value = opacity * liftAlpha

    // Cámara cenital centrada en el jugador, mirando al piso.
    shadowCam.position.set(px, groundY + height, pz)
    shadowCam.up.set(0, 0, -1)
    shadowCam.lookAt(px, groundY, pz)
    shadowCam.updateMatrixWorld()
    shadowCam.updateProjectionMatrix()

    // El RTT (render extra del personaje + doble traverse + swap de materiales
    // + re-upload del boneTexture) corre a 30Hz: la SILUETA con 33ms de retraso
    // es indistinguible (mancha suave de 160-256px), y el plano sí se reposiciona
    // a 60fps arriba — la sombra nunca se despega de los pies.
    frameParity.current = (frameParity.current + 1) % 2
    if (frameParity.current !== 0) return

    // Swap a material blanco en el cuerpo; oculta outline/orb/voxel/etc.
    const restore = []
    root.traverse((o) => {
      if (!o) return
      const renderable = o.isMesh || o.isSkinnedMesh || o.isInstancedMesh
      if (!renderable) return
      const isOutline = o.name && o.name.endsWith('_outline')
      let isPiece = false
      for (let p = o, hops = 0; p && hops < 6; p = p.parent, hops += 1) {
        if (p.userData?.__disassembleOwned === true) { isPiece = true; break }
      }
      const mat0 = Array.isArray(o.material) ? o.material[0] : o.material
      const effOpacity = mat0 && typeof mat0.opacity === 'number' ? mat0.opacity : 1
      const isBody = !isOutline && effOpacity > 0.1 && (o.isSkinnedMesh || isPiece)
      if (isBody) {
        restore.push([o, 'mat', o.material])
        o.material = whiteMat
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
    try { gl.render(root, shadowCam) } catch { }
    gl.setRenderTarget(prevTarget)
    gl.setClearColor(_clearColor.current, prevAlpha)
    gl.autoClear = prevAutoClear

    for (let i = 0; i < restore.length; i += 1) {
      const [o, type, val] = restore[i]
      if (type === 'mat') o.material = val
      else o.visible = val
    }
  }, 0.5)

  return (
    <mesh ref={planeRef} rotation={[-Math.PI / 2, 0, 0]} renderOrder={-18} frustumCulled={false}>
      <planeGeometry args={[size, size]} />
      <primitive object={planeMat} attach="material" />
    </mesh>
  )
}
