import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF, useAnimations } from '@react-three/drei'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'
import * as THREE from 'three'
import { EffectComposer, DotScreen } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import { extendGLTFLoaderKTX2, detectKTX2Support } from '../../lib/ktx2Setup.js'
import { applyToonBanding } from '../../lib/toonBanding.js'
import { prepareSkinMaterial, useSkinColors, activateSkinShader, readActiveSkinId } from '../../lib/characterSkin.js'
import { skinLineColor } from '../../lib/skinShaders.js'
import { posterNormalTexture } from '../../lib/toonInkBuffer.js'
import { pngDeCanvas } from '../../lib/wallpaperPng.js'
import { bakeCharacterPieces } from '../../lib/characterPieces.js'
import { playSfx } from '../../lib/sfx.js'
import { playEyePoke, playEyePop, playEyeRespawn } from '../../lib/eyePokeSound.js'
import { playOrbBounce } from '../../lib/homeSounds.js'
import CharacterNormalPass from '../fx/CharacterNormalPass.jsx'
import CameraAim from '../fx/CharacterCursorAim.jsx'
import EdgeInkEffect from '../fx/EdgeInkEffect.jsx'
import PeliculaBN from '../fx/PeliculaBN.jsx'
import SilhouetteShadow from '../SilhouetteShadow.jsx'
import { makeGeometrySet, boltCoreAlpha } from '../fx/LightningBolt.jsx'
import { crearNumerito, NUMERITO } from '../../lib/numeritoCabeza.js'

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
// dibuja y pega en la pantalla vacía que sigue a la historia, sin texto
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
const _camaraCuerpo = new THREE.Vector3()
const lerp = (a, b, t) => a + (b - a) * t
const ramp = (v, a, b) => clamp01((v - a) / Math.max(1e-6, b - a))
// Suaviza las puntas: sin esto el giro arranca y frena de golpe.
const suave = (t) => t * t * (3 - 2 * t)

// ── Personalizar (botón de la barra) ─────────────────────────────────────
// El rig no lee el scroll directo sino un progreso EFECTIVO: el scroll real
// mezclado con 0 (Skulley entero, de frente). Al abrir, la mezcla sube y la
// historia se rebobina —los huesos regresan por donde cayeron—; al cerrar
// baja y la historia se vuelve a contar hasta el scroll real, que nunca se
// movió. Así regresa exactamente a donde iba, roto o entero.
const PERSONALIZA_ENTRA_S = 1.0
const PERSONALIZA_SALE_S = 1.4
// Qué tanto del espacio libre (de la orilla de arriba de la barra, cuyos
// botones van en las esquinas, al panel; los mide el personalizador) ocupa
// el personaje. Va centrado ahí: el mismo aire arriba de la cabeza que abajo
// de los pies.
const PERSONALIZA_LLENA = 0.9
// El zoom con dos dedos (`zoom`, 1 = cuerpo entero) y lo que se movió el
// cuadro (`panX` / `panY`, en altos de pantalla con zoom 1). Los escribe el
// personalizador; al cerrar regresan a 1 y 0 junto con el giro.
const PERSONALIZA_ZOOM_MAX = 4
// El giro con el dedo: lo que se ve persigue al dedo (por segundo; ~40 ms de
// atraso, lo justo para tapar los brincos entre eventos del puntero), el
// frenado de la inercia de un flick y el regreso de frente al cerrar.
const GIRO_SIGUE = 24
const GIRO_FRENO = 5
const GIRO_REGRESO = 9
const suaveDoble = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const envolver = (a) => Math.atan2(Math.sin(a), Math.cos(a))

// ── Wallpaper (botón del personalizador) ─────────────────────────────────
// Con `wall` encendido la cámara encuadra dentro del marco del personalizador
// justo lo que va a salir en el archivo: el giro, el zoom y el paneo son los
// mismos en la pantalla y en la captura (encuadreWallpaper). El archivo es un
// cuadro del mismo canvas dibujado a 4K vertical (19.5:9, la proporción de los
// teléfonos de hoy) y copiado a un PNG con el fondo elegido. Si la GPU no da
// para tanto, sale del tamaño más grande que dé.
// zoom 1 deja a Skulley entero un poco abajo del centro, libre del reloj de la
// pantalla de bloqueo; `plano: 'cara'` lleva al encuadre de la primera escena
// del sitio (de ahí sale WALLPAPER_CARA_VE, lo que se ve de alto).
const WALLPAPER_W = 2160
const WALLPAPER_H = 4680
// Las líneas (EdgeInk) se miden como si la imagen se viera en un teléfono de
// este ancho en px de CSS: el mismo grosor relativo que en el sitio.
const WALLPAPER_CSS_W = 390
const WALLPAPER_CUERPO_LLENA = 0.6
const WALLPAPER_CUERPO_CENTRO = 0.58
const WALLPAPER_CARA_VE = 0.42

// Lo que entra en el archivo. El paneo va en altos del archivo con zoom 1, y
// la inclinación se va a cero al acercarse: con la cara en cuadro es la toma
// de frente de la primera escena.
function encuadreWallpaper(pers, { alto, midY }) {
  const zoom = Math.min(PERSONALIZA_ZOOM_MAX, Math.max(1, pers.zoom || 1))
  const base = alto / WALLPAPER_CUERPO_LLENA
  const pitch = PITCH * 0.4 * (1 - suave(ramp(zoom, 1, PERSONALIZA_ZOOM_MAX)))
  return {
    vh: base / zoom,
    pitch,
    x: (pers.panX || 0) * base,
    centro: midY * Math.cos(pitch) + (WALLPAPER_CUERPO_CENTRO - 0.5 + (pers.panY || 0)) * base,
  }
}

// El paneo del personalizador va en altos de su cuadro y lo que queda al
// centro es el hueco libre; el del marco, en altos del archivo y al centro del
// marco. Al pasar de uno a otro se convierte para que siga en cuadro lo mismo
// que estabas viendo.
function pasarPaneo(pz, alto, alMarco) {
  const libre = Math.max(0.15, 1 - (pz.abajo || 0.42) - (pz.arriba || 0))
  const verP = alto / (libre * PERSONALIZA_LLENA)
  const base = alto / WALLPAPER_CUERPO_LLENA
  const hueco = 0.5 - ((pz.arriba || 0) + libre / 2)
  const r = 1 - 1 / Math.max(1, pz.zoom || 1)
  const abajo = WALLPAPER_CUERPO_CENTRO - 0.5
  if (alMarco) {
    pz.panX = ((pz.panX || 0) * verP) / base
    pz.panY = (((pz.panY || 0) - hueco * r) * verP) / base - abajo * r
    const maxX = ((WALLPAPER_W / WALLPAPER_H) / 2) * r
    pz.panX = Math.max(-maxX, Math.min(maxX, pz.panX))
    pz.panY = Math.max(-0.5 * r, Math.min(0.5 * r, pz.panY))
  } else {
    pz.panX = ((pz.panX || 0) * base) / verP
    pz.panY = (((pz.panY || 0) + abajo * r) * base) / verP + hueco * r
  }
}

// Aleatorio estable por índice de pieza. Nada de Math.random: el scroll va y
// viene, así que la caída tiene que ser IDÉNTICA cada vez que pasas por el
// mismo punto, o subir y bajar da dos desarmes distintos.
function hash(i, salt) {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453
  return x - Math.floor(x)
}

