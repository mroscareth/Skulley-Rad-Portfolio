import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF, OrbitControls, Grid, TransformControls } from '@react-three/drei'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'
import * as THREE from 'three'
import { extendGLTFLoaderKTX2 } from '../../lib/ktx2Setup.js'
import { applyToonBanding } from '../../lib/toonBanding.js'
import { LASER_RAW } from '../../lib/laserPose.js'

// PoseStudio — herramienta de AUTOR, aislada del sitio.
//
// Se abre con `?pose=1` y renderiza SOLO esto: su propio canvas, su propio
// clon del personaje y nada de la escena de HOME. Ni Player ni HomeScene se
// enteran de que existe, así que no hay forma de que rompa el juego.
//
// Para qué: posar a mano en vez de calibrar animaciones a ciegas. Arrastras
// las esferas, armas la pose, la guardas como keyframe y exportas. El JSON
// trae el quaternion LOCAL de cada hueso, así que la animación reproduce
// EXACTAMENTE lo que viste — sin adivinar ejes, signos ni convenciones del rig
// (que fue justo lo que costó sangre con la patada).

const CHAR_URL = `${import.meta.env.BASE_URL}character.glb`
const BONE_AXIS = new THREE.Vector3(0, 1, 0)

// La esfera vive sobre `anchor`; al arrastrarla, `drive` apunta hacia ella.
// El orden importa: de la raíz a las puntas (mover el muslo arrastra rodilla
// y pie, así que el padre se resuelve primero).
const HANDLES = [
  // PIVOTE DE CADERA: no rota un hueso, TRASLADA la raíz — sube, baja y
  // desplaza el cuerpo entero. Es el control maestro de la pose (una patada
  // hunde el cuerpo sobre la pierna de apoyo, y eso no se puede expresar solo
  // rotando huesos). Para GIRAR la cadera está el gizmo "cadera".
  { id: 'cadera', anchor: 'rootx', drive: 'rootx', color: '#f5ff00', r: 0.06, mode: 'translate' },
  { id: 'pecho', anchor: 'neckx', drive: 'spine_03x', color: '#c084fc', r: 0.055 },
  { id: 'cabeza', anchor: 'headx', drive: 'neckx', color: '#e879f9', r: 0.05 },
  { id: 'codo.R', anchor: 'forearm_stretchr', drive: 'arm_stretchr', color: '#fb923c', r: 0.042 },
  { id: 'mano.R', anchor: 'handr', drive: 'forearm_stretchr', color: '#f97316', r: 0.042 },
  { id: 'codo.L', anchor: 'forearm_stretchl', drive: 'arm_stretchl', color: '#fbbf24', r: 0.042 },
  { id: 'mano.L', anchor: 'handl', drive: 'forearm_stretchl', color: '#f59e0b', r: 0.042 },
  { id: 'rodilla.L', anchor: 'leg_stretchl', drive: 'thigh_stretchl', color: '#4ade80', r: 0.05 },
  { id: 'pie.L', anchor: 'footl', drive: 'leg_stretchl', color: '#22c55e', r: 0.045 },
  { id: 'punta.L', anchor: 'toes_01l', drive: 'footl', color: '#15803d', r: 0.034 },
  { id: 'rodilla.R', anchor: 'leg_stretchr', drive: 'thigh_stretchr', color: '#60a5fa', r: 0.05 },
  { id: 'pie.R', anchor: 'footr', drive: 'leg_stretchr', color: '#3b82f6', r: 0.045 },
  { id: 'punta.R', anchor: 'toes_01r', drive: 'footr', color: '#1d4ed8', r: 0.034 },
]

