import React, { useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { armarPintado } from '../../lib/pintado.js'
import { compileAsyncSafe } from '../../lib/compileAsyncSafe.js'
import { cargarGrupoEstilo, copiaLocal } from '../../lib/cargarEstilo.js'
import { setObstaculosExtra } from '../../lib/obstaculosHome.js'
import { sectionColors } from '../../lib/appHelpers.js'
import { useLanguage } from '../../i18n/LanguageContext.jsx'

// Un letrero de neón de doble cara detrás de cada portal (Oscar, 2026-11-24: "se va a ver más
// cyberpunk"; reemplazó a los hitos labrados, que a su vez reemplazaron a los menhires). El nombre de
// la sección en runas de SKULLEYGLYPH, en el idioma de la barra, en letras de bloque con estructura
// (scripts/estilo/props_letreros.py → public/3dmodels/estilo/props_letreros.glb), del color de su
// portal. De lejos se quedan prendidos con alguna falla de neón viejo; con Skulley en el portal su
// letrero corre letra por letra, flashea y se queda a todo. Brillan muy por encima del umbral del
// bloom (Oscar: "que brillen más y que tengan bloom"). Los letreros de los dos idiomas van montados y
// el del otro se oculta (mismos programas: no compila). Se arma fuera de la escena y se compila antes.

const VERSION = 1

export const LETREROS = {
  radio: 19.6,       // detrás de cada portal, donde iban los menhires
  escala: 2.2,       // la de los props: el GLB está en metros reales
  solido: 0.32,      // medio grueso del círculo sólido, en metros reales
  luz: 1.5,          // luminancia de lejos (el bloom de la home empieza en 0.86 y llega a todo en 1.04)
  luzCerca: 3.2,     // con Skulley en el portal
  apagado: 0.1,      // lo que queda de una letra que falla o que todavía no prende
  corrida: 0.085,    // s entre letra y letra al prender
  flashes: 3,
  flash: 0.1,        // s de cada flash prendido (y apagado)
  falla: [3, 9],     // cada cuánto falla una letra de lejos (s)
}

// cada cuándo falla una letra: azar fijo por letra
function azar(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

function brilloLetra(L, t, i, total) {
  const C = LETREROS
  // de lejos: prendida con fallas cortas (dos parpadeos) cada tanto
  const [f0, f1] = C.falla
  const periodo = f0 + azar(L.semilla * 13 + i) * (f1 - f0)
  const fase = (t + azar(L.semilla * 7 + i * 3) * periodo) % periodo
  const falla = fase < 0.08 || (fase > 0.16 && fase < 0.22) ? C.apagado : 1
  const lejos = C.luz * falla
  if (L.cerca <= 0.001) return lejos
  // con Skulley en el portal: corre letra por letra, flashea y se queda a todo
  const dt = t - L.inicio
  let cerca
  const finCorrida = total * C.corrida
  if (dt < i * C.corrida) cerca = C.apagado
  else if (dt < finCorrida) cerca = C.luzCerca
  else if (dt < finCorrida + C.flashes * 2 * C.flash) cerca = Math.floor((dt - finCorrida) / C.flash) % 2 === 0 ? C.apagado : C.luzCerca
  else cerca = C.luzCerca
  return lejos + (cerca - lejos) * L.cerca
}

export default function LetrerosPortales({ portales, portalMixMap, visible = true }) {
  const { gl, camera, scene } = useThree()
  const { lang } = useLanguage()
  const [armado, setArmado] = useState(null)
  const letreros = useRef([])
  const mezcla = useRef(portalMixMap)
  mezcla.current = portalMixMap
  const lista = (portales || []).filter((p) => !p.antimatter)
  const llavePortales = lista.map((p) => `${p.id}:${p.position.join(',')}`).join('|')

  useEffect(() => {
    let vivo = true
    cargarGrupoEstilo('letreros', VERSION).then(async (gltf) => {
      if (!vivo || !gltf) return
      const raiz = new THREE.Group()
      raiz.name = 'LetrerosPortales'
      const nuevos = []
      const solidos = []
      const v = new THREE.Vector3()
      for (const p of lista) {
        const g = new THREE.Group()
        const ang = Math.atan2(p.position[2], p.position[0])
        g.position.set(Math.cos(ang) * LETREROS.radio, 0, Math.sin(ang) * LETREROS.radio)
        // de espaldas al portal y de frente al centro, como iban los menhires (es de doble cara)
        g.rotation.y = Math.atan2(-g.position.x, -g.position.z)
        g.scale.setScalar(LETREROS.escala)
        raiz.add(g)
        const idiomas = {}
        for (const idioma of ['en', 'es']) {
          const n = gltf.scene.getObjectByName(`Prop_LetreroPortal_${p.id}_${idioma}`)
          if (!n) continue
          const pintado = armarPintado(copiaLocal(n))
          g.add(pintado.grupo)
          idiomas[idioma] = pintado
        }
        const color = new THREE.Color(sectionColors[p.id] || '#ffffff')
        const lum = Math.max(0.05, 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b)
        nuevos.push({ id: p.id, grupo: g, idiomas, color, lum, cerca: 0, inicio: 0, semilla: nuevos.length + 1 })
        // sólido: una fila de círculos a lo largo del letrero (lo más ancho de sus dos idiomas)
        let x0 = 0, x1 = 0
        for (const pt of Object.values(idiomas)) {
          const c = pt.hull.geometry.boundingBox
          x0 = Math.min(x0, c.min.x); x1 = Math.max(x1, c.max.x)
        }
        g.updateMatrixWorld(true)
        const paso = LETREROS.solido * 1.4
        for (let x = x0 + LETREROS.solido; x <= x1 - LETREROS.solido + 1e-6; x += paso) {
          v.set(x, 0, 0).applyMatrix4(g.matrixWorld)
          solidos.push({ x: v.x, z: v.z, r: LETREROS.solido * LETREROS.escala })
        }
      }
      raiz.updateMatrixWorld(true)
      const rt = new THREE.WebGLRenderTarget(16, 16)
      try { await compileAsyncSafe(gl, raiz, camera, 10000, rt, scene) } catch { }
      rt.dispose()
      if (!vivo) return
      letreros.current = nuevos
      setObstaculosExtra('letreros', solidos)
      setArmado(raiz)
    }).catch((e) => console.warn('[letreros] no se armaron', e))
    return () => { vivo = false; setObstaculosExtra('letreros', []) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, camera, scene, llavePortales])

  // el idioma de la barra: el letrero del otro se oculta (mismos programas que el que se ve)
  useEffect(() => {
    for (const L of letreros.current) {
      for (const [idioma, pt] of Object.entries(L.idiomas)) pt.grupo.visible = idioma === lang
    }
  }, [lang, armado])

  useFrame((state, delta) => {
    if (!armado || !visible) return
    const dt = Math.min(delta, 0.05)
    const t = state.clock.elapsedTime
    for (const L of letreros.current) {
      const meta = Math.min(1, mezcla.current?.[L.id] || 0)
      if (meta > 0.05 && L.cerca <= 0.001) L.inicio = t
      L.cerca += Math.max(-dt / 0.8, Math.min(dt / 0.25, meta - L.cerca))
      const pt = L.idiomas[lang] || Object.values(L.idiomas)[0]
      if (!pt) continue
      pt.medir(state)
      const total = pt.neones.length ? Math.max(...pt.neones.map((n) => n.n)) + 1 : 1
      for (const n of pt.neones) {
        const b = brilloLetra(L, t, n.n, total)
        n.material.color.copy(L.color).multiplyScalar(b / L.lum)
      }
    }
  })

  if (typeof window !== 'undefined' && import.meta.env.DEV) window.__letrerosPortales = { letreros: letreros.current, LETREROS }
  return armado ? <primitive object={armado} visible={visible} /> : null
}
