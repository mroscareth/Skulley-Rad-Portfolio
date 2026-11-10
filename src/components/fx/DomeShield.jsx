import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// El escudo del domo que guarda a las esferas (ORB_PHYS.DOME_RADIUS en
// orbPhysics.js). Es invisible: solo se enciende donde pega una esfera, con una onda
// que se abre desde el golpe (pedido de Oscar: "como un escudo tecnológico hecho de
// hexagonitos"). Siempre del mismo cristal, no del color de la esfera (Oscar).
//
// Acabado tipo liquid glass (Oscar: el esmerilado se veía demasiado opaco): cada
// celda es un lente casi transparente al centro, con borde de luz del lado
// iluminado, brillo que crece hacia la orilla, un reflejo en la esquina de luz y un
// filo cian/rosa muy leve. Sin refracción de verdad: el escudo vive en la orilla del
// domo y detrás solo hay piso liso, no se notaría, y pediría dibujar la escena otra
// vez en cada cuadro.
//
// Es UNA media esfera con UNA rejilla de hexágonos medida sobre su superficie
// (vuelta y altura en unidades del domo), y cada golpe solo enciende celdas de esa
// rejilla: dos golpes cercanos encienden las mismas celdas, así se lee como un solo
// domo. El tamaño de celda se ajusta para que la vuelta cierre sin costura.
//
// Las orillas se suavizan con su tamaño en pantalla y, si las celdas quedan chicas,
// el detalle se apaga: si no, a lo lejos las juntas se aplastaban en rayas.
//
// Sin golpes vivos no se rasteriza (uActive), pero sigue en la escena: así compila
// con todo lo demás al entrar y el primer golpe no traba la partida.

const MAX_HITS = 16
const HEX_TARGET = 1.1   // tamaño de celda deseado, en unidades del domo
const REACH = 5.5        // hasta dónde llega la onda de un golpe fuerte
const LIFE = 1.2         // segundos que dura un golpe

const VERTEX = `
  uniform float uActive;
  varying vec3 vWorld;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = uActive > 0.5 ? projectionMatrix * viewMatrix * w : vec4(2.0, 2.0, 2.0, 1.0);
  }
`

const FRAGMENT = `
  #define MAX_HITS ${MAX_HITS}
  uniform float uTime;
  uniform float uLife;
  uniform float uR;
  uniform float uHex;
  uniform float uCirc;
  uniform float uReach;
  uniform vec3 uCenter;
  uniform float uGround;
  uniform vec4 uHits[MAX_HITS];    // vuelta, altura (en unidades del domo), inicio, fuerza
  uniform vec3 uTint;
  varying vec3 vWorld;

  float hexDist(vec2 p) {
    p = abs(p);
    return max(dot(p, vec2(0.5, 0.8660254)), p.x);
  }
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  void main() {
    if (vWorld.y < uGround) discard;
    vec3 p = vWorld - uCenter;
    vec2 g = vec2(atan(p.z, p.x) * uR, asin(clamp(p.y / uR, -1.0, 1.0)) * uR);

    vec2 uv = g / uHex;
    vec2 rep = vec2(1.0, 1.7320508);
    vec2 a = mod(uv, rep) - rep * 0.5;
    vec2 b = mod(uv - rep * 0.5, rep) - rep * 0.5;
    vec2 gv = dot(a, a) < dot(b, b) ? a : b;
    vec2 id = uv - gv;
    vec2 cell = id * uHex;

    float on = 0.0;
    float flash = 0.0;
    float membrane = 0.0;
    for (int i = 0; i < MAX_HITS; i++) {
      vec4 h = uHits[i];
      float age = uTime - h.z;
      if (age < 0.0 || age > uLife) continue;
      vec2 d = cell - h.xy;
      d.x = mod(d.x + uCirc * 0.5, uCirc) - uCirc * 0.5;
      float cellR = length(d);
      float reach = uReach * mix(0.55, 1.0, h.w);
      if (cellR > reach) continue;
      // La celda se enciende cuando le llega la onda y se apaga sola, en desorden.
      float tOn = (cellR / uReach) * uLife * 0.32;
      float tOff = uLife * (0.5 + 0.48 * hash(id + h.z * 13.0));
      if (age < tOn || age > tOff) continue;
      float w = mix(0.6, 1.0, h.w) * (1.0 - smoothstep(reach - uHex, reach, cellR) * 0.4);
      on = max(on, w);
      flash = max(flash, (1.0 - smoothstep(0.0, 0.16, age - tOn)) * h.w);
      membrane = 1.0;
    }
    if (membrane < 0.5) discard;

    // Orillas con antialias según el tamaño en pantalla; si la celda queda chica,
    // se apaga el detalle y queda el cristal liso.
    float edge = 0.5 - hexDist(gv);
    // Cuánto mide un pixel en celdas. De la posición en el mundo, que es continua:
    // la rejilla salta en cada junta y en la costura de la vuelta.
    float fw = max(length(fwidth(vWorld)) / uHex * 0.7, 0.0001);
    float detail = 1.0 - smoothstep(0.06, 0.16, fw);
    float gapW = 0.03;
    float inside = mix(1.0, smoothstep(gapW - fw, gapW + fw, edge), detail);
    // 0 en la orilla de la celda, 1 en su centro.
    float e = clamp((edge - gapW) / (0.5 - gapW), 0.0, 1.0);
    // De qué lado de la celda está este punto respecto a la luz (arriba a la izquierda).
    float facing = dot(normalize(gv + 0.0001), vec2(-0.5446, 0.8387));
    float lit = smoothstep(-0.3, 0.8, facing);

    // Borde de luz, delgado y nítido, más fuerte del lado iluminado.
    float rimW = max(0.1, fw * 3.0);
    float rim = (1.0 - smoothstep(0.0, rimW, e)) * mix(0.3, 1.0, lit);
    // Brillo que crece hacia la orilla: el centro queda casi transparente.
    float glow = pow(1.0 - e, 3.0);
    // El reflejo del lente, en la esquina de luz.
    float spec = smoothstep(0.7, 0.98, facing) * smoothstep(0.08, 0.2, e) * (1.0 - smoothstep(0.2, 0.42, e));

    // Filo cian de un lado y rosa del otro, apenas: la dispersión del cristal.
    vec3 fringe = mix(vec3(0.72, 0.95, 1.0), vec3(1.0, 0.82, 0.98), smoothstep(-0.7, 0.7, facing));
    vec3 c = mix(uTint, fringe, clamp(glow * 0.9, 0.0, 1.0));
    c = mix(c, vec3(1.0), clamp(rim * 0.8 + spec, 0.0, 1.0)) * (1.0 + rim * 0.35 + spec * 0.3);

    float sharp = (0.04 + glow * 0.28 + rim * 0.85 + spec * 0.7) * detail;
    float alpha = (sharp + (1.0 - detail) * 0.1 + flash * 0.18) * inside * on;
    gl_FragColor = vec4(c, clamp(alpha, 0.0, 0.95));
  }
`

