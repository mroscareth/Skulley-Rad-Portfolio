import React, { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { caminoEnPiso, zonasPiso } from '../../lib/pisoPintado.js'

// Pétalos de cempasúchil en el camino escondido de Work a SKULLEYGLYPH (2026-11-22):
// donde la tierra tapa las lozas, los pétalos siguen el camino, como el de Día de
// Muertos que guía a los muertos a casa (nadie lo dice en el sitio). Se siembran
// con la misma cuenta del shader del piso (`caminoEnPiso`): tupidos al centro de la
// tira tapada, ralos a los lados y casi nada sobre las lozas que se ven.
// El atlas lo pinta scripts/petalos/pintar_petalos.py (gris 0.5 = el naranja, abajo
// un rojo quemado, arriba aclara; alfa = pétalo): doce pétalos sueltos, dos
// doblados, un par y una flor entera.
// Cada pétalo es suyo: Skulley los levanta al pasar (más corriendo), giran, planean
// meciéndose y se acuestan donde caen, de cara o de espaldas, sin meterse en el
// piso. Un solo dibujo (InstancedBufferGeometry); su posición y giro viven en la
// CPU y solo se suben mientras alguno se mueve. Montado siempre: no compila al jugar.

const VERSION = 1
const URL_PETALOS = `${import.meta.env.BASE_URL}textures/petalos-camino.webp?v=${VERSION}`

const PETALOS = {
  semilla: 31,
  densidad: 7.5,        // pétalos por unidad² al centro de lo que tapa la tierra
  sueltos: 0.05,        // lo mismo sobre las lozas que se ven, en fracción
  tam: [0.24, 0.38],    // lo que mide un pétalo en el mundo
  flor: 0.03,           // de cada cuántos es una flor entera
  tamFlor: [0.46, 0.6],
  alto: [0.004, 0.013], // sobre el piso (cada uno distinto: no pelean al encimarse)
  color: '#ff7014',
  oscuro: [0.6, 0.27, 0.22],  // hacia dónde se va lo oscuro del atlas (multiplica)
  claro: [1, 0.9, 0.62],      // y lo claro (mezcla)
  claroFuerza: 0.55,
  espalda: 0.8,         // el revés, un poco más apagado
}

const FISICA = {
  radio: 0.62,          // alcance de los pies de Skulley
  radioCorre: 0.85,
  minVel: 1.2,          // abajo de esto no levanta nada
  caminar: 9,           // la velocidad de Skulley caminando (Player, SPEED)
  vuelo: [1.4, 3.0],    // velocidad hacia arriba al caminar
  empuje: [0.6, 1.5],   // hacia afuera
  arrastre: 0.3,        // lo que se lleva de la velocidad de Skulley
  gravedad: 7.5,
  caidaMax: [1.1, 1.8], // velocidad de caída tope: los pétalos planean
  aire: 1.7,            // freno horizontal en el aire
  aleteo: 2.4,          // vaivén al caer
  giro: [5, 13],        // rad/s al salir
  roce: 7,              // freno al resbalar en el piso
  asienta: 13,          // qué tan rápido se acuesta al caer
  espera: 0.35,         // segundos antes de poder levantarse otra vez
  flor: 0.4,            // las flores pesan más: vuelan menos y giran menos
}

const suaveEntre = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

function sembrar() {
  let semilla = PETALOS.semilla
  const azar = () => { semilla = (semilla * 16807) % 2147483647; return (semilla - 1) / 2147483646 }
  const [x0, z0] = zonasPiso.camino[0]
  const [x1, z1] = zonasPiso.camino[zonasPiso.camino.length - 1]
  const largo = zonasPiso.caminoLargo
  const margen = 4
  const caja = [Math.min(x0, x1) - margen, Math.min(z0, z1) - margen, Math.max(x0, x1) + margen, Math.max(z0, z1) + margen]
  const area = (caja[2] - caja[0]) * (caja[3] - caja[1])
  const candidatos = Math.round(area * PETALOS.densidad)
  const lista = []
  for (let i = 0; i < candidatos; i++) {
    const x = caja[0] + azar() * (caja[2] - caja[0])
    const z = caja[1] + azar() * (caja[3] - caja[1])
    const c = caminoEnPiso(x, z)
    const filtro = azar()
    if (c.pasado) continue
    // Tupidos al centro de la tira, se abren hacia sus orillas.
    const ancho = 0.45 * c.medio + 0.35
    const perfil = Math.exp(-((c.d / ancho) ** 2))
    const tapado = 1 - c.visible
    let p = perfil * (tapado * tapado + PETALOS.sueltos * c.visible)
    // Empiezan apartados de Work y se acaban antes del portal del glifo.
    p *= suaveEntre(-1, 1.5, c.s) * (1 - suaveEntre(largo - 7, largo, c.s))
    if (filtro >= p) continue
    const flor = azar() < PETALOS.flor
    const [t0, t1] = flor ? PETALOS.tamFlor : PETALOS.tam
    lista.push({
      x, z,
      yaw: azar() * Math.PI * 2,
      tam: t0 + (t1 - t0) * azar(),
      celda: flor ? 15 : Math.floor(azar() * 15),
      alto: PETALOS.alto[0] + (PETALOS.alto[1] - PETALOS.alto[0]) * azar(),
      fase: azar() * 6.283,
      flor,
    })
  }
  return lista
}

function armarGeometria(lista) {
  // Dos cuadros: el de enfrente mira hacia arriba y el revés hacia abajo (marcado en z).
  const esq = [-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0, -0.5, -0.5, 1, 0.5, -0.5, 1, 0.5, 0.5, 1, -0.5, 0.5, 1]
  const g = new THREE.InstancedBufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(esq, 3))
  g.setIndex([0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6])
  const n = lista.length
  const pos = new Float32Array(n * 4)
  const giro = new Float32Array(n * 2)
  const info = new Float32Array(n * 4)
  lista.forEach((p, i) => {
    pos.set([p.x, 0, p.z, p.yaw], i * 4)
    info.set([p.tam, p.celda, p.alto, 0], i * 4)
  })
  const aPos = new THREE.InstancedBufferAttribute(pos, 4)
  aPos.setUsage(THREE.DynamicDrawUsage)
  const aGiro = new THREE.InstancedBufferAttribute(giro, 2)
  aGiro.setUsage(THREE.DynamicDrawUsage)
  g.setAttribute('aPetalo', aPos)
  g.setAttribute('aPetaloGiro', aGiro)
  g.setAttribute('aPetaloInfo', new THREE.InstancedBufferAttribute(info, 4))
  g.instanceCount = n
  return g
}

