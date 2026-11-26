import React, { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { zonasPiso } from '../../lib/pisoPintado.js'
import { zonasSinPasto } from '../../lib/renderboxHome.js'

// Matas de pasto pintadas a mano en el home (Oscar, 2026-11-19, con su referencia
// de hojas largas y afiladas): unas por aquí y otras por allá, y Skulley las dobla
// al pasar y las aplasta al pisarlas; se enderezan con un rebotito.
// El atlas lo pinta scripts/pasto/pintar_pasto.py (gris = valor, alfa = hoja).
// Cada mata son dos tarjetas que miran a la cámara, un poco echadas hacia atrás
// para que la vean de frente (desde arriba una tarjeta derecha se ve delgada). Son del mismo material que el
// piso (meshStandardMaterial con su color y con la normal hacia arriba), así les
// toca la misma luz y su base es el color del piso: de noche o de día, salen del
// color que tenga (`colorPiso`). Lo claro se pinta como en el piso, acercando al
// blanco (el piso sale saturado y multiplicar no se ve).
// Un solo dibujo para todas (InstancedBufferGeometry); la dobladura de cada mata
// es un resorte en la CPU que se sube como atributo. Se monta una vez y no cambia
// de programa: nada compila al jugar.

// La versión va en la URL: si se vuelve a pintar el atlas con el mismo nombre, el
// navegador y el CDN servían el de antes.
const VERSION_MATAS = 3
const URL_MATAS = `${import.meta.env.BASE_URL}textures/pasto-matas.webp?v=${VERSION_MATAS}`

const PASTO = {
  semilla: 19,
  manchones: 70,       // grupos de matas
  porManchon: [3, 9],
  alto: [1.0, 1.8],  // alto de una mata, en unidades del mundo
  inclina: 0.35,       // cuánto se echa la tarjeta hacia atrás, para que mire a la cámara
  claro: 0.36,        // lo más claro (puntas), hacia el blanco: poco, que sigan azules
  oscuro: 0.25,        // lo más oscuro (orilla en sombra), poco: nada de azules oscuros
  piso: 0.2,           // el gris del atlas que es el color del piso
  // Resorte de cada mata (dobla y regresa con un rebotito toon).
  rigidez: 160,
  amortigua: 9,
  alcance: 0.8,        // hasta dónde llega el pie de Skulley, sumado a media mata
  aplastaS: 0.55,      // cuánto se queda aplastada después de pisarla
  viento: 0.06,
  // Profundidad de campo (como las luciérnagas): lo que no está en el plano de
  // Skulley se lee de una mip más borrosa y su orilla se trama, sin pase de blur.
  apertura: 0.22,
  maxBorroso: 3.2,     // tope del desenfoque, en niveles de mip
}

function crearZonas() {
  const { plaza, plazaGlifo, camino, caminoTramos, lozasClaro } = zonasPiso
  const z0 = camino[0][1]
  const dir = Math.sign(camino[1][1] - z0)
  return { plaza, plazaGlifo, x: camino[0][0], z0, dir, tramos: caminoTramos, lozasClaro }
}

// ¿Puede crecer una mata aquí? Fuera de los portales, de las lozas del claro (que
// llegan casi hasta los pinos: solo crece en su orilla, Oscar 2026-11-25), de las
// del glifo y de los tramos visibles del camino (en los tapados sí: ayuda a esconderlo).
const SIN_PASTO = zonasSinPasto()
function libre(x, z, portales, zonas) {
  for (const p of portales) {
    const dx = x - p[0], dz = z - p[1]
    if (dx * dx + dz * dz < 4.6 * 4.6) return false
  }
  const dc = Math.hypot(x - zonas.plaza[0], z - zonas.plaza[1])
  if (dc < zonas.lozasClaro) return false
  const dg = Math.hypot(x - zonas.plazaGlifo[0], z - zonas.plazaGlifo[1])
  if (dg < 8) return false
  // ni debajo de la Renderbox y su Cintiq (se asomaba por la pantalla)
  for (const s of SIN_PASTO) if (Math.hypot(x - s.x, z - s.z) < s.r) return false
  const s = (z - zonas.z0) * zonas.dir
  if (Math.abs(x - zonas.x) < 2.6) {
    for (const [a, b] of zonas.tramos) if (s > a - 1 && s < b + 1) return false
  }
  return true
}

function sembrar(portales) {
  let semilla = PASTO.semilla
  const azar = () => { semilla = (semilla * 16807) % 2147483647; return (semilla - 1) / 2147483646 }
  const zonas = crearZonas()
  const matas = []
  let intentos = 0
  let manchones = 0
  while (manchones < PASTO.manchones && intentos < 4000) {
    intentos++
    // La mayoría en la orilla del claro, donde las lozas se deshacen antes de los
    // pinos (repartidas por área); algunas por el camino al glifo.
    let cx, cz
    if (azar() < 0.8) {
      const ang = azar() * Math.PI * 2
      const r0 = zonas.lozasClaro, r1 = zonas.lozasClaro + 9.5
      const r = Math.sqrt(r0 * r0 + azar() * (r1 * r1 - r0 * r0))
      cx = Math.cos(ang) * r
      cz = Math.sin(ang) * r
    } else {
      cx = zonas.x + (azar() - 0.5) * 22
      cz = zonas.z0 + zonas.dir * azar() * 100
    }
    if (!libre(cx, cz, portales, zonas)) continue
    manchones++
    const n = PASTO.porManchon[0] + Math.floor(azar() * (PASTO.porManchon[1] - PASTO.porManchon[0] + 1))
    const radio = 0.6 + azar() * 1.6
    for (let i = 0; i < n; i++) {
      const a = azar() * Math.PI * 2
      const r = Math.sqrt(azar()) * radio
      const x = cx + Math.cos(a) * r
      const z = cz + Math.sin(a) * r
      if (!libre(x, z, portales, zonas)) continue
      // Más altas al centro del manchón.
      const centro = 1 - r / (radio + 1e-3)
      const alto = PASTO.alto[0] + (PASTO.alto[1] - PASTO.alto[0]) * (0.35 * azar() + 0.65 * centro * azar())
      matas.push({ x, z, alto, celdas: Math.floor(azar() * 16), fase: azar() * 6.283 })
    }
  }
  return matas
}

function armarGeometria(matas) {
  const base = new THREE.BufferGeometry()
  // Dos tarjetas, cada una de 4 tramos de alto (para que se doblen en curva).
  const tramos = 4
  const esq = []
  const idx = []
  for (let c = 0; c < 2; c++) {
    const o = esq.length / 3
    for (let j = 0; j <= tramos; j++) {
      const h = j / tramos
      esq.push(-0.5, h, c, 0.5, h, c)
    }
    for (let j = 0; j < tramos; j++) {
      const a = o + j * 2
      idx.push(a, a + 1, a + 3, a, a + 3, a + 2)
    }
  }
  const g = new THREE.InstancedBufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(esq, 3))
  g.setIndex(idx)
  base.dispose()
  const n = matas.length
  const pos = new Float32Array(n * 4)
  const dobla = new Float32Array(n * 2)
  matas.forEach((m, i) => {
    pos[i * 4] = m.x
    pos[i * 4 + 1] = m.z
    pos[i * 4 + 2] = m.alto
    // Las celdas del atlas de cada tarjeta (0..3 cada una) y la fase del viento.
    pos[i * 4 + 3] = m.celdas + Math.floor(m.fase * 100) * 16
  })
  g.setAttribute('aMata', new THREE.InstancedBufferAttribute(pos, 4))
  const aDobla = new THREE.InstancedBufferAttribute(dobla, 2)
  aDobla.setUsage(THREE.DynamicDrawUsage)
  g.setAttribute('aDobla', aDobla)
  g.instanceCount = n
  return g
}

