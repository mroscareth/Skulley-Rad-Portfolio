import React, { Suspense, useEffect, useReducer, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import IconoTinta from './ui/IconoTinta.jsx'
import { armar, URL_OFRENDAS } from './home/ObjetosOfrenda.jsx'
import { medirContorno } from '../lib/contornoPantalla.js'
import { ObjetoGirando } from './ToastOfrenda.jsx'
import { useGlitchRunas, textoGlitch } from '../hooks/useGlitchRunas.js'
import { useTituloOrilla } from '../hooks/useTituloOrilla.js'
import { OFRENDAS, ofrendaPuesta, ofrendaEnMano, escucharOfrendas } from '../lib/ofrendas.js'
import { HISTORIAS } from '../lib/misionesOfrenda.js'
import { skulleyOculto } from '../lib/inventarioEscena.js'
import { playSfx } from '../lib/sfx.js'

// Inventario → Objetos (Oscar, 2026-11-25): los objetos de la ofrenda que vas ganando, cada uno con
// su historia (HISTORIAS en misionesOfrenda.js). A la izquierda los seis en chips (los que no tienes,
// con signo de pregunta), al centro el escogido girando donde estaba Skulley (sin fondo, Oscar: "on
// brand") y a la derecha su nombre de orilla a orilla con el glitch de las runas, su historia y dónde va. Va aparte de CharacterCustomizer (lazy) porque trae three: las
// miniaturas de los chips se pintan una sola vez con un renderer propio que se tira al terminar, y el
// objeto de la derecha vive en un Canvas chico solo mientras se ve la pestaña.

const FEMENINO = new Set(['leica', 'cerillos', 'almohada'])
const tieneOfrenda = (id) => ofrendaPuesta(id) || ofrendaEnMano(id)
const MINI = { tam: 192, lado: 1.3 }

let miniaturas = null
function pintarMiniaturas(gltf) {
  if (miniaturas) return miniaturas
  const armado = armar(gltf)
  const canvas = document.createElement('canvas')
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true })
  renderer.setPixelRatio(1)
  renderer.setSize(MINI.tam, MINI.tam, false)
  renderer.setClearColor(0x000000, 0)
  const escena = new THREE.Scene()
  escena.add(new THREE.AmbientLight(0xffffff, 0.7))
  const luz = new THREE.DirectionalLight(0xffffff, 2.4)
  luz.position.set(2, 3, 4)
  escena.add(luz)
  const camara = new THREE.PerspectiveCamera(30, 1, 0.1, 50)
  camara.position.set(0, 0.55, 3.2)
  camara.lookAt(0, 0, 0)
  camara.updateProjectionMatrix()
  camara.updateMatrixWorld(true)
  const centro = new THREE.Vector3()
  const out = {}
  for (const [id, o] of Object.entries(armado.objetos)) {
    const g = new THREE.Group()
    g.rotation.set(0.22, -0.65, 0)
    o.carga.position.set(0, 0, 0)
    const esc = o.escCarga * (MINI.lado / 1.05)
    o.carga.scale.setScalar(esc)
    g.add(o.carga)
    escena.add(g)
    g.updateMatrixWorld(true)
    medirContorno(o.grosorCarga, camara, { width: MINI.tam, height: MINI.tam }, 1, centro, Math.max(0.3, o.tamMax * esc))
    renderer.render(escena, camara)
    out[id] = canvas.toDataURL('image/png')
    escena.remove(g)
  }
  const geos = new Set()
  const mats = new Set()
  for (const o of Object.values(armado.objetos)) {
    for (const r of [o.raiz, o.carga]) r.traverse((m) => { if (m.isMesh) { geos.add(m.geometry); mats.add(m.material) } })
  }
  geos.forEach((x) => x.dispose())
  mats.forEach((x) => x.dispose())
  Object.values(armado.tex).forEach((x) => x?.dispose?.())
  renderer.dispose()
  renderer.forceContextLoss()
  miniaturas = out
  return out
}

function useOfrendas() {
  const [, refrescar] = useReducer((n) => n + 1, 0)
  useEffect(() => escucharOfrendas(refrescar), [])
}

export function ChipsObjetos({ lang = 'es', seleccion, onSeleccion, enFila = false }) {
  useOfrendas()
  const gltf = useGLTF(URL_OFRENDAS, true)
  const [mins, setMins] = useState(miniaturas)
  useEffect(() => {
    if (mins) return undefined
    const id = setTimeout(() => setMins(pintarMiniaturas(gltf)), 60)
    return () => clearTimeout(id)
  }, [gltf, mins])
  // al abrir: si lo escogido no lo tienes y sí tienes otro, escoge el primero que tengas (después se
  // puede escoger uno que falta, para leer su pista)
  useEffect(() => {
    if (tieneOfrenda(seleccion)) return
    const primero = OFRENDAS.find((o) => tieneOfrenda(o.id))
    if (primero) onSeleccion?.(primero.id)
  }, [])
  return (
    <div className={enFila ? 'flex justify-center gap-3' : 'grid grid-cols-2 gap-2.5 md:gap-3'} role="group" aria-label={lang === 'es' ? 'Objetos' : 'Objects'}>
      {OFRENDAS.map(({ id }) => {
        const tiene = tieneOfrenda(id)
        const activa = id === seleccion
        const nombre = tiene ? HISTORIAS[id].nombre[lang === 'en' ? 'en' : 'es'] : '???'
        return (
          <div key={id} className="cc-pieza flex flex-col items-center">
            <button
              type="button"
              onClick={() => { if (activa) return; try { playSfx('click', { volume: 1.0 }) } catch { }; onSeleccion?.(id) }}
              onMouseEnter={() => { try { playSfx('hover', { volume: 0.9 }) } catch { } }}
              aria-pressed={activa}
              aria-label={nombre}
              className={`chip-tinta relative grid place-items-center w-12 h-12 md:w-16 md:h-16${activa ? ' es-elegido' : ''}`}
            >
              {tiene && mins?.[id]
                ? <img src={mins[id]} alt="" draggable={false} className="w-[92%] h-[92%] object-contain pointer-events-none select-none" />
                : <IconoTinta nombre="pregunta" tam={44} className="chip-tinta__icono opacity-60" />}
              {ofrendaPuesta(id) && <span className="absolute top-0 right-0 w-3 h-3 md:w-3.5 md:h-3.5 rounded-full bg-[#ff7a1a] border-2 border-[#0a0510]" aria-hidden="true" />}
            </button>
            <div className="mt-1 w-12 md:w-16 text-[9px] md:text-[10px] text-center leading-tight opacity-80 truncate">{nombre}</div>
          </div>
        )
      })}
    </div>
  )
}