const VERT_COMUN = /* glsl */`
attribute vec4 aPetalo;
attribute vec2 aPetaloGiro;
attribute vec4 aPetaloInfo;
uniform float uPetalosListo;
varying vec2 vPetaloUv;
varying float vPetaloCara;
`
const VERT_POS = /* glsl */`
  float tam = aPetaloInfo.x;
  float celda = aPetaloInfo.y;
  vec3 q = vec3(position.x, 0.0, -position.y) * tam;
  float cp = cos(aPetaloGiro.x), sp = sin(aPetaloGiro.x);
  q = vec3(q.x, q.y * cp - q.z * sp, q.y * sp + q.z * cp);
  float cr = cos(aPetaloGiro.y), sr = sin(aPetaloGiro.y);
  q = vec3(q.x * cr - q.y * sr, q.x * sr + q.y * cr, q.z);
  float cy = cos(aPetalo.w), sy = sin(aPetalo.w);
  q = vec3(q.x * cy + q.z * sy, q.y, -q.x * sy + q.z * cy);
  // Sin el atlas cargado, cada pétalo se junta en un punto y no dibuja nada.
  vec3 transformed = aPetalo.xyz + vec3(0.0, aPetaloInfo.z, 0.0) + q * uPetalosListo;
  // Celda del atlas (4 x 4, la 0 arriba a la izquierda).
  vec2 c = vec2(mod(celda, 4.0), 3.0 - floor(celda / 4.0));
  vec2 uvq = position.xy + 0.5;
  // El revés se ve en espejo.
  if (position.z > 0.5) uvq.x = 1.0 - uvq.x;
  vPetaloUv = (c + uvq) * 0.25;
  vPetaloCara = position.z > 0.5 ? ${PETALOS.espalda.toFixed(2)} : 1.0;
`
const FRAG_COMUN = /* glsl */`
uniform sampler2D uPetalosAtlas;
varying vec2 vPetaloUv;
varying float vPetaloCara;
float petaloValor;
`
const FRAG_ALFA = /* glsl */`
  {
    vec4 tx = texture2D(uPetalosAtlas, vPetaloUv);
    // Las mips promedian el alfa y los pétalos lejanos se adelgazarían: se compensa.
    vec2 dx = dFdx(vPetaloUv * 1024.0), dy = dFdy(vPetaloUv * 1024.0);
    float lod = 0.5 * log2(max(max(dot(dx, dx), dot(dy, dy)), 1e-6));
    if (tx.a * (1.0 + max(lod, 0.0) * 0.25) < 0.5) discard;
    petaloValor = tx.r * 2.0 - 1.0;
  }
`
const v3 = (a) => `vec3(${a.map((n) => n.toFixed(3)).join(', ')})`
const FRAG_COLOR = /* glsl */`
  {
    vec3 vis = sqrt(min(outgoingLight, vec3(1.0)));
    vis = petaloValor < 0.0
      ? mix(vis, vis * ${v3(PETALOS.oscuro)}, -petaloValor)
      : mix(vis, ${v3(PETALOS.claro)}, ${PETALOS.claroFuerza.toFixed(2)} * petaloValor);
    vis *= vPetaloCara;
    outgoingLight = vis * vis;
  }
`

