import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF, useAnimations } from '@react-three/drei'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'
import { extendGLTFLoaderKTX2, detectKTX2Support } from '../lib/ktx2Setup.js'
import { applyCharacterColorsToScene, CHARACTER_COLOR_EVENT } from '../lib/characterColors.js'
import { applyToonBanding } from '../lib/toonBanding.js'
import CameraAim from './fx/CharacterCursorAim.jsx'
import { playSfx } from '../lib/sfx.js'

// Skulley de fondo en el preloader: encuadre de CABEZA Y BUSTO, en idle.
//
// Por qué acá y no en el canvas de HomeScene: ese canvas trae orbes, física y
// timers de gameplay. Ya nos costó una vez (los orbes derivaban solos durante
// el preloader y el corrupto se consumía). Este es un Canvas PROPIO y aislado
// — solo el modelo, su idle y dos luces. Nada que se pueda gastar.
//
// Efecto secundario deseado: el GLB ya está descargado y parseado justo en
// este momento (el preloader existe para esperarlo), así que mostrarlo no
// cuesta carga extra y de paso compila sus shaders antes del ENTER.

// Contraluz toon: frío, de filo duro y solo del lado izquierdo-arriba, opuesto
// a la key cálida. Recorta la silueta contra el fondo casi negro y contra la
// rampa de la máscara, que es justo donde el personaje se disolvía.
const RIM_LIGHT = {
  rimStrength: 1.8,
  rimColor: [0.22, 0.78, 1.0],
  rimThreshold: 0.56,
  rimWidth: 0.06,
  rimDirection: [-0.75, 0.4, -0.55],
}

function IdleCamera() {
  const { camera } = useThree()
  useEffect(() => {
    // Encuadre CERRADO de cabeza y busto. El zoom del retrato chico (160) es
    // para un canvas de ~190px; acá el canvas mide varios cientos, así que
    // hay que escalarlo en proporción o sale de cuerpo entero.
    // La Y sube al pecho para que el corte quede bajo los hombros.
    // Calibrado midiendo sobre la propia pantalla: con la cabeza en world
    // y≈1.05 y el pecho en y≈0.3, para dejar la cabeza al ~35% desde arriba y
    // el busto llenando hacia abajo hace falta una ventana de ~1.5 unidades
    // de alto → zoom = altoDelCanvas / 1.5, centrada en y≈0.85.
    // La X corre al personaje hacia la IZQUIERDA en pantalla (la cámara se
    // mueve a la derecha, así que el modelo entra más en cuadro). Se hace
    // acá y no con un transform en el contenedor: mover el div despegaría el
    // canvas del borde derecho y el personaje quedaría cortado con una arista
    // dura. Moviendo la cámara, el encuadre se recorre pero el canvas sigue
    // sangrando por el borde.
    // X negativa: el contenedor se ensanchó (46% → 72%) para que la rampa de
    // la máscara caiga sobre lienzo vacío. Al ensancharlo, su centro se corrió
    // a la izquierda y el personaje se iba con él; esto lo regresa a su sitio.
    camera.position.set(-0.11, 0.85, 10)
    camera.rotation.set(0, 0, 0)
    camera.zoom = 700
    camera.near = -5000
    camera.far = 5000
    camera.updateProjectionMatrix()
  }, [camera])
  return null
}

// ── Easter egg: picarle los ojos ─────────────────────────────────────────
// Lenguaje de videojuego: cada piquete hace destellar el ojo en rojo (el flash
// de daño de un enemigo); al tercero se le salta y cae fuera de cuadro, y al
// rato reaparece parpadeando, como un enemigo que respawnea. Los clics no
// llegan al canvas (la capa de texto va encima y el contenedor es
// pointer-events-none), así que el golpe se resuelve a mano: el globo ocular
// proyectado a pantalla contra el cursor, escuchando en window y sin tocar
// nada de la UI.
const POKES_TO_DROP = 3
// Dos destellos duros (on/off/on/off), sin fundido: así se lee el golpe.
const HIT_FLASH_MS = 260
const HIT_FLASH_COLOR = new THREE.Color('#ff1f3d')
const REGROW_MS = 2600
const RESPAWN_BLINK_MS = 720
const RESPAWN_BLINK_STEP_MS = 90
const EYE_GRAVITY = 4.5
const isUiTarget = (t) => !!t?.closest?.('button, a, input, textarea, select, [role="button"]')