// Dedos por articulación: cuánto dobla cada una con la mano cerrada (grados).
// El rig tiene tres dedos más el pulgar; `*_base` son el metacarpo y no doblan.
const FINGER_CURL = [
  { suffix: '1', deg: 62 }, { suffix: '2', deg: 84 }, { suffix: '3', deg: 58 },
]
const THUMB_CURL = [
  { suffix: '1', deg: 16 }, { suffix: '2', deg: 34 }, { suffix: '3', deg: 42 },
]
const FINGERS = ['index', 'middle', 'pinky']
const fingerBones = (s) => [
  ...FINGERS.flatMap((f) => [`${f}1_base${s}`, `${f}1${s}`, `${f}2${s}`, `${f}3${s}`]),
  `thumb1${s}`, `thumb2${s}`, `thumb3${s}`,
]
const twistBones = (s) => [`arm_twist${s}`, `arm_twist_2${s}`, `forearm_twist${s}`, `forearm_twist_2${s}`]

const EXPORT_BONES = [
  'rootx', 'spine_01x', 'spine_02x', 'spine_03x', 'neckx', 'headx',
  'shoulderl', 'arm_stretchl', 'forearm_stretchl', 'handl',
  'shoulderr', 'arm_stretchr', 'forearm_stretchr', 'handr',
  'thigh_stretchl', 'leg_stretchl', 'footl', 'toes_01l',
  'thigh_stretchr', 'leg_stretchr', 'footr', 'toes_01r',
  ...twistBones('l'), ...twistBones('r'),
  ...fingerBones('l'), ...fingerBones('r'),
]

// Los huesos de giro no los mueve el rig solo: en Blender los manejan
// constraints que no viajan en el GLB, así que aquí se reconstruyen con la misma
// regla que traen los clips (medida contra Walking e Iddle):
//   forearm_twist    = giro de la mano, leído proyectando su eje X sobre el plano
//                      perpendicular al antebrazo
//   forearm_twist_2  = la mitad del camino entre el reposo y forearm_twist
//   arm_twist        = lo contrario del giro del brazo respecto a su reposo
//   arm_twist_2      = la mitad de arm_twist
// Sin esto, girar la mano retuerce la muñeca: la piel del antebrazo depende de
// estos huesos y se queda donde estaba.
const syncTwists = (() => {
  const x = new THREE.Vector3()
  const y = new THREE.Vector3()
  const y0 = new THREE.Vector3()
  const swing = new THREE.Quaternion()
  const rest = new THREE.Quaternion()
  const twist = new THREE.Quaternion()
  return (bones, restQ) => {
    for (const s of ['l', 'r']) {
      const hand = bones[`hand${s}`]
      const twistA = bones[`forearm_twist${s}`]
      const twistB = bones[`forearm_twist_2${s}`]
      if (hand && twistA && twistB) {
        x.set(1, 0, 0).applyQuaternion(hand.quaternion)
        const angle = Math.atan2(-x.z, x.x)
        const q0 = restQ.get(twistA)
        const angle0 = q0 ? 2 * Math.atan2(q0.y, q0.w) : 0
        twistA.quaternion.setFromAxisAngle(BONE_AXIS, angle)
        twistB.quaternion.setFromAxisAngle(BONE_AXIS, angle0 + (angle - angle0) / 2)
      }
      const arm = bones[`arm_stretch${s}`]
      const armA = bones[`arm_twist${s}`]
      const armB = bones[`arm_twist_2${s}`]
      const armRest = arm && restQ.get(arm)
      if (armRest && armA && armB) {
        y0.copy(BONE_AXIS).applyQuaternion(armRest)
        y.copy(BONE_AXIS).applyQuaternion(arm.quaternion)
        swing.setFromUnitVectors(y0, y)
        rest.copy(swing).multiply(armRest).invert()
        twist.copy(rest).multiply(arm.quaternion)
        // q y -q son el mismo giro; sin esto un brazo sin girar da 360° y la
        // mitad en arm_twist_2 son 180°: el bíceps se estrangula.
        const angle = 2 * Math.atan2(twist.y * Math.sign(twist.w || 1), Math.abs(twist.w))
        armA.quaternion.setFromAxisAngle(BONE_AXIS, -angle)
        armB.quaternion.setFromAxisAngle(BONE_AXIS, -angle / 2)
      }
    }
  }
})()

