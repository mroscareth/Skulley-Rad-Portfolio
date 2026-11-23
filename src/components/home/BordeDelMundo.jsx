import React, { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { applyToonBanding } from '../../lib/toonBanding.js'
import { getRuneAtlas, RUNE_ATLAS_GLSL } from '../../lib/runeAtlas.js'
import { zonasPiso } from '../../lib/pisoPintado.js'

// El borde del mundo (Oscar, 2026-11-23): pasando el portal de SKULLEYGLYPH, el pasillo
// sin pinos seguía abierto hacia la niebla. Ahí lo cierran tres barricadas de calle
// cerrada, en la orilla de la plaza que se camina (Skulley choca con esa orilla, así
// que no hace falta nada sólido), y detrás se ve el código crudo: lo que M.A.D.R.E. no
// alcanzó a construir del claro. Runas de SKULLEYGLYPH que caen en columnas, como en
// Matrix, en verde, rodeando todo el bosque por fuera: se asoman entre los pinos y cada
// una se prende según qué tan cerca está de Skulley (desde el centro del claro no se ven). Sin fondo (Oscar: "como
// transparente, no una barda como si fuera una imagen"): solo las runas, que suman su
// luz a lo que hay detrás, en anillos a distintas distancias por fuera del bosque del
// glifo, que se desplazan distinto al moverte; hacia las puntas del arco caen cada vez
// menos columnas, hasta perderse. Cada runa escribe su profundidad (lo que no es runa se descarta), así la
// profundidad de campo la deja nítida de cerca. No se dice en ningún lado.
// Las barricadas van en el toon del bosque (franjas en el amarillo del sitio y negro,
// postes con conos naranjas que parpadean despacio, patas en A y bases de concreto),
// fundidas en un dibujo por material. Todo montado siempre: se compila con la escena.

const PLAZA = zonasPiso.plazaGlifo
const AMARILLO = '#f5ff00'

const BARRICADA = {
  radio: 17.3,              // desde el portal; la plaza se camina hasta 16.5
  angulos: [-21, 0, 21],    // grados alrededor del norte
  torcida: [0.07, -0.03, -0.06], // cada una un poco chueca (radianes)
  ancho: 5,
  tabla: 0.44,              // alto de cada tabla
  tablas: [1.05, 1.78],     // altura del centro de cada tabla
  poste: 2.2,
}

const CODIGO = {
  // El código rodea todo el bosque por fuera (Oscar: en los huecos entre los pinos se veía
  // el vacío): alrededor del claro (sus pinos llegan a 62), a los lados del camino (hasta
  // |x| 36) y alrededor del glifo (hasta 40), en dos capas a distintas distancias que se
  // desplazan distinto al moverte, y una cerca, en el hueco de la barricada. Los arcos
  // dejan libre el pasillo por donde se camina. `hacia` en grados: 0 al sur, 180 al norte.
  capas: [
    { tipo: 'arco', centro: PLAZA, radio: 22, hacia: 180, arco: 62, alto: 15, runa: 0.42, luz: 1 },
    { tipo: 'arco', centro: PLAZA, radio: 45, hacia: 180, arco: 220, alto: 24, runa: 0.6, luz: 0.85 },
    { tipo: 'arco', centro: PLAZA, radio: 53, hacia: 180, arco: 220, alto: 28, runa: 0.7, luz: 0.6 },
    { tipo: 'arco', centro: [0, 0], radio: 67, hacia: 0, arco: 290, alto: 26, runa: 0.65, luz: 0.85 },
    { tipo: 'arco', centro: [0, 0], radio: 75, hacia: 0, arco: 290, alto: 30, runa: 0.75, luz: 0.6 },
    { tipo: 'pared', x: 41, z: [-50, -106], alto: 24, runa: 0.6, luz: 0.85 },
    { tipo: 'pared', x: -41, z: [-50, -106], alto: 24, runa: 0.6, luz: 0.85 },
    { tipo: 'pared', x: 48, z: [-52, -108], alto: 28, runa: 0.7, luz: 0.6 },
    { tipo: 'pared', x: -48, z: [-52, -108], alto: 28, runa: 0.7, luz: 0.6 },
  ],
  // Cada runa se prende según qué tan cerca está de Skulley: completa hasta aquí y apagada
  // desde aquí. Caminando cerca de la orilla aparece entre los huecos; desde el centro del
  // claro, no.
  revela: [36, 64],
}

function texturaFranjas() {
  const c = document.createElement('canvas')
  c.width = 704
  c.height = 64
  const x = c.getContext('2d')
  x.fillStyle = '#141414'
  x.fillRect(0, 0, c.width, c.height)
  x.fillStyle = AMARILLO
  const paso = 96
  for (let i = -2; i < c.width / paso + 2; i++) {
    x.beginPath()
    x.moveTo(i * paso, 64)
    x.lineTo(i * paso + paso / 2, 64)
    x.lineTo(i * paso + paso / 2 + 64, 0)
    x.lineTo(i * paso + 64, 0)
    x.closePath()
    x.fill()
  }
  // Orilla oscura arriba y abajo, como el canto de la tabla.
  x.fillStyle = '#141414'
  x.fillRect(0, 0, c.width, 5)
  x.fillRect(0, c.height - 5, c.width, 5)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

function armarBarricadas() {
  const partes = { tabla: [], metal: [], cono: [], concreto: [] }
  const B = BARRICADA
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const pon = (lista, geo, x, y, z, rx = 0, ry = 0, rz = 0) => {
    geo.applyMatrix4(m.compose(new THREE.Vector3(x, y, z), q.setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1)))
    lista.push(geo)
  }
  B.angulos.forEach((grados, k) => {
    const una = { tabla: [], metal: [], cono: [], concreto: [] }
    const px = B.ancho / 2 - 0.3
    for (const y of B.tablas) pon(una.tabla, new THREE.BoxGeometry(B.ancho, B.tabla, 0.08), 0, y, 0)
    for (const s of [-1, 1]) {
      pon(una.metal, new THREE.CylinderGeometry(0.075, 0.075, B.poste, 10), s * px, B.poste / 2 + 0.12, 0.07)
      // El cono de arriba con su faja clara.
      pon(una.cono, new THREE.ConeGeometry(0.15, 0.38, 14), s * px, B.poste + 0.31, 0.07)
      pon(una.concreto, new THREE.CylinderGeometry(0.13, 0.13, 0.07, 14), s * px, B.poste + 0.16, 0.07)
      // Patas en A hacia adelante y hacia atrás, y la base de concreto.
      for (const lado of [-1, 1]) pon(una.metal, new THREE.BoxGeometry(0.07, 0.95, 0.07), s * px, 0.5, 0.07 + lado * 0.26, lado * 0.55, 0, 0)
      pon(una.concreto, new THREE.BoxGeometry(0.5, 0.26, 1.15), s * px, 0.13, 0.07)
    }
    // A su lugar en la orilla de la plaza, de frente al portal.
    const a = THREE.MathUtils.degToRad(grados)
    const cx = PLAZA[0] + Math.sin(a) * B.radio
    const cz = PLAZA[1] - Math.cos(a) * B.radio
    const giro = Math.atan2(PLAZA[0] - cx, PLAZA[1] - cz) + (B.torcida[k] || 0)
    const lugar = new THREE.Matrix4().compose(new THREE.Vector3(cx, 0, cz), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, giro, 0)), new THREE.Vector3(1, 1, 1))
    for (const nombre of Object.keys(una)) for (const g of una[nombre]) { g.applyMatrix4(lugar); partes[nombre].push(g) }
  })
  const out = {}
  for (const nombre of Object.keys(partes)) {
    // Sin índices en todas, para poder fundirlas (las de three vienen indexadas).
    out[nombre] = mergeGeometries(partes[nombre].map((g) => g.toNonIndexed()), false)
    partes[nombre].forEach((g) => g.dispose())
  }
  return out
}

