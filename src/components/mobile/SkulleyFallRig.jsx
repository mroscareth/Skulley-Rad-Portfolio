import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF, useAnimations } from '@react-three/drei'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'
import * as THREE from 'three'
import { EffectComposer, DotScreen } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import { extendGLTFLoaderKTX2, detectKTX2Support } from '../../lib/ktx2Setup.js'
import { applyToonBanding } from '../../lib/toonBanding.js'
import { applyCharacterColorsToScene, CHARACTER_COLOR_EVENT } from '../../lib/characterColors.js'
import { posterNormalTexture } from '../../lib/toonInkBuffer.js'
import { bakeCharacterPieces } from '../../lib/characterPieces.js'
import { playSfx } from '../../lib/sfx.js'
import CharacterNormalPass from '../fx/CharacterNormalPass.jsx'
import EdgeInkEffect from '../fx/EdgeInkEffect.jsx'
import SilhouetteShadow from '../SilhouetteShadow.jsx'
import { makeGeometrySet, boltCoreAlpha } from '../fx/LightningBolt.jsx'

// La caída: Skulley gira, le cae un rayo, se desarma y sus huesos aterrizan
// en el pie de página.
//
// Es el easter egg del rayo de escritorio (Player.jsx: el rayo pega, suena el
// trueno, flash en pantalla y en el pico se desarma) contado con el scroll: el
// rayo se DIBUJA conforme bajas, y cuando toca la cabeza es el impacto lo que
// lo parte. Liga las dos versiones del sitio.
//
// El motor es UN número —el progreso del scroll, 0 a 1— que llega por un ref y
// se lee en useFrame. Nunca por estado de React: a 60 fps eso remonta el árbol
// entero (misma razón que `setDiscRotation` en MusicPlayer).
//
// Cámara ORTOGRÁFICA, como el cartel y el preloader: el encuadre es una sola
// variable (el zoom) y el personaje se lee plano y gráfico, que es el lenguaje
// del sitio.

// Tramos del scroll.
//   0 ............ GIRO_START : primer plano quieto, el título encima.
//   GIRO_START ... HIT        : se abre el plano y da una vuelta completa.
//   DRAW_START ... HIT        : mientras gira, el rayo se dibuja de arriba abajo.
//   HIT                       : toca la cabeza — flash, trueno, se parte.
//   HIT .......... LAND       : cae.
//   LAND ......... 1          : ya está en el piso, en el footer.
//
// El rayo (DRAW_START y HIT) lo pone la home midiendo el DOM (timingRef): se
// dibuja y pega en la pantalla vacía que sigue a "Fuera de bromas", sin texto
// encima que lo tape. Estos son los valores si no llega la medida.
const GIRO_START = 0.06
const DRAW_START_BASE = 0.10
const HIT_BASE = 0.28
const LAND = 0.93

function tiemposRayo(timingRef) {
  const t = timingRef?.current
  return {
    HIT: Number.isFinite(t?.hit) ? t.hit : HIT_BASE,
    DRAW_START: Number.isFinite(t?.draw) ? t.draw : DRAW_START_BASE,
    FIN: Number.isFinite(t?.fin) ? t.fin : null,
  }
}

// El progreso de la HISTORIA no es el del scroll. Al final de la home el pie
// se queda quieto un tramo largo (.msh-fin); ese tramo entero, de FIN a 1, es
// el final de la historia (de P_FIN a 1): la cabeza abre la boca, brinca, cae
// de lado y el ojo rueda. Todo lo de antes se reparte en lo de antes. Así las
// constantes de los tramos (LAND, LADO_*, OJO_PARA) siguen siendo las mismas.
const P_FIN = 0.935
// Qué tanto del hueco libre del pie puede ocupar la cabeza (con su brinco).
const HUECO_LLENO = 0.85
function historia(s, fin) {
  if (fin == null || fin <= 0 || fin >= 1) return s
  return s < fin ? (s / fin) * P_FIN : P_FIN + ((s - fin) / (1 - fin)) * (1 - P_FIN)
}

// Física de la caída, en segundos simulados y metros. El personaje mide ~1.7,
// así que con la gravedad real los arcos se ven naturales; todos los huesos
// caen con la MISMA. El scroll recorre este tiempo: T se calcula al hornear
// para que el último hueso toque piso en LAND.
const G = 9.81
// Lo que tarda el golpe en bajar de la cabeza al hueso más lejano. Corto a
// propósito: el desarme entra por la cabeza pero tiene que leerse como UN
// golpe, brusco, no como una cascada.
const ONDA_S = 0.12
// Los primeros segundos del estallido corren por TIEMPO, como el flash: el
// rayo parte al personaje de golpe aunque dejes de scrollear justo ahí. Lo
// que sigue de la caída ya va con el scroll. Dura lo que tarda una pieza en
// llegar a lo más alto del salto: el brinco entero se ve con el trueno.
const GOLPE_S = 0.3
// Lo que tarda en rearmarse ese mismo tramo al regresar arriba del impacto:
// un poco más lento que el golpe, para que se vea cómo vuelve cada pieza.
const REARME_S = 0.5
// El estallido sale de la cabeza, que es donde pega el rayo: cada hueso sale
// disparado ALEJÁNDOSE de ella, más fuerte mientras más cerca estaba, y los
// chicos más que los grandes (una mano vuela, la pelvis apenas se mueve).
// Lejos del golpe, las piernas casi solo se desploman. En m/s; los MIN son
// para el hueso más lejano (los pies) y los otros junto a la cabeza.
//
// Historia (2026-10-30): Oscar pidió que brincaran más. Primero subí el salto
// a TODOS por igual (2.4–4.4 hacia arriba) y se veía falso: el cuerpo entero
// flotaba en vez de reventar, y como la cámara encuadraba lo que volaba,
// parecía que solo se alejaba. Ahora la fuerza depende de dónde pegó y la
// cámara NO cambia el zoom después del impacto (pedido de Oscar): el empuje
// de lado se recorta al hornear para que el montón quepa en el cuadro.
// Hacia arriba, TODOS brincan (Oscar: "que los pedacitos suban más"): de
// ~13 cm los pies a ~50 cm junto a la cabeza, y las piezas chicas un poco
// más (tope 1.2×, para que nada salga del cuadro por arriba).
const ESTALLIDO_LADO = 1.3
const ESTALLIDO_LADO_MIN = 0.3
const ESTALLIDO_ARRIBA = 3.2
const ESTALLIDO_ARRIBA_MIN = 1.6
const ARRIBA_CHICA_MAX = 1.2
const SALTO_CRANEO = 3.0
// Cómo se reparten las piezas de los lados (las que no están justo debajo de
// la cabeza: más "abiertas" que LADO_ABIERTO). VUELAN de ellas salen volando
// del cuadro, de VUELO_MIN a VUELO_MAX m/s de lado; ORILLA caen en la orilla
// del cuadro; el resto, al montón del centro. Oscar pidió que salieran más y
// que el montón no quedara tan denso (2026-10-30): ahora entran todas, también
// las de justo debajo de la cabeza, y en el centro queda ~¼ con ella.
const LADO_ABIERTO = 0
const VUELAN = 0.5
const ORILLA = 0.25
const VUELO_MIN = 2.2
const VUELO_MAX = 3.4
// Lo que se ve de alto (en altos del personaje) con el plano abierto: antes
// del impacto y durante toda la caída. Solo el final se acerca a la cabeza.
const PLANO = 1.6
// Qué tanto del ancho del cuadro puede ocupar el montón (el resto es aire).
const MONTON_ANCHO = 0.86
// Restitución del rebote de la cabeza: menos que los huesos, para que frene
// con peso y se quede viendo a cámara.
const REBOTE = 0.42
// Los demás huesos rebotan más y cada uno distinto (entre 0.70 y 0.82). Sin
// rebote se clavaban en el piso en seco; con el mismo para todos el montón
// saltaría al unísono. La altura de un rebote va con el CUADRADO de esto.
// Oscar pidió más rebote dos veces: con 0.42–0.58 se veían poco, y con
// 0.58–0.72 (primer bote de ~45 cm) le siguió faltando; con este y el salto
// de arriba el primer bote anda en ~80 cm.
const REBOTE_HUESO_MIN = 0.70
const REBOTE_HUESO_VAR = 0.12
// Cuántos botes como mucho, y cuánto más se apagan después del primero
// (COLA multiplica la restitución del segundo en adelante). La caída entera se
// reparte en el mismo tramo de scroll: con 5 botes y el primero alto, duraba
// ~4.7 s simulados y cada píxel adelantaba 1.5× más que antes; después de
// Proyectos se sentía rápido y violento (Oscar, 2026-10-30). Así el primer
// bote queda igual de alto y la caída vuelve a ~3.1 s.
const REBOTES_MAX = 3
const COLA = 0.8
// Mientras rebota, cada hueso sigue avanzando y girando, pero frenado: lo que
// le queda de velocidad horizontal y de giro, como fracción de la del vuelo.
const DESLIZ = 0.45
const GIRO_REBOTE = 0.3

