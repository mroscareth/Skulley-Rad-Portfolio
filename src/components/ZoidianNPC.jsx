import React, { useMemo, useRef, useState, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF, useAnimations } from '@react-three/drei'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'
import * as THREE from 'three'
import { extendGLTFLoaderKTX2 } from '../lib/ktx2Setup.js'
import { applyToonBanding } from '../lib/toonBanding.js'
import SpeechBubble3D from './SpeechBubble3D.jsx'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import { playSfx } from '../lib/sfx.js'

// Zoidian — NPC dueño del juego de las esferas. Vive donde antes flotaba solo
// el "!" amarillo (entre los portales de Store y Contact); ahora el signo
// flota ARRIBA de él. Click → diálogo (ZoidianDialog en App) → instrucciones.
//
// El GLB viene de Sketchfab con transforms raros en el root, así que el modelo
// se AUTO-CENTRA por bounding box: pies en y=0, centrado en X/Z. Nada de
// offsets mágicos que se rompan si se re-exporta el asset.

const ZOIDIAN_URL = `${import.meta.env.BASE_URL}3dmodels/zoidian.glb`
// Hueso de la cabeza del rig (Sketchfab). Lo usan el head-tracking y el
// encuadre del retrato del diálogo.
export const ZOIDIAN_HEAD_BONE = 'head_05'
const ZOIDIAN_NECK_BONE = 'neck_04'

