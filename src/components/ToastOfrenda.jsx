import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { armar, URL_OFRENDAS } from './home/ObjetosOfrenda.jsx'
import { medirContorno } from '../lib/contornoPantalla.js'
import { hablando } from '../lib/turnoGlobos.js'
import { useGlitchRunas, textoGlitch } from '../hooks/useGlitchRunas.js'
import useFocoModal from '../hooks/useFocoModal.js'
import { playSfx } from '../lib/sfx.js'
import { PRIZE_RAYS, Sparkle } from './argusArt.jsx'

// El aviso de una ofrenda ganada (Oscar, 2026-11-25): una tarjeta chica al centro con el objeto
// girando sobre la banda amarilla de los premios de Argus, "¡Has obtenido…!" en Luckiest Guy (llega
// en runas y se glitchea a letras, solo de ida) y la pista de qué hacer con él. Sale cuando nadie
// está hablando (turnoGlobos) y la home está libre (`puede`), un respiro después de que Skulley ya lo
// carga sobre la cabeza; mientras está abierta, los globos esperan (App pausa el turno de palabra).
// El objeto es el mismo de la plaza (armar de ObjetosOfrenda) en su propio Canvas chico, que solo
// vive lo que dura la tarjeta.

const TEXTOS = {
  es: {
    nombre: { ipad: 'el iPad', leica: 'la cámara', album: 'el álbum de fotos', teclado: 'el teclado MIDI', cerillos: 'la caja de cerillos', almohada: 'la almohada' },
    titulo: (n) => `¡Has obtenido ${n}!`,
    pista: (lo) => `L${lo === 'la' ? 'a' : 'o'} guardaste en tu inventario. Deberías colocar${lo} en una de las piedras del portal que no funciona… a ver qué pasa.`,
    pistaAlmohada: 'La guardaste en tu inventario. Deberías llevarla atrás del portal que no funciona, junto a las barricadas… a ver qué pasa.',
    va: '¡Va!',
  },
  en: {
    nombre: { ipad: 'the iPad', leica: 'the camera', album: 'the photo album', teclado: 'the MIDI keyboard', cerillos: 'the matchbox', almohada: 'the pillow' },
    titulo: (n) => `You got ${n}!`,
    pista: () => "It's in your inventory. You should place it at one of the stones by the broken portal… see what happens.",
    pistaAlmohada: "It's in your inventory. You should take it behind the broken portal, by the barricades… see what happens.",
    va: 'Got it!',
  },
}
const FEMENINO = new Set(['leica', 'cerillos', 'almohada'])

export const TOAST_OFRENDA = {
  espera: 1.4,      // s desde que la gana hasta que puede salir la tarjeta
  glitch: 0.45,     // s hasta que el título se glitchea a letras
  gira: 1.1,        // rad/s
  tam: 1.3,         // lado mayor del objeto, en unidades de su escena
  entra: 0.55,      // s del pasón con que aparece el objeto
}
const SIN_REGRESO_MS = 864e5

const pason = (x) => { const c = 1.9; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2) }
const _centro = new THREE.Vector3()

// `espera`: segundos antes de aparecer; `sale`: se encoge girando (el inventario, al cambiar de pestaña).
export function ObjetoGirando({ id, tam = TOAST_OFRENDA.tam, gira = TOAST_OFRENDA.gira, espera = 0, sale = false }) {
  const gltf = useGLTF(URL_OFRENDAS, true)
  const armado = useMemo(() => armar(gltf), [gltf])
  const o = armado.objetos[id]
  const grupo = useRef(null)
  const t = useRef(-espera)
  const fuera = useRef(0)
  const saleRef = useRef(sale)
  saleRef.current = sale

  useEffect(() => () => {
    const geos = new Set()
    const mats = new Set()
    for (const ob of Object.values(armado.objetos)) {
      for (const raiz of [ob.raiz, ob.carga]) {
        raiz.traverse((m) => { if (m.isMesh) { geos.add(m.geometry); mats.add(m.material) } })
      }
    }
    geos.forEach((g) => g.dispose())
    mats.forEach((m) => m.dispose())
    Object.values(armado.tex).forEach((x) => x?.dispose?.())
  }, [armado])

  useFrame((state, delta) => {
    if (!o || !grupo.current) return
    const dt = Math.min(delta, 0.05)
    t.current += dt
    fuera.current = saleRef.current ? Math.min(1, fuera.current + dt / 0.28) : Math.max(0, fuera.current - dt / 0.28)
    const s = pason(Math.min(1, Math.max(0, t.current) / TOAST_OFRENDA.entra)) * (1 - fuera.current * fuera.current)
    const esc = o.escCarga * (tam / 1.05) * Math.max(1e-4, s)
    o.carga.scale.setScalar(esc)
    o.carga.position.set(0, Math.sin(t.current * 1.6) * 0.05, 0)
    grupo.current.rotation.y = -0.6 + Math.max(0, t.current) * gira + fuera.current * fuera.current * 4
    medirContorno(o.grosorCarga, state.camera, state.size, state.viewport.dpr, _centro, Math.max(0.3, o.tamMax * esc))
  })

  if (!o) return null
  return (
    <group rotation-x={0.22}>
      <group ref={grupo}>
        <primitive object={o.carga} />
      </group>
    </group>
  )
}