// El último scroll: la cabeza, ya quieta de frente, abre la mandíbula; la
// mandíbula se apoya en el piso, levanta el cráneo y lo empuja de lado hasta
// que se vence y cae acostada. Antes se iba de lado sola, sin nada que la
// moviera, y no se creía (Oscar, 2026-10-30). Arranca después de LAND (cuando
// ya nada rebota) y termina antes del fondo, que en iOS cuesta alcanzar exacto.
const LADO_START = 0.94
const LADO_END = 0.99
// Qué parte del tramo es el empujón (abrir la mandíbula); el resto, la caída.
const EMPUJE = 0.4
// Hasta dónde la inclina el empujón (~12°): el punto donde se vence.
const INCLINA = 0.22
// Cuánto se regresa (radianes, ~10°) al pegar de lado en el piso.
const LADO_REBOTE = 0.18
// La boca se abre por los dos lados: la mandíbula baja (~17°, un poco chueca,
// ~7°, baja más su lado izquierdo, que es el que levanta el cráneo hacia la
// derecha) y el cráneo se echa para atrás (~20°) girando sobre la bisagra.
// Con solo la mandíbula moviéndose contra el piso no se percibía (Oscar,
// 2026-10-30). Se abre de golpe y se pasa un poco antes de asentarse
// (MANDIBULA_GOLPE: en qué parte del empujón termina de abrirse).
const MANDIBULA_ABRE = 0.3
const MANDIBULA_SESGO = 0.12
const MANDIBULA_GOLPE = 0.3
const CRANEO_ATRAS = 0.35
// El brinco: al azotar el piso, la mandíbula avienta el cráneo hacia arriba
// (SALTO_FINAL × el alto de la cabeza) y en el aire se inclina; cae sobre su
// orilla y de ahí se vence. Sin el brinco la apertura no se percibía (Oscar,
// 2026-10-30; luego lo pidió más alto dos veces: 0.22, 0.5). Va entre
// SALTO_DESDE y SALTO_HASTA del empujón. Sube hasta donde después entra el
// título: mientras brinca, el pie todavía no aparece.
const SALTO_FINAL = 0.85
// Las chispas de lo más alto del brinco: cuántas, qué tan rápido salen
// (m/s), cuánto viven (s) y de qué tamaño se ven (px de pantalla; el
// resplandor de abajo, BRILLO_PX). Nacen detrás de la cabeza y salen en
// abanico en el plano de la pantalla. La primera versión (70 de 9 px, desde
// el centro de la cabeza y encima de ella): "las peores chispas", dijo Oscar.
const CHISPAS_N = 90
const CHISPAS_VEL = [1.8, 4.6]
const CHISPAS_VIDA = [0.7, 1.4]
// Un intermedio (Oscar): 9 px se perdían y 18 / 46 eran demasiado.
const CHISPAS_PX = 13
const BRILLO_PX = 30
const BRILLO = 0.35
// Solo blancas (Oscar; primero eran del rayo: blanco, cian y amarillo).
const CHISPAS_COLORES = [new THREE.Color('#ffffff')]

// Un punto suave: centro blanco que se apaga hacia la orilla. Una sola
// textura para todas las chispas.
let texturaChispaCache = null
function texturaChispa() {
  if (texturaChispaCache) return texturaChispaCache
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.25, 'rgba(255,255,255,0.9)')
  g.addColorStop(0.6, 'rgba(255,255,255,0.25)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 64, 64)
  texturaChispaCache = new THREE.CanvasTexture(c)
  return texturaChispaCache
}
const SALTO_DESDE = 0.15
const SALTO_HASTA = 1
// En qué punto de la caída (0–1) pega de lado en el piso.
const PEGA = 0.72
// El ojo de abajo se zafa con el golpe y rueda (Oscar, 2026-10-30): del
// momento en que la cabeza pega en el piso hasta OJO_PARA del scroll. Primero
// sale de la cuenca hacia el frente y cae al piso (la fracción OJO_SALE de su
// tramo); luego rueda OJO_RUEDA metros, frenándose, hacia la derecha y un poco
// hacia la cámara, por delante de la cara.
const OJO_PARA = 0.998
const OJO_SALE = 0.22
const OJO_RUEDA = 0.24
const OJO_DIR = new THREE.Vector3(1, 0, 0.45).normalize()
const OJO_EJE = new THREE.Vector3(0, 1, 0).cross(OJO_DIR).normalize()
const P_PEGA = LADO_START + (EMPUJE + (1 - EMPUJE) * PEGA) * (LADO_END - LADO_START)

// Ángulo de la caída de lado en u ∈ [0, 1], hasta `final`: el ángulo en que
// el lado del cráneo toca el piso (lo calcula el horneado). El brinco es lo
// que la tira: el golpe chueco de la mandíbula le da un giro que en el aire
// es parejo (velocidad constante). Cae sobre la esquina de la mandíbula con
// ese mismo giro, sin frenar; la gravedad la acelera hasta que el cráneo pega
// en el piso, y rebota una vez.
function anguloDeLado(u, final = Math.PI / 2) {
  if (u <= 0) return 0
  if (u < EMPUJE) return INCLINA * clamp01((u / EMPUJE - SALTO_DESDE) / (SALTO_HASTA - SALTO_DESDE))
  const v = (u - EMPUJE) / (1 - EMPUJE)
  if (v < PEGA) return INCLINA + GIRO_AIRE * v + Math.max(0, (final - INCLINA - GIRO_AIRE * PEGA) / (PEGA * PEGA)) * v * v
  return final - LADO_REBOTE * Math.sin(Math.PI * Math.min(1, (v - PEGA) / (1 - PEGA)))
}

// Cómo se acuesta la cabeza sin quedar en un punto redondo, que no se
// sostendría (Oscar, 2026-10-30): se ladea sobre la esquina de abajo de la
// mandíbula hasta que el lado del cráneo también toca el piso, y ahí se queda,
// apoyada en los dos. Con los vértices reales (cada 3) de las dos mallas, en
// coordenadas de la pieza de la cabeza: para cada ángulo, qué tan abajo queda
// lo más bajo de cada una al girar hacia la derecha. Devuelve ese ángulo y
// el punto de la mandíbula sobre el que gira.
function apoyoDeLado(mandibula, craneo) {
  const muestras = (m) => {
    const pos = m.geometry.getAttribute('position')
    const out = []
    for (let i = 0; i < pos.count; i += 3) out.push(pos.getX(i), pos.getY(i))
    return out
  }
  const mj = muestras(mandibula)
  const mc = muestras(craneo)
  const masBajo = (pts, c, s) => {
    let min = Infinity
    let at = 0
    for (let i = 0; i < pts.length; i += 2) {
      const y = -pts[i] * s + pts[i + 1] * c
      if (y < min) { min = y; at = i }
    }
    return { y: min, x: pts[at], yl: pts[at + 1] }
  }
  let final = Math.PI / 2
  for (let a = 0.05; a <= Math.PI / 2; a += 0.01) {
    const c = Math.cos(a)
    const s = Math.sin(a)
    if (masBajo(mc, c, s).y <= masBajo(mj, c, s).y) { final = a; break }
  }
  const j = masBajo(mj, Math.cos(final), Math.sin(final))
  return { final, pivote: new THREE.Vector2(j.x, j.yl) }
}

// Cuándo se cierra la mandíbula (en u): en la bajada del brinco, de lo más
// alto a que toca el piso. Abrir la boca lo avienta, y ya cayendo la va
// cerrando (Oscar, 2026-10-30): llega cerrada y de ahí se va de lado.
const CIERRA_DESDE = EMPUJE * (SALTO_DESDE + SALTO_HASTA) / 2
const CIERRA_HASTA = EMPUJE * SALTO_HASTA
const U_PEGA = EMPUJE + (1 - EMPUJE) * PEGA
// El giro del aire (radianes por unidad de la caída de lado): con el que
// aterriza y sigue, para que no frene al tocar el piso.
const GIRO_AIRE = (INCLINA / ((SALTO_HASTA - SALTO_DESDE) * EMPUJE)) * (1 - EMPUJE)

// Qué tan abierta va la mandíbula (0–1) en u: se abre de golpe durante el
// empujón, se cierra al empezar a caer y el golpe contra el piso la abre
// apenas y se vuelve a cerrar: el "clac".
function aperturaMandibula(u) {
  if (u <= 0) return 0
  if (u < CIERRA_DESDE) {
    // easeOutBack: llega rápido, se pasa ~10 % y se asienta.
    const x = clamp01(u / EMPUJE / MANDIBULA_GOLPE) - 1
    return 1 + 2.70158 * x * x * x + 1.70158 * x * x
  }
  if (u < CIERRA_HASTA) return 1 - suave((u - CIERRA_DESDE) / (CIERRA_HASTA - CIERRA_DESDE))
  if (u < U_PEGA) return 0
  return 0.1 * Math.sin(Math.PI * clamp01((u - U_PEGA) / (1 - U_PEGA) / 0.6))
}

// Altura del brinco (fracción de SALTO_FINAL, 0–1) en u: una parábola, como
// cualquier salto, dentro del empujón.
function saltoFinal(u) {
  const x = (u / EMPUJE - SALTO_DESDE) / (SALTO_HASTA - SALTO_DESDE)
  return x > 0 && x < 1 ? 4 * x * (1 - x) : 0
}

// Los botes de una pieza: cada uno sale con la velocidad del anterior por la
// restitución, hasta REBOTES_MAX o hasta que ya no se vería (< 4 cm/s).
function rebotesDesde(vImpacto, e, g) {
  const out = []
  let v = vImpacto * e
  for (let k = 0; k < REBOTES_MAX && v > 0.04; k++) {
    out.push({ v, t: (2 * v) / g })
    v *= e * COLA
  }
  return out
}
const duracion = (rebotes) => rebotes.reduce((a, r) => a + r.t, 0)
// Inclinación de la cámara al abrir el plano. Mirando perfectamente de frente
// el piso queda de canto y la sombra no existe en pantalla; 16° bastan para
// verla sin que el personaje se lea desde arriba. En el primer plano es 0.
const PITCH = (16 * Math.PI) / 180