function cargarAtlas(gl, alListo) {
  const t = new THREE.TextureLoader().load(URL_PETALOS, (tex) => {
    try { gl?.initTexture?.(tex) } catch { }
    alListo()
  })
  t.colorSpace = THREE.NoColorSpace
  t.anisotropy = Math.min(8, gl?.capabilities?.getMaxAnisotropy?.() || 1)
  return t
}

// Lo que se levanta del piso cuando el pétalo va inclinado: así ninguna esquina se mete.
// (La esquina más baja del cuadro girado en x y luego en z baja eso; el giro en y no cambia la altura.)
const levante = (s, i) => 0.5 * s.tam[i] * (Math.abs(Math.sin(s.roll[i])) + Math.abs(Math.sin(s.pitch[i]) * Math.cos(s.roll[i])))

export default function PetalosCamino({ playerRef }) {
  const gl = useThree((s) => s.gl)
  const recursos = useMemo(() => {
    const lista = sembrar()
    const geo = armarGeometria(lista)
    const uniforms = {
      uPetalosAtlas: { value: null },
      uPetalosListo: { value: 0 },
    }
    uniforms.uPetalosAtlas.value = cargarAtlas(gl, () => { uniforms.uPetalosListo.value = 1 })
    const mat = new THREE.MeshStandardMaterial({
      color: PETALOS.color,
      roughness: 0.9,
      metalness: 0,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    })
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms)
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\n${VERT_COMUN}`)
        .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = vec3(0.0, 1.0, 0.0);')
        .replace('#include <begin_vertex>', VERT_POS)
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\n${FRAG_COMUN}`)
        .replace('#include <alphatest_fragment>', `#include <alphatest_fragment>\n${FRAG_ALFA}`)
        .replace('#include <opaque_fragment>', `${FRAG_COLOR}\n#include <opaque_fragment>`)
    }
    mat.customProgramCacheKey = () => 'petalos-camino-1'
    const n = lista.length
    const sim = {
      n,
      x: Float32Array.from(lista, (p) => p.x),
      y: new Float32Array(n),
      z: Float32Array.from(lista, (p) => p.z),
      yaw: Float32Array.from(lista, (p) => p.yaw),
      pitch: new Float32Array(n),
      roll: new Float32Array(n),
      vx: new Float32Array(n), vy: new Float32Array(n), vz: new Float32Array(n),
      wy: new Float32Array(n), wp: new Float32Array(n), wr: new Float32Array(n),
      tam: Float32Array.from(lista, (p) => p.tam),
      fase: Float32Array.from(lista, (p) => p.fase),
      flor: Uint8Array.from(lista, (p) => (p.flor ? 1 : 0)),
      caida: Float32Array.from(lista, (p, i) => FISICA.caidaMax[0] + (FISICA.caidaMax[1] - FISICA.caidaMax[0]) * ((i * 0.618) % 1)),
      // 0 quieto, 1 en el aire, 2 acostándose en el piso.
      estado: new Uint8Array(n),
      espera: new Float32Array(n),
    }
    return { geo, mat, uniforms, sim }
  }, [gl])

  useEffect(() => () => {
    recursos.geo.dispose()
    recursos.mat.dispose()
    recursos.uniforms.uPetalosAtlas.value?.dispose?.()
  }, [recursos])

  const prev = useRef({ x: 0, z: 0, ok: false, vx: 0, vz: 0, t: 0, azar: 0x9e3779b9 })

  // Levanta el pétalo i: hacia arriba, hacia afuera de (ox, oz) y con algo de la
  // velocidad (vx, vz). `fuerza` 1 es caminar.
  const levantar = (i, ox, oz, vx, vz, fuerza) => {
    const s = recursos.sim
    const pr = prev.current
    const azar = () => { pr.azar ^= pr.azar << 13; pr.azar ^= pr.azar >>> 17; pr.azar ^= pr.azar << 5; return (pr.azar >>> 0) / 4294967296 }
    let dx = s.x[i] - ox, dz = s.z[i] - oz
    let d = Math.hypot(dx, dz)
    if (d < 1e-3) { dx = Math.cos(s.fase[i]); dz = Math.sin(s.fase[i]); d = 1 }
    const peso = s.flor[i] ? FISICA.flor : 1
    const f = Math.min(1.5, fuerza) * peso
    const e = FISICA.empuje[0] + (FISICA.empuje[1] - FISICA.empuje[0]) * azar()
    s.vx[i] = (dx / d) * e * f + vx * FISICA.arrastre * peso
    s.vz[i] = (dz / d) * e * f + vz * FISICA.arrastre * peso
    s.vy[i] = (FISICA.vuelo[0] + (FISICA.vuelo[1] - FISICA.vuelo[0]) * azar()) * Math.max(0.45, f)
    const giro = () => (azar() < 0.5 ? -1 : 1) * (FISICA.giro[0] + (FISICA.giro[1] - FISICA.giro[0]) * azar()) * peso
    s.wy[i] = giro() * 0.5
    s.wp[i] = giro()
    s.wr[i] = giro() * 0.6
    s.y[i] = Math.max(s.y[i], levante(s, i))
    s.estado[i] = 1
  }

  useEffect(() => {
    if (!import.meta.env.DEV) return
    window.__petalos = {
      recursos,
      PETALOS,
      FISICA,
      // Patea los pétalos alrededor de (x, z) como si pasara Skulley.
      patear: (x, z, radio = 1.2, fuerza = 1.3) => {
        const s = recursos.sim
        let k = 0
        for (let i = 0; i < s.n; i++) {
          if (Math.hypot(s.x[i] - x, s.z[i] - z) < radio) { levantar(i, x, z, 0, 0, fuerza); k++ }
        }
        return k
      },
      enAire: () => Array.from(recursos.sim.estado).filter((e) => e > 0).length,
      jugador: () => playerRef?.current?.position?.toArray(),
      // Lo más que se mete un pétalo en el piso (negativo = se mete), con sus cuatro esquinas.
      bajoPiso: () => {
        const s = recursos.sim
        let peor = Infinity
        const m = new THREE.Matrix4(), e = new THREE.Euler(), v = new THREE.Vector3()
        const alto = recursos.geo.getAttribute('aPetaloInfo')
        for (let i = 0; i < s.n; i++) {
          e.set(s.pitch[i], s.yaw[i], s.roll[i], 'YZX')
          m.makeRotationFromEuler(e)
          for (const [a, b] of [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]]) {
            v.set(a * s.tam[i], 0, -b * s.tam[i]).applyMatrix4(m)
            peor = Math.min(peor, s.y[i] + alto.getZ(i) + v.y)
          }
        }
        return peor
      },
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recursos])

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05)
    if (dt <= 0) return
    const s = recursos.sim
    const pr = prev.current
    pr.t += dt
    const p = playerRef?.current?.position
    let vel = 0
    if (p) {
      if (pr.ok) {
        const vx = (p.x - pr.x) / dt, vz = (p.z - pr.z) / dt
        // Un salto grande (teletransporte, regreso al home, la esfera) no es caminar.
        if (vx * vx + vz * vz < 600) { pr.vx += (vx - pr.vx) * 0.35; pr.vz += (vz - pr.vz) * 0.35 }
        else { pr.vx = 0; pr.vz = 0 }
      }
      pr.x = p.x; pr.z = p.z; pr.ok = true
      vel = Math.hypot(pr.vx, pr.vz)
    }
    // Solo con los pies en el piso.
    const pisa = p && p.y < 0.6 && vel > FISICA.minVel
    const fuerza = vel / FISICA.caminar
    const radio = fuerza > 1.15 ? FISICA.radioCorre : FISICA.radio
    let cambio = false
    for (let i = 0; i < s.n; i++) {
      if (s.espera[i] > 0) s.espera[i] -= dt
      if (pisa && s.estado[i] !== 1 && s.espera[i] <= 0) {
        const dx = s.x[i] - p.x, dz = s.z[i] - p.z
        if (dx * dx + dz * dz < radio * radio) levantar(i, p.x, p.z, pr.vx, pr.vz, fuerza)
      }
      const e = s.estado[i]
      if (e === 0) continue
      cambio = true
      if (e === 1) {
        // En el aire: cae hasta su velocidad tope, el aire lo frena y al bajar se mece.
        s.vy[i] = Math.max(s.vy[i] - FISICA.gravedad * dt, -s.caida[i])
        const freno = Math.exp(-FISICA.aire * dt)
        s.vx[i] *= freno; s.vz[i] *= freno
        if (s.vy[i] < 0) {
          const a = FISICA.aleteo * (s.flor[i] ? 0.2 : 1)
          s.vx[i] += Math.sin(pr.t * 6.1 + s.fase[i]) * a * dt
          s.vz[i] += Math.cos(pr.t * 5.3 + s.fase[i] * 1.7) * a * dt
          s.wp[i] += Math.sin(pr.t * 7.3 + s.fase[i]) * 9 * dt
        }
        const giroFreno = Math.exp(-1.1 * dt)
        s.wy[i] *= giroFreno; s.wp[i] *= giroFreno; s.wr[i] *= giroFreno
        s.yaw[i] += s.wy[i] * dt
        s.pitch[i] += s.wp[i] * dt
        s.roll[i] += s.wr[i] * dt
        s.x[i] += s.vx[i] * dt
        s.z[i] += s.vz[i] * dt
        s.y[i] += s.vy[i] * dt
        // De subida también: girando rápido, una esquina bajaba más rápido de lo que subía él.
        const piso = levante(s, i)
        if (s.y[i] <= piso) {
          s.y[i] = piso
          if (s.vy[i] <= 0) {
            s.vy[i] = 0
            s.vx[i] *= 0.3; s.vz[i] *= 0.3
            s.wy[i] *= 0.2
            s.estado[i] = 2
          }
        }
      } else {
        // En el piso: se acuesta de cara o de espaldas (lo más cerca) y resbala tantito.
        const k = 1 - Math.exp(-FISICA.asienta * (s.flor[i] ? 0.6 : 1) * dt)
        const tp = Math.round(s.pitch[i] / Math.PI) * Math.PI
        const tr = Math.round(s.roll[i] / Math.PI) * Math.PI
        s.pitch[i] += (tp - s.pitch[i]) * k
        s.roll[i] += (tr - s.roll[i]) * k
        const roce = Math.exp(-FISICA.roce * dt)
        s.vx[i] *= roce; s.vz[i] *= roce; s.wy[i] *= roce
        s.x[i] += s.vx[i] * dt
        s.z[i] += s.vz[i] * dt
        s.yaw[i] += s.wy[i] * dt
        s.y[i] = levante(s, i)
        if (Math.abs(tp - s.pitch[i]) < 0.002 && Math.abs(tr - s.roll[i]) < 0.002 && s.vx[i] * s.vx[i] + s.vz[i] * s.vz[i] < 1e-4) {
          // Ángulos de vuelta a una vuelta: de cara (0) o de espaldas (π).
          s.pitch[i] = ((Math.round(tp / Math.PI) % 2) + 2) % 2 ? Math.PI : 0
          s.roll[i] = ((Math.round(tr / Math.PI) % 2) + 2) % 2 ? Math.PI : 0
          s.y[i] = 0
          s.estado[i] = 0
          s.espera[i] = FISICA.espera
        }
      }
    }
    if (!cambio) return
    const aPos = recursos.geo.getAttribute('aPetalo')
    const aGiro = recursos.geo.getAttribute('aPetaloGiro')
    const P = aPos.array, G = aGiro.array
    for (let i = 0; i < s.n; i++) {
      P[i * 4] = s.x[i]; P[i * 4 + 1] = s.y[i]; P[i * 4 + 2] = s.z[i]; P[i * 4 + 3] = s.yaw[i]
      G[i * 2] = s.pitch[i]; G[i * 2 + 1] = s.roll[i]
    }
    aPos.needsUpdate = true
    aGiro.needsUpdate = true
  })

  return <mesh geometry={recursos.geo} material={recursos.mat} frustumCulled={false} />
}