// ── Picarle los ojos en la historia ──────────────────────────────────────
// El easter egg del preloader viejo, ahora dentro del video (Oscar: que la
// historia sea interactiva). Cada piquete hace destellar el ojo en rojo, como
// el daño de un enemigo; al tercero se le salta, cae, rebota en el piso y al
// rato reaparece en su lugar parpadeando. No toca la animación: el numerito
// mueve huesos y esto solo las mallas de los ojos (visible y color) y una
// copia que vuela. El clic se resuelve a mano, porque el canvas no recibe el
// puntero: el ojo, con la pose del esqueleto de este cuadro (la cabeza puede
// ir volando o en sus manos), proyectado a la pantalla contra el cursor. La
// copia es el material del ojo sin esqueleto, otro programa: va montada desde
// el inicio fuera de cuadro para que compile al cargar y no al saltarse el
// ojo, y dentro del contenedor del personaje, para que lleve tinta y sombra.
const OJOS = {
  piquetes: 3,
  destelloMs: 260,
  rojo: new THREE.Color('#ff1f3d'),
  vuelveMs: 2600,
  parpadeoMs: 720,
  pasoParpadeoMs: 90,
  gravedad: 11,
  rebote: 0.45,
}
const esUi = (t) => !!t?.closest?.('button, a, input, textarea, select, [role="button"]')

// Rojo puro mientras dura el destello: el color base se apaga y manda el
// emisivo (sumado al amarillo del ojo salía naranja). Al apagarse regresa lo
// que había, incluido lo que puso el personalizador de colores.
function destello(ojo, on) {
  const mat = ojo.globo?.material
  if (!mat?.emissive) return
  if (on && !ojo.guardado) {
    ojo.guardado = { color: mat.color.clone(), emissive: mat.emissive.clone(), intensidad: mat.emissiveIntensity }
    mat.color.setRGB(0, 0, 0)
    mat.emissive.copy(OJOS.rojo)
    mat.emissiveIntensity = 1
  } else if (!on && ojo.guardado) {
    mat.color.copy(ojo.guardado.color)
    mat.emissive.copy(ojo.guardado.emissive)
    mat.emissiveIntensity = ojo.guardado.intensidad
    ojo.guardado = null
  }
}

function PicarOjos({ modelo, rigRef, escenaRef, fitRef, activoAhora }) {
  const { gl, camera } = useThree()
  const ojosRef = useRef([])
  const punteroRef = useRef({ x: 0, y: 0, sucio: false, ultimo: 0, encima: false })
  const activoRef = useRef(false)
  const tmp = useMemo(() => ({ s: new THREE.Sphere(), v: new THREE.Vector3(), c: new THREE.Vector3() }), [])

  // Cada ojo es su globo (material "Eyes") y su pupila, emparentados por
  // nombre (Skull043 / Skull043_1), y su copia para volar, fuera de cuadro.
  useEffect(() => {
    const rig = rigRef.current
    if (!rig) return undefined
    const porNombre = new Map()
    modelo.traverse((o) => {
      if (!o.isSkinnedMesh) return
      const mat = Array.isArray(o.material) ? o.material[0] : o.material
      const nombre = mat?.name || ''
      const esGlobo = /^eyes$/i.test(nombre)
      if (!esGlobo && !/pupil/i.test(nombre)) return
      const clave = o.name.replace(/_\d+$/, '')
      if (!porNombre.has(clave)) {
        porNombre.set(clave, { mallas: [], globo: null, piquetes: 0, estado: 'puesto', vuelveEn: 0, destelloT: -1, guardado: null, parpadeoT: -1, copia: null })
      }
      const ojo = porNombre.get(clave)
      ojo.mallas.push(o)
      if (esGlobo) ojo.globo = o
    })
    const ojos = [...porNombre.values()].filter((o) => o.globo)
    for (const ojo of ojos) {
      const grupo = new THREE.Group()
      grupo.position.set(0, -100, 0)
      for (const m of ojo.mallas) {
        const g = new THREE.BufferGeometry()
        g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3))
        g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]), 3))
        const copia = new THREE.Mesh(g, m.material)
        copia.frustumCulled = false
        grupo.add(copia)
      }
      rig.add(grupo)
      ojo.copia = { grupo, vel: new THREE.Vector3(), giro: new THREE.Vector3(), radio: 0.05, vuela: false }
    }
    ojosRef.current = ojos
    return () => {
      for (const ojo of ojos) {
        destello(ojo, false)
        for (const m of ojo.mallas) m.visible = true
        rig.remove(ojo.copia.grupo)
        ojo.copia.grupo.traverse((o) => { if (o.isMesh) o.geometry.dispose() })
      }
      ojosRef.current = []
    }
  }, [modelo, rigRef])

  const centroDe = useCallback((ojo, out) => {
    ojo.globo.computeBoundingSphere()
    tmp.s.copy(ojo.globo.boundingSphere).applyMatrix4(ojo.globo.matrixWorld)
    out.copy(tmp.s.center)
    return tmp.s.radius
  }, [tmp])

  const tocado = useCallback((x, y) => {
    const rect = gl.domElement.getBoundingClientRect()
    if (!rect.width) return null
    for (const ojo of ojosRef.current) {
      if (ojo.estado !== 'puesto') continue
      const r = centroDe(ojo, tmp.c)
      tmp.v.copy(tmp.c).project(camera)
      const sx = rect.left + (tmp.v.x + 1) * 0.5 * rect.width
      const sy = rect.top + (1 - tmp.v.y) * 0.5 * rect.height
      // Ortográfica de R3F: una unidad de mundo son `zoom` pixeles. Un poco
      // más que el ojo y nunca menos de 14 px: en el teléfono el dedo es grueso.
      if (Math.hypot(x - sx, y - sy) <= Math.max(14, r * camera.zoom * 1.1)) return ojo
    }
    return null
  }, [gl, camera, centroDe, tmp])

  // En desarrollo, `window.__ojos()` da el estado y el lugar en pantalla de
  // cada ojo (para probar los piquetes).
  useEffect(() => {
    if (!import.meta.env.DEV) return undefined
    window.__ojos = () => {
      const rect = gl.domElement.getBoundingClientRect()
      return ojosRef.current.map((ojo) => {
        const r = centroDe(ojo, tmp.c)
        tmp.v.copy(tmp.c).project(camera)
        return {
          estado: ojo.estado, piquetes: ojo.piquetes, visible: ojo.globo.visible,
          x: Math.round(rect.left + (tmp.v.x + 1) * 0.5 * rect.width),
          y: Math.round(rect.top + (1 - tmp.v.y) * 0.5 * rect.height),
          r: Math.round(r * camera.zoom),
          copia: ojo.copia ? ojo.copia.grupo.position.toArray().map((n) => +n.toFixed(2)) : null,
        }
      })
    }
    return () => { delete window.__ojos }
  }, [gl, camera, centroDe, tmp])

  // El ojo se hornea en su pose de este cuadro (con la piel aplicada) en la
  // copia rígida, en el espacio del contenedor, y la original se oculta.
  const saltar = useCallback((ojo) => {
    const rig = rigRef.current
    if (!rig || !ojo.copia) return
    ojo.estado = 'fuera'
    ojo.parpadeoT = -1
    const centro = new THREE.Vector3()
    const radio = centroDe(ojo, centro)
    const otro = ojosRef.current.find((o) => o !== ojo)
    const lado = otro ? Math.sign(centro.x - centroDe(otro, tmp.c)) || 1 : 1
    rig.updateMatrixWorld(true)
    const aRig = rig.matrixWorld.clone().invert()
    const centroRig = centro.clone().applyMatrix4(aRig)
    const v = new THREE.Vector3()
    ojo.mallas.forEach((m, k) => {
      const pos = m.geometry.attributes.position
      const arr = new Float32Array(pos.count * 3)
      for (let i = 0; i < pos.count; i += 1) {
        m.getVertexPosition(i, v)
        v.applyMatrix4(m.matrixWorld).applyMatrix4(aRig).sub(centroRig)
        arr[i * 3] = v.x; arr[i * 3 + 1] = v.y; arr[i * 3 + 2] = v.z
      }
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.BufferAttribute(arr, 3))
      // Copias: compartir los de la malla original y luego tirar la copia le
      // borraba sus buffers.
      if (m.geometry.attributes.uv) g.setAttribute('uv', m.geometry.attributes.uv.clone())
      if (m.geometry.index) g.setIndex(m.geometry.index.clone())
      g.computeVertexNormals()
      const copia = ojo.copia.grupo.children[k]
      copia.geometry.dispose()
      copia.geometry = g
      m.visible = false
    })
    const c = ojo.copia
    c.grupo.position.copy(centroRig)
    c.grupo.rotation.set(0, 0, 0)
    c.radio = radio / Math.max(1e-6, rig.getWorldScale(v).x)
    c.vel.set(lado * (0.8 + Math.random() * 0.4), 2.6 + Math.random() * 0.6, 1.0)
    c.giro.set((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 12)
    c.vuela = true
    ojo.vuelveEn = OJOS.vuelveMs
    playEyePop()
  }, [rigRef, centroDe, tmp])

  // Todo a su lugar: al terminar la historia los ojos regresan sin parpadeo.
  const reponer = useCallback(() => {
    activoRef.current = false
    for (const ojo of ojosRef.current) {
      destello(ojo, false)
      Object.assign(ojo, { piquetes: 0, estado: 'puesto', destelloT: -1, parpadeoT: -1, vuelveEn: 0 })
      for (const m of ojo.mallas) m.visible = true
      if (ojo.copia) { ojo.copia.vuela = false; ojo.copia.grupo.position.set(0, -100, 0) }
    }
    if (punteroRef.current.encima) { punteroRef.current.encima = false; document.body.style.cursor = '' }
  }, [])

  useEffect(() => {
    const abajo = (ev) => {
      const e = escenaRef?.current
      if (!activoAhora() || e?.pausa != null) return
      if (ev.button !== 0 || esUi(ev.target)) return
      const ojo = tocado(ev.clientX, ev.clientY)
      if (!ojo) return
      ojo.piquetes += 1
      if (ojo.piquetes >= OJOS.piquetes) { destello(ojo, false); ojo.destelloT = -1; saltar(ojo); return }
      ojo.destelloT = 0
      playEyePoke(ojo.piquetes)
    }
    const mueve = (ev) => {
      const p = punteroRef.current
      p.x = ev.clientX; p.y = ev.clientY; p.sucio = true
    }
    window.addEventListener('pointerdown', abajo, true)
    window.addEventListener('pointermove', mueve, { passive: true })
    return () => {
      window.removeEventListener('pointerdown', abajo, true)
      window.removeEventListener('pointermove', mueve)
      if (punteroRef.current.encima) document.body.style.cursor = ''
    }
  }, [escenaRef, tocado, saltar, activoAhora])

  useFrame((_, delta) => {
    const e = escenaRef?.current
    if (!e || !activoAhora()) {
      if (activoRef.current) reponer()
      return
    }
    activoRef.current = true
    // En pausa todo se queda donde iba, como el resto del video.
    const enPausa = e.pausa != null
    const dt = enPausa ? 0 : Math.min(0.05, delta || 0)
    const ahora = performance.now()

    // La mano sobre el ojo: la única pista de que se puede picar.
    const p = punteroRef.current
    if (p.sucio && ahora - p.ultimo > 90) {
      p.sucio = false
      p.ultimo = ahora
      const encima = !enPausa && !!tocado(p.x, p.y) && !esUi(document.elementFromPoint(p.x, p.y))
      if (encima !== p.encima) {
        p.encima = encima
        document.body.style.cursor = encima ? 'pointer' : ''
      }
    }

    const piso = fitRef.current?.piso ?? 0
    for (const ojo of ojosRef.current) {
      if (ojo.estado === 'fuera') {
        ojo.vuelveEn -= dt * 1000
        if (ojo.vuelveEn <= 0) {
          ojo.estado = 'puesto'
          ojo.piquetes = 0
          ojo.parpadeoT = 0
          if (ojo.copia) { ojo.copia.vuela = false; ojo.copia.grupo.position.set(0, -100, 0) }
          playEyeRespawn()
        }
      }
      // Reaparece parpadeando, como un enemigo que respawnea, y se queda.
      if (ojo.parpadeoT >= 0 && ojo.estado === 'puesto') {
        ojo.parpadeoT += dt * 1000
        const listo = ojo.parpadeoT >= OJOS.parpadeoMs
        const visible = listo || Math.floor(ojo.parpadeoT / OJOS.pasoParpadeoMs) % 2 === 0
        for (const m of ojo.mallas) m.visible = visible
        if (listo) ojo.parpadeoT = -1
      }
      // Dos destellos duros, sin fundido: así se lee el golpe.
      if (ojo.destelloT >= 0) {
        ojo.destelloT += dt * 1000
        const listo = ojo.destelloT >= OJOS.destelloMs
        destello(ojo, !listo && Math.floor(ojo.destelloT / (OJOS.destelloMs / 4)) % 2 === 0)
        if (listo) ojo.destelloT = -1
      }
      // La copia vuela, rebota en el piso y se va quedando.
      const c = ojo.copia
      if (c?.vuela && dt > 0) {
        c.vel.y -= OJOS.gravedad * dt
        c.grupo.position.addScaledVector(c.vel, dt)
        c.grupo.rotation.x += c.giro.x * dt
        c.grupo.rotation.y += c.giro.y * dt
        c.grupo.rotation.z += c.giro.z * dt
        const suelo = piso + c.radio
        if (c.grupo.position.y < suelo) {
          c.grupo.position.y = suelo
          if (c.vel.y < 0) {
            const golpe = -c.vel.y
            c.vel.y = golpe * OJOS.rebote
            c.vel.x *= 0.7
            c.vel.z *= 0.7
            c.giro.multiplyScalar(0.6)
            if (golpe > 0.8) playOrbBounce(Math.min(1, golpe / 4) * 0.6, 0.08)
          }
        }
      }
    }
  })

  return null
}