// Modelo puro + idle en loop. Reusable: escena principal y mini-canvas del
// retrato del diálogo (mismo patrón que SlimeMesh / SlimeSlugDOM).
// `lookAtRef`: Object3D a seguir con cabeza/cuello (Skulley). Es PROCEDURAL,
// encima del idle: cada frame el mixer escribe la pose y después le sumamos
// yaw/pitch clampeados a neck+head. Cuando el target sale de rango (lejos o
// muy de espaldas) el peso se desvanece y regresa solito a su pose.
// `pushRef`: timeline compartida del EMPUJÓN procedural ({ t: -1 } = idle;
// el NPC la arranca poniendo t=0 y este componente la avanza y posa los
// huesos). No hay clip en el GLB — la animación es 100% aditiva sobre el
// idle, igual que el head-tracking: windup (brazos atrás + lean atrás) →
// thrust (brazos disparados al frente + lean adelante) → recover.
export function ZoidianModel({ targetHeight = 1.7, lookAtRef = null, outlineColor = '#000000', pushRef = null, onMeasured }) {
  const groupRef = useRef()
  const { scene: srcScene, animations } = useGLTF(ZOIDIAN_URL, true, true, extendGLTFLoaderKTX2)

  const cloned = useMemo(() => {
    const c = SkeletonUtils.clone(srcScene)
    // Contorno de hull invertido — MISMA receta que el outline de Skulley
    // (Player.jsx): MeshBasicMaterial negro BackSide extruido a lo largo de la
    // normal DESPUÉS del skinning, así el trazo se deforma con el idle y el
    // head-tracking. El grosor va en unidades del objeto (pre-escala del fit).
    const outlineMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      side: THREE.BackSide,
      transparent: false,
      depthWrite: true,
      depthTest: true,
      fog: false,
      toneMapped: false,
    })
    outlineMat.onBeforeCompile = (shader) => {
      shader.uniforms.outlineThickness = { value: c.userData.__outlineThickness || 0.012 }
      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `#include <common>
        uniform float outlineThickness;`
      )
      shader.vertexShader = shader.vertexShader.replace(
        '#include <project_vertex>',
        `#ifdef USE_SKINNING
        transformed += normalize(objectNormal) * outlineThickness;
        #else
        transformed += normalize(normal) * outlineThickness;
        #endif
        #include <project_vertex>`
      )
    }
    const skinnedMeshes = []
    c.traverse((o) => {
      if (!(o.isMesh || o.isSkinnedMesh)) return
      // Material propio por instancia (escena + retrato conviven) + el toon
      // banding del personaje para que se sienta del mismo universo.
      const mats = Array.isArray(o.material) ? o.material : [o.material]
      const out = mats.map((m) => {
        const mm = m.clone()
        try { applyToonBanding(mm, { steps: 2, minBand: 0.04, bandIndirect: true }) } catch { }
        return mm
      })
      o.material = Array.isArray(o.material) ? out : out[0]
      // La pose animada se sale del bbox de bind → sin esto parpadea al culear.
      o.frustumCulled = false
      // El raycast va contra el hitbox del wrapper, no contra 40k tris.
      o.raycast = () => { }
      if (o.isSkinnedMesh) skinnedMeshes.push(o)
    })
    // Hermanos _outline con el MISMO esqueleto (el sufijo hace que
    // SilhouetteShadow los ignore en el RTT de la sombra).
    for (const o of skinnedMeshes) {
      const hull = new THREE.SkinnedMesh(o.geometry, outlineMat)
      hull.name = `${o.name || 'zoid'}_outline`
      hull.bindMode = o.bindMode
      hull.bind(o.skeleton, o.bindMatrix)
      hull.position.copy(o.position)
      hull.quaternion.copy(o.quaternion)
      hull.scale.copy(o.scale)
      hull.frustumCulled = false
      hull.raycast = () => { }
      o.parent.add(hull)
    }
    c.userData.__outlineMat = outlineMat
    return c
  }, [srcScene])

  // Auto-fit: escala a `targetHeight` y apoya los pies en y=0.
  const fit = useMemo(() => {
    cloned.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(cloned)
    const size = new THREE.Vector3()
    const center = new THREE.Vector3()
    box.getSize(size)
    box.getCenter(center)
    const rawH = Math.max(size.y, 0.001)
    const scale = targetHeight / rawH
    // Grosor del contorno en unidades del objeto: ~0.02 world → constante
    // visual sin importar el targetHeight. Se lee en el onBeforeCompile del
    // outline (compila en el primer render, después de este memo).
    cloned.userData.__outlineThickness = 0.02 / scale
    return {
      scale,
      offset: [-center.x * scale, -box.min.y * scale, -center.z * scale],
      height: targetHeight,
    }
  }, [cloned, targetHeight])

  useEffect(() => { try { onMeasured?.(fit) } catch { } }, [fit, onMeasured])

  // Feedback de hover del NPC: el outline cambia de color (negro → blanco).
  // Es un uniform del material compartido de los hulls — cero recompilación.
  useEffect(() => {
    try { cloned.userData.__outlineMat?.color?.set(outlineColor) } catch { }
  }, [cloned, outlineColor])

  const { actions } = useAnimations(animations, groupRef)
  useEffect(() => {
    // Siempre en idle — es su único estado.
    const idle = actions?.Idle || Object.values(actions || {})[0]
    if (!idle) return undefined
    idle.reset().setLoop(THREE.LoopRepeat, Infinity).fadeIn(0.2).play()
    return () => { try { idle.stop() } catch { } }
  }, [actions])

  // ── Head-tracking hacia lookAtRef ──
  const bonesRef = useRef(null)
  useEffect(() => {
    const head = cloned.getObjectByName(ZOIDIAN_HEAD_BONE)
    const neck = cloned.getObjectByName(ZOIDIAN_NECK_BONE)
    // OJO con los nombres: GLTFLoader los SANITIZA y borra los puntos
    // (THREE.PropertyBinding.sanitizeNodeName), así que el `upper_arm.L_09`
    // del rig llega como `upper_armL_09`. Buscar con el nombre original
    // devolvía undefined y los brazos NUNCA se movían — el empujón se leía
    // como cabezazo porque solo quedaba el lean del pecho (chest_03 y head_05
    // no tienen punto, por eso esos sí funcionaban). Probamos ambas formas.
    const findBone = (...names) => {
      for (const n of names) {
        const b = cloned.getObjectByName(n)
        if (b) return b
      }
      return null
    }
    bonesRef.current = head || neck ? {
      head,
      neck,
      chest: findBone('chest_03'),
      shL: findBone('shoulderL_08', 'shoulder.L_08'),
      shR: findBone('shoulderR_024', 'shoulder.R_024'),
      uaL: findBone('upper_armL_09', 'upper_arm.L_09'),
      uaR: findBone('upper_armR_025', 'upper_arm.R_025'),
      laL: findBone('lower_armL_010', 'lower_arm.L_010'),
      laR: findBone('lower_armR_026', 'lower_arm.R_026'),
      hL: findBone('handL_011', 'hand.L_011'),
      hR: findBone('handR_027', 'hand.R_027'),
    } : null
  }, [cloned])
  const trackRef = useRef({ yaw: 0, pitch: 0, w: 0 })
  const _headPos = useRef(null)
  const _target = useRef(null)
  const _dir = useRef(null)
  const _q = useRef(null)
  const _qOff = useRef(null)
  const _e = useRef(null)
  // Scratch del empujón (aimBone) — ver la pose del push más abajo.
  const _fwd = useRef(null)
  const _dirLocal = useRef(null)
  const _axis = useRef(null)
  const _qw = useRef(null)
  const _boneAxis = useRef(null)
  const _up = useRef(null)
  useFrame((state, delta) => {
    const bones = bonesRef.current
    const target = lookAtRef?.current
    if (!bones) return
    if (!_headPos.current) {
      _headPos.current = new THREE.Vector3()
      _target.current = new THREE.Vector3()
      _dir.current = new THREE.Vector3()
      _q.current = new THREE.Quaternion()
      _qOff.current = new THREE.Quaternion()
      _e.current = new THREE.Euler()
    }
    const st = trackRef.current
    let wantYaw = 0
    let wantPitch = 0
    let wantW = 0
    const headBone = bones.head || bones.neck
    if (target && groupRef.current) {
      headBone.getWorldPosition(_headPos.current)
      target.getWorldPosition(_target.current)
      _target.current.y += 1.4 // a la cara de Skulley, no a los pies
      _dir.current.copy(_target.current).sub(_headPos.current)
      const dist = _dir.current.length()
      if (dist > 0.6 && dist < 14) {
        _dir.current.normalize()
        // A espacio local del modelo (incluye la rotación del NPC en escena).
        groupRef.current.getWorldQuaternion(_q.current).invert()
        _dir.current.applyQuaternion(_q.current)
        // El GLB mira hacia +Z en su propio espacio.
        const yaw = Math.atan2(_dir.current.x, _dir.current.z)
        const pitch = Math.asin(THREE.MathUtils.clamp(_dir.current.y, -1, 1))
        if (Math.abs(yaw) < 1.25) {
          wantYaw = THREE.MathUtils.clamp(yaw, -0.8, 0.8)
          wantPitch = THREE.MathUtils.clamp(pitch, -0.55, 0.45)
          wantW = 1
        }
      }
    }
    // ── Pose del EMPUJÓN (aditiva, corre aunque el head-track esté en 0) ──
    // Curva: windup (brazos atrás, A negativa) → thrust con overshoot (A>1)
    // → recover suave. Los ejes/amplitudes admiten override en
    // window.__argusPushCfg para afinar en vivo sin rebuild.
    const push = pushRef?.current
    if (push && push.t >= 0 && bones) {
      const cfgEarly = (typeof window !== 'undefined' && window.__argusPushCfg) || null
      // cfg.hold congela la pose en el pico — para afinar ejes/amplitudes en
      // vivo sin recompilar (la animación dura 0.7s, imposible de inspeccionar).
      if (!cfgEarly?.hold) push.t += Math.min(delta, 0.05)
      // SIN windup hacia atrás (se veía como que primero echaba los brazos
      // atrás): thrust seco al frente → hold corto → regreso suave. Solo
      // adelante, nunca A negativa.
      const T = 0.14   // thrust
      const HOLD = 0.1 // brazos extendidos
      const DUR = 0.62
      const PEAK = 1.15
      let A = 0
      if (cfgEarly?.hold) {
        A = PEAK
      } else if (push.t < T) {
        const r = push.t / T
        A = PEAK * (1 - Math.pow(1 - r, 3)) // ease-out cúbico: sale disparado
      } else if (push.t < T + HOLD) {
        A = PEAK
      } else if (push.t < DUR) {
        const r = (push.t - T - HOLD) / (DUR - T - HOLD)
        A = PEAK * (1 - r * r * (3 - 2 * r))
      } else {
        push.t = -1
      }
      if (A !== 0 && groupRef.current) {
        const cfg = cfgEarly
        const armAmp = cfg?.armAmp ?? 1.0
        const foreAmp = cfg?.foreAmp ?? 0.75
        const leanAmp = cfg?.leanAmp ?? 0.12
        // Nada de adivinar ejes locales (el primer intento rotaba en el eje
        // equivocado y la pose leía como CABEZAZO): APUNTAMOS cada hueso del
        // brazo hacia el frente del NPC. Todos estos huesos crecen en +Y local
        // (sus hijos están en [0, +y, 0]), así que basta rotar ese +Y hacia la
        // dirección de empuje — correcto sea cual sea el roll del rig.
        if (!_fwd.current) { _fwd.current = new THREE.Vector3(); _dirLocal.current = new THREE.Vector3(); _axis.current = new THREE.Vector3(); _qw.current = new THREE.Quaternion() }
        // El GLB mira a +Z en su espacio (ver head-tracking) → frente en mundo.
        groupRef.current.getWorldQuaternion(_qw.current)
        _fwd.current.set(0, 0, 1).applyQuaternion(_qw.current)
        const BONE_AXIS = _boneAxis.current || (_boneAxis.current = new THREE.Vector3(0, 1, 0))
        // `dirWorld` por defecto = frente del NPC. Las MUÑECAS apuntan hacia
        // ARRIBA: con el brazo extendido al frente eso deja la palma de cara
        // al empujón (pose clásica de "alto ahí"), no la mano colgando.
        const aimBone = (bone, weight, dirWorld) => {
          if (!bone || !weight) return
          bone.getWorldQuaternion(_qw.current)
          _qw.current.invert()
          _dirLocal.current.copy(dirWorld || _fwd.current).applyQuaternion(_qw.current).normalize()
          _axis.current.crossVectors(BONE_AXIS, _dirLocal.current)
          const len = _axis.current.length()
          if (len < 1e-4) return
          _axis.current.multiplyScalar(1 / len)
          // Ángulo completo hasta apuntar al frente; A lo modula (negativo en
          // el windup = brazos atrás, >1 en el thrust = overshoot).
          const fullAngle = Math.acos(THREE.MathUtils.clamp(BONE_AXIS.dot(_dirLocal.current), -1, 1))
          _qOff.current.setFromAxisAngle(_axis.current, A * weight * fullAngle)
          bone.quaternion.multiply(_qOff.current)
        }
        aimBone(bones.uaL, armAmp)
        aimBone(bones.uaR, armAmp)
        aimBone(bones.laL, foreAmp)
        aimBone(bones.laR, foreAmp)
        // Muñecas quebradas hacia arriba → palmas al frente.
        const wristAmp = cfg?.wristAmp ?? 0.85
        const UP = _up.current || (_up.current = new THREE.Vector3(0, 1, 0))
        aimBone(bones.hL, wristAmp, UP)
        aimBone(bones.hR, wristAmp, UP)
        // Lean discreto del pecho: acompaña, no protagoniza.
        aimBone(bones.chest, leanAmp)
      }
    }

    // Suavizado exponencial independiente del framerate.
    const k = 1 - Math.exp(-6 * Math.max(delta, 0.001))
    st.yaw += (wantYaw - st.yaw) * k
    st.pitch += (wantPitch - st.pitch) * k
    st.w += (wantW - st.w) * k
    if (st.w < 0.01) return
    // Reparto cuello/cabeza (35/65). Ejes del rig: Y = a lo largo del hueso
    // (girar izq/der), Z = lateral (asentir). Se MULTIPLICA sobre la pose que
    // el mixer ya escribió este frame (useAnimations corre antes en el orden
    // de suscripción) → aditivo, no pisa el idle.
    const applyTo = (bone, factor) => {
      if (!bone) return
      _e.current.set(0, st.yaw * st.w * factor, -st.pitch * st.w * factor, 'YZX')
      _qOff.current.setFromEuler(_e.current)
      bone.quaternion.multiply(_qOff.current)
    }
    applyTo(bones.neck, 0.35)
    applyTo(bones.head, 0.65)
  })

  return (
    <group ref={groupRef}>
      <group position={fit.offset} scale={fit.scale}>
        <primitive object={cloned} />
      </group>
    </group>
  )
}

