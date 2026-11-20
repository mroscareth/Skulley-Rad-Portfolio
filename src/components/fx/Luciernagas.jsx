import React, { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Luciérnagas del home (Oscar, 2026-11-19): motas que flotan por el escenario y
// titilan, como el polvo mágico de la historia (POLVO en SkulleyFallRig), para
// hacerlo más místico; chicas como las de los portales y en verde menta. Las que quedan lejos del plano de Skulley, cerca de la
// cámara o al fondo, salen desenfocadas como profundidad de campo: el punto crece
// con el círculo de confusión de una lente delgada (|1/d - 1/foco|), su orilla se
// suaviza y baja su brillo, sin un pase de blur.
// Un solo objeto de puntos que el vertex shader acomoda en una caja que sigue a
// Skulley (un poco hacia adelante de la cámara) y se repite, con las orillas
// apagadas para que ninguna aparezca de golpe. Va montado desde el warm-up y no se
// desmonta ni se oculta: con `activo` en falso el shader pone los puntos en tamaño
// 0 y no dibuja nada, así nunca compila a media partida (CLAUDE.md).
const LUCES = {
  cuantas: 260,
  ancho: 46,          // la caja, en unidades del mundo
  fondo: 72,
  // Más alto que la cámara (~13): si no, las que le pasan cerca se apagaban por la
  // orilla de arriba (Oscar: le gusta que algunas pasen cerca, se ve cinematográfico).
  alto: 17,
  // Cuánto se corre la caja hacia donde mira la cámara. Poco: la cámara tiene que
  // quedar adentro y lejos de su orilla, o se apagan las de enfrente.
  adelante: 4,
  tam: [0.022, 0.048], // tamaño de la mota enfocada, en unidades del mundo (como las de los portales)
  apertura: 0.45,     // qué tanto se desenfoca lo que no está en el plano de Skulley
  maxPx: 140,         // tope del punto desenfocado, en pixeles del canvas
  color: '#86ffc0',   // verde menta (Oscar)
  brillo: 1,
  // Cuánto se multiplica el color: arriba de 1 pasan el umbral del bloom y
  // resplandecen (Oscar: más brillantes).
  intensidad: 2.2,
}

const VERT = /* glsl */`
  uniform float uTiempo;
  uniform float uDeriva;
  uniform float uAlpha;
  uniform float uAltoPx;
  uniform float uFoco;
  uniform vec3 uCentro;
  uniform vec3 uCaja;
  attribute float aFase;
  attribute float aVel;
  attribute float aTam;
  varying float vBrillo;
  varying float vBlur;
  void main() {
    float t = uTiempo * aVel * uDeriva;
    vec3 rel = vec3(
      position.x + sin(t * 0.21 + aFase) * 0.6 + sin(t * 0.09 + aFase * 2.1) * 0.9 - uCentro.x,
      position.y * uCaja.y + t * 0.08 + sin(t * 0.27 + aFase * 1.3) * 0.35,
      position.z + cos(t * 0.19 + aFase * 0.7) * 0.7 - uCentro.z);
    rel.x = mod(rel.x + uCaja.x * 0.5, uCaja.x) - uCaja.x * 0.5;
    rel.z = mod(rel.z + uCaja.z * 0.5, uCaja.z) - uCaja.z * 0.5;
    rel.y = mod(rel.y, uCaja.y);
    vec3 w = vec3(uCentro.x, 0.0, uCentro.z) + rel;
    float orilla = (1.0 - smoothstep(0.36, 0.5, abs(rel.x / uCaja.x))) * (1.0 - smoothstep(0.36, 0.5, abs(rel.z / uCaja.z)))
      * smoothstep(0.0, 0.08, rel.y / uCaja.y) * (1.0 - smoothstep(0.8, 1.0, rel.y / uCaja.y));
    float titila = 0.35 + 0.65 * pow(0.5 + 0.5 * sin(uTiempo * (0.5 + aVel * 0.8) + aFase * 6.0), 2.0);
    vec4 vista = modelViewMatrix * vec4(w, 1.0);
    gl_Position = projectionMatrix * vista;
    float d = max(-vista.z, 0.2);
    float escala = projectionMatrix[1][1] * uAltoPx * 0.5;
    float nitida = aTam * escala / d;
    float coc = ${LUCES.apertura.toFixed(3)} * escala * abs(1.0 / d - 1.0 / uFoco);
    float tam = min(sqrt(nitida * nitida + coc * coc), ${LUCES.maxPx.toFixed(1)});
    vBlur = clamp(coc / max(tam, 1e-3), 0.0, 1.0);
    // Al desenfocarse la luz se reparte en un disco más grande: baja el brillo,
    // con un piso para que las grandes se sigan viendo.
    float reparte = max(pow(nitida / tam, 0.75), 0.14);
    vBrillo = orilla * titila * reparte * uAlpha;
    gl_PointSize = uAlpha > 0.001 && orilla > 0.001 ? max(tam, 1.5) : 0.0;
  }
`
const FRAG = /* glsl */`
  uniform vec3 uColor;
  varying float vBrillo;
  varying float vBlur;
  // Enfocada: centro sólido y halo suave (como el polvo de la historia).
  // Desenfocada: un disco suave de bokeh.
  void main() {
    float r = length(gl_PointCoord - 0.5) * 2.0;
    if (r > 1.0) discard;
    float centro = 1.0 - smoothstep(mix(0.3, 0.35, vBlur), mix(0.75, 1.0, vBlur), r);
    float halo = (1.0 - r) * (1.0 - r) * 0.45 * (1.0 - vBlur);
    gl_FragColor = vec4(uColor * ${LUCES.intensidad.toFixed(2)}, max(centro, halo) * vBrillo);
  }
`

function geometria() {
  let semilla = 11
  const azar = () => { semilla = (semilla * 16807) % 2147483647; return (semilla - 1) / 2147483646 }
  const n = LUCES.cuantas
  const pos = new Float32Array(n * 3)
  const fase = new Float32Array(n)
  const vel = new Float32Array(n)
  const tam = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    pos[i * 3] = (azar() - 0.5) * LUCES.ancho
    pos[i * 3 + 1] = azar()
    pos[i * 3 + 2] = (azar() - 0.5) * LUCES.fondo
    fase[i] = azar() * Math.PI * 2
    vel[i] = 0.5 + azar()
    tam[i] = LUCES.tam[0] + Math.pow(azar(), 2.5) * (LUCES.tam[1] - LUCES.tam[0])
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('aFase', new THREE.BufferAttribute(fase, 1))
  g.setAttribute('aVel', new THREE.BufferAttribute(vel, 1))
  g.setAttribute('aTam', new THREE.BufferAttribute(tam, 1))
  return g
}

export default function Luciernagas({ playerRef, activo = true }) {
  const recursos = useMemo(() => {
    let quieto = false
    try { quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { }
    return {
      geo: geometria(),
      mat: new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
        uniforms: {
          uColor: { value: new THREE.Color(LUCES.color) },
          uAlpha: { value: 0 },
          uTiempo: { value: 0 },
          // Con menos movimiento solo titilan.
          uDeriva: { value: quieto ? 0 : 1 },
          uAltoPx: { value: 1000 },
          uFoco: { value: 16 },
          uCentro: { value: new THREE.Vector3() },
          uCaja: { value: new THREE.Vector3(LUCES.ancho, LUCES.alto, LUCES.fondo) },
        },
      }),
    }
  }, [])
  useEffect(() => () => { recursos.geo.dispose(); recursos.mat.dispose() }, [recursos])

  const tmp = useRef({ v: new THREE.Vector3(), dir: new THREE.Vector3(), tam: new THREE.Vector2(), alpha: 0 })
  useFrame((state, delta) => {
    const u = recursos.mat.uniforms
    const t = tmp.current
    u.uTiempo.value += Math.min(delta, 0.1)
    t.alpha += ((activo ? LUCES.brillo : 0) - t.alpha) * (1 - Math.exp(-3 * Math.min(delta, 0.1)))
    if (t.alpha < 0.002 && !activo) t.alpha = 0
    u.uAlpha.value = t.alpha
    state.gl.getDrawingBufferSize(t.tam)
    u.uAltoPx.value = t.tam.y
    const cam = state.camera
    const p = playerRef?.current?.position
    cam.getWorldDirection(t.dir)
    t.dir.y = 0
    if (t.dir.lengthSq() > 1e-6) t.dir.normalize()
    if (p) {
      u.uCentro.value.set(p.x + t.dir.x * LUCES.adelante, 0, p.z + t.dir.z * LUCES.adelante)
      // El plano enfocado es el de Skulley.
      t.v.copy(p).applyMatrix4(cam.matrixWorldInverse)
      u.uFoco.value = Math.max(2, -t.v.z)
    }
  })

  return <points geometry={recursos.geo} material={recursos.mat} frustumCulled={false} renderOrder={5} />
}