const SIN_REGRESO_MS = 864e5

// El objeto escogido, grande y girando donde estaba Skulley (CharacterCustomizer lo quita de en medio:
// lib/inventarioEscena.js). Sin fondo: solo el objeto con su toon y su tinta, en un Canvas transparente
// que vive mientras se ve la pestaña. Lo que no tienes es un signo de pregunta.
export function EscenaObjeto({ id, activa = false, sale = false }) {
  useOfrendas()
  const tiene = tieneOfrenda(id)
  if (!tiene) {
    return (
      <div className="w-full h-full grid place-items-center">
        <IconoTinta nombre="pregunta" tam={150} className="opacity-70" />
      </div>
    )
  }
  if (!activa) return null
  return (
    <Canvas
      flat
      dpr={[1, 2]}
      camera={{ fov: 30, position: [0, 0.3, 3.4] }}
      gl={{ alpha: true, antialias: true, powerPreference: 'low-power' }}
      style={{ pointerEvents: 'none' }}
    >
      <ambientLight intensity={0.7} />
      <directionalLight position={[2, 3, 4]} intensity={2.4} />
      <directionalLight position={[-3, 1, -2]} intensity={0.6} />
      <Suspense fallback={null}>
        {/* si Skulley todavía está (se va a deshacer), el objeto espera a que se vaya; al cambiar de objeto, no */}
        <ObjetoGirando key={id} id={id} tam={1.3} gira={0.7} espera={skulleyOculto() ? 0 : 0.6} sale={sale} />
      </Suspense>
    </Canvas>
  )
}

// El nombre de orilla a orilla (useTituloOrilla): llega en runas y se glitchea a Luckiest Guy cada vez
// que escoges otro (por eso va con `key`); ya en letras, un clic lo regresa un rato a las runas.
function NombreGlitch({ texto, activo }) {
  const orilla = useTituloOrilla(texto)
  const llegada = useGlitchRunas(activo, { sonido: false, sostieneMs: SIN_REGRESO_MS })
  const yaEnLetras = Boolean(llegada.fase?.letras && !llegada.fase?.tiembla)
  const clic = useGlitchRunas(activo && yaEnLetras)
  useEffect(() => {
    if (!activo) return undefined
    const id = setTimeout(llegada.disparar, 380)
    return () => clearTimeout(id)
  }, [activo, llegada.disparar])
  const fase = clic.fase || llegada.fase
  const enRunas = clic.fase ? clic.fase.letras : !llegada.fase?.letras
  return (
    <h2
      className={`display-title select-none cursor-pointer w-full ${orilla ? 'titulo-orilla' : 'display-title--lg'}${enRunas ? ' display-title--runas' : ''}${fase?.tiembla ? ' glitch-runas' : ''}`}
      style={orilla || undefined}
      onClick={clic.disparar}
      aria-label={texto}
    >
      <span aria-hidden>{textoGlitch(texto, fase)}</span>
    </h2>
  )
}

// A la derecha: el nombre grande con glitch y abajo su historia y dónde va.
export function TextoObjeto({ lang = 'es', id, activo = false, compacta = false }) {
  useOfrendas()
  const L = lang === 'en' ? 'en' : 'es'
  const h = HISTORIAS[id] || HISTORIAS.ipad
  const tiene = tieneOfrenda(id)
  const puesta = ofrendaPuesta(id)
  const nombre = tiene ? h.nombre[L] : '???'
  const donde = puesta
    ? (L === 'es' ? 'Ya está en la ofrenda.' : "It's already on the ofrenda.")
    : id === 'almohada'
      ? (L === 'es' ? 'Llévala atrás del portal que no funciona, junto a las barricadas.' : 'Take it behind the broken portal, by the barricades.')
      : (L === 'es' ? `Llév${FEMENINO.has(id) ? 'ala' : 'alo'} a su piedra, en el portal que no funciona.` : 'Take it to its stone at the broken portal.')
  return (
    <div className={`@container flex flex-col ${compacta ? 'w-full max-w-sm items-center text-center' : 'w-full'}`}>
      <div className="cc-pieza w-full"><NombreGlitch key={`${id}-${nombre}`} texto={nombre} activo={activo} /></div>
      <p className={`cc-pieza mt-5 leading-snug opacity-90 ${compacta ? 'text-[13px]' : 'text-[15px] md:text-base'}`}>
        {tiene ? h[L] : (h.pista?.[L] || (L === 'es' ? 'Todavía no lo encuentras.' : "You haven't found it yet."))}
      </p>
      {tiene && <p className="cc-pieza mt-3 text-[12px] md:text-[13px] leading-snug opacity-60">{donde}</p>}
    </div>
  )
}