function materialToon(params) {
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, ...params })
  applyToonBanding(mat, { steps: 3, minBand: 0.32, bandIndirect: true })
  return mat
}

const VERT_CODIGO = /* glsl */`
varying vec2 vUv;
varying vec3 vMundo;
void main() {
  vUv = uv;
  vMundo = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`
const FRAG_CODIGO = /* glsl */`
${RUNE_ATLAS_GLSL}
uniform float uTiempo;
uniform vec2 uJugador;
uniform vec2 uRevelaDist;
uniform vec2 uCeldas;
uniform float uSemilla;
uniform float uLuz;
varying vec2 vUv;
varying vec3 vMundo;
float azar(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  // Se prende cerca de Skulley (lo lejano ni se calcula).
  float revela = 1.0 - smoothstep(uRevelaDist.x, uRevelaDist.y, distance(vMundo.xz, uJugador));
  if (revela <= 0.001) discard;
  // Hacia los lados se apaga y se adelgaza (cada vez caen menos columnas, hasta quedar
  // sueltas): no hay orilla. También arriba y un poco abajo.
  float lado = abs(vUv.x - 0.5) * 2.0;
  float densidad = 1.0 - smoothstep(0.4, 1.0, lado);
  float orilla = mix(0.3, 1.0, densidad) * smoothstep(1.0, 0.5, vUv.y) * smoothstep(0.0, 0.05, vUv.y);
  if (orilla <= 0.001) discard;
  vec2 p = vec2(vUv.x, 1.0 - vUv.y) * uCeldas;   // fila 0 arriba
  vec2 celda = floor(p) + vec2(uSemilla * 131.0, 0.0);
  vec2 dentro = fract(p);
  // Los anillos se ven por dentro: ahí la runa saldría en espejo.
  if (!gl_FrontFacing) dentro.x = 1.0 - dentro.x;
  float col = celda.x;
  // La columna existe según qué tan al centro queda.
  if (azar(vec2(col, 7.7)) > densidad * 1.05 + 0.02) discard;
  // Cada columna cae a su ritmo, con su estela; algunas casi no se mueven.
  float vel = 3.0 + 9.0 * azar(vec2(col, 1.7));
  float largo = 7.0 + 14.0 * azar(vec2(col, 5.3));
  float ciclo = uCeldas.y + largo + 6.0 * azar(vec2(col, 9.1));
  float cabeza = mod(uTiempo * vel + azar(vec2(col, 3.3)) * ciclo, ciclo);
  float atras = cabeza - celda.y;
  float brillo = atras >= 0.0 && atras < largo ? 1.0 - atras / largo : 0.0;
  // Un poco de código quieto de fondo, muy tenue, para que no quede vacío.
  float fondo = step(0.72, azar(celda + floor(uTiempo * 0.5) * 0.37)) * 0.12;
  brillo = max(brillo, fondo);
  // La runa cambia de vez en cuando (la de la cabeza, más seguido).
  float cambio = floor(uTiempo * (atras < 1.0 ? 14.0 : 1.5 + 3.0 * azar(celda)));
  float runa = floor(azar(celda + cambio * 0.123) * 26.0);
  // La caja de 4 × 6 con un margen alrededor.
  vec2 g = (dentro - 0.5) * vec2(4.0, 6.0) * 1.35 + vec2(2.0, 3.0);
  float d = runeDist(runa, g);
  float aa = max(fwidth(d), 0.02);
  float tinta = 1.0 - smoothstep(-aa, aa, d - 0.12);
  float luz = tinta * brillo * orilla * revela * uLuz;
  // Lo que no es runa no se dibuja ni escribe profundidad.
  if (luz < 0.035) discard;
  vec3 verde = vec3(0.16, 1.0, 0.42);
  vec3 cabezaColor = vec3(0.85, 1.0, 0.9);
  vec3 col3 = mix(verde, cabezaColor, step(atras, 0.999) * step(0.0, atras)) * 2.2;
  gl_FragColor = vec4(col3, luz);
}
`

