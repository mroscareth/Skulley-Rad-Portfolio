import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { characterNormalTexture } from '../../lib/toonInkBuffer.js'
import { pngDeCanvas } from '../../lib/wallpaperPng.js'
import { WALLPAPER_W, WALLPAPER_H, wallpaperEstado as est } from '../../lib/wallpaperEscritorio.js'

// Skulley aislado en escritorio, adentro del Canvas: mueve la onda de la trama al
// entrar y salir de Customize, dibuja la máscara que ella respeta, quita el mundo,
// y encuadra y captura el wallpaper a 4K. La interfaz vive afuera (CharacterCustomizer
// y DesktopWallpaper) y solo escribe en wallpaperEstado.
//
// El encuadre es de pantalla, no de mundo: zoom de la cámara y corrimiento con
// setViewOffset. Así el perfil de Skulley no cambia al acomodarlo, y la captura es
// exactamente el pedazo de la vista que cae adentro del marco.
const ENTRA_S = 1.25
const SALE_S = 0.8
// La cámara ya va en camino cuando arranca la onda.
const ESPERA_S = 0.3
const GIRO_SIGUE = 24
const REGRESO = 9
// Al entrar el cuadro sube hasta centrar a Skulley en el marco.
const CENTRA_S = 0.5
// La cara, para el atajo: su altura y qué tanto se acerca.
const CARA_Y = 2.1
const CARA_ZOOM = 2.6

function esDelCuerpo(o) {
  return o.isSkinnedMesh || o.name === 'Egg_EnergyBall'
}

// Lo que se queda aunque el mundo se vaya (las runas de Aleatorio viven adentro
// de las esferas).
function traeConservado(o) {
  let si = false
  o.traverse((x) => { if (x.userData?.conservarAislado) si = true })
  return si
}