function Rig({ apiRef, onReady, setOrbitEnabled, rotateTarget }) {
  const { camera, gl } = useThree()
  const { scene: src, animations } = useGLTF(CHAR_URL, true, true, extendGLTFLoaderKTX2)
  const groupRef = useRef()
  const meshRefs = useRef({})
  const dragRef = useRef(null)
  const [dragging, setDragging] = useState(null)

  const model = useMemo(() => {
    const c = SkeletonUtils.clone(src)
    c.traverse((o) => {
      if (!(o.isMesh || o.isSkinnedMesh)) return
      const mats = Array.isArray(o.material) ? o.material : [o.material]
      const out = mats.map((m) => {
        const mm = m.clone()
        try { applyToonBanding(mm, { steps: 2, minBand: 0.04, bandIndirect: true }) } catch { }
        return mm
      })
      o.material = Array.isArray(o.material) ? out : out[0]
      o.frustumCulled = false
      o.raycast = () => { } // el raycast va a las esferas, no a la malla
    })
    return c
  }, [src])

  const bones = useMemo(() => {
    const map = {}
    model.traverse((o) => { if (o.isBone) map[o.name] = o })
    return map
  }, [model])

  // Pose de reposo, para el botón RESET.
  //
  // OJO con las dependencias: `onReady` llega como función inline desde el
  // padre, así que cambia en CADA render. Con él en las deps este efecto se
  // re-ejecutaba constantemente y volvía a capturar la "pose de reposo" con
  // la pose que ya tenías puesta — por eso RESET no hacía nada. La captura
  // tiene que ocurrir UNA sola vez por modelo.
  const restRef = useRef(null)
  const restPosRef = useRef(null)
  const curlRef = useRef({})
  const onReadyRef = useRef(onReady)
  onReadyRef.current = onReady
  useEffect(() => {
    const rest = new Map()
    Object.values(bones).forEach((b) => rest.set(b, b.quaternion.clone()))
    restRef.current = rest
    // La POSICIÓN de la raíz también es parte de la pose (el pivote de cadera).
    restPosRef.current = bones.rootx ? bones.rootx.position.clone() : null
    // Eje de cierre de cada dedo, en el espacio local del hueso y medido en
    // reposo: cada dedo tiene su propio roll, así que un eje fijo los abriría
    // en abanico. El de cada falange es el que lleva su punta hacia la palma.
    model.updateMatrixWorld(true)
    const curl = {}
    const handQ = new THREE.Quaternion()
    const boneQ = new THREE.Quaternion()
    const dir = new THREE.Vector3()
    for (const s of ['l', 'r']) {
      const hand = bones[`hand${s}`]
      if (!hand) continue
      hand.getWorldQuaternion(handQ)
      const palm = new THREE.Vector3(0, 0, -1).applyQuaternion(handQ)
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(handQ)
      // El pulgar cierra cruzando la palma, no hacia ella.
      const thumbTo = palm.clone().multiplyScalar(0.55).addScaledVector(up, 0.85).normalize()
      const add = (name, deg, to) => {
        const b = bones[name]
        if (!b) return
        b.getWorldQuaternion(boneQ)
        dir.set(0, 1, 0).applyQuaternion(boneQ)
        const axis = new THREE.Vector3().crossVectors(dir, to)
        if (axis.lengthSq() < 1e-6) return
        axis.normalize().applyQuaternion(boneQ.clone().invert())
        curl[name] = { axis, rad: THREE.MathUtils.degToRad(deg) }
      }
      for (const f of FINGERS) for (const j of FINGER_CURL) add(`${f}${j.suffix}${s}`, j.deg, palm)
      for (const j of THUMB_CURL) add(`thumb${j.suffix}${s}`, j.deg, thumbTo)
    }
    curlRef.current = curl
    onReadyRef.current?.(Object.keys(bones).length, (animations || []).map((a) => a.name))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bones])

  const tmp = useMemo(() => ({
    ray: new THREE.Raycaster(), ndc: new THREE.Vector2(), hit: new THREE.Vector3(),
    camDir: new THREE.Vector3(), anchorPos: new THREE.Vector3(), drivePos: new THREE.Vector3(),
    parentQ: new THREE.Quaternion(), dirLocal: new THREE.Vector3(), cur: new THREE.Vector3(),
    qDelta: new THREE.Quaternion(), qTarget: new THREE.Quaternion(),
  }), [])

  // API para los botones de la UI.
  useEffect(() => {
    apiRef.current = {
      capture: () => {
        const out = {}
        for (const name of EXPORT_BONES) {
          const b = bones[name]
          if (!b) continue
          const q = b.quaternion
          out[name] = [q.x, q.y, q.z, q.w].map((v) => Math.round(v * 10000) / 10000)
        }
        // Desplazamiento de la cadera respecto al reposo (el pivote).
        if (bones.rootx && restPosRef.current) {
          const p0 = restPosRef.current
          const p1 = bones.rootx.position
          out.__rootOffset = [p1.x - p0.x, p1.y - p0.y, p1.z - p0.z].map((v) => Math.round(v * 10000) / 10000)
        }
        return out
      },
      reset: () => {
        // Soltar cualquier arrastre en curso: si no, el useFrame vuelve a
        // aplicar el destino viejo y parece que el reset no funcionó.
        dragRef.current = null
        if (!restRef.current) return false
        restRef.current.forEach((q, b) => { b.quaternion.copy(q) })
        if (bones.rootx && restPosRef.current) bones.rootx.position.copy(restPosRef.current)
        model.updateMatrixWorld(true)
        return true
      },
      // 0 = dedos en reposo, 1 = puño, negativo = dedos abiertos hacia atrás.
      // Siempre parte del reposo, así que mover el control no acumula.
      setHandClosed: (side, amount) => {
        if (!restRef.current) return false
        const q = new THREE.Quaternion()
        Object.entries(curlRef.current).forEach(([name, c]) => {
          if (!name.endsWith(side)) return
          const b = bones[name]
          const q0 = b && restRef.current.get(b)
          if (!q0) return
          q.setFromAxisAngle(c.axis, c.rad * amount)
          b.quaternion.copy(q0).multiply(q)
        })
        model.updateMatrixWorld(true)
        return true
      },
      applyPose: (pose) => {
        if (!pose) return false
        dragRef.current = null
        let n = 0
        Object.entries(pose).forEach(([name, q]) => {
          if (name === '__rootOffset') return
          const b = bones[name]
          if (b && Array.isArray(q) && q.length === 4) { b.quaternion.set(q[0], q[1], q[2], q[3]); n += 1 }
        })
        if (bones.rootx && restPosRef.current) {
          const off = pose.__rootOffset
          bones.rootx.position.copy(restPosRef.current)
          if (Array.isArray(off) && off.length === 3) bones.rootx.position.add(new THREE.Vector3(off[0], off[1], off[2]))
        }
        model.updateMatrixWorld(true)
        return n > 0
      },
    }
    // Para ajustar poses desde la consola del navegador.
    try {
      window.__poseStudio = {
        ...apiRef.current, bones, model, camera, THREE,
        syncTwists: () => syncTwists(bones, restRef.current),
      }
    } catch { }
    return () => { try { delete window.__poseStudio } catch { } }
  }, [apiRef, bones, model, camera])

  useEffect(() => {
    const el = gl.domElement
    const onMove = (e) => {
      const d = dragRef.current
      if (!d) return
      const rect = el.getBoundingClientRect()
      tmp.ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1)
      tmp.ray.setFromCamera(tmp.ndc, camera)
      if (tmp.ray.ray.intersectPlane(d.plane, tmp.hit)) d.target.copy(tmp.hit)
    }
    const onUp = () => {
      if (!dragRef.current) return
      dragRef.current = null
      setDragging(null)
      setOrbitEnabled(true)
    }
    el.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      el.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [camera, gl, tmp, setOrbitEnabled])

  useFrame(() => {
    const d = dragRef.current
    if (d && d.mode === 'translate' && d.bone && d.bone.parent) {
      // Traslación pura: el destino world se convierte al espacio del padre.
      tmp.hit.copy(d.target)
      d.bone.parent.worldToLocal(tmp.hit)
      d.bone.position.copy(tmp.hit)
      model.updateMatrixWorld(true)
    } else if (d && d.bone && d.bone.parent) {
      const bone = d.bone
      bone.parent.getWorldQuaternion(tmp.parentQ)
      tmp.parentQ.invert()
      bone.getWorldPosition(tmp.drivePos)
      tmp.dirLocal.copy(d.target).sub(tmp.drivePos)
      if (tmp.dirLocal.lengthSq() > 1e-8) {
        tmp.dirLocal.applyQuaternion(tmp.parentQ).normalize()
        // Rotación MÍNIMA desde el eje actual: preserva el roll del hueso.
        // Construir el quaternion desde cero dejaba el pie torcido de canto.
        tmp.cur.copy(BONE_AXIS).applyQuaternion(bone.quaternion).normalize()
        tmp.qDelta.setFromUnitVectors(tmp.cur, tmp.dirLocal)
        tmp.qTarget.copy(tmp.qDelta).multiply(bone.quaternion)
        bone.quaternion.copy(tmp.qTarget)
        model.updateMatrixWorld(true)
      }
    }
    if (restRef.current) syncTwists(bones, restRef.current)
    // Las esferas siguen a sus huesos (menos la que arrastras).
    for (const h of HANDLES) {
      const mesh = meshRefs.current[h.id]
      const anchor = bones[h.anchor]
      if (!mesh || !anchor) continue
      if (d && d.id === h.id) continue
      anchor.getWorldPosition(tmp.anchorPos)
      mesh.position.copy(tmp.anchorPos)
    }
  })

  const startDrag = (h) => (e) => {
    e.stopPropagation()
    const bone = bones[h.drive]
    const anchor = bones[h.anchor]
    if (!bone || !anchor) return
    anchor.getWorldPosition(tmp.anchorPos)
    camera.getWorldDirection(tmp.camDir)
    dragRef.current = {
      id: h.id,
      bone,
      mode: h.mode || 'rotate',
      plane: new THREE.Plane().setFromNormalAndCoplanarPoint(tmp.camDir.clone().negate(), tmp.anchorPos.clone()),
      target: tmp.anchorPos.clone(),
    }
    setDragging(h.id)
    setOrbitEnabled(false) // no girar la cámara mientras posas
  }

  const rotBone = rotateTarget ? bones[rotateTarget] : null

  return (
    <group ref={groupRef}>
      <primitive object={model} />
      {/* Gizmo de ROTACIÓN libre. Los handles de arrastre solo APUNTAN el
          hueso (dirección), que no basta para orientar una mano o un pie:
          hace falta poder girarlos sobre su propio eje. TransformControls
          escribe directo en bone.quaternion, y como aquí no corre ningún
          mixer, la rotación se queda. */}
      {rotBone && (
        <TransformControls
          object={rotBone}
          mode="rotate"
          space="local"
          size={0.5}
          onMouseDown={() => setOrbitEnabled(false)}
          onMouseUp={() => setOrbitEnabled(true)}
        />
      )}
      {HANDLES.map((h) => (
        <mesh
          key={h.id}
          ref={(el) => { if (el) meshRefs.current[h.id] = el }}
          onPointerDown={startDrag(h)}
          onPointerOver={() => { try { gl.domElement.style.cursor = 'grab' } catch { } }}
          onPointerOut={() => { try { gl.domElement.style.cursor = '' } catch { } }}
          renderOrder={9999}
        >
          <sphereGeometry args={[h.r, 16, 12]} />
          <meshBasicMaterial color={dragging === h.id ? '#ffffff' : h.color} depthTest={false} depthWrite={false} transparent opacity={0.95} />
        </mesh>
      ))}
    </group>
  )
}