// Contraluz frío de un lado, igual que el cartel: recorta la silueta contra el
// color plano del fondo, que acá cambia por sección.
const RIM_LIGHT = {
  rimStrength: 1.9,
  rimColor: [0.22, 0.78, 1.0],
  rimThreshold: 0.54,
  rimWidth: 0.07,
  rimDirection: [-0.75, 0.4, -0.55],
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)
const tmpQuat = new THREE.Quaternion()
const tmpVec = new THREE.Vector3()
const tmpVec2 = new THREE.Vector3()
const EJE_X = new THREE.Vector3(1, 0, 0)
const lerp = (a, b, t) => a + (b - a) * t
const ramp = (v, a, b) => clamp01((v - a) / Math.max(1e-6, b - a))
// Suaviza las puntas: sin esto el giro arranca y frena de golpe.
const suave = (t) => t * t * (3 - 2 * t)

// Aleatorio estable por índice de pieza. Nada de Math.random: el scroll va y
// viene, así que la caída tiene que ser IDÉNTICA cada vez que pasas por el
// mismo punto, o subir y bajar da dos desarmes distintos.
function hash(i, salt) {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453
  return x - Math.floor(x)
}

function FallingSkulley({ progressRef, timingRef, fitRef, onMedido }) {
  const { gl, size, scene: escena } = useThree()
  const liveRef = useRef(null)     // el personaje entero, con su idle
  const piecesRef = useRef(null)   // grupo de huesos rígidos
  const bakedRef = useRef(null)
  const cabezaRef = useRef(null)   // la pieza 'head' con sus datos de vuelo
  const rigRef = useRef(null)
  const sim = useRef({ T: 0, g: G })
  const fit = fitRef

  useEffect(() => { detectKTX2Support(gl) }, [gl])

  const { scene, animations } = useGLTF(
    `${import.meta.env.BASE_URL}character.glb`,
    true,
    true,
    extendGLTFLoaderKTX2,
  )

  const cloned = useMemo(() => {
    const clone = SkeletonUtils.clone(scene)

    // El GLB viene del caché compartido y puede traer los outline meshes que
    // inyecta Player.jsx. Acá estorban (BackSide negro).
    const toRemove = []
    clone.traverse((obj) => {
      const mat = Array.isArray(obj?.material) ? obj.material[0] : obj?.material
      const esOutline = (obj?.name && obj.name.endsWith('_outline'))
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

    clone.traverse((obj) => {
      if (!obj.isMesh && !obj.isSkinnedMesh) return
      // Sin frustum culling. El volumen de culling de una SkinnedMesh no sigue
      // a los huesos: sale de la pose de reposo. Con este encuadre tan cerrado
      // y el personaje girando, la mano podía caer "fuera" según ese volumen
      // aunque estuviera en pantalla, y three la dejaba de dibujar — se veía
      // el antebrazo con la muñeca hueca. Es un solo personaje en pantalla:
      // no hay nada que ahorrar descartándolo.
      obj.frustumCulled = false
      const src = Array.isArray(obj.material) ? obj.material : [obj.material]
      const out = src.map((m) => {
        if (!m?.clone) return m
        const mm = m.clone()
        try {
          mm.envMapIntensity = 0.5
          // Pupilas planas: el GLB las trae espejo (roughness 0).
          if (/pupil/i.test(mm.name || '')) {
            return new THREE.MeshBasicMaterial({ color: 0x000000, toneMapped: false, name: mm.name })
          }
          const withRim = /^(head|hair)$/i.test(mm.name || '')
          applyToonBanding(mm, { steps: 2, minBand: 0.04, bandIndirect: true, ...(withRim ? RIM_LIGHT : {}) })
        } catch { }
        return mm
      })
      obj.material = Array.isArray(obj.material) ? out : out[0]
    })
    return clone
  }, [scene])

  const { actions, mixer } = useAnimations(animations, liveRef)
  const idleRef = useRef(null)
  useEffect(() => {
    if (!actions) return
    const names = Object.keys(actions)
    // 'root|root|Iddle' con doble d, tal cual viene del GLB.
    const idleName = names.includes('root|root|Iddle')
      ? 'root|root|Iddle'
      : (names.find((n) => n.toLowerCase().includes('idle')) || names[0])
    const idle = idleName && actions[idleName]
    if (idle) { idle.reset().fadeIn(0.4).play(); idle.timeScale = 1.35 }
    idleRef.current = idle || null
    return () => { try { idle?.fadeOut(0.2) } catch { } }
  }, [actions])

  useEffect(() => {
    if (!cloned) return
    const apply = (detail) => { try { applyCharacterColorsToScene(cloned, detail) } catch { } }
    apply()
    const onChange = (e) => apply(e?.detail)
    window.addEventListener(CHARACTER_COLOR_EVENT, onChange)
    return () => window.removeEventListener(CHARACTER_COLOR_EVENT, onChange)
  }, [cloned])

  // Medidas reales del modelo. El encuadre sale del alto del personaje, no de
  // números a mano: si alguien reexporta el GLB con otra escala, sigue bien.
  // Viven en un ref que comparte con el rayo y la sombra.
  useEffect(() => {
    if (!cloned) return
    const id = requestAnimationFrame(() => {
      try {
        cloned.updateMatrixWorld(true)
        const box = new THREE.Box3().setFromObject(cloned)
        const alto = Math.max(0.2, box.max.y - box.min.y)
        fit.current = {
          // Mira más abajo de la coronilla de lo que parecería: así el
          // personaje sube en el cuadro y los ojos entran completos. Con el
          // punto más arriba, el primer plano se iba al mohawk y los ojos
          // quedaban pegados al borde de abajo.
          // 0.29 (antes 0.22): Oscar pidió los ojos más arriba en el primer
          // encuadre; quedaban a ~72 % del alto y ahora a ~55 %.
          headY: box.max.y - alto * 0.29,
          midY: (box.max.y + box.min.y) / 2,
          alto,
          // Donde se apoyan los pies: ahí va la sombra.
          piso: box.min.y,
          // El piso de las piezas, justo encima: los huesos se amontonan a la
          // altura donde el personaje estaba parado, no en un sótano.
          suelo: box.min.y + alto * 0.02,
          // La punta del mohawk: ahí pega el rayo.
          top: box.max.y,
          ready: true,
        }
        onMedido?.(fit.current)
      } catch { }
    })
    return () => cancelAnimationFrame(id)
  }, [cloned, fit, onMedido])

  // El horneado NO se hace al montar: se hace en el instante del impacto, con
  // la pose que el usuario está viendo. Hornear al montar parecía más barato,
  // pero el idle sigue respirando después y al cambiar de personaje entero a
  // piezas el cuerpo saltaba a una pose de hace rato: se veía como si fueran
  // dos personajes. Es lo que hace el desarme de escritorio, que hornea al
  // dispararse.
  //
  // Va en dos pasos: congelar el mixer un frame, hornear al siguiente. Así los
  // huesos que se hornean son los mismos que se acaban de dibujar.
  const prep = useRef({ frozen: false, baked: false })

  const congelar = useCallback(() => {
    if (prep.current.frozen) return
    // El idle entra con un fundido de 0.4 s: recién montado (al regresar de un
    // capítulo ya pasado el rayo) todavía pesa cero y el modelo está en su
    // pose T, que es la que se horneaba (Oscar, 2026-10-30). Antes de congelar
    // se pone la pose de reposo completa y se aplica a los huesos.
    try {
      const idle = idleRef.current
      if (idle && idle.getEffectiveWeight() < 0.999) {
        idle.stopFading()
        idle.setEffectiveWeight(1)
        mixer?.update(0)
      }
    } catch { }
    try { if (mixer) mixer.timeScale = 0 } catch { }
    prep.current.frozen = true
  }, [mixer])

  // Tira las piezas horneadas. Solo la geometría es suya: los materiales son
  // los del personaje entero y se siguen usando.
  const tirarPiezas = useCallback(() => {
    const prev = bakedRef.current
    if (prev && piecesRef.current) {
      for (const pz of prev) {
        piecesRef.current.remove(pz.group)
        pz.group.traverse((o) => { try { o.geometry?.dispose?.() } catch { } })
        if (pz.ojo) {
          piecesRef.current.remove(pz.ojo.grupo)
          pz.ojo.grupo.traverse((o) => { try { o.geometry?.dispose?.() } catch { } })
        }
      }
    }
    bakedRef.current = null
    cabezaRef.current = null
    sim.current = { T: 0, g: G }
  }, [])

  const hornear = useCallback(() => {
    if (prep.current.baked || !cloned || !piecesRef.current) return
    prep.current.baked = true
    try {
      const pieces = bakeCharacterPieces(cloned)
      if (!pieces.length) return

      const { alto, suelo } = fit.current
      const esc = Math.max(0.2, alto) / 1.7
      const g = G * esc

      // 'head' junta cráneo, mandíbula, dientes, ojos, párpados, cejas y pelo
      // (ver limbOf en characterPieces.js). Si no saliera, la más alta.
      let cabeza = pieces.find((p) => p.id === 'head') || null
      if (!cabeza) for (const p of pieces) if (!cabeza || p.home.y > cabeza.home.y) cabeza = p

      let lejosMax = 1e-6
      for (const p of pieces) lejosMax = Math.max(lejosMax, p.home.distanceTo(cabeza.home))

      // Tamaño de cada pieza (media diagonal de su caja), para que las chicas
      // salgan más rápido que las grandes. Se compara contra la mediana.
      const cajaPieza = new THREE.Box3()
      const tam = new THREE.Vector3()
      for (const p of pieces) {
        p.group.position.copy(p.home)
        p.group.rotation.set(0, 0, 0)
        p.group.updateMatrixWorld(true)
        p.radio = Math.max(0.005, cajaPieza.setFromObject(p.group).getSize(tam).length() / 2)
      }
      const radios = pieces.map((p) => p.radio).sort((a, b) => a - b)
      const radioTipico = radios[Math.floor(radios.length / 2)]

      // Lo que se ve a lo ancho con el zoom fijo (MONTON_ANCHO de la mitad):
      // el montón del centro tiene que caber, y las de la orilla caen justo
      // en ese borde.
      const lienzo = gl.domElement
      const aspecto = Math.max(0.3, (lienzo.clientWidth || 1) / Math.max(1, lienzo.clientHeight || 1))
      const cabe = alto * PLANO * aspecto * 0.5 * MONTON_ANCHO

      pieces.forEach((p, i) => {
        piecesRef.current.add(p.group)
        // Arranca EXACTAMENTE donde estaba el cuerpo: misma posición, sin
        // rotación. Con una rotación aleatoria de salida, al partirse todas
        // aparecían de golpe ya volteadas y parecían otro personaje.
        p.group.position.copy(p.home)
        p.group.rotation.set(0, 0, 0)

        // El golpe entra por la cabeza y baja por el cuerpo, pero rápido: en
        // 0.12 s todo está suelto, así que se lee como un solo impacto.
        const lejos = p.home.distanceTo(cabeza.home) / lejosMax
        const cerca = 1 - lejos
        p.d = p === cabeza ? 0 : ONDA_S * lejos + hash(i, 18) * 0.04

        // Hacia afuera, lejos de la cabeza, en el piso (XZ). Lo que está justo
        // debajo de ella (cuello, columna) no tiene para dónde abrirse: recibe
        // el golpe desde arriba y casi no se va de lado.
        const desde = p.home.clone().sub(cabeza.home)
        const lado = new THREE.Vector3(desde.x, 0, desde.z)
        const abierto = lado.length() / Math.max(1e-6, desde.length())
        if (lado.lengthSq() < 1e-8) {
          const a = i * 2.399963229728653 // ángulo áureo: reparte sin repetir
          lado.set(Math.cos(a), 0, Math.sin(a))
        }
        lado.normalize()

        const chica = Math.min(1.5, Math.max(0.65, Math.sqrt(radioTipico / p.radio)))
        const azar = (0.85 + hash(i, 11) * 0.3) * esc
        p.v = lado.multiplyScalar(lerp(ESTALLIDO_LADO_MIN, ESTALLIDO_LADO, cerca) * (0.35 + 0.65 * abierto) * chica * azar)
        p.v.y = lerp(ESTALLIDO_ARRIBA_MIN, ESTALLIDO_ARRIBA, cerca) * Math.min(ARRIBA_CHICA_MAX, chica) * azar
        // Gira más lo que salió con más fuerza.
        const giro = (3 + 7 * cerca) * Math.min(1.3, chica) * 2
        p.w = new THREE.Vector3(
          (hash(i, 13) - 0.5) * giro,
          (hash(i, 14) - 0.5) * giro,
          (hash(i, 15) - 0.5) * giro,
        )

        p.suelo = suelo + hash(i, 16) * alto * 0.05
        const H = Math.max(0, p.home.y - p.suelo)
        const vImpacto = Math.sqrt(p.v.y * p.v.y + 2 * g * H)
        p.tl = p.d + (p.v.y + vImpacto) / g

        const e = REBOTE_HUESO_MIN + hash(i, 19) * REBOTE_HUESO_VAR
        p.rebotes = rebotesDesde(vImpacto, e, g)
        p.tRebotes = duracion(p.rebotes)
        // Dónde se queda: el encuadre de la cámara va hacia el montón final,
        // no hacia lo que va volando.
        p.avance = (p.tl - p.d) + p.tRebotes * DESLIZ

        // A dónde la manda el rayo: unas salen volando del cuadro con todo el
        // golpe, otras caen en la orilla, hasta donde las aventó, y las demás
        // hacen el montón del centro con la cabeza (ver LADO_ABIERTO). Antes
        // todo caía en medio y no se sentía el madrazo (Oscar, 2026-10-30).
        // Salen hacia su lado; las que estaban casi justo debajo de la cabeza,
        // a un lado al azar, para que no se vayan todas al mismo.
        const r = hash(i, 21)
        p.destino = abierto > LADO_ABIERTO
          ? (r < VUELAN ? 'vuela' : r < VUELAN + ORILLA ? 'orilla' : 'centro')
          : 'centro'
        const sentido = Math.abs(desde.x) > 0.05 * esc ? Math.sign(desde.x) : (hash(i, 23) < 0.5 ? -1 : 1)
        if (p.destino === 'vuela') {
          p.v.x = sentido * lerp(VUELO_MIN, VUELO_MAX, hash(i, 22)) * esc
          p.v.z = (hash(i, 24) - 0.3) * 0.8 * esc
          p.w.multiplyScalar(1.5)
        } else if (p.destino === 'orilla') {
          const meta = sentido * cabe * lerp(0.75, 1, hash(i, 22))
          p.v.x = sentido * Math.max(0.3 * esc, (sentido * (meta - p.home.x)) / Math.max(0.2, p.avance))
          p.v.z *= 0.5
        }
        p.reposo = new THREE.Vector3(p.home.x + p.v.x * p.avance, p.suelo, p.home.z + p.v.z * p.avance)
      })

      // Con el zoom fijo, el montón del centro tiene que caber a lo ancho del
      // cuadro. Si alguno fuera a quedar fuera, se acorta el empuje de lado
      // de todos los del centro por la misma razón (así no cambia la forma
      // del estallido). Solo lo horizontal: el brinco y los rebotes se quedan
      // igual. Las que vuelan o van a la orilla no entran aquí.
      let recorte = 1
      for (const p of pieces) {
        if (p === cabeza || p.destino !== 'centro') continue
        const dx = p.v.x * p.avance
        const libre = (dx >= 0 ? cabe - p.home.x : cabe + p.home.x)
        if (Math.abs(dx) > 1e-6 && Math.abs(dx) > libre) recorte = Math.min(recorte, Math.max(0, libre) / Math.abs(dx))
      }
      if (recorte < 1) {
        for (const p of pieces) {
          if (p === cabeza || p.destino !== 'centro') continue
          p.v.x *= recorte
          p.v.z *= recorte
          p.reposo.set(p.home.x + p.v.x * p.avance, p.suelo, p.home.z + p.v.z * p.avance)
        }
      }

      // ── La cabeza ──────────────────────────────────────────────────────
      // Se suelta primero (es donde pegó el rayo) y cae con la misma
      // gravedad que todo lo demás. Da vueltas completas hacia adelante
      // durante el vuelo, calculadas para cerrarse justo al tocar piso: así
      // aterriza de frente a la cámara por física, sin ajustarla al final.
      // Después rebota dos veces, cada vez más bajo, y se queda.
      //
      // Va al centro y un poco por delante de los demás huesos, para que en el
      // plano final ninguno le quede encima. El "cerca de la cámara" lo hace
      // la cámara con zoom, no la cabeza creciendo.
      cabeza.group.updateMatrixWorld(true)
      const caja = new THREE.Box3().setFromObject(cabeza.group)
      cabeza.medio = Math.max(0.01, (caja.max.y - caja.min.y) / 2)
      // Media anchura: la orilla sobre la que se va de lado al final.
      cabeza.ancho = Math.max(0.01, (caja.max.x - caja.min.x) / 2)
      cabeza.esCabeza = true

      // La mandíbula (malla Egg_Jaw) viene adentro de la pieza de la cabeza.
      // Se cuelga de un pivote en su bisagra —el hueso c_jawbonex, en la pose
      // del impacto— para poder abrirla al final. `bajaBarbilla` dice cuánto
      // baja su punto más bajo y adelantado al abrirse: lo que hay que
      // levantar el cráneo para que la barbilla empuje el piso en vez de
      // atravesarlo.
      const mandibula = cabeza.group.children.find((m) => m.name === 'Egg_Jaw')
      if (mandibula) {
        const bisagra = new THREE.Vector3()
        const hueso = cloned.getObjectByName('c_jawbonex')
        mandibula.geometry.computeBoundingBox()
        const cajaMandibula = mandibula.geometry.boundingBox
        if (hueso) {
          hueso.getWorldPosition(bisagra)
          bisagra.sub(cabeza.home)
        } else {
          bisagra.set(0, cajaMandibula.max.y, cajaMandibula.min.z)
        }
        const pivote = new THREE.Group()
        pivote.position.copy(bisagra)
        cabeza.group.add(pivote)
        pivote.add(mandibula)
        mandibula.position.copy(bisagra).negate()
        const abajo = cajaMandibula.min.y - bisagra.y
        const adelante = cajaMandibula.max.z - bisagra.z
        cabeza.mandibula = pivote
        cabeza.bajaBarbilla = (a) => Math.max(0, abajo * (1 - Math.cos(a)) + adelante * Math.sin(a))
      }

      // El ojo de abajo: el del lado que queda contra el piso al acostarse
      // (+x, porque se vence a la derecha), con su pupila. Sale de la cabeza
      // a un grupo propio, hermano de las piezas: así puede quedarse en el
      // piso rodando mientras la cabeza rebota. Hasta que pega, copia la pose
      // de la cabeza y se ve en su cuenca.
      const centroDe = (m) => {
        m.geometry.computeBoundingBox()
        return m.geometry.boundingBox.getCenter(new THREE.Vector3())
      }
      const globos = cabeza.group.children.filter((m) => m.material?.name === 'Eyes')
      const globo = globos.reduce((a, m) => (!a || centroDe(m).x > centroDe(a).x ? m : a), null)
      if (globo && globo.geometry.boundingBox) {
        const centro = centroDe(globo)
        const pupila = cabeza.group.children
          .filter((m) => m.material?.name === 'Pupils')
          .reduce((a, m) => (!a || Math.abs(centroDe(m).x - centro.x) < Math.abs(centroDe(a).x - centro.x) ? m : a), null)
        const grupo = new THREE.Group()
        for (const m of [globo, pupila]) {
          if (!m) continue
          grupo.add(m)
          m.position.copy(centro).negate()
        }
        piecesRef.current.add(grupo)
        const tamGlobo = globo.geometry.boundingBox.getSize(new THREE.Vector3())
        cabeza.ojo = {
          grupo,
          offset: centro,
          radio: Math.max(0.005, Math.min(tamGlobo.x, tamGlobo.y) / 2),
          rueda: OJO_RUEDA * esc,
        }
      }
      // Reposa APOYADA en el piso (su centro a casi medio alto), no hundida a
      // la mitad como el centro de un hueso delgado.
      cabeza.suelo = suelo + cabeza.medio * 0.75

      // Cómo se acuesta al final (ver apoyoDeLado). Sin las mallas, como
      // antes: de canto sobre la orilla derecha, a 90°.
      cabeza.ladoFinal = Math.PI / 2
      cabeza.pivoteLado = new THREE.Vector2(cabeza.ancho, -(cabeza.suelo - suelo))
      const craneo = cabeza.group.children.find((m) => m.name === 'Skull071')
      const quijada = cabeza.mandibula?.children.find((m) => m.name === 'Egg_Jaw')
      if (craneo && quijada) {
        const apoyo = apoyoDeLado(quijada, craneo)
        cabeza.ladoFinal = apoyo.final
        cabeza.pivoteLado = apoyo.pivote
      }
      cabeza.v.y = SALTO_CRANEO * esc
      const Hc = Math.max(0, cabeza.home.y - cabeza.suelo)
      const vImpacto = Math.sqrt(cabeza.v.y * cabeza.v.y + 2 * g * Hc)
      cabeza.tl = cabeza.d + (cabeza.v.y + vImpacto) / g
      const vuelo = cabeza.tl - cabeza.d

      let zMax = -Infinity
      for (const p of pieces) {
        if (p !== cabeza && p.destino !== 'vuela') zMax = Math.max(zMax, p.home.z + p.v.z * (p.tl - p.d))
      }
      if (!Number.isFinite(zMax)) zMax = cabeza.home.z
      cabeza.v.x = -cabeza.home.x / vuelo
      cabeza.zFinal = zMax + alto * 0.12
      cabeza.v.z = (cabeza.zFinal - cabeza.home.z) / vuelo
      const vueltas = Math.max(1, Math.round(vuelo * 1.6))
      cabeza.w.set((Math.PI * 2 * vueltas) / vuelo, 0, 0)

      cabeza.rebotes = rebotesDesde(vImpacto, REBOTE, g)
      cabeza.tRebotes = duracion(cabeza.rebotes)
      cabeza.reposo = new THREE.Vector3(cabeza.home.x + cabeza.v.x * vuelo, cabeza.suelo, cabeza.zFinal)

      // El scroll de HIT a LAND recorre todo este tiempo: el último rebote del
      // último hueso termina justo en LAND, así nada sigue saltando en el
      // footer. `caen` es cuando toca piso el último: para entonces la
      // cámara ya terminó de abrirse al montón.
      let total = 0
      let caen = 0
      for (const p of pieces) {
        total = Math.max(total, p.tl + p.tRebotes)
        caen = Math.max(caen, p.tl)
      }
      sim.current = { T: Math.max(GOLPE_S * 2, total * 1.03), g, caen }

      bakedRef.current = pieces
      cabezaRef.current = cabeza
      if (liveRef.current) liveRef.current.visible = false
    } catch { /* si falla, se queda el personaje entero */ }
  }, [cloned, fit, gl])

  const tmp = useMemo(() => ({
    sMin: 0,
    sMax: 0,
  }), [])

  const suavizado = useRef({ y: null, zoom: null, pitch: 0, x: 0 })
  const golpeRef = useRef(null)
  const llegaPasado = useRef(false)

  // ── Las chispas de lo más alto del brinco final ───────────────────────
  // Puntos aditivos, por tiempo (como el trueno): se disparan al cruzar lo
  // más alto del brinco bajando con el scroll y viven menos de un segundo.
  // Las mueve el useFrame; nada pasa por estado de React.
  const uPrevio = useRef(0)
  const chispas = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(CHISPAS_N * 3), 3))
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(CHISPAS_N * 3), 3))
    geo.setDrawRange(0, 0)
    // depthTest encendido: la cabeza tapa las que pasan por detrás de ella.
    const comun = {
      sizeAttenuation: false,
      map: texturaChispa(),
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }
    const mat = new THREE.PointsMaterial({ ...comun, size: CHISPAS_PX })
    // El resplandor: los mismos puntos, más grandes y tenues, debajo.
    const matBrillo = new THREE.PointsMaterial({ ...comun, size: BRILLO_PX, color: new THREE.Color(BRILLO, BRILLO, BRILLO) })
    return {
      geo,
      mat,
      matBrillo,
      vel: new Float32Array(CHISPAS_N * 3),
      base: new Float32Array(CHISPAS_N * 3),
      vida: new Float32Array(CHISPAS_N),
      vida0: new Float32Array(CHISPAS_N),
      vivas: false,
    }
  }, [])
  // Cuelgan directo de la escena y no del personaje: la sombra y la tinta
  // renderizan todo lo que cuelga de él y solo filtran mallas, así que unos
  // puntos ahí se volvían manchas negras enormes en el piso. Al final el
  // personaje no tiene giro ni desplazamiento: mismas coordenadas.
  useEffect(() => {
    const brillo = new THREE.Points(chispas.geo, chispas.matBrillo)
    const nucleo = new THREE.Points(chispas.geo, chispas.mat)
    for (const [p, orden] of [[brillo, 9], [nucleo, 10]]) {
      p.frustumCulled = false
      p.renderOrder = orden
      escena.add(p)
    }
    return () => {
      escena.remove(brillo)
      escena.remove(nucleo)
      chispas.geo.dispose()
      chispas.mat.dispose()
      chispas.matBrillo.dispose()
    }
  }, [chispas, escena])

  // Nacen detrás de la cabeza (`atras`: su radio) y salen en abanico en el
  // plano de la pantalla, para todos lados, un poco hacia atrás: la cabeza
  // tapa las que le pasan por detrás y se lee como un estallido a su espalda.
  const dispararChispas = useCallback((origen, esc, atras) => {
    const pos = chispas.geo.getAttribute('position').array
    for (let i = 0; i < CHISPAS_N; i++) {
      const a = Math.random() * Math.PI * 2
      const v = lerp(CHISPAS_VEL[0], CHISPAS_VEL[1], Math.random()) * esc
      chispas.vel[i * 3] = Math.cos(a) * v
      chispas.vel[i * 3 + 1] = Math.sin(a) * v
      chispas.vel[i * 3 + 2] = -Math.random() * 0.3 * v
      const r = Math.random() * atras * 0.4
      pos[i * 3] = origen.x + Math.cos(a) * r
      pos[i * 3 + 1] = origen.y + Math.sin(a) * r
      pos[i * 3 + 2] = origen.z - atras * 1.2
      const color = CHISPAS_COLORES[i % CHISPAS_COLORES.length]
      chispas.base[i * 3] = color.r
      chispas.base[i * 3 + 1] = color.g
      chispas.base[i * 3 + 2] = color.b
      chispas.vida0[i] = chispas.vida[i] = lerp(CHISPAS_VIDA[0], CHISPAS_VIDA[1], Math.random())
    }
    chispas.geo.setDrawRange(0, CHISPAS_N)
    chispas.vivas = true
    try { playSfx('sparkleBom', { volume: 0.6 })?.catch?.(() => { }) } catch { }
  }, [chispas])

  useFrame(({ camera }, delta) => {
    // Todo lo de aquí va en progreso de la historia (ver historia()), el
    // scroll y el punto del rayo por igual.
    const rayo = tiemposRayo(timingRef)
    const p = historia(clamp01(progressRef.current || 0), rayo.FIN)
    const HIT = historia(rayo.HIT, rayo.FIN)
    const { headY, midY, alto, suelo, piso } = fit.current

    // El impacto, en dos pasos, para que las piezas salgan de la MISMA pose
    // que se está viendo.
    if (p > HIT && !prep.current.baked) {
      if (!prep.current.frozen) congelar()
      else hornear()
    }

    // ── El golpe por reloj ───────────────────────────────────────────────
    // Los primeros GOLPE_S del estallido corren por tiempo, no por scroll:
    // el rayo lo parte aunque dejes de scrollear justo en el impacto. Y de
    // regreso igual: arriba del impacto ese tramo se REBOBINA por tiempo, las
    // piezas vuelan de vuelta a su lugar y solo cuando llegaron vuelve el
    // personaje entero. Antes se cambiaba en un cuadro con las piezas todavía
    // en el aire: el brinco de un estado a otro al subir (2026-10-30).
    const dt = Math.min(0.05, delta || 0)
    const g0 = golpeRef.current
    if (g0 === null) {
      // La página llegó ya pasada el rayo: el golpe se da por hecho.
      golpeRef.current = p > HIT ? GOLPE_S : 0
    } else if (p > HIT) {
      if (bakedRef.current) golpeRef.current = Math.min(GOLPE_S, g0 + dt)
    } else {
      golpeRef.current = Math.max(0, g0 - dt * (GOLPE_S / REARME_S))
    }
    const golpe = golpeRef.current

    // ── Ya rearmado arriba del impacto ───────────────────────────────────
    // El personaje entero recupera su idle. Las piezas se tiran: si vuelves a
    // bajar se hornean otra vez con la pose de ESE momento; con las viejas
    // saltaría a la pose del primer impacto.
    if (p <= HIT && golpe <= 0 && prep.current.frozen) {
      try { if (mixer) mixer.timeScale = 1 } catch { }
      tirarPiezas()
      prep.current = { frozen: false, baked: false }
    }

    const baked = bakedRef.current
    const broken = !!baked && (p > HIT || golpe > 0)
    // Llegó ya pasado el rayo (al regresar de un capítulo): mientras se
    // despieza (un cuadro) no se enseña el personaje entero parado en medio.
    const esperandoPiezas = !baked && p > HIT && golpe >= GOLPE_S
    // Y la cámara se pone directo en su encuadre en cuanto están las piezas:
    // si persiguiera desde el del personaje entero, todo el montón se veía
    // deslizarse al centro al regresar (Oscar, 2026-10-30).
    if (esperandoPiezas) llegaPasado.current = true
    if (broken && llegaPasado.current) {
      suavizado.current.y = null
      llegaPasado.current = false
    }

    if (liveRef.current) liveRef.current.visible = !broken && !esperandoPiezas
    if (piecesRef.current) piecesRef.current.visible = broken

    // ── La vuelta completa ───────────────────────────────────────────────
    // Antes de romperse da UN giro de 360°, para verlo entero. Cierra justo
    // en el impacto, de frente. Pasado el impacto vale 2π (una vuelta entera,
    // lo mismo que cero), así que las piezas, horneadas en coordenadas de
    // mundo, no giran de más. Mientras se rearman arriba del impacto giran
    // con el contenedor: si subiste rápido, el personaje entero aparece en el
    // mismo ángulo que las piezas, sin salto.
    if (rigRef.current) {
      rigRef.current.rotation.y = suave(ramp(p, GIRO_START, HIT)) * Math.PI * 2
    }

    // ── La caída ─────────────────────────────────────────────────────────
    let tau = 0
    if (broken && baked && sim.current.T) {
      const { T, g } = sim.current
      // Golpe por reloj + el resto con el scroll.
      tau = golpe + ramp(p, HIT, LAND) * (T - GOLPE_S)

      for (let i = 0; i < baked.length; i++) {
        const pz = baked[i]
        if (!pz.v) continue
        const s = Math.max(0, tau - pz.d)   // segundos desde que la soltó el golpe
        const sl = pz.tl - pz.d             // segundos de vuelo hasta el piso
        const vol = Math.min(s, sl)

        let y = s >= sl ? pz.suelo : pz.home.y + pz.v.y * s - 0.5 * g * s * s
        // Ya en el piso: los rebotes, parábolas cada vez más bajas.
        let rebotando = 0
        if (s > sl) {
          let r = s - sl
          rebotando = Math.min(r, pz.tRebotes)
          for (const rb of pz.rebotes) {
            if (r < rb.t) {
              y = pz.suelo + rb.v * r - 0.5 * g * r * r
              break
            }
            r -= rb.t
          }
        }

        if (pz.esCabeza) {
          // La cabeza rebota en su lugar y sin girar: aterrizó de frente y así
          // se queda, que es a donde cierra la cámara.
          pz.group.position.set(pz.home.x + pz.v.x * vol, y, pz.home.z + pz.v.z * vol)
          pz.group.rotation.set(pz.w.x * vol, 0, 0)

          // El último scroll: abre la mandíbula, que empuja el cráneo de lado
          // hasta vencerlo. Gira sobre su orilla derecha de abajo, la que se
          // queda en el piso, así que al acostarse su centro queda a media
          // anchura del suelo, sin hundirse. Ya está quieta y de frente
          // (vueltas completas), así que basta el giro en z.
          const u = ramp(p, LADO_START, LADO_END)
          const abre = aperturaMandibula(u)
          // El cráneo se echa para atrás sobre la bisagra mientras la boca va
          // abierta y se endereza cuando se cierra; ya acostado va derecho (el
          // "clac" del piso no lo mueve). La mandíbula gira lo mismo al revés,
          // así que se queda abajo y la boca abre lo de los dos.
          const atras = pz.mandibula && u < CIERRA_HASTA ? CRANEO_ATRAS * Math.min(1, abre) : 0
          if (atras > 0) {
            pz.group.rotation.x -= atras
            const bisagra = tmpVec.copy(pz.mandibula.position)
            pz.group.position.add(bisagra).sub(tmpVec2.copy(bisagra).applyAxisAngle(EJE_X, -atras))
          }
          if (pz.mandibula) {
            pz.mandibula.rotation.set(MANDIBULA_ABRE * abre + atras, 0, MANDIBULA_SESGO * abre * (u < EMPUJE ? 1 : 1 - suave((u - EMPUJE) / (1 - EMPUJE))))
            // Mientras empuja, la barbilla se apoya en el piso y levanta el
            // cráneo lo que ella baja. Al vencerse ya no carga nada.
            if (u > 0 && pz.bajaBarbilla) {
              const carga = u < EMPUJE ? 1 : 1 - suave(Math.min(1, (u - EMPUJE) / ((1 - EMPUJE) * 0.5)))
              pz.group.position.y += pz.bajaBarbilla(MANDIBULA_ABRE * Math.min(1, abre)) * carga
            }
          }
          // El brinco. `alzado` es lo que la cámara NO debe seguir: si lo
          // persiguiera, el salto se borraría en pantalla.
          pz.alzado = u < EMPUJE ? saltoFinal(u) * SALTO_FINAL * pz.medio * 2 : 0
          pz.group.position.y += pz.alzado
          // Giro rígido sobre el punto de la mandíbula que toca el piso: ese
          // punto no se mueve (no resbala) y el centro da la vuelta alrededor.
          const lado = anguloDeLado(u, pz.ladoFinal)
          if (lado > 0 && pz.pivoteLado) {
            const P = pz.pivoteLado
            const c = Math.cos(lado)
            const sn = Math.sin(lado)
            pz.group.position.x += P.x - (P.x * c + P.y * sn)
            pz.group.position.y += P.y - (-P.x * sn + P.y * c)
            pz.group.rotation.z = -lado
          }

          // Las chispas: al cruzar lo más alto del brinco bajando. Solo si
          // llegó scrolleando (no de un salto, al cargar ya pasada la página).
          const uCima = EMPUJE * (SALTO_DESDE + SALTO_HASTA) / 2
          if (uPrevio.current < uCima && u >= uCima && u - uPrevio.current < 0.25) {
            dispararChispas(pz.group.position, Math.max(0.2, alto) / 1.7, pz.ancho)
          }
          uPrevio.current = u

          // El ojo de abajo. Pegado: la misma pose que tendría en su cuenca.
          // Al pegar la cabeza en el piso se sale hacia el frente, cae al
          // suelo con un brinquito y rueda frenándose; el giro es el que
          // corresponde a lo que avanzó (distancia / radio).
          if (pz.ojo) {
            const o = pz.ojo
            const ojo3d = o.grupo
            ojo3d.position.copy(o.offset).applyQuaternion(pz.group.quaternion).add(pz.group.position)
            ojo3d.quaternion.copy(pz.group.quaternion)
            const k = ramp(p, P_PEGA, OJO_PARA)
            if (k > 0) {
              const sale = suave(clamp01(k / OJO_SALE))
              const t = clamp01((k - OJO_SALE * 0.6) / (1 - OJO_SALE * 0.6))
              const rodado = o.rueda * (1 - (1 - t) * (1 - t))
              ojo3d.position.y = lerp(ojo3d.position.y, piso + o.radio * 0.95, sale) + o.radio * 0.8 * Math.sin(Math.PI * sale)
              ojo3d.position.z += o.radio * 1.6 * sale
              ojo3d.position.addScaledVector(OJO_DIR, rodado)
              tmpQuat.setFromAxisAngle(OJO_EJE, rodado / o.radio)
              ojo3d.quaternion.premultiply(tmpQuat)
            }
          }
        } else {
          const avance = vol + rebotando * DESLIZ
          const giro = vol + rebotando * GIRO_REBOTE
          pz.group.position.set(pz.home.x + pz.v.x * avance, y, pz.home.z + pz.v.z * avance)
          pz.group.rotation.set(pz.w.x * giro, pz.w.y * giro, pz.w.z * giro)
        }
      }
    }

    // ── Las chispas ──────────────────────────────────────────────────────
    // Por tiempo: salen rápido, el aire las frena, caen un poco y se apagan
    // (aditivas: bajar el color a negro es desaparecer).
    if (chispas.vivas) {
      const posA = chispas.geo.getAttribute('position')
      const colA = chispas.geo.getAttribute('color')
      const pos = posA.array
      const col = colA.array
      const caida = G * (Math.max(0.2, alto) / 1.7) * 0.5
      const freno = Math.max(0, 1 - 1.6 * dt)
      let alguna = false
      for (let i = 0; i < CHISPAS_N; i++) {
        if (chispas.vida[i] <= 0) { col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = 0; continue }
        chispas.vida[i] -= dt
        chispas.vel[i * 3 + 1] -= caida * dt
        for (let k = 0; k < 3; k++) {
          chispas.vel[i * 3 + k] *= freno
          pos[i * 3 + k] += chispas.vel[i * 3 + k] * dt
        }
        const f = clamp01(chispas.vida[i] / chispas.vida0[i])
        for (let k = 0; k < 3; k++) col[i * 3 + k] = chispas.base[i * 3 + k] * Math.sqrt(f)
        alguna = true
      }
      posA.needsUpdate = true
      colA.needsUpdate = true
      if (!alguna) {
        chispas.vivas = false
        chispas.geo.setDrawRange(0, 0)
      }
    }

    // ── Cámara: ortográfica, ligeramente inclinada ───────────────────────
    // Todo el encuadre se calcula en coordenadas de PANTALLA: con la cámara
    // inclinada, la altura en pantalla de un punto es y·cos − z·sen, así que
    // un hueso que cae hacia el frente baja en el cuadro aunque su y no
    // cambie. Calcularlo en mundo descuadraba el montón.
    const sv = suavizado.current
    const cp = Math.cos(sv.pitch)
    const sp = Math.sin(sv.pitch)
    const enPantalla = (y, z) => y * cp - z * sp

    let verAlto
    let centroS
    let pitchObj

    if (!broken) {
      // Del primer plano de la cara al cuerpo entero, dejando AIRE ARRIBA de
      // la cabeza: por ahí baja el rayo, y sin ese espacio solo se vería el
      // último pedazo antes del impacto.
      const abre = suave(ramp(p, GIRO_START * 0.5, 0.20))
      verAlto = alto * lerp(0.42, PLANO, abre)
      centroS = enPantalla(lerp(headY, midY + alto * 0.22, abre), 0)
      pitchObj = PITCH * abre
    } else {
      // Ya en piezas. El zoom NO cambia (pedido de Oscar, 2026-10-30): antes
      // el plano encuadraba lo que iba volando y cada brinco se leía como la
      // cámara alejándose. Se queda con lo que se veía al impacto y solo baja,
      // conforme caen, al piso donde se juntan (dónde se queda cada hueso,
      // sacado al hornear). Que el montón quepa a lo ancho lo asegura el
      // hornear, recortando el empuje de lado.
      verAlto = alto * PLANO
      tmp.sMin = Infinity
      tmp.sMax = -Infinity
      for (const pz of baked) {
        if (!pz.reposo || pz.destino === 'vuela') continue
        const s = enPantalla(pz.reposo.y, pz.reposo.z)
        tmp.sMin = Math.min(tmp.sMin, s)
        tmp.sMax = Math.max(tmp.sMax, s)
      }
      // Mira un poco por debajo del centro: así se ve el piso donde se juntan
      // en vez de quedar el montón pegado al borde de abajo.
      const centroMonton = lerp((tmp.sMin + tmp.sMax) / 2, enPantalla(suelo, 0) + verAlto * 0.18, 0.55)
      const baja = suave(clamp01(tau / Math.max(0.1, sim.current.caen || 1)))
      centroS = lerp(enPantalla(midY + alto * 0.22, 0), centroMonton, baja)
      pitchObj = PITCH
    }

    // ── El final: zoom de cámara a la cabeza ─────────────────────────────
    // Arranca cuando la cabeza toca piso y cierra el plano sobre ella, con
    // los huesos alrededor y medio cortados por el borde. Es la CÁMARA la que
    // se acerca: todo conserva su tamaño. Mira a donde reposa (no a donde va
    // en el rebote) para que el plano no salte con ella.
    const cab = cabezaRef.current
    let mirarX = 0
    if (broken && cab?.medio && sim.current.T) {
      const tCab = (cab.tl - GOLPE_S) / Math.max(1e-6, sim.current.T - GOLPE_S)
      const pPosa = HIT + clamp01(tCab) * (LAND - HIT)
      const fin = suave(ramp(p, pPosa - 0.03, 1))
      if (fin > 0) {
        // La cabeza va centrada en el hueco libre del pie: entre el título y
        // la frase de arriba y las redes de abajo (lo mide la home, en
        // fracción del alto de la pantalla). 2.5 cabezas de alto en cuadro
        // (Oscar lo pidió cerca); si el hueco es chico, se abre lo justo para
        // que quepa la cabeza con su mohawk (HUECO_LLENO). El brinco no
        // cuenta: sube a la zona del título, que entra hasta que acaba.
        const hueco = timingRef?.current?.huecoFinal
        const alturaCabeza = cab.medio * 2
        let verH = alturaCabeza * 2.5
        let dondeVa = 0.37
        if (hueco && hueco.abajo > hueco.arriba) {
          verH = Math.max(verH, alturaCabeza / ((hueco.abajo - hueco.arriba) * HUECO_LLENO))
          dondeVa = (hueco.arriba + hueco.abajo) / 2
        }
        verAlto = lerp(verAlto, verH, fin)
        // Para que el centro de la cabeza caiga a `dondeVa` del alto (desde
        // arriba), la cámara mira (dondeVa − 0.5) de pantalla por encima de él.
        centroS = lerp(centroS, enPantalla(cab.suelo, cab.zFinal) + verH * (dondeVa - 0.5), fin)
        // Cuando se va de lado, la cámara la sigue para que no se salga: de
        // lado, y también hacia abajo (acostada, su centro baja), así queda a
        // la altura que tenía parada, en su espacio arriba del título. Solo
        // después de LAND, para no perseguir sus rebotes.
        mirarX = (cab.group?.position.x || 0) * fin
        if (p > LAND && cab.group) centroS += (cab.group.position.y - (cab.alzado || 0) - cab.suelo) * cp * fin
      }
    }

    // Persecución suave. El scroll llega a ráfagas (y en iOS con rebote), así
    // que ni el zoom, ni la altura, ni la inclinación se asignan directo:
    // persiguen. Sin esto se siente escalonado en cuanto el dedo se despega.
    const objetivoZoom = size.height / Math.max(0.01, verAlto)
    // La cámara mira a (0, y, 0); su centro en pantalla es y·cos(pitch).
    const objetivoY = centroS / Math.max(0.2, cp)
    if (sv.y === null) { sv.y = objetivoY; sv.zoom = objetivoZoom; sv.pitch = pitchObj; sv.x = mirarX }
    sv.y += (objetivoY - sv.y) * 0.12
    sv.zoom += (objetivoZoom - sv.zoom) * 0.12
    sv.pitch += (pitchObj - sv.pitch) * 0.12
    sv.x += (mirarX - sv.x) * 0.12

    camera.position.set(sv.x, sv.y + Math.sin(sv.pitch) * 10, Math.cos(sv.pitch) * 10)
    camera.lookAt(sv.x, sv.y, 0)
    camera.zoom = sv.zoom
    camera.updateProjectionMatrix()
  })

  return (
    <group ref={rigRef}>
      <primitive object={cloned} ref={liveRef} />
      <group ref={piecesRef} />
    </group>
  )
}