const DomeShield = forwardRef(function DomeShield({ radius, groundY = 0 }, ref) {
  const stateRef = useRef({ next: 0, time: 0, lastHit: -1e9 })

  const circ = 2 * Math.PI * radius
  const hex = circ / Math.max(1, Math.round(circ / HEX_TARGET))

  const geo = useMemo(() => new THREE.SphereGeometry(radius, 128, 32, 0, Math.PI * 2, 0, Math.PI / 2), [radius])
  const mat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uActive: { value: 0 },
      uTime: { value: 0 },
      uLife: { value: LIFE },
      uR: { value: radius },
      uHex: { value: hex },
      uCirc: { value: circ },
      uReach: { value: REACH },
      uCenter: { value: new THREE.Vector3(0, groundY, 0) },
      uGround: { value: groundY + 0.01 },
      uHits: { value: Array.from({ length: MAX_HITS }, () => new THREE.Vector4(0, 0, -1000, 0)) },
      // Cristal frío, un pelo azulado como el piso, igual en cada golpe.
      uTint: { value: new THREE.Color('#e9edff') },
    },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  }), [radius, groundY, hex, circ])

  useEffect(() => () => {
    try {
      geo.dispose()
      mat.dispose()
    } catch { }
  }, [geo, mat])

  useImperativeHandle(ref, () => ({
    // `at` es donde va la esfera; se enciende el punto del domo en esa dirección.
    hit(at, strength = 1) {
      if (!at) return
      const dx = at.x
      const dy = at.y - groundY
      const dz = at.z
      const len = Math.hypot(dx, dy, dz)
      if (len < 1e-6) return
      const s = stateRef.current
      const i = s.next
      s.next = (s.next + 1) % MAX_HITS
      const along = Math.atan2(dz, dx) * radius
      const up = Math.asin(THREE.MathUtils.clamp(dy / len, -1, 1)) * radius
      mat.uniforms.uHits.value[i].set(along, up, s.time, THREE.MathUtils.clamp(strength, 0, 1))
      s.lastHit = s.time
      mat.uniforms.uActive.value = 1
    },
  }), [mat, radius, groundY])

  useFrame((_, delta) => {
    const s = stateRef.current
    s.time += Math.min(0.1, Math.max(0, delta || 0))
    mat.uniforms.uTime.value = s.time
    if (mat.uniforms.uActive.value && s.time - s.lastHit > LIFE) mat.uniforms.uActive.value = 0
  })

  return (
    <mesh
      geometry={geo}
      material={mat}
      position={[0, groundY, 0]}
      frustumCulled={false}
      renderOrder={3}
      raycast={() => null}
    />
  )
})

export default DomeShield