// Rojo puro mientras dura el destello: el color base se apaga y manda el
// emisivo (si solo se sumara el emisivo, sobre el amarillo del ojo saldría
// naranja). Al apagarse se restaura lo que había, incluido lo que puso el
// customizer de colores.
function setHitFlash(eye, on) {
  const mat = eye.ball?.material
  if (!mat?.emissive) return
  if (on && !eye.flashSaved) {
    eye.flashSaved = { color: mat.color.clone(), emissive: mat.emissive.clone(), intensity: mat.emissiveIntensity }
    mat.color.setRGB(0, 0, 0)
    mat.emissive.copy(HIT_FLASH_COLOR)
    mat.emissiveIntensity = 1
  } else if (!on && eye.flashSaved) {
    mat.color.copy(eye.flashSaved.color)
    mat.emissive.copy(eye.flashSaved.emissive)
    mat.emissiveIntensity = eye.flashSaved.intensity
    eye.flashSaved = null
  }
}

function useEyePoke(model) {
  const { gl, camera, scene } = useThree()
  const eyesRef = useRef([])
  const fallingRef = useRef([])
  const pointerRef = useRef({ x: 0, y: 0, dirty: false, lastCheck: 0, over: false })
  const tmp = useMemo(() => ({ s: new THREE.Sphere(), v: new THREE.Vector3(), c: new THREE.Vector3() }), [])

  // Cada ojo = globo (material "Eyes") + pupila, emparentados por nombre
  // (Skull043 / Skull043_1).
  useEffect(() => {
    const byKey = new Map()
    model.traverse((o) => {
      if (!o.isSkinnedMesh) return
      const mat = Array.isArray(o.material) ? o.material[0] : o.material
      const name = mat?.name || ''
      const isBall = /^eyes$/i.test(name)
      if (!isBall && !/pupil/i.test(name)) return
      const key = o.name.replace(/_\d+$/, '')
      if (!byKey.has(key)) byKey.set(key, { meshes: [], ball: null, pokes: 0, state: 'in', regrowAt: 0, flashT: -1, flashSaved: null, blinkT: -1 })
      const eye = byKey.get(key)
      eye.meshes.push(o)
      if (isBall) eye.ball = o
    })
    eyesRef.current = [...byKey.values()].filter((e) => e.ball)
  }, [model])

  const eyeCenter = useCallback((eye, out) => {
    eye.ball.computeBoundingSphere()
    tmp.s.copy(eye.ball.boundingSphere).applyMatrix4(eye.ball.matrixWorld)
    out.copy(tmp.s.center)
    return tmp.s.radius
  }, [tmp])

  const hitEye = useCallback((x, y) => {
    const rect = gl.domElement.getBoundingClientRect()
    if (!rect.width) return null
    for (const eye of eyesRef.current) {
      if (eye.state !== 'in') continue
      const radius = eyeCenter(eye, tmp.c)
      tmp.v.copy(tmp.c).project(camera)
      const sx = rect.left + (tmp.v.x + 1) * 0.5 * rect.width
      const sy = rect.top + (1 - tmp.v.y) * 0.5 * rect.height
      // Ortográfica de R3F: 1 unidad de mundo = `zoom` px CSS.
      if (Math.hypot(x - sx, y - sy) <= radius * camera.zoom * 0.9) return eye
    }
    return null
  }, [gl, camera, eyeCenter, tmp])

  // Helper de tuning (mismo patrón que __kickDbg): estado y posición en
  // pantalla de cada ojo.
  useEffect(() => {
    try {
      window.__eyePoke = () => {
        const rect = gl.domElement.getBoundingClientRect()
        return eyesRef.current.map((e) => {
          const r = eyeCenter(e, tmp.c)
          tmp.v.copy(tmp.c).project(camera)
          return {
            state: e.state, pokes: e.pokes, flashing: !!e.flashSaved, visible: e.ball.visible,
            x: Math.round(rect.left + (tmp.v.x + 1) * 0.5 * rect.width),
            y: Math.round(rect.top + (1 - tmp.v.y) * 0.5 * rect.height),
            r: Math.round(r * camera.zoom),
          }
        })
      }
    } catch { }
    return () => { try { delete window.__eyePoke } catch { } }
  }, [gl, camera, eyeCenter, tmp])

  // El ojo se "hornea" en su pose actual (skinning aplicado) como una malla
  // rígida en coordenadas de mundo, y esa es la que cae. La original se oculta.
  const dropEye = useCallback((eye) => {
    eye.state = 'out'
    eye.blinkT = -1
    const center = new THREE.Vector3()
    eyeCenter(eye, center)
    const other = eyesRef.current.find((e) => e !== eye)
    const side = other ? Math.sign(center.x - eyeCenter(other, tmp.c)) || 1 : 1
    const group = new THREE.Group()
    const v = new THREE.Vector3()
    for (const m of eye.meshes) {
      const pos = m.geometry.attributes.position
      const arr = new Float32Array(pos.count * 3)
      for (let i = 0; i < pos.count; i += 1) {
        m.getVertexPosition(i, v)
        v.applyMatrix4(m.matrixWorld).sub(center)
        arr[i * 3] = v.x; arr[i * 3 + 1] = v.y; arr[i * 3 + 2] = v.z
      }
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(arr, 3))
      if (m.geometry.attributes.uv) geo.setAttribute('uv', m.geometry.attributes.uv)
      if (m.geometry.index) geo.setIndex(m.geometry.index)
      geo.computeVertexNormals()
      const rigid = new THREE.Mesh(geo, m.material)
      rigid.frustumCulled = false
      group.add(rigid)
      m.visible = false
    }
    group.position.copy(center)
    scene.add(group)
    fallingRef.current.push({
      group,
      vel: new THREE.Vector3(side * (0.3 + Math.random() * 0.2), 0.9 + Math.random() * 0.3, 0.6),
      spin: new THREE.Vector3((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 12),
    })
    eye.regrowAt = performance.now() + REGROW_MS
    try { playSfx('punch', { volume: 0.7 }) } catch { }
  }, [scene, eyeCenter, tmp])

  useEffect(() => {
    const onDown = (ev) => {
      if (ev.button !== 0 || isUiTarget(ev.target)) return
      const eye = hitEye(ev.clientX, ev.clientY)
      if (!eye) return
      eye.pokes += 1
      if (eye.pokes >= POKES_TO_DROP) { setHitFlash(eye, false); eye.flashT = -1; dropEye(eye); return }
      eye.flashT = 0
      try { playSfx('click', { volume: 0.8 }) } catch { }
    }
    const onMove = (ev) => {
      const p = pointerRef.current
      p.x = ev.clientX; p.y = ev.clientY; p.dirty = true
    }
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('pointermove', onMove)
      if (pointerRef.current.over) document.body.style.cursor = ''
      for (const f of fallingRef.current) {
        scene.remove(f.group)
        f.group.traverse((o) => { if (o.isMesh) o.geometry.dispose() })
      }
      fallingRef.current = []
    }
  }, [hitEye, dropEye, scene])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    const now = performance.now()

    // Cursor de mano sobre el ojo: la única pista de que se puede picar.
    const p = pointerRef.current
    if (p.dirty && now - p.lastCheck > 90) {
      p.dirty = false
      p.lastCheck = now
      const over = !!hitEye(p.x, p.y) && !isUiTarget(document.elementFromPoint(p.x, p.y))
      if (over !== p.over) {
        p.over = over
        document.body.style.cursor = over ? 'pointer' : ''
      }
    }

    for (const eye of eyesRef.current) {
      if (eye.state === 'out' && now >= eye.regrowAt) {
        eye.state = 'in'
        eye.pokes = 0
        eye.blinkT = 0
        try { playSfx('sparkleBom', { volume: 0.45 }) } catch { }
      }
      // Reaparición: parpadea on/off como enemigo que respawnea y se queda.
      if (eye.blinkT >= 0 && eye.state === 'in') {
        eye.blinkT += dt * 1000
        const done = eye.blinkT >= RESPAWN_BLINK_MS
        const visible = done || Math.floor(eye.blinkT / RESPAWN_BLINK_STEP_MS) % 2 === 0
        eye.meshes.forEach((m) => { m.visible = visible })
        if (done) eye.blinkT = -1
      }
      if (eye.flashT >= 0) {
        eye.flashT += dt * 1000
        const done = eye.flashT >= HIT_FLASH_MS
        setHitFlash(eye, !done && Math.floor(eye.flashT / (HIT_FLASH_MS / 4)) % 2 === 0)
        if (done) eye.flashT = -1
      }
    }

    const falling = fallingRef.current
    for (let i = falling.length - 1; i >= 0; i -= 1) {
      const f = falling[i]
      f.vel.y -= EYE_GRAVITY * dt
      f.group.position.addScaledVector(f.vel, dt)
      f.group.rotation.x += f.spin.x * dt
      f.group.rotation.y += f.spin.y * dt
      f.group.rotation.z += f.spin.z * dt
      // Bajo el borde inferior del encuadre (la ventana arranca en y≈0.06).
      if (f.group.position.y < -0.6) {
        scene.remove(f.group)
        f.group.traverse((o) => { if (o.isMesh) o.geometry.dispose() })
        falling.splice(i, 1)
      }
    }
  })
}