export default function ZoidianNPC({
  position = [0, 0, 12.9],
  rotationY = Math.PI,
  targetHeight = 1.7,
  onClick,
  visible = true,
  // Object3D a seguir con la cabeza (Skulley) — ver ZoidianModel.
  lookAtRef = null,
  // Ref externo al group raíz — lo usa SilhouetteShadow (HomeScene) para
  // renderle su sombra de contacto igual que al personaje.
  groupRef = null,
}) {
  const wrapRef = useRef()
  const [hovered, setHovered] = useState(false)
  const { gl } = useThree()

  // ── Burlas cuando algo despieza a Skulley ──
  // Dos caminos con línea propia:
  // · 'character-disassembled-by-bolt' — el rayo de la esfera corrupta (lo
  //   emite Player en el shatter exacto, mismo evento de la skin Molten Lava).
  // · 'bolt-strike' — la activación del easter egg (Player lo emite al caer
  //   el rayo; el despiece llega ~230ms después).
  // Argus espera un beat (que el flash y las piezas registren) y remata.
  const { t } = useLanguage()
  const mockAnchorRef = useRef(null)
  const [mock, setMock] = useState({ on: false, typed: '', full: '' })
  const mockTimersRef = useRef([])
  useEffect(() => {
    const clearTimers = () => {
      for (const id of mockTimersRef.current) { clearTimeout(id); clearInterval(id) }
      mockTimersRef.current = []
    }
    const sayMock = (key) => {
      clearTimers()
      // La key puede resolver a un string o a un POOL de frases (mockEgg):
      // con pool, cada despiece saca una burla distinta al azar.
      const resolved = t(key)
      const full = Array.isArray(resolved)
        ? resolved[Math.floor(Math.random() * resolved.length)]
        : resolved
      if (!full) return
      mockTimersRef.current.push(setTimeout(() => {
        let i = 0
        setMock({ on: true, typed: '', full })
        const typeId = setInterval(() => {
          i += 1
          setMock({ on: true, typed: full.slice(0, i), full })
          if (i >= full.length) clearInterval(typeId)
        }, 60)
        mockTimersRef.current.push(typeId)
        mockTimersRef.current.push(setTimeout(() => {
          setMock({ on: false, typed: '', full: '' })
        }, 3600))
      }, 700))
    }
    const onBoltShatter = () => sayMock('zoidian.mock')
    const onEggShatter = () => sayMock('zoidian.mockEgg')
    const onPushShatter = () => sayMock('zoidian.mockPush')
    window.addEventListener('character-disassembled-by-bolt', onBoltShatter)
    window.addEventListener('bolt-strike', onEggShatter)
    window.addEventListener('character-disassembled-by-argus', onPushShatter)
    return () => {
      window.removeEventListener('character-disassembled-by-bolt', onBoltShatter)
      window.removeEventListener('bolt-strike', onEggShatter)
      window.removeEventListener('character-disassembled-by-argus', onPushShatter)
      clearTimers()
    }
  }, [t])

  // ── Collider sólido + empujón por contacto ──
  // El collider lo consume Player (clamp del movimiento, ver simPos). El
  // trigger de contacto queda apenas AFUERA del radio sólido: solo dispara
  // cuando Skulley está empujando contra Argus, no al pasar cerca.
  const COLLIDER_R = 1.2
  const PUSH_TRIGGER_R = 1.26
  const REARM_R = 2.3
  useEffect(() => {
    try { window.__argusCollider = { x: position[0], z: position[2], r: COLLIDER_R } } catch { }
    return () => { try { delete window.__argusCollider } catch { } }
  }, [position[0], position[2]])
  // Timeline del empujón: t=-1 idle; el modelo la avanza y posa los huesos.
  // `hit` marca el dispatch del despiece en el frame del thrust (t≈0.24).
  const pushTimelineRef = useRef({ t: -1, hit: false, armed: true, lastAt: -Infinity })
  const _playerPos = useRef(new THREE.Vector3())

  useFrame((state) => {
    const g = wrapRef.current
    if (!g) return
    if (groupRef && groupRef.current !== g) groupRef.current = g

    const push = pushTimelineRef.current
    // Momento del impacto: el thrust del brazo conecta a t≈0.24 → recién ahí
    // se despieza a Skulley (Player escucha 'argus-push-strike').
    // El impacto va al final del thrust (T=0.14), no a mitad del recorrido.
    if (push.t >= 0 && !push.hit && push.t >= 0.13) {
      push.hit = true
      try { playSfx('sparkleBom', { volume: 0.9 }) } catch { }
      try { window.dispatchEvent(new CustomEvent('argus-push-strike', { detail: { x: position[0], z: position[2] } })) } catch { }
    }
    // Trigger por contacto, con histéresis: tras un empujón hay que ALEJARSE
    // (REARM_R) antes de poder comerse otro — sin esto, el reensamble ocurre
    // pegado a Argus y el loop de empujones no termina nunca.
    if (push.t < 0 && lookAtRef?.current) {
      lookAtRef.current.getWorldPosition(_playerPos.current)
      const dx = _playerPos.current.x - position[0]
      const dz = _playerPos.current.z - position[2]
      const dist = Math.hypot(dx, dz)
      const now = state.clock.elapsedTime
      if (!push.armed) {
        if (dist > REARM_R) push.armed = true
      } else if (dist < PUSH_TRIGGER_R && now - push.lastAt > 3) {
        push.t = 0
        push.hit = false
        push.armed = false
        push.lastAt = now
      }
    }
  })

  if (!visible) return null

  const handleClick = (e) => {
    e.stopPropagation()
    try { onClick?.() } catch { }
  }
  const handlePointerOver = (e) => {
    e.stopPropagation()
    setHovered(true)
    try { gl.domElement.style.cursor = 'pointer' } catch { }
  }
  const handlePointerOut = () => {
    setHovered(false)
    try { gl.domElement.style.cursor = '' } catch { }
  }

  return (
    <>
      <group ref={wrapRef} position={position} rotation={[0, rotationY, 0]}>
        {/* Hitbox invisible generoso (cilindro) — raycast barato y click fácil */}
        <mesh
          position={[0, targetHeight * 0.5, 0]}
          onClick={handleClick}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
        >
          <cylinderGeometry args={[targetHeight * 0.55, targetHeight * 0.55, targetHeight * 1.1, 10]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
        {/* Hover = outline blanco (nada de escalar al NPC, se veía raro) */}
        <ZoidianModel targetHeight={targetHeight} lookAtRef={lookAtRef} outlineColor={hovered ? '#ffffff' : '#000000'} pushRef={pushTimelineRef} />
        {/* Ancla de la viñeta a la altura del pecho: con el offset lateral el
            globo queda AL LADO y despegado, como el de Skulley. */}
        <object3D ref={mockAnchorRef} position={[0, targetHeight * 0.55, 0]} />
      </group>
      {/* La viñeta va FUERA del group rotado π: SpeechBubble3D arma su base
          mirando a cámara asumiendo padre sin rotación — adentro salía el
          texto volteado 180° y el globo con las normales culled. */}
      <SpeechBubble3D
        anchorRef={mockAnchorRef}
        visible={mock.on}
        displayText={mock.typed}
        layoutText={mock.full}
        offset={[2.5, 0.1, 0]}
      />
    </>
  )
}

// SIN useGLTF.preload a nivel módulo: este chunk se evalúa durante el boot y
// la descarga se colaría al DefaultLoadingManager — la barra del preloader
// esperaría también estos 3.3MB antes de habilitar el ENTER. El Suspense del
// mount (post-bootAllDone, detrás del preloader) dispara la carga en el
// momento correcto.