/**
 * El rayo, dibujado con el scroll.
 *
 * Es el mismo de escritorio: `makeGeometrySet` de LightningBolt.jsx, armado en
 * SUS unidades (cielo a 22, impacto en 0) y escalado al personaje. La forma —el
 * zigzag, la rama lateral, las proporciones, los colores y el blending
 * aditivo— es idéntica. Lo único distinto es el grosor: allá se ve de lejos y
 * acá ocupa media pantalla de un teléfono.
 *
 * Antes del impacto el tubo se REVELA de arriba abajo con el scroll (drawRange
 * sobre el índice: TubeGeometry ordena sus triángulos a lo largo de la curva,
 * así que revelar los primeros N es revelar desde el cielo). Al tocar la
 * cabeza el impacto ya es por tiempo —la envolvente `boltCoreAlpha` de
 * escritorio, 260 ms—, porque un rayo no se puede dibujar lento al pegar.
 */
function ScrollBolt({ progressRef, timingRef, fitRef, onStrike }) {
  const grupoRef = useRef(null)
  const coreRef = useRef(null)
  const haloRef = useRef(null)
  const ramaCoreRef = useRef(null)
  const ramaHaloRef = useRef(null)
  const luzRef = useRef(null)
  const setRef = useRef(null)
  // `armado` solo se enciende cuando se ve el scroll ANTES del impacto: si la
  // página vuelve ya pasada (el navegador restaura el scroll) no hay rayo
  // fantasma al cargar.
  const golpe = useRef({ armado: false, at: -1e9 })
  const onStrikeRef = useRef(onStrike)
  onStrikeRef.current = onStrike

  useEffect(() => () => {
    const s = setRef.current
    if (!s) return
    for (const k of ['mainCore', 'mainHalo', 'branchCore', 'branchHalo']) {
      try { s[k].dispose() } catch { }
    }
  }, [])

  useFrame(() => {
    const f = fitRef.current
    if (!f?.ready || !grupoRef.current) return

    if (!setRef.current) {
      const s = makeGeometrySet(new THREE.Vector3(0, 22, 0), new THREE.Vector3(0, 0, 0), 0.16, 0.55)
      // Altura donde nace la rama, como fracción del rayo: se revela cuando la
      // punta principal ya pasó por ahí.
      s.branchCore.computeBoundingBox()
      s.ramaDesde = clamp01(1 - (s.branchCore.boundingBox?.max.y ?? 11) / 22)
      coreRef.current.geometry = s.mainCore
      haloRef.current.geometry = s.mainHalo
      ramaCoreRef.current.geometry = s.branchCore
      ramaHaloRef.current.geometry = s.branchHalo

      // Del cielo —un poco arriba del borde de pantalla con el plano abierto—
      // a la punta del mohawk, apenas adelante para que no se esconda en el
      // pelo.
      const impacto = new THREE.Vector3(0, f.top - f.alto * 0.04, f.alto * 0.06)
      const cielo = f.midY + f.alto * 1.12
      grupoRef.current.position.copy(impacto)
      grupoRef.current.scale.setScalar(Math.max(0.005, (cielo - impacto.y) / 22))
      if (luzRef.current) {
        luzRef.current.position.copy(impacto)
        luzRef.current.distance = f.alto * 2.5
      }
      setRef.current = s
    }

    const s = setRef.current
    const p = clamp01(progressRef.current || 0)
    const { HIT, DRAW_START } = tiemposRayo(timingRef)
    const ahora = performance.now()
    const gp = golpe.current

    if (p < HIT - 0.01 && !gp.armado) {
      gp.armado = true
    }
    if (gp.armado && p >= HIT) {
      gp.armado = false
      gp.at = ahora
      try { playSfx('thunder.mp3', { volume: 0.9 })?.catch?.(() => { }) } catch { }
      try { onStrikeRef.current?.() } catch { }
    }

    let revela
    let core
    if (gp.armado) {
      revela = ramp(p, DRAW_START, HIT)
      // Mientras baja chisporrotea, un poco menos brillante que al pegar.
      core = revela > 0 ? 0.78 + 0.22 * Math.sin(ahora * 0.09) * Math.sin(ahora * 0.023) : 0
    } else {
      revela = 1
      core = boltCoreAlpha((ahora - gp.at) / 1000)
    }
    const halo = core * (gp.armado ? 0.55 : 0.7)

    const mostrar = (geo, frac) => {
      const total = geo.index ? geo.index.count : geo.attributes.position.count
      geo.setDrawRange(0, Math.floor((total * clamp01(frac)) / 3) * 3)
    }
    mostrar(s.mainCore, revela)
    mostrar(s.mainHalo, revela)
    const rama = ramp(revela, s.ramaDesde, s.ramaDesde + (1 - s.ramaDesde) * 0.55)
    mostrar(s.branchCore, rama)
    mostrar(s.branchHalo, rama)

    grupoRef.current.visible = core > 0.001
    coreRef.current.material.opacity = core
    haloRef.current.material.opacity = halo
    ramaCoreRef.current.material.opacity = core * 0.85
    ramaHaloRef.current.material.opacity = halo * 0.7
    // La luz del impacto: apenas un brillo mientras baja, el flash al pegar.
    if (luzRef.current) luzRef.current.intensity = gp.armado ? core * 0.5 : core * 7
  })

  return (
    <>
      <group ref={grupoRef} visible={false}>
        <mesh ref={haloRef} renderOrder={49} frustumCulled={false}>
          <meshBasicMaterial color="#9fdcff" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
        <mesh ref={coreRef} renderOrder={50} frustumCulled={false}>
          <meshBasicMaterial color="#ffffff" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
        <mesh ref={ramaHaloRef} renderOrder={49} frustumCulled={false}>
          <meshBasicMaterial color="#9fdcff" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
        <mesh ref={ramaCoreRef} renderOrder={50} frustumCulled={false}>
          <meshBasicMaterial color="#ffffff" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      </group>
      {/* Persistente con intensidad 0, igual que en escritorio: montar una luz
          a media escena cambia el conteo de luces y recompila todos los
          materiales justo en el frame del impacto. */}
      <pointLight ref={luzRef} color="#cfeaff" intensity={0} distance={4} decay={1.6} />
    </>
  )
}