// Render manual de respaldo.
//
// R3F deja de llamar a `gl.render()` automáticamente en cuanto ALGÚN
// useFrame del canvas se registra con priority > 0 — el root entra en "manual
// render mode" y espera que alguien dibuje. `CameraAim` usa priority 1 (corre
// después del mixer de animaciones), así que al montarlo este canvas dejaba
// de pintar por completo: personaje invisible, cero excepciones, consola
// limpia. En CharacterPortrait no pasa porque su <EffectComposer> ya dibuja
// por su cuenta a priority 1; acá no hay composer a propósito, para no
// arrastrar @react-three/postprocessing al chunk del arranque.
//
// Esto es ese mismo relevo, en tres líneas.
function ManualRenderKeepAlive() {
  useFrame((state) => { state.gl.render(state.scene, state.camera) }, 1)
  return null
}

function Model() {
  const { gl } = useThree()
  const groupRef = useRef(null)
  useEffect(() => { detectKTX2Support(gl) }, [gl])

  const { scene, animations } = useGLTF(
    `${import.meta.env.BASE_URL}character.glb`,
    true,
    true,
    extendGLTFLoaderKTX2,
  )

  // Clon con esqueleto propio para no pelearse con el Player ni el retrato.
  const cloned = useMemo(() => {
    const clone = SkeletonUtils.clone(scene)
    // El GLB cacheado puede traer los outline meshes que inyecta Player.jsx.
    // Acá estorban (son BackSide negro) → fuera.
    const toRemove = []
    clone.traverse((obj) => {
      if (!obj) return
      const mat = Array.isArray(obj.material) ? obj.material[0] : obj.material
      const esOutline = (obj.name && obj.name.endsWith('_outline'))
        || (mat && mat.side === THREE.BackSide && mat.type === 'MeshBasicMaterial')
      if (esOutline) toRemove.push(obj)
    })
    toRemove.forEach((obj) => {
      try {
        obj.parent?.remove(obj)
        obj.geometry?.dispose?.()
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m?.dispose?.())
        else obj.material?.dispose?.()
      } catch { }
    })

    // Materiales propios + banding toon: DESIGN.md §7.8 regla 5 — cualquier
    // render nuevo del personaje conserva el cel-shading.
    clone.traverse((obj) => {
      if (!obj.isMesh && !obj.isSkinnedMesh) return
      const src = Array.isArray(obj.material) ? obj.material : [obj.material]
      const out = src.map((m) => {
        if (!m?.clone) return m
        const mm = m.clone()
        try {
          mm.envMapIntensity = 0.5
          // Pupilas planas (roughness 0 del GLB = espejo). Mismo trato que en
          // Player y el retrato.
          if (/pupil/i.test(mm.name || '')) {
            // El nombre se conserva: con él se reconocen los ojos (EyePoke).
            return new THREE.MeshBasicMaterial({ color: 0x000000, toneMapped: false, name: mm.name })
          }
          // Rim solo en cuerpo y pelo: el borde de los ojos queda dentro de
          // la cuenca (el contraluz les dibujaba un aro) y la bola de energía
          // se lavaba entera.
          const withRim = /^(head|hair)$/i.test(mm.name || '')
          applyToonBanding(mm, { steps: 2, minBand: 0.04, bandIndirect: true, ...(withRim ? RIM_LIGHT : {}) })
        } catch { }
        return mm
      })
      obj.material = Array.isArray(obj.material) ? out : out[0]
    })
    return clone
  }, [scene])

  const { actions } = useAnimations(animations, groupRef)
  useEffect(() => {
    if (!actions) return
    const names = Object.keys(actions)
    // Mismo clip explícito que usa el retrato; si no está, heurística.
    const idleName = names.includes('root|root|Iddle')
      ? 'root|root|Iddle'
      : (names.find((n) => n.toLowerCase().includes('idle')) || names[0])
    const idle = idleName && actions[idleName]
    if (idle) idle.reset().fadeIn(0.4).play()
    return () => { try { idle?.fadeOut(0.2) } catch { } }
  }, [actions])

  useEyePoke(cloned)

  // Colores del customizer (mismo slot global que el resto del sitio).
  useEffect(() => {
    if (!cloned) return
    const apply = (detail) => { try { applyCharacterColorsToScene(cloned, detail) } catch { } }
    apply()
    const onChange = (e) => apply(e?.detail)
    window.addEventListener(CHARACTER_COLOR_EVENT, onChange)
    return () => window.removeEventListener(CHARACTER_COLOR_EVENT, onChange)
  }, [cloned])

  // Deriva lentísima: no es una pose congelada, es un plano vivo.
  useFrame(({ clock }) => {
    const g = groupRef.current
    if (!g) return
    const t = clock.getElapsedTime()
    g.rotation.y = Math.sin(t * 0.12) * 0.13
    g.position.y = -1.45 + Math.sin(t * 0.35) * 0.012
  })

  // Seguimiento de cursor SOLO en desktop: con puntero grueso no hay cursor
  // que seguir y el head-tracking se sentiría errático al hacer scroll.
  const finePointer = useMemo(() => {
    try { return window.matchMedia('(pointer: fine)').matches } catch { return false }
  }, [])

  return (
    <group ref={groupRef} position={[0, -1.45, 0]}>
      <primitive object={cloned} scale={1.65} />
      {/* SEGUIMIENTO DE CURSOR: DESACTIVADO. No borrar sin leer esto.
          Montar <CameraAim modelRef={groupRef} /> acá deja al personaje fuera
          de cuadro: medido con Box3, el modelo pasa a ocupar y ∈ [-1.46, 0.20]
          mientras la ventana de esta cámara (y 0.85, zoom 700) cubre
          y ∈ [0.06, 1.64] — o sea que queda por debajo del encuadre. No lanza
          ninguna excepción, así que no es un error de referencia; algo en el
          componente reposiciona/reescala el subárbol en este contexto de
          ortográfica muy cerrada. En el retrato funciona bien.
          Pendiente de investigar con calma antes de reactivar. */}
      {finePointer && (
        <>
          <CameraAim modelRef={groupRef} />
          {/* Obligatorio junto a CameraAim — ver la nota del componente. */}
          <ManualRenderKeepAlive />
        </>
      )}
      {/* Key cálida lateral + relleno frío tenue: el corte toon necesita una
          dirección dominante, si no el banding se aplana. */}
      <directionalLight intensity={1.6} position={[3, 4, 3]} color="#fff4e6" />
      <directionalLight intensity={0.35} position={[-4, 1, -2]} color="#9fd0ff" />
      <ambientLight intensity={0.5} />
    </group>
  )
}

export default function PreloaderCharacter({ className = '' }) {
  return (
    <div className={`absolute inset-0 pointer-events-none ${className}`} aria-hidden>
      <Canvas
        orthographic
        dpr={[1, 1.25]}
        gl={{ antialias: false, powerPreference: 'high-performance', alpha: true, stencil: false }}
        events={undefined}
        style={{ width: '100%', height: '100%' }}
      >
        <IdleCamera />
        <React.Suspense fallback={null}>
          <Model />
        </React.Suspense>
      </Canvas>
    </div>
  )
}