const VERT_COMUN = /* glsl */`
attribute vec4 aMata;
attribute vec2 aDobla;
uniform float uPastoTiempo;
uniform float uPastoListo;
uniform float uPastoFoco;
uniform float uPastoAltoPx;
varying vec2 vPastoUv;
varying float vPastoBorroso;
`
const VERT_POS = /* glsl */`
  vec2 baseXZ = aMata.xy;
  float alto = aMata.z;
  float codigo = aMata.w;
  float celdas = mod(codigo, 16.0);
  float fase = floor(codigo / 16.0) / 100.0;
  float carta = position.z;
  float celda = carta < 0.5 ? mod(celdas, 4.0) : floor(celdas / 4.0);
  float h = position.y;
  // Hacia la cámara, en el piso.
  vec2 aCam = cameraPosition.xz - baseXZ;
  aCam = length(aCam) > 1e-4 ? normalize(aCam) : vec2(0.0, 1.0);
  vec2 lado = vec2(aCam.y, -aCam.x);
  // La tarjeta 0 va un poco atrás y a un lado; la 1, enfrente y al otro.
  float sgn = carta < 0.5 ? -1.0 : 1.0;
  vec2 desp = lado * sgn * 0.18 * alto + aCam * sgn * 0.12 * alto;
  vec2 xz = baseXZ + desp + lado * position.x * alto;
  // Inclinada hacia atrás (así mira hacia la cámara, que la ve desde arriba), y la
  // dobladura del resorte más el viento.
  vec2 b = aDobla + ${PASTO.viento.toFixed(3)} * vec2(sin(uPastoTiempo * 1.3 + baseXZ.x * 0.35 + fase), cos(uPastoTiempo * 1.1 + baseXZ.y * 0.3 + fase * 1.7));
  float m = min(length(b), 1.3);
  xz -= aCam * h * alto * ${PASTO.inclina.toFixed(2)};
  xz += b * alto * h * h * 0.85;
  float y = h * alto * (1.0 - 0.62 * min(m * m, 1.0) * h);
  // Sin el atlas cargado, cada tarjeta se junta en un punto y no dibuja nada.
  vec3 transformed = mix(vec3(baseXZ.x, 0.0, baseXZ.y), vec3(xz.x, y, xz.y), uPastoListo);
  // Celda del atlas (2 x 2, la de arriba a la izquierda es la 0); la base de la
  // hoja va 6 px arriba de la orilla de la celda.
  vec2 c = vec2(mod(celda, 2.0), 1.0 - floor(celda / 2.0));
  vPastoUv = (c + vec2(position.x + 0.5, h * (1.0 - 6.0 / 512.0) + 6.0 / 512.0)) * 0.5;
  // Círculo de confusión de lente delgada contra el plano de Skulley, en pixeles.
  {
    float d = max(-(modelViewMatrix * vec4(transformed, 1.0)).z, 0.5);
    float escala = projectionMatrix[1][1] * uPastoAltoPx * 0.5;
    float coc = ${PASTO.apertura.toFixed(3)} * escala * abs(1.0 / d - 1.0 / uPastoFoco);
    vPastoBorroso = min(log2(max(coc - 1.0, 1.0)), ${PASTO.maxBorroso.toFixed(2)});
  }
`
const FRAG_COMUN = /* glsl */`
uniform sampler2D uPastoMatas;
varying vec2 vPastoUv;
varying float vPastoBorroso;
float pastoValor;
float pastoBayer(vec2 p) {
  // Umbral de Bayer 4 x 4: la orilla desenfocada se trama en lugar de mezclarse
  // (sin transparencia ni orden de dibujo).
  ivec2 q = ivec2(mod(floor(p), 4.0));
  int a = (((q.x ^ q.y) & 1) << 1) | (q.y & 1);
  int b = ((((q.x >> 1) ^ (q.y >> 1)) & 1) << 1) | ((q.y >> 1) & 1);
  return (float(a * 4 + b) + 0.5) / 16.0;
}
`
const FRAG_ALFA = /* glsl */`
  {
    vec4 tx = texture(uPastoMatas, vPastoUv, vPastoBorroso);
    // Las mips promedian el alfa y las hojas lejanas se adelgazarían: se compensa
    // (solo lo de la distancia; lo desenfocado sí se reparte).
    vec2 dx = dFdx(vPastoUv * 1024.0), dy = dFdy(vPastoUv * 1024.0);
    float lod = 0.5 * log2(max(max(dot(dx, dx), dot(dy, dy)), 1e-6));
    float a = tx.a * (1.0 + max(lod, 0.0) * 0.3);
    float desenfoque = clamp(vPastoBorroso / 2.0, 0.0, 1.0);
    if (a < mix(0.5, pastoBayer(gl_FragCoord.xy), desenfoque)) discard;
    float g = tx.r;
    pastoValor = g >= ${PASTO.piso.toFixed(2)} ? (g - ${PASTO.piso.toFixed(2)}) / ${(1 - PASTO.piso).toFixed(2)} : (g - ${PASTO.piso.toFixed(2)}) / ${PASTO.piso.toFixed(2)};
  }
`
const FRAG_COLOR = /* glsl */`
  {
    vec3 vis = sqrt(min(outgoingLight, vec3(1.0)));
    vis *= 1.0 - ${PASTO.oscuro.toFixed(2)} * max(-pastoValor, 0.0);
    vis = mix(vis, vec3(1.0), ${PASTO.claro.toFixed(2)} * max(pastoValor, 0.0));
    outgoingLight = vis * vis;
  }
`