export default function BordeDelMundo({ playerRef }) {
  const recursos = useMemo(() => {
    const geos = armarBarricadas()
    const franjas = texturaFranjas()
    const mats = {
      tabla: materialToon({ map: franjas }),
      metal: materialToon({ color: '#9aa0a6', roughness: 0.6 }),
      cono: materialToon({ color: '#ff6a1a', emissive: '#ff5a00', emissiveIntensity: 0 }),
      concreto: materialToon({ color: '#c9c6bd', roughness: 0.95 }),
    }
    // Tiempo, Skulley y revelado compartidos; cada capa con su retícula, su semilla y su luz.
    const uniforms = {
      uRuneAtlas: { value: getRuneAtlas() },
      uTiempo: { value: 0 },
      uJugador: { value: new THREE.Vector2(0, 0) },
      uRevelaDist: { value: new THREE.Vector2(...CODIGO.revela) },
    }
    const capas = CODIGO.capas.map((c, i) => {
      const arco = c.tipo === 'arco' ? THREE.MathUtils.degToRad(c.arco) : 0
      const largo = c.tipo === 'arco' ? c.radio * arco : Math.abs(c.z[1] - c.z[0])
      const material = new THREE.ShaderMaterial({
        vertexShader: VERT_CODIGO,
        fragmentShader: FRAG_CODIGO,
        uniforms: {
          ...uniforms,
          uCeldas: { value: new THREE.Vector2(Math.round(largo / c.runa), Math.round(c.alto / (c.runa * 1.5))) },
          uSemilla: { value: i + 1 },
          uLuz: { value: c.luz },
        },
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: true,
        // Los arcos se ven por dentro; las paredes, de frente hacia el camino.
        side: c.tipo === 'arco' ? THREE.BackSide : THREE.FrontSide,
        fog: false,
      })
      if (c.tipo === 'arco') {
        // En three el ángulo 0 del cilindro mira a +z (el sur).
        const centro = THREE.MathUtils.degToRad(c.hacia)
        const geo = new THREE.CylinderGeometry(c.radio, c.radio, c.alto, Math.max(16, Math.round(c.arco / 3)), 1, true, centro - arco / 2, arco)
        return { c, material, geo, posicion: [c.centro[0], c.alto / 2, c.centro[1]], giro: 0 }
      }
      const geo = new THREE.PlaneGeometry(largo, c.alto)
      return { c, material, geo, posicion: [c.x, c.alto / 2, (c.z[0] + c.z[1]) / 2], giro: c.x > 0 ? -Math.PI / 2 : Math.PI / 2 }
    })
    return { geos, franjas, mats, uniforms, capas }
  }, [])

  useEffect(() => () => {
    Object.values(recursos.geos).forEach((g) => g.dispose())
    Object.values(recursos.mats).forEach((m) => m.dispose())
    recursos.franjas.dispose()
    recursos.capas.forEach((k) => { k.material.dispose(); k.geo.dispose() })
  }, [recursos])

  useEffect(() => {
    if (import.meta.env.DEV) window.__bordeDelMundo = { recursos, BARRICADA, CODIGO }
  }, [recursos])

  useFrame((state, delta) => {
    const u = recursos.uniforms
    u.uTiempo.value += Math.min(delta, 0.1)
    const p = playerRef?.current?.position
    if (p) u.uJugador.value.set(p.x, p.z)
    // Las luces de los conos parpadean despacio.
    const t = u.uTiempo.value
    recursos.mats.cono.emissiveIntensity = Math.sin(t * 3.2) > 0.2 ? 1.6 : 0.15
  })

  const { geos, mats } = recursos
  return (
    <group>
      <mesh geometry={geos.tabla} material={mats.tabla} />
      <mesh geometry={geos.metal} material={mats.metal} />
      <mesh geometry={geos.cono} material={mats.cono} />
      <mesh geometry={geos.concreto} material={mats.concreto} />
      {recursos.capas.map((k, i) => (
        <mesh key={i} geometry={k.geo} material={k.material} position={k.posicion} rotation={[0, k.giro, 0]} />
      ))}
    </group>
  )
}