export default function ToastOfrenda({ id, lang = 'es', puede = true, onAbierto, onClose }) {
  const T = TEXTOS[lang === 'en' ? 'en' : 'es']
  const [abierto, setAbierto] = useState(false)
  const [saliendo, setSaliendo] = useState(false)
  const desde = useRef(performance.now())
  const puedeRef = useRef(puede)
  puedeRef.current = puede

  // espera su turno: un respiro, la home libre y nadie a media frase
  useEffect(() => {
    if (abierto) return undefined
    const id = setInterval(() => {
      if (performance.now() - desde.current < TOAST_OFRENDA.espera * 1000) return
      if (!puedeRef.current || hablando()) return
      setAbierto(true)
    }, 200)
    return () => clearInterval(id)
  }, [abierto])

  useEffect(() => {
    if (!abierto) return undefined
    onAbierto?.(true)
    try { playSfx('sparkleBom', { volume: 0.8 }) } catch { /* sin audio */ }
    return () => onAbierto?.(false)
  }, [abierto, onAbierto])

  const cerrar = () => {
    if (saliendo) return
    try { playSfx('click', { volume: 0.8 }) } catch { /* sin audio */ }
    setSaliendo(true)
    setTimeout(() => onClose?.(), 240)
  }
  const cerrarRef = useRef(cerrar)
  cerrarRef.current = cerrar

  useEffect(() => {
    if (!abierto) return undefined
    const onKeyDown = (e) => {
      if (e?.key !== 'Escape' || e.defaultPrevented) return
      e.preventDefault()
      cerrarRef.current()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [abierto])

  const raizRef = useRef(null)
  useFocoModal(raizRef, abierto)

  const titulo = T.titulo(T.nombre[id] || id)
  const { fase, disparar } = useGlitchRunas(abierto, { sonido: false, sostieneMs: SIN_REGRESO_MS })
  useEffect(() => {
    if (!abierto) return undefined
    const t = setTimeout(disparar, TOAST_OFRENDA.glitch * 1000)
    return () => clearTimeout(t)
  }, [abierto, disparar])

  if (!abierto) return null
  const pista = id === 'almohada' ? T.pistaAlmohada : T.pista(FEMENINO.has(id) ? 'la' : 'lo')
  const enRunas = !fase?.letras

  return (
    <div
      ref={raizRef}
      tabIndex={-1}
      className={`ofr-toast-raiz fixed inset-0 z-tutorial flex items-center justify-center p-4 outline-none${saliendo ? ' is-sale pointer-events-none' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ofr-toast-titulo"
      onPointerDown={(e) => { if (e.target === e.currentTarget) cerrar() }}
    >
      <div className="ofr-toast-raiz__fondo absolute inset-0 bg-[#0a0510]/80 pointer-events-none" />
      <div className="ofr-toast" onPointerDown={(e) => e.stopPropagation()}>
        <div className="ofr-toast__escena">
          <svg className="argus-prize-rays" viewBox="-50 -50 100 100" aria-hidden>
            <path d={PRIZE_RAYS} fill="#0a0510" opacity={0.07} />
          </svg>
          <Sparkle style={{ left: '1rem', top: '0.9rem', width: 18 }} />
          <Sparkle style={{ right: '1.2rem', top: '1.6rem', width: 14, animationDelay: '-0.6s' }} />
          <Sparkle style={{ left: '20%', bottom: '1rem', width: 15, animationDelay: '-1.1s' }} />
          <Canvas
            className="ofr-toast__canvas"
            flat
            dpr={[1, 2]}
            camera={{ fov: 30, position: [0, 0.3, 3.4] }}
            gl={{ alpha: true, antialias: true, powerPreference: 'low-power' }}
          >
            <ambientLight intensity={0.7} />
            <directionalLight position={[2, 3, 4]} intensity={2.4} />
            <directionalLight position={[-3, 1, -2]} intensity={0.6} />
            <Suspense fallback={null}>
              <ObjetoGirando id={id} />
            </Suspense>
          </Canvas>
        </div>
        <div className="ofr-toast__cuerpo">
          <h2
            id="ofr-toast-titulo"
            className={`ofr-toast__titulo${enRunas ? ' ofr-toast__titulo--runas' : ''}${fase?.tiembla ? ' glitch-runas' : ''}`}
            aria-label={titulo}
          >
            {textoGlitch(titulo, fase)}
          </h2>
          <p className="ofr-toast__pista">{pista}</p>
          <button
            type="button"
            onClick={cerrar}
            className="shop-btn shop-btn--primary min-h-[44px] px-8 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            {T.va}
          </button>
        </div>
      </div>
    </div>
  )
}