function cargarAtlas(gl, alListo) {
  const t = new THREE.TextureLoader().load(URL_MATAS, (tex) => {
    try { gl?.initTexture?.(tex) } catch { }
    alListo()
  })
  t.colorSpace = THREE.NoColorSpace
  t.anisotropy = Math.min(8, gl?.capabilities?.getMaxAnisotropy?.() || 1)
  return t
}

export default function PastoPintado({ playerRef, portales, colorPiso = '#204580' }) {
  const gl = useThree((s) => s.gl)
  const listaPortales = useMemo(() => (portales || []).map((p) => [p.position[0], p.position[2]]), [portales])
  const recursos = useMemo(() => {
    const matas = sembrar(listaPortales)
    const geo = armarGeometria(matas)
    const uniforms = {
      uPastoMatas: { value: null },
      uPastoTiempo: { value: 0 },
      uPastoListo: { value: 0 },
      uPastoFoco: { value: 18 },
      uPastoAltoPx: { value: 1000 },
    }
    uniforms.uPastoMatas.value = cargarAtlas(gl, () => { uniforms.uPastoListo.value = 1 })
    const mat = new THREE.MeshStandardMaterial({ color: colorPiso, roughness: 0.95, metalness: 0, dithering: true })
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
    mat.customProgramCacheKey = () => 'pasto-pintado-1'
    const n = matas.length
    const sim = {
      x: Float32Array.from(matas, (m) => m.x),
      z: Float32Array.from(matas, (m) => m.z),
      alto: Float32Array.from(matas, (m) => m.alto),
      b: new Float32Array(n * 2),
      v: new Float32Array(n * 2),
      aplasta: new Float32Array(n),
      dirX: new Float32Array(n),
      dirZ: new Float32Array(n),
      despiertas: new Uint8Array(n),
    }
    return { geo, mat, uniforms, sim, n }
    // El material y la geometría se arman una vez: el color cambia sin recompilar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listaPortales, gl])

  useEffect(() => { recursos.mat.color.set(colorPiso) }, [recursos, colorPiso])
  // En desarrollo: las matas, sus resortes y el material, para medir y probar.
  useEffect(() => { if (import.meta.env.DEV) window.__pastoPintado = recursos }, [recursos])
  useEffect(() => () => {
    recursos.geo.dispose()
    recursos.mat.dispose()
    recursos.uniforms.uPastoMatas.value?.dispose?.()
  }, [recursos])

  const prev = useRef({ x: 0, z: 0, ok: false, vx: 0, vz: 0, v: new THREE.Vector3(), tam: new THREE.Vector2() })
  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05)
    const u = recursos.uniforms
    u.uPastoTiempo.value += dt
    const p = playerRef?.current?.position
    state.gl.getDrawingBufferSize(prev.current.tam)
    u.uPastoAltoPx.value = prev.current.tam.y
    if (p) {
      // El plano enfocado es el de Skulley.
      prev.current.v.copy(p).applyMatrix4(state.camera.matrixWorldInverse)
      u.uPastoFoco.value = Math.max(2, -prev.current.v.z)
    }
    if (!p || dt <= 0) return
    const pr = prev.current
    if (pr.ok) {
      const vx = (p.x - pr.x) / dt, vz = (p.z - pr.z) / dt
      // Un salto grande (teletransporte, regreso al home) no es velocidad.
      if (vx * vx + vz * vz < 400) { pr.vx += (vx - pr.vx) * 0.3; pr.vz += (vz - pr.vz) * 0.3 }
    }
    pr.x = p.x; pr.z = p.z; pr.ok = true
    const s = recursos.sim
    const n = recursos.n
    const sub = dt > 1 / 45 ? 2 : 1
    const h = dt / sub
    const K = PASTO.rigidez, C = PASTO.amortigua
    let cambio = false
    for (let i = 0; i < n; i++) {
      const dx = s.x[i] - p.x, dz = s.z[i] - p.z
      const alcance = s.alto[i] * 0.5 + PASTO.alcance
      const d2 = dx * dx + dz * dz
      const cerca = d2 < alcance * alcance
      if (!cerca && !s.despiertas[i]) continue
      let tx = 0, tz = 0
      if (cerca) {
        const d = Math.sqrt(d2)
        // Encima de la mata, hacia donde camina; si no, lejos de él.
        let ux, uz
        if (d < 0.25) {
          const vv = Math.hypot(pr.vx, pr.vz)
          ux = vv > 0.3 ? pr.vx / vv : (s.dirX[i] || 1); uz = vv > 0.3 ? pr.vz / vv : s.dirZ[i]
        } else { ux = dx / d; uz = dz / d }
        const f = 1 - d / alcance
        const fuerza = Math.min(1.25, f * 1.7)
        tx = ux * fuerza; tz = uz * fuerza
        // Pisada: se queda aplastada un rato.
        if (d < s.alto[i] * 0.42) { s.aplasta[i] = PASTO.aplastaS; s.dirX[i] = ux; s.dirZ[i] = uz }
      }
      if (s.aplasta[i] > 0) {
        s.aplasta[i] -= dt
        const m = Math.hypot(tx, tz)
        if (m < 1.15) { tx = s.dirX[i] * 1.15; tz = s.dirZ[i] * 1.15 }
      }
      let bx = s.b[i * 2], bz = s.b[i * 2 + 1], vx = s.v[i * 2], vz = s.v[i * 2 + 1]
      for (let k = 0; k < sub; k++) {
        vx += (K * (tx - bx) - C * vx) * h
        vz += (K * (tz - bz) - C * vz) * h
        bx += vx * h
        bz += vz * h
      }
      s.b[i * 2] = bx; s.b[i * 2 + 1] = bz; s.v[i * 2] = vx; s.v[i * 2 + 1] = vz
      const quieta = !cerca && s.aplasta[i] <= 0 && bx * bx + bz * bz < 1e-6 && vx * vx + vz * vz < 1e-5
      if (quieta) { s.b[i * 2] = 0; s.b[i * 2 + 1] = 0; s.v[i * 2] = 0; s.v[i * 2 + 1] = 0 }
      s.despiertas[i] = quieta ? 0 : 1
      cambio = true
    }
    if (cambio) {
      const attr = recursos.geo.getAttribute('aDobla')
      attr.array.set(s.b)
      attr.needsUpdate = true
    }
  })

  return <mesh geometry={recursos.geo} material={recursos.mat} frustumCulled={false} />
}
