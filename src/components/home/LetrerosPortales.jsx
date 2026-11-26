import React, { useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { armarPintado } from '../../lib/pintado.js'
import { compileAsyncSafe } from '../../lib/compileAsyncSafe.js'
import { cargarGrupoEstilo, copiaLocal } from '../../lib/cargarEstilo.js'
import { setObstaculosExtra } from '../../lib/obstaculosHome.js'
import { sectionColors } from '../../lib/appHelpers.js'
import { useLanguage } from '../../i18n/LanguageContext.jsx'
import { juego } from '../../lib/juegoEsferas.js'

// Un letrero de neón de doble cara detrás de cada portal (Oscar, 2026-11-24: "se va a ver más
// cyberpunk"; reemplazó a los hitos labrados, que a su vez reemplazaron a los menhires). El nombre de
// la sección en runas de SKULLEYGLYPH, en el idioma de la barra, en letras de bloque con estructura
// (scripts/estilo/props_letreros.py → public/3dmodels/estilo/props_letreros.glb), del color de su
// portal. De lejos se quedan prendidos con alguna falla de neón viejo; con Skulley en el portal su
// letrero corre letra por letra, flashea y se queda a todo. Brillan muy por encima del umbral del
// bloom (Oscar: "que brillen más y que tengan bloom"). Los letreros de los dos idiomas van montados y
// el del otro se oculta (mismos programas: no compila). Se arma fuera de la escena y se compila antes.
// En la partida de las esferas se guardan en una fosa de acero bajo cada uno (Oscar: "imagina que debajo
// de ellas hay una estructura metálica con compuertas y ahí se meten"; scripts/estilo/props_fosos.py →
// props_fosos.glb): se apaga el neón, parpadean las luces de aviso, la plataforma baja el letrero y las
// compuertas se cierran de golpe con un rebote; al terminar se abren, sube y prende letra por letra.
// La fosa se ve a través del piso porque su boca borra la profundidad del piso (`boca`): el piso no
// se corta. Abajo no son sólidos.

const VERSION = 2
const VERSION_FOSOS = 2

export const LETREROS = {
  radio: 19.6,       // detrás de cada portal, donde iban los menhires
  escala: 2.2,       // la de los props: el GLB está en metros reales (las letras ya vienen grandes)
  solido: 0.32,      // medio grueso del círculo sólido, en metros reales
  // El brillo va por el canal más alto de su color, no por la luminancia: por luminancia, al magenta de la
  // tienda le tocaba el multiplicador más grande y su halo salía más gordo que los demás (a Oscar le gustó
  // ese: todos llegan a ese tope). El bloom de la home empieza en luminancia 0.86.
  tope: 9,           // canal más alto de lejos
  luz: 1,            // de lejos (fracción del tope)
  luzCerca: 2,       // con Skulley en el portal
  apagado: 0.1,      // lo que queda de una letra que falla o que todavía no prende
  corrida: 0.085,    // s entre letra y letra al prender
  flashes: 3,
  flash: 0.1,        // s de cada flash prendido (y apagado)
  falla: [3, 9],     // cada cuánto falla una letra de lejos (s)
  // guardarse en su fosa durante la partida (s): lo de cada letrero se escalona por `escalon`
  guarda: { apaga: 0.3, puertas: 0.55, baja: 1.5, sube: 1.3, escalon: 0.16, temblor: 0.006, rebote: 0.18, avisoHz: 3 },
}

// Medidas de la fosa (scripts/estilo/props_fosos.py): cuánto baja la plataforma de cada letrero (m, en
// su marco) y el giro de cada compuerta para abrir (radianes sobre su eje x).
export const FOSOS = {
  bajadaDef: 1.85,
  bajada: {},
  abreA: -Math.PI / 2,
  abreB: Math.PI / 2,
  aviso: new THREE.Color('#ffab1f'),
  avisoBrillo: 3,
}

// cada cuándo falla una letra: azar fijo por letra
function azar(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

// Una pieza de la fosa en el marco de su letrero: su geometría queda en el espacio de su nodo (así las
// compuertas giran en su bisagra) y el pivote lleva la transformación del nodo respecto a la raíz.
const _mInv = new THREE.Matrix4()
const _m = new THREE.Matrix4()
function piezaFoso(nodo, raizNodo) {
  if (!nodo) return null
  raizNodo.updateWorldMatrix(true, false)
  nodo.updateWorldMatrix(true, false)
  _mInv.copy(raizNodo.matrixWorld).invert()
  _m.multiplyMatrices(_mInv, nodo.matrixWorld)
  const solo = nodo.clone(false)
  solo.position.set(0, 0, 0); solo.quaternion.identity(); solo.scale.set(1, 1, 1)
  const envoltura = new THREE.Group()
  envoltura.add(solo)
  envoltura.updateMatrixWorld(true)
  const pintado = armarPintado(envoltura)
  const pivote = new THREE.Group()
  _m.decompose(pivote.position, pivote.quaternion, pivote.scale)
  pivote.add(pintado.grupo)
  return { pivote, pintado, base: pivote.quaternion.clone() }
}

// La boca de la fosa: pinta lo hondo y borra la profundidad del piso (que se dibuja antes) para que se vea
// adentro; las paredes y el fondo de la fosa la vuelven a escribir. Un solo programa para las diez.
const matBoca = new THREE.ShaderMaterial({
  uniforms: { uColor: { value: new THREE.Color('#05060a') } },
  vertexShader: 'void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'uniform vec3 uColor; void main() { gl_FragColor = vec4(uColor, 1.0); gl_FragDepth = 1.0; }',
  depthFunc: THREE.AlwaysDepth,
  depthWrite: true,
})

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
  const solidosRef = useRef([])
  const solidosPuestos = useRef(false)
  const mezcla = useRef(portalMixMap)
  mezcla.current = portalMixMap
  const lista = (portales || []).filter((p) => !p.antimatter)
  const llavePortales = lista.map((p) => `${p.id}:${p.position.join(',')}`).join('|')

  useEffect(() => {
    let vivo = true
    Promise.all([cargarGrupoEstilo('letreros', VERSION), cargarGrupoEstilo('fosos', VERSION_FOSOS)]).then(async ([gltf, fosos]) => {
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
        const fosoDe = {}
        for (const idioma of ['en', 'es']) {
          const n = gltf.scene.getObjectByName(`Prop_LetreroPortal_${p.id}_${idioma}`)
          if (!n) continue
          const pintado = armarPintado(copiaLocal(n))
          // el letrero va en el elevador: baja con la plataforma
          const elevador = new THREE.Group()
          elevador.add(pintado.grupo)
          const todo = new THREE.Group()
          todo.add(elevador)
          g.add(todo)
          idiomas[idioma] = pintado
          const S = `Prop_FosoPortal_${p.id}_${idioma}`
          const raizFoso = fosos?.scene.getObjectByName(S)
          const f = { todo, elevador, puertas: [], luces: [], pintados: [], bajada: 0 }
          if (raizFoso) {
            const fijo = piezaFoso(raizFoso, raizFoso)
            todo.add(fijo.pivote); f.pintados.push(fijo.pintado)
            const plat = piezaFoso(fosos.scene.getObjectByName(`${S}_Plataforma`), raizFoso)
            if (plat) { elevador.add(plat.pivote); f.pintados.push(plat.pintado) }
            const ud = raizFoso.userData || {}
            for (const [lado, abre] of [['A', ud.giro_puerta_a ?? FOSOS.abreA], ['B', ud.giro_puerta_b ?? FOSOS.abreB]]) {
              const pu = piezaFoso(fosos.scene.getObjectByName(`${S}_Puerta${lado}`), raizFoso)
              if (!pu) continue
              todo.add(pu.pivote); f.pintados.push(pu.pintado)
              f.puertas.push({ ...pu, abre })
            }
            const luz = piezaFoso(fosos.scene.getObjectByName(`${S}_LuzAviso`), raizFoso)
            if (luz) {
              todo.add(luz.pivote); f.pintados.push(luz.pintado)
              luz.pintado.grupo.traverse((o) => { if (o.isMesh && o.material) { o.material = new THREE.MeshBasicMaterial({ color: FOSOS.aviso, toneMapped: false }); f.luces.push(o.material) } })
            }
            const boca = fosos.scene.getObjectByName(`${S}_Boca`)
            if (boca) {
              const b = piezaFoso(boca, raizFoso)
              const m = new THREE.Mesh(boca.geometry, matBoca)
              m.renderOrder = -15
              b.pivote.clear()
              b.pivote.add(m)
              todo.add(b.pivote)
            }
            f.bajada = ud.bajada ?? FOSOS.bajada[`${p.id}_${idioma}`] ?? FOSOS.bajadaDef
          }
          fosoDe[idioma] = f
        }
        const color = new THREE.Color(sectionColors[p.id] || '#ffffff')
        const tope = Math.max(0.05, color.r, color.g, color.b)
        let alto = 0
        for (const pt of Object.values(idiomas)) alto = Math.max(alto, pt.hull.geometry.boundingBox.max.y)
        nuevos.push({
          id: p.id, grupo: g, idiomas, fosoDe, color, tope, cerca: 0, inicio: 0, semilla: nuevos.length + 1,
          alto: alto * LETREROS.escala, indice: nuevos.length,
          // la fosa: n neón (1 prendido), p compuertas (1 abiertas), e elevador (1 abajo)
          n: 1, pa: 1, e: 0, espera: 0, quiere: 0, rebote: -1, prende: -1,
        })
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
      solidosRef.current = solidos
      solidosPuestos.current = true
      setObstaculosExtra('letreros', solidos)
      setArmado(raiz)
    }).catch((e) => console.warn('[letreros] no se armaron', e))
    return () => { vivo = false; setObstaculosExtra('letreros', []) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, camera, scene, llavePortales])

  // el idioma de la barra: el letrero del otro se oculta (mismos programas que el que se ve)
  useEffect(() => {
    for (const L of letreros.current) {
      for (const [idioma, f] of Object.entries(L.fosoDe || {})) f.todo.visible = idioma === lang
    }
  }, [lang, armado])

  useFrame((state, delta) => {
    if (!armado || !visible) return
    const dt = Math.min(delta, 0.05)
    const t = state.clock.elapsedTime
    const G = LETREROS.guarda
    const quiere = juego.activo ? 1 : 0
    let alguno = false
    for (const L of letreros.current) {
      const f = L.fosoDe?.[lang] || Object.values(L.fosoDe || {})[0]
      const pt = L.idiomas[lang] || Object.values(L.idiomas)[0]
      if (!f || !pt) continue
      // la fosa, por pasos: guardarse = neón fuera → baja → compuertas; salir = compuertas → sube → neón
      if (quiere !== L.quiere) { L.quiere = quiere; L.espera = L.indice * G.escalon }
      if (L.espera > 0) L.espera -= dt
      else if (quiere) {
        if (L.n > 0) L.n = Math.max(0, L.n - dt / G.apaga)
        else if (L.e < 1) L.e = Math.min(1, L.e + dt / G.baja)
        else if (L.pa > 0) { L.pa = Math.max(0, L.pa - dt / G.puertas); if (L.pa === 0) L.rebote = t }
      } else {
        if (L.e > 0 && L.pa < 1) L.pa = Math.min(1, L.pa + dt / G.puertas)
        else if (L.e > 0) { L.e = Math.max(0, L.e - dt / G.sube); if (L.e === 0) L.prende = t }
        else if (L.n < 1) L.n = Math.min(1, L.n + dt / 0.2)
      }
      const moviendo = L.e > 0 && L.e < 1 || L.pa > 0 && L.pa < 1 || (quiere && L.n < 1 && L.n > 0)
      if (L.e > 0 || L.pa < 1) alguno = true
      // elevador: sale con un pasón y regresa; baja con temblor
      const e = L.e
      const subiendo = !quiere
      let y = e < 0.5 ? 2 * e * e : 1 - ((-2 * e + 2) ** 2) / 2
      if (subiendo && e > 0 && e < 0.12) y -= Math.sin((e / 0.12) * Math.PI) * 0.025
      const tiembla = moviendo ? G.temblor : 0
      f.elevador.position.set(Math.sin(t * 47 + L.indice) * tiembla, -f.bajada * y, Math.cos(t * 43) * tiembla)
      f.elevador.visible = !(L.e >= 1 && L.pa <= 0)
      // compuertas: abiertas cuelgan en la fosa; al cerrar dan un golpe y rebotan tantito
      let a = L.pa
      a = a < 0.5 ? 2 * a * a : 1 - ((-2 * a + 2) ** 2) / 2
      if (L.rebote >= 0) {
        const d = t - L.rebote
        if (d < 0.6) a += G.rebote * Math.exp(-d * 9) * Math.abs(Math.sin(d * 22))
        else L.rebote = -1
      }
      for (const pu of f.puertas) {
        pu.pivote.quaternion.copy(pu.base)
        pu.pivote.rotateX(pu.abre * a)
      }
      // luces de aviso: parpadean mientras se mueve
      const aviso = moviendo && Math.floor(t * G.avisoHz * 2) % 2 === 0 ? 1 : 0.06
      for (const m of f.luces) m.color.copy(FOSOS.aviso).multiplyScalar(aviso * FOSOS.avisoBrillo)
      for (const pn of f.pintados) pn.medir(state)
      if (!f.elevador.visible) continue

      const meta = Math.min(1, mezcla.current?.[L.id] || 0)
      if (meta > 0.05 && L.cerca <= 0.001) L.inicio = t
      L.cerca += Math.max(-dt / 0.8, Math.min(dt / 0.25, meta - L.cerca))
      pt.medir(state)
      const total = pt.neones.length ? Math.max(...pt.neones.map((n) => n.n)) + 1 : 1
      const k = LETREROS.tope / L.tope
      for (const n of pt.neones) {
        let b = brilloLetra(L, t, n.n, total)
        // apagándose: parpadea y se va
        if (L.n < 1) b *= L.n * (Math.sin(t * 90 + n.n * 7) > 0.2 ? 0.3 : 1)
        // recién subido: prende letra por letra
        if (L.prende >= 0) {
          const d = t - L.prende
          if (d < n.n * LETREROS.corrida) b = 0
          else if (d > total * LETREROS.corrida + 1) L.prende = -1
        }
        n.material.color.copy(L.color).multiplyScalar(b * k)
      }
    }
    // guardados no estorban: las esferas y Skulley pasan por encima de las compuertas
    if (alguno && solidosPuestos.current) { setObstaculosExtra('letreros', []); solidosPuestos.current = false }
    else if (!alguno && !solidosPuestos.current) { setObstaculosExtra('letreros', solidosRef.current); solidosPuestos.current = true }
  })

  if (typeof window !== 'undefined' && import.meta.env.DEV) window.__letrerosPortales = { letreros: letreros.current, LETREROS }
  return armado ? <primitive object={armado} visible={visible} /> : null
}