function FallingSkulley({ progressRef, timingRef, fitRef, onMedido, personalizaRef, escenaRef, miraCursor = false, picarEnInicio = false }) {
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
          // La skin activa (shader) en cuerpo y pelo, antes del banding.
          prepareSkinMaterial(mm)
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

  // Los ojos se pican en la historia y en la pantalla principal (Oscar), con
  // Skulley entero y quieto: sin el rayo, sin desarmar y sin el personalizador.
  const picarRef = useRef(picarEnInicio)
  picarRef.current = picarEnInicio
  const ojosActivos = useCallback(() => {
    if (escenaRef?.current?.enHistoria) return true
    return Boolean(picarRef.current)
      && (progressRef?.current || 0) <= 0.001
      && (personalizaRef?.current?.m || 0) <= 0.01
      && liveRef.current?.visible !== false
  }, [escenaRef, progressRef, personalizaRef])
  const apuntaFino = useMemo(() => {
    try { return window.matchMedia('(pointer: fine)').matches } catch { return false }
  }, [])
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

  useSkinColors(cloned)

  // El numerito de "Conocer la historia" (lib/numeritoCabeza.js): corre
  // mientras `escenaRef.current.cabeza` tenga la hora en que arrancó. Va
  // después del mixer (useAnimations se registró antes) y antes de que se
  // dibuje.
  const numeritoRef = useRef(null)
  const orbeRef = useRef(null)
  const esferaManoRef = useRef(null)
  const mixerEnPausaRef = useRef(false)
  useFrame((_, delta) => {
    // En desarrollo, `window.__numeritoT = 2.7` congela el numerito en ese segundo.
    // Se prepara al montar (las piezas rígidas del cuello cuestan unos
    // milisegundos), no al empezar, para que no dé un tirón en el chiste.
    if (!escenaRef || !cloned) return
    // La esfera verde de la mano no sale en la historia (Oscar: se veía mal
    // cuando agarra la cabeza y la esfera seguía ahí). Se encoge en lo oscuro
    // y regresa con las luces; casi a cero y no oculta, para no recompilar.
    if (esferaManoRef.current === null) {
      const esfera = cloned.getObjectByName('Egg_EnergyBall')
      esferaManoRef.current = esfera ? { esfera, escala: esfera.scale.clone(), m: 1 } : false
    }
    const mano = esferaManoRef.current
    if (mano) {
      const objetivo = escenaRef.current.sinEsfera ? 0 : 1
      if (mano.m !== objetivo) {
        mano.m += (objetivo - mano.m) * (1 - Math.exp(-6 * Math.min(0.05, delta || 0)))
        if (Math.abs(objetivo - mano.m) < 0.002) mano.m = objetivo
        mano.esfera.scale.copy(mano.escala).multiplyScalar(Math.max(1e-4, mano.m))
      }
    }
    // Con la historia en pausa también se detienen las animaciones del GLB
    // (el idle y la caminata): el numerito ya se queda en la hora de la pausa.
    // Sin tocar el mixer cuando lo congeló el desarme o el wallpaper.
    const enPausa = escenaRef.current.pausa != null
    if (enPausa !== mixerEnPausaRef.current) {
      mixerEnPausaRef.current = enPausa
      if (mixer && !prep.current.frozen && !quietoRef.current) mixer.timeScale = enPausa ? 0 : 1
    }
    if (numeritoRef.current === null) {
      if (!actions || !idleRef.current || !orbeRef.current) return
      numeritoRef.current = crearNumerito(cloned, {
        idle: idleRef.current,
        camina: actions['root|root|Walking'] || null,
        orbe: orbeRef.current,
      }) || false
    }
    const fijo = import.meta.env.DEV ? window.__numeritoT : null
    const desde = escenaRef.current?.cabeza
    if (fijo == null && desde == null) {
      if (numeritoRef.current) numeritoRef.current.soltar()
      escenaRef.current.blanco = null
      escenaRef.current.camaraX = 0
      escenaRef.current.camaraZ = 0
      return
    }
    if (!numeritoRef.current || !rigRef.current || !fit.current?.ready) return
    // A dónde apunta el foco que lo sigue (LucesEscena). Con la historia en
    // pausa (pestaña oculta) se queda en la hora de la pausa.
    const ahora = escenaRef.current.pausa ?? performance.now()
    const tNum = fijo ?? (ahora - desde) / 1000
    const t0 = import.meta.env.DEV ? performance.now() : 0
    const blanco = numeritoRef.current.aplicar(tNum, rigRef.current, fit.current)
    if (import.meta.env.DEV && window.__numeritoPiso) {
      const ms = performance.now() - t0
      const r = numeritoRef.current.medirTodo()
      ;(window.__numeritoLog ||= []).push({ t: +tNum.toFixed(3), cuerpo: r.cuerpo - fit.current.piso, cabeza: r.cabeza - fit.current.piso, hc: r.huesoCuerpo, hk: r.huesoCabeza, alto: fit.current.alto, py: cloned.position.y, ms })
    }
    escenaRef.current.blanco = blanco
    // La cámara se mueve con él: siempre al centro y a la misma altura, sin
    // retraso (Oscar), porque su camino ya arranca y frena suave. Antes lo
    // perseguía a la mitad y se veía desfasada: arrancaba tarde y seguía
    // moviéndose hasta un segundo después de que él se paraba. También va con
    // él hacia la cámara (z): vista desde arriba, al acercarse bajaba en el
    // cuadro y los subtítulos le tapaban los pies. Sigue al cuerpo, no a
    // `blanco`, que al ir por la cabeza se corre hacia ella. El empujón del
    // golpe no la mueve.
    const cuerpo = cloned.getWorldPosition(_camaraCuerpo)
    const anda = tNum >= NUMERITO.despiste
    escenaRef.current.camaraX = anda ? cuerpo.x : 0
    escenaRef.current.camaraZ = anda ? cuerpo.z : 0
  })

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
  const quietoRef = useRef(false)

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

  const suavizado = useRef({ y: null, zoom: null, pitch: 0, x: 0, camaraX: 0, camaraZ: 0 })
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

    // Desde que se pide el wallpaper hasta que cambias algo, Skulley se queda
    // en la pose del archivo: lo que ves en el marco es lo que se guarda. Con
    // zoom, el idle movía la cara hasta un 7 % del marco.
    const quieto = Boolean(personalizaRef?.current?.quieto)
    if (quieto !== quietoRef.current && !prep.current.frozen) {
      quietoRef.current = quieto
      try { if (mixer) mixer.timeScale = quieto ? 0 : 1 } catch { }
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
    // Personalizando se suma el giro del dedo. Al cerrar regresa a cero antes
    // de que la historia avance: las piezas se hornean con este giro y, si
    // no, caerían en otro lugar.
    if (rigRef.current) {
      rigRef.current.rotation.y = suave(ramp(p, GIRO_START, HIT)) * Math.PI * 2 + (personalizaRef?.current?.giroVisto || 0)
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

    // ── Personalizando: cuerpo entero sobre el panel ─────────────────────
    // La barra de arriba y el panel con su aviso tapan los bordes (`arriba` y
    // `abajo`, fracciones de la pantalla): el personaje se centra en lo que
    // queda libre. Encima, el zoom y el paneo de los dedos.
    const pers = personalizaRef?.current
    const m = pers?.m || 0
    if (m > 0) {
      const arriba = pers.arriba || 0
      // El tope de abajo es solo contra medidas absurdas: en un teléfono de
      // 640 px de alto lo libre es ~25 % y con 0.3 Skulley pisaba el aviso.
      const libre = Math.max(0.15, 1 - (pers.abajo || 0.42) - arriba)
      const verP = alto / (libre * PERSONALIZA_LLENA)
      const dondeVa = arriba + libre / 2
      // `zoomMin`: la historia abre el plano del numerito más que el cuerpo
      // entero (zoom menor que 1); los dedos no bajan de 1.
      const zoom = Math.min(PERSONALIZA_ZOOM_MAX, Math.max(pers.zoomMin || 1, pers.zoom || 1))
      verAlto = lerp(verAlto, verP / zoom, m)
      centroS = lerp(centroS, enPantalla(midY, 0) - (0.5 - dondeVa) * verP + (pers.panY || 0) * verP, m)
      // `pitch` (radianes): "Conocer la historia" cambia de ángulo entre tomas
      // (picado, contrapicado); sin él, el de siempre.
      pitchObj = lerp(pitchObj, Number.isFinite(pers.pitch) ? pers.pitch : PITCH * 0.4, m)
      mirarX = lerp(mirarX, (pers.panX || 0) * verP, m)
    }

    // ── Wallpaper: el marco ──────────────────────────────────────────────
    // El marco (lo mide el personalizador, en fracciones de la pantalla) es
    // el archivo: aquí se abre el cuadro de la pantalla para que lo que cae
    // adentro sea exactamente el encuadre del wallpaper. Las líneas se miden
    // como en el archivo (`vista`): si no, en el marco se verían más gruesas.
    const enMarco = Boolean(pers?.wall && pers.marco)
    posterNormalTexture.vista = enMarco && pers.marco.w ? WALLPAPER_CSS_W / pers.marco.w : 1
    if (enMarco) {
      if (pers.plano) {
        const base = alto / WALLPAPER_CUERPO_LLENA
        pers.zoom = pers.plano === 'cara' ? base / (alto * WALLPAPER_CARA_VE) : 1
        pers.panX = 0
        pers.panY = pers.plano === 'cara' ? (headY - midY) / base - (WALLPAPER_CUERPO_CENTRO - 0.5) : 0
        pers.plano = null
      }
      const e = encuadreWallpaper(pers, fit.current)
      const verW = e.vh / pers.marco.h
      verAlto = verW
      centroS = e.centro + (pers.marco.cy - 0.5) * verW
      pitchObj = e.pitch
      mirarX = e.x
    }

    // ── Wallpaper: el cuadro de la captura ───────────────────────────────
    // El mismo encuadre del marco, sin persecución: lo que dejaste en
    // pantalla, con el giro tal cual (lo pone el contenedor arriba, y aquí no
    // se toca). CapturaWallpaper ya puso el canvas y la cámara a su tamaño. El
    // suavizado no se toca: el siguiente cuadro sigue como si nada.
    const cap = pers?.captura
    if (cap?.fase === 'render') {
      const e = encuadreWallpaper(pers, fit.current)
      const y = e.centro / Math.cos(e.pitch)
      camera.position.set(e.x, y + Math.sin(e.pitch) * 10, Math.cos(e.pitch) * 10)
      camera.lookAt(e.x, y, 0)
      camera.zoom = cap.h / e.vh
      camera.updateProjectionMatrix()
      return
    }

    // Persecución suave. El scroll llega a ráfagas (y en iOS con rebote), así
    // que ni el zoom, ni la altura, ni la inclinación se asignan directo:
    // persiguen. Sin esto se siente escalonado en cuanto el dedo se despega.
    const objetivoZoom = size.height / Math.max(0.01, verAlto)
    // La cámara mira a (0, y, 0); su centro en pantalla es y·cos(pitch).
    const objetivoY = centroS / Math.max(0.2, cp)
    // `corte`: un corte de cámara (la historia del preloader lo da a negro):
    // va directo al encuadre nuevo, sin perseguirlo.
    // `camaraX` / `camaraZ` (mundo): en el numerito la cámara se mueve con
    // Skulley (lo pone el numerito, arriba). Mientras corre va pegada a él,
    // sin persecución (con ella se veía desfasada); al soltarlo regresa
    // persiguiendo, salvo en un corte.
    const camaraX = (escenaRef?.current?.camaraX || 0) * m
    const camaraZ = (escenaRef?.current?.camaraZ || 0) * m
    const conNumerito = escenaRef?.current?.cabeza != null
    if (pers?.corte) { sv.y = null; pers.corte = false }
    if (sv.y === null) { sv.y = objetivoY; sv.zoom = objetivoZoom; sv.pitch = pitchObj; sv.x = mirarX; sv.camaraX = camaraX; sv.camaraZ = camaraZ }
    // Con dos dedos encima, la cámara va pegada a ellos: con la persecución
    // el zoom se sentía flotado, atrasado respecto al pellizco.
    const sigue = pers?.pellizcando && m >= 0.999 ? 1 : 0.12
    sv.y += (objetivoY - sv.y) * sigue
    sv.zoom += (objetivoZoom - sv.zoom) * sigue
    sv.pitch += (pitchObj - sv.pitch) * sigue
    sv.x += (mirarX - sv.x) * sigue
    sv.camaraX = conNumerito ? camaraX : sv.camaraX + (camaraX - sv.camaraX) * sigue
    sv.camaraZ = conNumerito ? camaraZ : sv.camaraZ + (camaraZ - sv.camaraZ) * sigue
    const x = sv.x + sv.camaraX
    const z = sv.camaraZ

    camera.position.set(x, sv.y + Math.sin(sv.pitch) * 10, Math.cos(sv.pitch) * 10 + z)
    camera.lookAt(x, sv.y, z)
    camera.zoom = sv.zoom
    camera.updateProjectionMatrix()
  })

  return (
    <group ref={rigRef}>
      <primitive object={cloned} ref={liveRef} />
      <group ref={piecesRef} />
      {/* La esfera que le tumba la cabeza en el numerito. Se dibuja siempre
          (fuera de cuadro, muy abajo) para que su shader se compile al montar
          y no al entrar. Va dentro del contenedor del personaje: el pase de
          normales le pone su contorno de tinta y la sombra la ve. */}
      {escenaRef && (
        <mesh ref={orbeRef} position={[0, -100, 0]} frustumCulled={false}>
          <sphereGeometry args={[0.13, 32, 20]} />
          <meshBasicMaterial color="#ff6b00" toneMapped={false} />
        </mesh>
      )}
      {escenaRef && <PicarOjos modelo={cloned} rigRef={rigRef} escenaRef={escenaRef} fitRef={fitRef} activoAhora={ojosActivos} />}
      {/* En la pantalla principal la cabeza y los ojos siguen un poco al
          cursor, como el retrato (Oscar). Solo con mouse: con el dedo seguiría
          al scroll. Fuera de ahí se suelta para no pelear con el numerito. */}
      {escenaRef && apuntaFino && <CameraAim modelRef={liveRef} activo={miraCursor} prioridad={0.9} />}
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

// ── Las luces y el foco ──────────────────────────────────────────────────
// Más luz que el cartel de escritorio (Oscar, 2026-11-02: se veía oscuro, como
// si solo lo alumbrara el rim). Sube la key y, sobre todo, el relleno y el
// ambiente, que son los que levantan la banda de sombra del toon sin lavar la
// de luz.
const LUZ_KEY = 2.25
const LUZ_RELLENO = 0.8
const LUZ_AMBIENTE = 1.05
// El foco de teatro de la historia del preloader de escritorio (Oscar): se
// apagan las luces, queda Skulley a oscuras con su rim (el contraluz cian del
// toon, que no depende de las luces) y se prende un foco desde arriba, con su
// haz en el aire y su charco en el piso. `alto` y `adelante`: dónde cuelga,
// en altos del personaje sobre la coronilla y hacia la cámara (un poco al
// frente para que le dé en la cara). El haz se ve un poco más angosto que la
// luz, como el centro de un foco real.
// Con intensidad alta el toon (2 bandas) subía hasta el pecho a la banda de
// luz y se veía parejo: así, lo de arriba (cráneo, hombros, el lomo de cada
// costilla) queda en luz y lo de enfrente en media sombra.
const ABAJO = new THREE.Vector3(0, -1, 0)
const FOCO = { intensidad: 1.8, angulo: 0.32, penumbra: 0.5, alto: 1.3, adelante: 0.3, color: '#fff1d6', haz: 0.22, charco: 0.5, anchoHaz: 0.82 }

const HAZ_VERT = /* glsl */`
  varying vec3 vN;
  varying float vY;
  varying float vX;
  void main() {
    vY = uv.y;
    vX = uv.x;
    vN = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
// Un volumen de luz se ve más denso al centro (más aire que atravesar) y se
// desvanece en las orillas; más fuerte cerca del foco. La cámara es
// ortográfica: la vista siempre es (0, 0, 1). Encima, luz de cine (Oscar):
// rayos que salen del foco, franjas a lo largo del cono (van con su vuelta,
// `vX`, así se abren desde la punta) que cambian de brillo despacio, como
// polvo que pasa, y motas de polvo que caen y titilan. Todo en este shader:
// sin luces nuevas ni pases de post, casi gratis.
const HAZ_FRAG = /* glsl */`
  uniform vec3 uColor;
  uniform float uAlpha;
  uniform float uTiempo;
  varying vec3 vN;
  varying float vY;
  varying float vX;
  float hash(float n) { return fract(sin(n) * 43758.5453); }
  // Ruido que se repite cada p celdas: la vuelta del cono (vX) brinca de 1 a
  // 0 justo de frente a la cámara, y un ruido sin repetir dejaba ahí una
  // orilla dura de arriba a abajo.
  float ruido(float x, float p) {
    float i = floor(x);
    float f = fract(x);
    f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
    return mix(hash(mod(i, p)), hash(mod(i + 1.0, p)), f);
  }
  void main() {
    float centro = pow(abs(dot(normalize(vN), vec3(0.0, 0.0, 1.0))), 1.8);
    // Anchos y suaves (Oscar: difuminados, no duros, "finura"): pocas franjas
    // por vuelta y poco contraste entre ellas, para que se fundan.
    float r = 0.6 * ruido(vX * 10.0 + uTiempo * 0.2, 10.0) + 0.4 * ruido(vX * 20.0 - uTiempo * 0.13 + 5.0, 20.0);
    float rayos = mix(0.75, 1.2, r);
    // El polvo: motas de un pixel, pocas y tenues, que caen despacio.
    vec2 g = vec2(vX * 420.0, vY * 170.0 + uTiempo * 2.0);
    vec2 celda = floor(g);
    float h = fract(sin(dot(celda, vec2(127.1, 311.7))) * 43758.5453);
    float mota = step(0.988, h) * smoothstep(0.16, 0.0, length(fract(g) - 0.5))
      * (0.5 + 0.5 * sin(uTiempo * 2.2 + h * 40.0));
    float a = centro * (rayos * mix(0.3, 1.0, vY) + mota * 0.5) * uAlpha;
    gl_FragColor = vec4(uColor, a);
  }
`
// El charco en el piso: lleno al centro y se apaga suave hasta la orilla
// (Oscar: la orilla dura de antes se veía muy dura).
const CHARCO_FRAG = /* glsl */`
  uniform vec3 uColor;
  uniform float uAlpha;
  varying vec2 vUv;
  void main() {
    float r = length(vUv - 0.5) * 2.0;
    float a = 1.0 - smoothstep(0.12, 1.0, r);
    gl_FragColor = vec4(uColor, a * a * 0.85 * uAlpha);
  }
`
const CHARCO_VERT = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

// Polvo mágico de la historia (Oscar): motas finas que flotan despacio
// alrededor de Skulley y titilan como luciérnagas; las que cruzan el haz del
// foco brillan más, como polvo que agarra la luz. Salen y se van con el foco.
// Un solo objeto de puntos: el campo se repite en una caja alrededor de la
// cámara (`ancho` y `fondo` en unidades del rig, `alto` en altos de Skulley),
// así siempre hay polvo cerca aunque la cámara lo siga, y se apaga en las
// orillas de la caja para que ninguna mota aparezca de golpe. `tam`: el tamaño
// en pixeles (de la más fina a la más grande, pocas).
const POLVO = { cuantas: 260, ancho: 8, fondo: 4, alto: 2, tam: [1.6, 4.2], color: '#ffe6b0', brillo: 1 }
const POLVO_VERT = /* glsl */`
  uniform float uTiempo;
  uniform float uDeriva;
  uniform float uPx;
  uniform vec3 uCentro;
  uniform vec3 uCaja;
  uniform vec3 uPunta;
  uniform vec3 uSigue;
  uniform float uRadio;
  attribute float aFase;
  attribute float aVel;
  attribute float aTam;
  varying float vBrillo;
  void main() {
    float t = uTiempo * aVel * uDeriva;
    vec3 rel = vec3(
      position.x + sin(t * 0.37 + aFase) * 0.22 + sin(t * 0.13 + aFase * 2.1) * 0.35 - uCentro.x,
      position.y * uCaja.y + t * 0.06 + sin(t * 0.29 + aFase * 1.3) * 0.12,
      position.z + cos(t * 0.31 + aFase * 0.7) * 0.22 - uCentro.z);
    rel.x = mod(rel.x + uCaja.x * 0.5, uCaja.x) - uCaja.x * 0.5;
    rel.z = mod(rel.z + uCaja.z * 0.5, uCaja.z) - uCaja.z * 0.5;
    rel.y = mod(rel.y, uCaja.y);
    vec3 w = uCentro + rel;
    float orilla = (1.0 - smoothstep(0.38, 0.5, abs(rel.x / uCaja.x))) * (1.0 - smoothstep(0.38, 0.5, abs(rel.z / uCaja.z)))
      * smoothstep(0.0, 0.1, rel.y / uCaja.y) * (1.0 - smoothstep(0.85, 1.0, rel.y / uCaja.y));
    float titila = 0.45 + 0.55 * pow(0.5 + 0.5 * sin(uTiempo * (0.7 + aVel) + aFase * 6.0), 2.0);
    vec3 eje = uSigue - uPunta;
    vec3 d = w - uPunta;
    float k = clamp(dot(d, eje) / max(1e-4, dot(eje, eje)), 0.0, 1.0);
    float enHaz = 1.0 - smoothstep(uRadio * k * 0.6, uRadio * k * 1.1 + 1e-3, length(d - eje * k));
    vBrillo = orilla * titila * (0.75 + 0.8 * enHaz);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(w, 1.0);
    gl_PointSize = aTam * uPx;
  }
`
const POLVO_FRAG = /* glsl */`
  uniform vec3 uColor;
  uniform float uAlpha;
  varying float vBrillo;
  // Un centro sólido y un halo suave: las motas miden 2 o 3 pixeles, y con un
  // desvanecido parejo el centro de cada pixel apenas llevaba luz.
  void main() {
    float r = length(gl_PointCoord - 0.5) * 2.0;
    float centro = 1.0 - smoothstep(0.3, 0.75, r);
    float halo = (1.0 - r) * (1.0 - r) * 0.45;
    gl_FragColor = vec4(uColor, max(centro, halo) * vBrillo * uAlpha);
  }
`
function geometriaPolvo() {
  // Al azar pero siempre igual (semilla fija).
  let semilla = 7
  const azar = () => { semilla = (semilla * 16807) % 2147483647; return (semilla - 1) / 2147483646 }
  const n = POLVO.cuantas
  const pos = new Float32Array(n * 3)
  const fase = new Float32Array(n)
  const vel = new Float32Array(n)
  const tam = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    pos[i * 3] = (azar() - 0.5) * POLVO.ancho
    pos[i * 3 + 1] = azar()
    pos[i * 3 + 2] = (azar() - 0.5) * POLVO.fondo
    fase[i] = azar() * Math.PI * 2
    vel[i] = 0.5 + azar()
    tam[i] = POLVO.tam[0] + Math.pow(azar(), 3) * (POLVO.tam[1] - POLVO.tam[0])
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('aFase', new THREE.BufferAttribute(fase, 1))
  g.setAttribute('aVel', new THREE.BufferAttribute(vel, 1))
  g.setAttribute('aTam', new THREE.BufferAttribute(tam, 1))
  return g
}

// `escenaRef` (opcional): { ambiente, foco } de 0 a 1, que la historia mueve
// por cuadro. Sin él las luces se quedan fijas y no se monta el foco. Con él
// el foco existe desde el primer cuadro con intensidad 0, y el haz y el charco
// se dibujan siempre (transparentes en 0): una luz que aparece después
// recompila todos los materiales iluminados, y un shader que se dibuja por
// primera vez se compila en ese cuadro, justo al prenderse (CLAUDE.md, tirones
// por compilación). Igual el polvo.
function LucesEscena({ escenaRef, fitRef }) {
  const keyRef = useRef(null)
  const rellenoRef = useRef(null)
  const ambienteRef = useRef(null)
  const focoRef = useRef(null)
  const hazRef = useRef(null)
  const charcoRef = useRef(null)
  const objetivo = useMemo(() => new THREE.Object3D(), [])
  const colocado = useRef(false)
  const recursos = useMemo(() => {
    if (!escenaRef) return null
    const color = new THREE.Color(FOCO.color)
    // El cono con la punta en el origen y la base en y = -1, radio 1: se escala
    // al personaje cuando ya se midió.
    const hazGeo = new THREE.CylinderGeometry(0.03, 1, 1, 48, 1, true)
    hazGeo.translate(0, -0.5, 0)
    const charcoGeo = new THREE.PlaneGeometry(2, 2)
    charcoGeo.rotateX(-Math.PI / 2)
    const comun = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }
    let quieto = false
    try { quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { }
    return {
      hazGeo,
      charcoGeo,
      polvoGeo: geometriaPolvo(),
      polvoMat: new THREE.ShaderMaterial({
        ...comun,
        vertexShader: POLVO_VERT,
        fragmentShader: POLVO_FRAG,
        uniforms: {
          uColor: { value: new THREE.Color(POLVO.color) },
          uAlpha: { value: 0 },
          uTiempo: { value: 0 },
          // Con menos movimiento solo titilan.
          uDeriva: { value: quieto ? 0 : 1 },
          uPx: { value: 1 },
          uCentro: { value: new THREE.Vector3() },
          uCaja: { value: new THREE.Vector3(POLVO.ancho, 1, POLVO.fondo) },
          uPunta: { value: new THREE.Vector3() },
          uSigue: { value: new THREE.Vector3() },
          uRadio: { value: 1 },
        },
      }),
      hazMat: new THREE.ShaderMaterial({ ...comun, vertexShader: HAZ_VERT, fragmentShader: HAZ_FRAG, uniforms: { uColor: { value: color }, uAlpha: { value: 0 }, uTiempo: { value: 0 } } }),
      charcoMat: new THREE.ShaderMaterial({ ...comun, vertexShader: CHARCO_VERT, fragmentShader: CHARCO_FRAG, uniforms: { uColor: { value: color }, uAlpha: { value: 0 } } }),
    }
  }, [escenaRef])
  useEffect(() => () => {
    if (!recursos) return
    for (const r of Object.values(recursos)) { try { r.dispose() } catch { } }
  }, [recursos])

  useFrame((state, delta) => {
    const e = escenaRef?.current
    if (!e) return
    const a = Math.max(0, Math.min(1, e.ambiente ?? 1))
    if (keyRef.current) keyRef.current.intensity = LUZ_KEY * a
    if (rellenoRef.current) rellenoRef.current.intensity = LUZ_RELLENO * a
    if (ambienteRef.current) ambienteRef.current.intensity = LUZ_AMBIENTE * a
    const f = fitRef.current
    if (!focoRef.current || !recursos || !f?.ready) return
    if (!colocado.current) {
      colocado.current = {
        punta: new THREE.Vector3(0, f.top + f.alto * FOCO.alto, f.alto * FOCO.adelante),
        sigue: new THREE.Vector3(0, f.piso, 0),
        destino: new THREE.Vector3(),
        eje: new THREE.Vector3(),
      }
      focoRef.current.position.copy(colocado.current.punta)
    }
    // El foco sigue a Skulley cuando camina en el numerito (`blanco`, en
    // mundo), un poco detrás, como un operador de seguidor. Al soltarlo
    // regresa rápido al centro, en un corte a negro.
    const c = colocado.current
    const b = e.blanco
    c.destino.set(b ? b.x : 0, f.piso, b ? b.z : 0)
    c.sigue.lerp(c.destino, 1 - Math.exp(-(b ? 3.2 : 18) * Math.min(0.05, delta || 0)))
    objetivo.position.copy(c.sigue)
    objetivo.updateMatrixWorld()
    c.eje.copy(c.sigue).sub(c.punta)
    const largo = c.eje.length()
    const radio = largo * Math.tan(FOCO.angulo) * FOCO.anchoHaz
    hazRef.current.position.copy(c.punta)
    hazRef.current.quaternion.setFromUnitVectors(ABAJO, c.eje.normalize())
    hazRef.current.scale.set(radio, largo, radio)
    charcoRef.current.position.set(c.sigue.x, f.piso + f.alto * 0.004, c.sigue.z)
    charcoRef.current.scale.set(radio * 1.15, 1, radio * 1.15)
    const foco = Math.max(0, Math.min(1, e.foco ?? 0))
    focoRef.current.intensity = FOCO.intensidad * foco
    recursos.hazMat.uniforms.uAlpha.value = FOCO.haz * foco
    // El polvo del haz se mueve con la historia (con ella en pausa, se queda).
    const paso = foco > 0 && e.pausa == null ? Math.min(0.05, delta || 0) : 0
    recursos.hazMat.uniforms.uTiempo.value += paso
    recursos.charcoMat.uniforms.uAlpha.value = FOCO.charco * foco
    const p = recursos.polvoMat.uniforms
    p.uAlpha.value = POLVO.brillo * foco
    p.uTiempo.value += paso
    p.uPx.value = state.gl.getPixelRatio()
    p.uCentro.value.set(e.camaraX || 0, f.piso, e.camaraZ || 0)
    p.uCaja.value.y = f.alto * POLVO.alto
    p.uPunta.value.copy(c.punta)
    p.uSigue.value.copy(c.sigue)
    p.uRadio.value = radio
  })

  return (
    <>
      <directionalLight ref={keyRef} intensity={LUZ_KEY} position={[3, 4, 3]} color="#fff4e6" />
      <directionalLight ref={rellenoRef} intensity={LUZ_RELLENO} position={[-4, 1, -2]} color="#9fd0ff" />
      <ambientLight ref={ambienteRef} intensity={LUZ_AMBIENTE} />
      {recursos && (
        <>
          <primitive object={objetivo} />
          <spotLight ref={focoRef} target={objetivo} intensity={0} angle={FOCO.angulo} penumbra={FOCO.penumbra} decay={0} color={FOCO.color} />
          <mesh ref={hazRef} geometry={recursos.hazGeo} material={recursos.hazMat} frustumCulled={false} renderOrder={2} />
          {/* Antes que la sombra de Skulley (-18): la sombra oscurece el charco. */}
          <mesh ref={charcoRef} geometry={recursos.charcoGeo} material={recursos.charcoMat} frustumCulled={false} renderOrder={-19} />
          <points geometry={recursos.polvoGeo} material={recursos.polvoMat} frustumCulled={false} renderOrder={3} />
        </>
      )}
    </>
  )
}

// El progreso efectivo (ver PERSONALIZA_*). Prioridad negativa: corre antes que
// el personaje y el rayo, que leen lo que deja en efectivoRef. También mueve
// el giro con el dedo: inercia al soltar y, al cerrar, de regreso al frente
// por el camino corto antes de que la historia avance.
function MezclaPersonaliza({ progressRef, personalizaRef, efectivoRef, fitRef }) {
  useFrame((_, delta) => {
    const real = clamp01(progressRef.current || 0)
    const pz = personalizaRef?.current
    if (!pz) { efectivoRef.current = real; return }
    const dt = Math.min(0.05, delta || 0)
    if (Boolean(pz.wall) !== Boolean(pz.wallVisto)) {
      pz.wallVisto = Boolean(pz.wall)
      pasarPaneo(pz, fitRef.current.alto, pz.wallVisto)
    }
    if (pz.activo) {
      pz.cerrando = false
      pz.mezcla = Math.min(1, pz.mezcla + dt / PERSONALIZA_ENTRA_S)
      if (!pz.arrastrando && pz.vel) {
        pz.giro += pz.vel * dt
        pz.vel *= Math.exp(-GIRO_FRENO * dt)
        if (Math.abs(pz.vel) < 0.02) pz.vel = 0
      }
      pz.giroVisto += (pz.giro - pz.giroVisto) * (1 - Math.exp(-GIRO_SIGUE * dt))
      if (pz.corte) pz.giroVisto = pz.giro
    } else if (pz.mezcla > 0 || pz.giroVisto || (pz.zoom || 1) !== 1 || pz.panX || pz.panY) {
      // Al cerrar, primero se acomoda la cámara —de frente, sin zoom y sin
      // paneo, todo a la vez— y luego la historia avanza.
      if (!pz.cerrando) { pz.cerrando = true; pz.giroVisto = envolver(pz.giroVisto); pz.giro = 0; pz.vel = 0; pz.pellizcando = false }
      const f = Math.exp(-GIRO_REGRESO * dt)
      let quieto = true
      if (Math.abs(pz.giroVisto) > 0.002) { pz.giroVisto *= f; quieto = false } else pz.giroVisto = 0
      if (Math.abs((pz.zoom || 1) - 1) > 0.002) { pz.zoom = 1 + (pz.zoom - 1) * f; quieto = false } else pz.zoom = 1
      if (Math.abs(pz.panX || 0) + Math.abs(pz.panY || 0) > 0.001) { pz.panX *= f; pz.panY *= f; quieto = false } else { pz.panX = 0; pz.panY = 0 }
      if (quieto) pz.mezcla = Math.max(0, pz.mezcla - dt / PERSONALIZA_SALE_S)
    }
    pz.m = suaveDoble(pz.mezcla)
    efectivoRef.current = real * (1 - pz.m)
    if (pz.alRegresar && !pz.activo && pz.mezcla === 0) {
      pz.alRegresar()
      pz.alRegresar = null
    }
  }, -1)
  return null
}

// El wallpaper (ver WALLPAPER_*). El pedido llega en personalizaRef.captura
// ({ ancho, fondo, resolve, reject }) y se atiende en UN cuadro, ya con Skulley
// armado del todo: antes que nada (después de la mezcla) el canvas, el
// composer y la cámara pasan a 4K; FallingSkulley encuadra; el composer dibuja,
// y después de él se copia el canvas y todo regresa como estaba. El PNG se
// comprime fuera del hilo principal (wallpaperPng.js).
function CapturaWallpaper({ personalizaRef, composerRef }) {
  const guardado = useRef(null)

  const restaurar = useCallback(({ gl, size, camera }) => {
    const g = guardado.current
    if (!g) return
    guardado.current = null
    posterNormalTexture.captura = null
    if (g.puntos) g.puntos.value = g.escalaPuntos
    try {
      // Primero el tamaño a 1×, luego el dpr: al revés, el canvas pasaría un
      // instante por 4K × dpr.
      gl.setSize(size.width, size.height, false)
      gl.setPixelRatio(g.dpr)
      composerRef.current?.setSize(size.width, size.height, false)
    } catch { }
    Object.assign(camera, g.frustum)
    camera.updateProjectionMatrix()
  }, [composerRef])

  useFrame((state) => {
    const pz = personalizaRef?.current
    const c = pz?.captura
    if (!c || c.fase !== 'pedida' || (pz.m || 0) < 0.999) return
    const { gl, camera } = state
    try {
      const composer = composerRef.current
      if (!composer) throw new Error('sin composer')
      const ctx = gl.getContext()
      const tope = Math.min(
        gl.capabilities.maxTextureSize,
        ctx.getParameter(ctx.MAX_RENDERBUFFER_SIZE),
        ...ctx.getParameter(ctx.MAX_VIEWPORT_DIMS),
      )
      // `ancho`: el personalizador lo baja en teléfonos con poca memoria.
      const k = Math.min(1, tope / WALLPAPER_H)
      c.w = Math.floor(Math.min(c.ancho || WALLPAPER_W, WALLPAPER_W * k))
      c.h = Math.floor((c.w * WALLPAPER_H) / WALLPAPER_W)
      // Los puntos de cámara se miden en pixeles: a 4K quedarían cuatro veces
      // más chicos que en el marco y en el teléfono ya no se verían.
      const puntos = composer.passes.flatMap((p) => p.effects || []).find((e) => e.name === 'DotScreenEffect')?.uniforms.get('scale')
      const dpr = gl.getPixelRatio()
      guardado.current = {
        dpr,
        frustum: { left: camera.left, right: camera.right, top: camera.top, bottom: camera.bottom },
        puntos,
        escalaPuntos: puntos?.value,
      }
      if (puntos && pz.marco?.w) puntos.value *= (pz.marco.w * dpr) / c.w
      gl.setPixelRatio(1)
      composer.setSize(c.w, c.h, false)
      Object.assign(camera, { left: -c.w / 2, right: c.w / 2, top: c.h / 2, bottom: -c.h / 2 })
      posterNormalTexture.captura = { w: c.w, h: c.h, css: [WALLPAPER_CSS_W, (WALLPAPER_CSS_W * c.h) / c.w] }
      c.fase = 'render'
    } catch (e) {
      restaurar(state)
      pz.captura = null
      c.reject(e)
    }
  }, -0.9)

  useFrame((state) => {
    const pz = personalizaRef?.current
    const c = pz?.captura
    if (!c || c.fase !== 'render') return
    let lienzo = null
    let error = null
    try {
      // Mismo cuadro: el canvas todavía tiene lo que acaba de dibujar el
      // composer (sin preserveDrawingBuffer se borra hasta que se pinta).
      lienzo = document.createElement('canvas')
      lienzo.width = c.w
      lienzo.height = c.h
      const ctx = lienzo.getContext('2d')
      ctx.fillStyle = c.fondo || '#022dd6'
      ctx.fillRect(0, 0, c.w, c.h)
      ctx.drawImage(state.gl.domElement, 0, 0, c.w, c.h)
    } catch (e) {
      lienzo = null
      error = e
    }
    restaurar(state)
    pz.captura = null
    if (!lienzo) { c.reject(error); return }
    pngDeCanvas(lienzo).then(c.resolve, c.reject)
  }, 2)

  return null
}

// `pausado`: la versión rápida lo deja en pausa con un proyecto abierto encima.
// Va en la prop frameloop del Canvas, que R3F reaplica en cada render.
// `onListo`: avisa una vez, cuando el modelo ya se midió (la versión rápida abre
// el iris de llegada con eso).
// `escenaRef`: las luces, el foco y el numerito de "Conocer la historia" (ver
// LucesEscena): el preloader de escritorio y la primera pantalla del teléfono.
export default function SkulleyFallRig({ progressRef, timingRef, onStrike, personalizaRef, pausado = false, onListo, escenaRef, miraCursor = false, picarEnInicio = false }) {
  // El teléfono no monta useSkinSystem: aquí se enciende la skin guardada.
  useEffect(() => { activateSkinShader(readActiveSkinId()) }, [])
  const efectivoRef = useRef(0)
  const rootRef = useRef(null)
  const composerRef = useRef(null)
  const fitRef = useRef({ headY: 1.5, midY: 0.85, alto: 1.7, piso: 0, suelo: -0.02, top: 1.7, ready: false })
  // La sombra necesita el piso y el alto como props, así que esto sí pasa por
  // estado: una sola vez, cuando el modelo se mide.
  const [medida, setMedida] = useState(null)
  const onListoRef = useRef(onListo)
  onListoRef.current = onListo
  const onMedido = useCallback((f) => {
    setMedida((m) => (m && m.piso === f.piso && m.alto === f.alto ? m : { piso: f.piso, alto: f.alto }))
    try { onListoRef.current?.() } catch { }
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
        frameloop={pausado ? 'never' : 'always'}
        style={{ background: 'transparent' }}
      >
        <LucesEscena escenaRef={escenaRef} fitRef={fitRef} />

        <MezclaPersonaliza progressRef={progressRef} personalizaRef={personalizaRef} efectivoRef={efectivoRef} fitRef={fitRef} />
        <CapturaWallpaper personalizaRef={personalizaRef} composerRef={composerRef} />

        <React.Suspense fallback={null}>
          <group ref={rootRef}>
            <FallingSkulley
              progressRef={efectivoRef}
              timingRef={timingRef}
              fitRef={fitRef}
              onMedido={onMedido}
              personalizaRef={personalizaRef}
              escenaRef={escenaRef}
              miraCursor={miraCursor}
              picarEnInicio={picarEnInicio}
            />
          </group>
        </React.Suspense>

        {/* Fuera de rootRef a propósito: el pase de normales entinta todo lo
            que cuelga de ahí, y el rayo con ink lines se vería como un tubo de
            caricatura en vez de luz. */}
        <ScrollBolt progressRef={efectivoRef} timingRef={timingRef} fitRef={fitRef} onStrike={onStrike} />

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
        <EffectComposer ref={composerRef} multisampling={0} resolutionScale={0.85}>
          {/* color: el de la skin activa (Vacío las lleva blancas), el mismo
              array que escritorio y el retrato; se muta en sitio y el effect
              lo lee cada cuadro. */}
          <EdgeInkEffect
            bufferRef={posterNormalTexture}
            color={skinLineColor}
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
          {escenaRef && <PeliculaBN escenaRef={escenaRef} />}
        </EffectComposer>
      </Canvas>
    </div>
  )
}