// Dos poses clave: de dónde sale el gesto y dónde termina. La animación
// interpola entre ellas (con su curva de timing), así que con estas dos basta
// para definir una patada completa.
const SLOTS = ['inicial', 'final', 'cerca', 'lejos', 'retroceso']
// Huesos que se pueden ROTAR con gizmo (orientación libre, no solo dirección).
const ROTATABLE = [
  { id: 'mano.L', bone: 'handl' }, { id: 'mano.R', bone: 'handr' },
  { id: 'pie.L', bone: 'footl' }, { id: 'pie.R', bone: 'footr' },
  { id: 'cabeza', bone: 'headx' }, { id: 'pecho', bone: 'spine_03x' },
  { id: 'cadera', bone: 'rootx' },
]

export default function PoseStudio() {
  const apiRef = useRef(null)
  const [orbitEnabled, setOrbitEnabled] = useState(true)
  const [poses, setPoses] = useState(() => ({ ...LASER_RAW }))
  const [hands, setHands] = useState({ l: 0, r: 0 })
  const [reach, setReach] = useState(0.5)
  const [rotateTarget, setRotateTarget] = useState(null)
  const [status, setStatus] = useState('')
  const [info, setInfo] = useState('')

  const say = (m) => { setStatus(m); setTimeout(() => setStatus(''), 2400) }

  const saveSlot = (slot) => {
    const p = apiRef.current?.capture()
    if (!p) return
    setPoses((prev) => ({ ...prev, [slot]: p }))
    say(`Guardada: ${slot}`)
  }
  const loadSlot = (slot) => {
    const p = poses[slot]
    if (!p) return say(`"${slot}" está vacía`)
    const ok = apiRef.current?.applyPose(p)
    say(ok ? `Cargada: ${slot}` : 'No se pudo cargar (rig no listo)')
  }
  const closeHand = (side, value) => {
    setHands((prev) => ({ ...prev, [side]: value }))
    apiRef.current?.setHandClosed(side, value)
  }
  // Muestra lo que hará el juego: el brazo entre la pose cercana y la lejana.
  const previewReach = (value) => {
    setReach(value)
    const { cerca, lejos } = poses
    if (!cerca || !lejos) return
    const qa = new THREE.Quaternion()
    const qb = new THREE.Quaternion()
    const mix = {}
    Object.keys(cerca).forEach((name) => {
      const a = cerca[name]
      const b = lejos[name]
      if (!b) return
      if (name === '__rootOffset') {
        mix[name] = a.map((v, i) => v + (b[i] - v) * value)
        return
      }
      qa.set(a[0], a[1], a[2], a[3])
      qb.set(b[0], b[1], b[2], b[3])
      qa.slerp(qb, value)
      mix[name] = [qa.x, qa.y, qa.z, qa.w]
    })
    apiRef.current?.applyPose(mix)
  }
  const exportAll = () => {
    const json = JSON.stringify(poses, null, 2)
    try { window.__poses = poses } catch { }
    // eslint-disable-next-line no-console
    console.log('[PoseStudio] poses:\n' + json)
    try {
      navigator.clipboard.writeText(json)
      say('JSON copiado al portapapeles ✓')
    } catch { say('En consola: window.__poses') }
  }

  const btn = {
    padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.18)',
    background: 'rgba(255,255,255,0.06)', color: '#fff', cursor: 'pointer',
    fontSize: 13, fontWeight: 600,
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0b0b16' }}>
      <Canvas
        camera={{ position: [0, 1.15, 2.7], fov: 42, near: 0.05, far: 100 }}
        gl={{ antialias: true, alpha: false }}
      >
        <color attach="background" args={['#0b0b16']} />
        <ambientLight intensity={0.6} />
        <directionalLight intensity={1.6} position={[2, 3.5, 2.5]} />
        <directionalLight intensity={0.5} position={[-2.2, 1.5, -2]} />
        <Grid args={[20, 20]} cellSize={0.25} cellColor="#26264a" sectionSize={1} sectionColor="#3a3a6e" infiniteGrid fadeDistance={22} position={[0, 0, 0]} />
        <React.Suspense fallback={null}>
          <Rig apiRef={apiRef} setOrbitEnabled={setOrbitEnabled} rotateTarget={rotateTarget} onReady={(n, clips) => setInfo(`${n} huesos · clips: ${clips.join(', ') || '—'}`)} />
        </React.Suspense>
        <OrbitControls enabled={orbitEnabled} target={[0, 0.85, 0]} makeDefault minDistance={0.5} maxDistance={12} />
      </Canvas>

      <div style={{
        position: 'absolute', top: 16, left: 16, display: 'flex', flexDirection: 'column', gap: 12,
        background: 'rgba(10,10,22,0.82)', border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 14, padding: 16, color: '#fff', fontFamily: 'Outfit, system-ui, sans-serif',
        maxWidth: 340, backdropFilter: 'blur(10px)',
      }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Pose Studio</div>
          <div style={{ opacity: 0.55, fontSize: 12, marginTop: 2 }}>{info || 'cargando personaje…'}</div>
        </div>
        <div style={{ fontSize: 12.5, lineHeight: 1.5, opacity: 0.75 }}>
          Arrastra las esferas para posar (verde = pierna izq · azul = pierna der ·
          naranja/ámbar = brazos · morado = torso · <b>amarillo = pivote de
          cadera</b>, que sube/baja y desplaza todo el cuerpo). Para orientar manos, pies,
          cabeza o cadera usa <b>Rotar</b> y aparece un gizmo de anillos. El giro del
          antebrazo sigue a la mano solo. Gira la vista arrastrando el fondo.
        </div>
        <div>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.14em', opacity: 0.5, marginBottom: 6 }}>Rotar (gizmo)</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {ROTATABLE.map((r) => (
              <button
                key={r.id}
                type="button"
                style={{ ...btn, ...(rotateTarget === r.bone ? { background: '#f5ff00', color: '#0a0510', borderColor: '#f5ff00' } : null) }}
                onClick={() => setRotateTarget(rotateTarget === r.bone ? null : r.bone)}
              >{r.id}</button>
            ))}
            {rotateTarget && (
              <button type="button" style={btn} onClick={() => setRotateTarget(null)}>quitar</button>
            )}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.14em', opacity: 0.5, marginBottom: 6 }}>Cerrar la mano</div>
          {[['l', 'Izquierda'], ['r', 'Derecha']].map(([side, label]) => (
            <label key={side} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, marginTop: 4 }}>
              <span style={{ width: 62 }}>{label}</span>
              <input
                type="range" min={-0.3} max={1} step={0.01} value={hands[side]} style={{ flex: 1 }}
                onChange={(e) => closeHand(side, Number(e.target.value))}
              />
            </label>
          ))}
        </div>
        <div>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.14em', opacity: 0.5, marginBottom: 6 }}>Láser: de cerca a lejos</div>
          <input
            type="range" min={0} max={1} step={0.01} value={reach} style={{ width: '100%' }}
            onChange={(e) => previewReach(Number(e.target.value))}
          />
        </div>
        <div>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.14em', opacity: 0.5, marginBottom: 6 }}>Guardar pose en</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {SLOTS.map((s) => (
              <button key={s} type="button" style={{ ...btn, borderColor: poses[s] ? '#4ade80' : 'rgba(255,255,255,0.18)' }} onClick={() => saveSlot(s)}>{s}</button>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.14em', opacity: 0.5, marginBottom: 6 }}>Cargar</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {SLOTS.map((s) => (
              <button key={s} type="button" style={{ ...btn, opacity: poses[s] ? 1 : 0.4 }} onClick={() => loadSlot(s)}>{s}</button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" style={{ ...btn, background: '#f5ff00', color: '#0a0510', border: 'none' }} onClick={exportAll}>Exportar JSON</button>
          <button type="button" style={btn} onClick={() => { const ok = apiRef.current?.reset(); say(ok ? 'Pose reiniciada ✓' : 'Rig no listo') }}>Reset</button>
        </div>
        {status && <div style={{ fontSize: 12.5, color: '#4ade80' }}>{status}</div>}
      </div>
    </div>
  )
}

useGLTF.preload(CHAR_URL, true, true, extendGLTFLoaderKTX2)