export default function WallpaperEscena({ playerRef }) {
  const { gl, camera, scene, size } = useThree()
  const fbo = useMemo(() => new THREE.WebGLRenderTarget(2, 2, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    type: THREE.UnsignedByteType,
    depthBuffer: true,
  }), [])
  // Sin luces: la máscara solo necesita alfa, y el material real compilaría otro
  // programa por cada skin en el primer cuadro.
  const blanco = useMemo(() => new THREE.MeshBasicMaterial({ color: 0xffffff }), [])
  // Las runas de Aleatorio, aparte: la trama pinta el fondo encima de todo y ellas
  // se le suman.
  const fboRunas = useMemo(() => new THREE.WebGLRenderTarget(2, 2, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    type: THREE.UnsignedByteType,
    depthBuffer: false,
  }), [])
  useEffect(() => () => { try { fbo.dispose(); fboRunas.dispose(); blanco.dispose() } catch { } }, [fbo, fboRunas, blanco])

  const r = useRef({ t: 0, espera: 0, centra: 0, ocultos: [], bg: null, fog: null, apagados: [], captura: null, v: new THREE.Vector3() })

  const efectos = () => (est.composer?.passes || []).flatMap((p) => p.effects || [])

  const encuadra = (W, H) => {
    const cy = est.marco ? H / 2 - (est.marco.y + est.marco.h / 2) : 0
    camera.zoom = est.zoom
    camera.setViewOffset(W, H, est.ox, cy * r.current.centra + est.oy, W, H)
  }

  const raizDe = (o) => {
    let n = o
    while (n?.parent && n.parent !== scene) n = n.parent
    return n
  }

  const quitaMundo = () => {
    const s = r.current
    const yo = raizDe(playerRef.current)
    const quita = (o) => {
      if (o === yo || o === est.sombra || o.isLight || !o.visible || o.userData?.conservarAislado) return
      if (traeConservado(o)) { o.children.forEach(quita); return }
      o.visible = false
      s.ocultos.push(o)
    }
    scene.children.forEach(quita)
    // Y de lo que cuelga de él, solo el cuerpo: los efectos flotarían sobre el fondo.
    playerRef.current.traverse((o) => {
      if ((o.isMesh || o.isPoints || o.isLine || o.isSprite) && o.visible && !esDelCuerpo(o)) {
        o.visible = false
        s.ocultos.push(o)
      }
    })
  }

  const regresaMundo = () => {
    const s = r.current
    for (const o of s.ocultos) o.visible = true
    s.ocultos = []
    if (s.bg) { scene.background?.copy?.(s.bg); s.bg = null }
    if (s.fog) { scene.fog?.color?.copy(s.fog); s.fog = null }
    for (const [u, v] of s.apagados) u.value = v
    s.apagados = []
    s.composer = null
  }

  // Ya sin mundo: el cielo toma el fondo (se ve a través de las skins
  // transparentes) y se apagan la viñeta, el ruido y el bloom sobre Skulley. Los
  // puntos de cámara se quedan: sin ellos pierde el contraste y se ve lavado.
  const preparaSolo = () => {
    const s = r.current
    if (scene.background?.isColor && !s.bg) s.bg = scene.background.clone()
    if (scene.fog && !s.fog) s.fog = scene.fog.color.clone()
    const fx = efectos()
    const darkness = fx.find((e) => e.name === 'VignetteEffect')?.uniforms.get('darkness')
    const ruido = fx.find((e) => e.name === 'NoiseEffect')?.blendMode?.opacity
    const bloom = fx.find((e) => e.name === 'BloomEffect')?.uniforms.get('intensity')
    for (const u of [darkness, ruido, bloom]) {
      if (!u) continue
      s.apagados.push([u, u.value])
      u.value = 0
    }
  }

  const aplicaPlano = (W, H) => {
    const p = playerRef.current
    const m = est.marco
    if (est.plano === 'cara' && m) {
      // Dónde cae la cara sin zoom, y de ahí cuánto hay que correr el cuadro.
      camera.zoom = 1
      const cy = H / 2 - (m.y + m.h / 2)
      camera.setViewOffset(W, H, 0, cy, W, H)
      const v = r.current.v.set(p.position.x, p.position.y + CARA_Y, p.position.z).project(camera)
      const sx = (v.x * 0.5 + 0.5) * W
      const sy = (0.5 - v.y * 0.5) * H
      // El zoom se abre desde el centro del marco.
      est.zoom = CARA_ZOOM
      est.ox = (sx - W / 2) * CARA_ZOOM
      est.oy = (sy - (m.y + m.h / 2)) * CARA_ZOOM
    } else {
      est.zoom = 1
      est.ox = 0
      est.oy = 0
    }
    est.plano = null
  }

  const termina = () => {
    const s = r.current
    regresaMundo()
    s.t = 0
    s.espera = 0
    s.centra = 0
    est.onda = 0
    est.mascara = null
    est.fase = 'off'
    camera.zoom = 1
    camera.clearViewOffset()
    camera.updateProjectionMatrix()
    if (playerRef.current) playerRef.current.rotation.y = est.yawBase
    est.cubre = false
  }

  // Después de la cámara (prioridad 0) y antes de los pases del personaje (0.5):
  // ellos dibujan con este encuadre y, en la captura, con este tamaño.
  useFrame((state, delta) => {
    if (est.fase === 'off') return
    const p = playerRef.current
    const s = r.current
    if (!p) return
    const dt = Math.min(0.05, delta || 0)
    const W = size.width
    const H = size.height
    let quieto = false
    try { quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { }

    // Fuera del marco, el encuadre regresa solo.
    if (!est.enMarco) {
      const f = Math.exp(-REGRESO * dt)
      est.zoom = 1 + (est.zoom - 1) * f
      est.ox *= f
      est.oy *= f
      if (est.fase === 'sale') est.giro *= f
    }

    if (est.fase === 'entra') {
      s.espera += dt
      if (s.espera >= ESPERA_S || s.t > 0) s.t = quieto ? 1 : Math.min(1, s.t + dt / ENTRA_S)
      est.onda = s.t
      if (s.t >= 1) {
        est.fase = 'lista'
        s.espera = 0
      }
    } else if (est.fase === 'sale') {
      if (s.ocultos.length || s.bg) regresaMundo()
      const asentado = Math.abs(est.zoom - 1) < 0.01 && Math.abs(est.ox) + Math.abs(est.oy) < 2 && Math.abs(est.giro) < 0.01
      if (asentado) {
        est.zoom = 1
        est.ox = 0
        est.oy = 0
        est.giro = 0
        s.t = quieto ? 0 : Math.max(0, s.t - dt / SALE_S)
      }
      est.cubre = !asentado
      est.onda = s.t
      if (s.t <= 0) { termina(); return }
    }

    // Con la pantalla ya cubierta sobra todo lo demás: no se gasta en dibujarlo y
    // nada se le cruza enfrente a Skulley.
    if (est.fase === 'lista') {
      quitaMundo()
      // Al regresar a la pestaña el composer se vuelve a montar.
      if (est.composer !== s.composer) { s.composer = est.composer; preparaSolo() }
      scene.background?.set?.(est.color)
      scene.fog?.color?.set(est.color)
    }
    s.centra = est.enMarco ? (quieto ? 1 : Math.min(1, s.centra + dt / CENTRA_S)) : Math.max(0, s.centra - dt / CENTRA_S)

    if (est.plano) aplicaPlano(W, H)

    if (est.centrar) {
      const f = Math.exp(-REGRESO * dt)
      est.ox *= f
      est.oy *= f
      if (Math.abs(est.ox) + Math.abs(est.oy) < 0.5) {
        est.ox = 0
        est.oy = 0
        est.centrar = false
      }
    }

    est.giroVisto += (est.giro - est.giroVisto) * (1 - Math.exp(-GIRO_SIGUE * dt))
    p.rotation.y = est.yawBase + est.giroVisto

    encuadra(W, H)

    const v = s.v.set(p.position.x, p.position.y, p.position.z).project(camera)
    est.pies = [v.x * 0.5 + 0.5, v.y * 0.5 + 0.5]

    // La captura: un cuadro a 4K, con la vista recortada al marco.
    const c = est.captura
    if (c && c.fase === 'pedida' && est.fase === 'lista' && est.enMarco) {
      try {
        const composer = est.composer
        const m = est.marco
        if (!composer || !m) throw new Error('sin composer')
        const ctx = gl.getContext()
        const tope = Math.min(gl.capabilities.maxTextureSize, ctx.getParameter(ctx.MAX_RENDERBUFFER_SIZE), ...ctx.getParameter(ctx.MAX_VIEWPORT_DIMS))
        c.w = Math.floor(Math.min(c.ancho || WALLPAPER_W, tope))
        c.h = Math.floor((c.w * WALLPAPER_H) / WALLPAPER_W)
        // Los puntos de cámara se miden en pixeles: a 4K se perderían.
        const puntos = efectos().find((e) => e.name === 'DotScreenEffect')?.uniforms.get('scale')
        const dpr = gl.getPixelRatio()
        s.captura = { dpr, puntos, escala: puntos?.value }
        if (puntos) puntos.value *= (m.w * dpr) / c.w
        gl.setPixelRatio(1)
        composer.setSize(c.w, c.h, false)
        const cy = H / 2 - (m.y + m.h / 2)
        camera.setViewOffset(W, H, m.x + est.ox, m.y + cy * s.centra + est.oy, m.w, m.h)
        characterNormalTexture.captura = { w: c.w, h: c.h, css: [m.w, m.h] }
        c.fase = 'render'
      } catch (e) {
        est.captura = null
        c.reject(e)
      }
    }
  }, 0.4)

  // La máscara: después de los pases del personaje, antes del composer.
  useFrame(() => {
    if (est.fase === 'off') return
    const root = playerRef.current
    if (!root) return
    const c = est.captura?.fase === 'render' ? est.captura : null
    const dpr = gl.getPixelRatio()
    const fw = c ? c.w : Math.max(2, Math.floor(size.width * dpr))
    const fh = c ? c.h : Math.max(2, Math.floor(size.height * dpr))
    if (fbo.width !== fw || fbo.height !== fh) fbo.setSize(fw, fh)

    const restaura = []
    root.traverse((o) => {
      if (!o.isMesh && !o.isSkinnedMesh && !o.isInstancedMesh && !o.isPoints && !o.isLine) return
      if (!esDelCuerpo(o)) {
        restaura.push([o, 'vis', o.visible])
        o.visible = false
      } else if (!o.name.endsWith('_outline')) {
        restaura.push([o, 'mat', o.material])
        o.material = blanco
      }
    })

    const previo = gl.getRenderTarget()
    const auto = gl.autoClear
    const claro = gl.getClearColor(new THREE.Color())
    const alfa = gl.getClearAlpha()
    gl.setRenderTarget(fbo)
    gl.autoClear = false
    gl.setClearColor(0x000000, 0)
    gl.clear(true, true, true)
    try {
      // La sombra primero: el cuerpo se dibuja encima y queda en alfa 1.
      if (est.sombra?.visible) gl.render(est.sombra, camera)
      gl.clearDepth()
      gl.render(root, camera)
      if (est.fase === 'lista' && !c) {
        const s = r.current
        if (!s.runas) scene.traverse((o) => { if (o.userData?.conservarAislado) s.runas = o })
        const rw = Math.ceil(fw / 2)
        const rh = Math.ceil(fh / 2)
        if (fboRunas.width !== rw || fboRunas.height !== rh) fboRunas.setSize(rw, rh)
        gl.setRenderTarget(fboRunas)
        gl.clear(true, false, false)
        if (s.runas) gl.render(s.runas, camera)
        est.runas = fboRunas.texture
      }
    } catch { }
    gl.setRenderTarget(previo)
    gl.setClearColor(claro, alfa)
    gl.autoClear = auto

    for (const [o, tipo, valor] of restaura) {
      if (tipo === 'mat') o.material = valor
      else o.visible = valor
    }
    est.mascara = fbo.texture
  }, 0.6)

  // Mismo cuadro: el canvas todavía tiene lo que dibujó el composer.
  useFrame(() => {
    const c = est.captura
    if (!c || c.fase !== 'render') return
    const s = r.current
    let lienzo = null
    let error = null
    try {
      lienzo = document.createElement('canvas')
      lienzo.width = c.w
      lienzo.height = c.h
      const ctx = lienzo.getContext('2d')
      ctx.fillStyle = c.fondo
      ctx.fillRect(0, 0, c.w, c.h)
      ctx.drawImage(gl.domElement, 0, 0, c.w, c.h)
      // Los stickers van encima de todo.
      for (const p of c.stickers || []) {
        const ancho = p.s * c.w
        ctx.save()
        ctx.translate(p.x * c.w, p.y * c.h)
        ctx.rotate(p.r)
        ctx.drawImage(p.img, -ancho / 2, (-ancho * p.alto) / 2, ancho, ancho * p.alto)
        ctx.restore()
      }
    } catch (e) {
      lienzo = null
      error = e
    }
    const g = s.captura
    s.captura = null
    characterNormalTexture.captura = null
    if (g?.puntos) g.puntos.value = g.escala
    try {
      // Primero el tamaño a 1×, luego el dpr: al revés, el canvas pasaría un
      // instante por 4K × dpr.
      gl.setSize(size.width, size.height, false)
      gl.setPixelRatio(g?.dpr || 1)
      est.composer?.setSize(size.width, size.height, false)
    } catch { }
    encuadra(size.width, size.height)
    est.captura = null
    if (!lienzo) { c.reject(error); return }
    pngDeCanvas(lienzo).then(c.resolve, c.reject)
  }, 2)

  return null
}