// Los dots de cámara: el DotScreen del home de escritorio, con sus mismos
// valores (App.jsx, `fx`).
//
// Caen sobre lo 3D —personaje, huesos, sombra—, igual que en escritorio caen
// sobre el mundo 3D. El fondo plano se queda FUERA, en CSS, a propósito: el
// halftone de DotScreen depende del tono (su salida es color×10 − 5 + patrón,
// sin acotar). Sobre un tono medio, como el piso azul de escritorio, dibuja
// puntos; sobre un neón saturado plano no hay nada que modular, y sobre un
// oscuro plano resta en vez de sumar. Se probó con el fondo dentro del canvas
// y se midió: #0f172a, #120a1e y #0a0510 salían 0,0,0, y los neones se corrían
// (#00bfff → 0,200,255). Los colores de sección no se tocan.
const DOTS = { angle: 0.06, scale: 1, center: [0.38, 0.44], opacity: 0.02 }

export default function SkulleyFallRig({ progressRef, timingRef, onStrike }) {
  const rootRef = useRef(null)
  const fitRef = useRef({ headY: 1.5, midY: 0.85, alto: 1.7, piso: 0, suelo: -0.02, top: 1.7, ready: false })
  // La sombra necesita el piso y el alto como props, así que esto sí pasa por
  // estado: una sola vez, cuando el modelo se mide.
  const [medida, setMedida] = useState(null)
  const onMedido = useCallback((f) => {
    setMedida((m) => (m && m.piso === f.piso && m.alto === f.alto ? m : { piso: f.piso, alto: f.alto }))
  }, [])

  return (
    <div className="absolute inset-0" style={{ pointerEvents: 'none' }} aria-hidden="true">
      <Canvas
        orthographic
        dpr={[1, 2]}
        gl={{
          antialias: false,
          // alpha: el color plano del fondo lo pinta el DOM, no un clear del
          // renderer — así la transición de color por sección es CSS.
          alpha: true,
          stencil: false,
          powerPreference: 'high-performance',
        }}
        // Rango generoso: la ortográfica no tiene perspectiva que perder y así
        // ninguna pieza se recorta por near/far mientras vuela.
        camera={{ position: [0, 1.2, 10], zoom: 200, near: -5000, far: 5000 }}
        style={{ background: 'transparent' }}
      >
        <directionalLight intensity={1.7} position={[3, 4, 3]} color="#fff4e6" />
        <directionalLight intensity={0.38} position={[-4, 1, -2]} color="#9fd0ff" />
        <ambientLight intensity={0.5} />

        <React.Suspense fallback={null}>
          <group ref={rootRef}>
            <FallingSkulley
              progressRef={progressRef}
              timingRef={timingRef}
              fitRef={fitRef}
              onMedido={onMedido}
            />
          </group>
        </React.Suspense>

        {/* Fuera de rootRef a propósito: el pase de normales entinta todo lo
            que cuelga de ahí, y el rayo con ink lines se vería como un tubo de
            caricatura en vez de luz. */}
        <ScrollBolt progressRef={progressRef} timingRef={timingRef} fitRef={fitRef} onStrike={onStrike} />

        {/* La sombra de escritorio (SilhouetteShadow): cámara cenital que ve
            solo al personaje, pintada como mancha dura en el piso. Reconoce las
            piezas por userData.__disassembleOwned, así que sigue a cada hueso
            mientras cae. El cuadro cubre lo que se abren las piezas. */}
        {medida && (
          <SilhouetteShadow
            playerRef={rootRef}
            groundY={medida.piso}
            size={medida.alto * 2.6}
            height={medida.alto * 3.5}
            opacity={0.42}
            resolution={160}
            blur={1.0}
          />
        )}

        {/* Ojo: SilhouetteShadow corre su useFrame con prioridad 0.5, y en R3F
            cualquier prioridad > 0 apaga el render automático. Quien dibuja
            el cuadro es el EffectComposer (prioridad 1); sin él, el canvas se
            queda congelado. */}
        <CharacterNormalPass playerRef={rootRef} target={posterNormalTexture} fixedScale />
        <EffectComposer multisampling={0} resolutionScale={0.85}>
          <EdgeInkEffect
            bufferRef={posterNormalTexture}
            thickness={1.2}
            strength={0.95}
            threshold={0.3}
            soft={0.16}
            silhouette
            silhouetteWidth={2.6}
            silhouetteStrength={1}
          />
          <DotScreen
            blendFunction={BlendFunction.SCREEN}
            angle={DOTS.angle}
            scale={DOTS.scale}
            center={DOTS.center}
            opacity={DOTS.opacity}
          />
        </EffectComposer>
      </Canvas>
    </div>
  )
}
