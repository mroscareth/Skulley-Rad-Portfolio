import React, { useEffect, useRef, useState, Suspense } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { playSfx } from '../lib/sfx.js'
import { ZoidianModel, ZOIDIAN_HEAD_BONE } from './ZoidianNPC.jsx'
import GlyphedText from './GlyphedText.jsx'

// ZoidianDialog — Argus (el NPC del juego de esferas) te presenta el juego
// antes de las instrucciones (SphereGameModal). Lenguaje §14 (editorial +
// toon, como la Store) con el acento amarillo de Argus: superficie plana,
// borde sólido, display Luckiest Guy — fuera el chrome terminal. Retrato
// circular 3D (mini-canvas propio, idle + mirada a cámara). Se monta SOLO
// mientras está abierto: el canvas del retrato vive y muere con el diálogo.
//
// Flujo: click a Argus/"!" en escena → este diálogo → "jugar" → onPlay
// (App cierra esto y abre SphereGameModal).

// Encuadre a la CABEZA: la cámara ortográfica se ancla al hueso head_05 cada
// frame (después del mixer) — sigue el bobbing del idle y el retrato queda
// vivo. El prop `camera` del Canvas no basta para el zoom ortográfico (igual
// que en CharacterPortrait): hay que aplicarlo con updateProjectionMatrix.
// `viewHeight` = unidades de mundo visibles en el círculo (cabeza + hombros).
function HeadFramer({ size, targetHeight, viewHeight = 0.78, headLift = 0.19 }) {
  const camera = useThree((s) => s.camera)
  const scene = useThree((s) => s.scene)
  const headRef = useRef(null)
  const _v = useRef(null)
  useFrame(() => {
    if (!_v.current) _v.current = new THREE.Vector3()
    if (!headRef.current) headRef.current = scene.getObjectByName(ZOIDIAN_HEAD_BONE) || null
    // R3F hace lookAt(0,0,0) al crear la cámara → quedaba INCLINADA hacia
    // abajo y subir position.y no subía el encuadre (solo la ladeaba más).
    // Ortográfica de retrato = mirada recta al frente, siempre.
    camera.rotation.set(0, 0, 0)
    if (headRef.current) {
      headRef.current.getWorldPosition(_v.current)
      camera.position.x = _v.current.x
      camera.position.y = _v.current.y + headLift
    } else {
      // Fallback si el rig cambiara de nombres: busto genérico.
      camera.position.x = 0
      camera.position.y = targetHeight * 0.7
    }
    const zoom = size / viewHeight
    if (Math.abs(camera.zoom - zoom) > 0.5) {
      camera.zoom = zoom
      camera.updateProjectionMatrix()
    }
  })
  return null
}

function ZoidianPortrait({ size = 128 }) {
  const targetHeight = 1.7
  // El idle lo tiene encorvado con la cabeza agachada — de frente se le ve el
  // pecho. Un target de mirada EN LA CÁMARA reusa el head-tracking del NPC:
  // levanta la cabeza y te mira mientras te habla.
  const lookTarget = useRef(null)
  return (
    <div
      className="rounded-full overflow-hidden border-[3px] border-white/[0.12] bg-[#06061D] shrink-0"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <Canvas
        dpr={[1, 2]}
        orthographic
        camera={{ position: [0, targetHeight * 0.55, 10], zoom: size / (targetHeight * 0.85), near: -100, far: 100 }}
        frameloop="always"
        gl={{ antialias: false, powerPreference: 'high-performance', alpha: true, stencil: false, preserveDrawingBuffer: false }}
      >
        <HeadFramer size={size} targetHeight={targetHeight} />
        {/* Receta de luz del retrato del personaje: ambient bajo + key fuerte
            → el banding toon muestra el corte luz/sombra. */}
        <ambientLight intensity={0.45} />
        <directionalLight intensity={1.5} position={[2, 4, 3]} />
        {/* Target CERCA y ALTO para que el pitch llegue al clamp (+0.45 rad) y
            de verdad levante la cabeza agachada del idle. El -1.4 en Y
            compensa el +1.4 que el tracking suma para mirar "a la cara" de
            Skulley — aquí el target es el punto exacto a mirar. */}
        <object3D ref={lookTarget} position={[0, 2.6 - 1.4, 1.6]} />
        <Suspense fallback={null}>
          {/* Tilt hacia atrás: toma de ángulo bajo — con la cabezota agachada
              del idle, sin esto la cara no se ve desde el frente. */}
          <group rotation={[-0.15, 0, 0]}>
            <ZoidianModel targetHeight={targetHeight} lookAtRef={lookTarget} />
          </group>
        </Suspense>
      </Canvas>
    </div>
  )
}

// Colorea la ÚLTIMA palabra con el acento (como "¿Quieres JUGAR?" del mock).
// Solo cuando el texto ya está completo — durante el typewriter va plano.
function AccentLastWord({ text }) {
  const idx = text.lastIndexOf(' ')
  if (idx < 0) return <span className="text-[#f5ff00]">{text}</span>
  return (
    <>
      {text.slice(0, idx + 1)}
      <span className="text-[#f5ff00]">{text.slice(idx + 1)}</span>
    </>
  )
}

export default function ZoidianDialog({ t, open, onClose, onPlay }) {
  useEffect(() => {
    if (!open) return undefined
    const onKeyDown = (e) => {
      if (e?.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  // Typewriter estilo preloader: las líneas se ACUMULAN, cada una entra con
  // beat propio y los caracteres nacen como runas (GlyphedText) que se
  // resuelven a latin. Los botones aparecen cuando termina el texto; un click
  // en el diálogo antes de eso lo completa de golpe (mismo rol que SKIP).
  const [tw, setTw] = useState({ line: 0, chars: 0, done: false, skipped: false })
  const twSkippedRef = useRef(false)
  useEffect(() => {
    if (!open) return undefined
    const texts = [t('zoidian.line1'), t('zoidian.line2'), t('zoidian.question')]
    twSkippedRef.current = false
    setTw({ line: 0, chars: 0, done: false, skipped: false })
    let line = 0
    let chars = 0
    let pause = 22 // deja que el modal termine de aparecer antes de teclear
    const id = setInterval(() => {
      if (twSkippedRef.current) { clearInterval(id); return }
      if (pause > 0) { pause -= 1; return }
      const ln = texts[line] || ''
      chars = Math.min(ln.length, chars + 2)
      setTw({ line, chars, done: false, skipped: false })
      if (chars >= ln.length) {
        if (line >= texts.length - 1) {
          setTw({ line, chars, done: true, skipped: false })
          clearInterval(id)
        } else {
          pause = 16 // respiro corto entre beats (~260ms)
          line += 1
          chars = 0
        }
      }
    }, 16)
    return () => clearInterval(id)
  }, [open, t])

  const skipTypewriter = () => {
    if (tw.done) return
    twSkippedRef.current = true
    setTw({ line: 2, chars: Number.MAX_SAFE_INTEGER, done: true, skipped: true })
  }

  // El acento amarillo de la última palabra entra cuando las runas de la
  // pregunta ya se resolvieron (skip = inmediato) — no a media traducción.
  const [accentReady, setAccentReady] = useState(false)
  useEffect(() => {
    if (!open) { setAccentReady(false); return undefined }
    if (!tw.done) return undefined
    if (tw.skipped) { setAccentReady(true); return undefined }
    const id = setTimeout(() => setAccentReady(true), 380)
    return () => clearTimeout(id)
  }, [open, tw.done, tw.skipped])

  if (!open) return null

  const handlePlay = () => {
    try { playSfx('click', { volume: 0.8 }) } catch { }
    try { onPlay?.() } catch { }
  }
  const handleClose = () => {
    try { playSfx('click', { volume: 0.8 }) } catch { }
    onClose?.()
  }

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t('zoidian.dialogAria')}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose?.()
      }}
    >
      {/* Backdrop — §6.1: con /70 el blur sí se nota */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-xl pointer-events-none" />

      {/* Panel §14 — mismo ancho que SphereGameModal */}
      <div className="argus-panel relative w-[min(640px,94vw)] max-h-[90vh] overflow-y-auto modal-scroll px-7 sm:px-10 pt-8 sm:pt-9 pb-9">
        {/* Cerrar */}
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-4 right-5 text-white/35 hover:text-white text-2xl leading-none transition-colors"
          aria-label="Close"
        >
          ×
        </button>

        {/* Retrato + nombre */}
        <div className="flex items-center gap-5 sm:gap-6 mb-6">
          <ZoidianPortrait />
          <div>
            <h1 className="argus-display text-white text-[2.6rem] sm:text-[3.25rem]">{t('zoidian.title')}</h1>
            <p className="argus-display text-white/50 text-lg sm:text-xl mt-2">{t('zoidian.subtitle')}</p>
          </div>
        </div>

        {/* Diálogo — typewriter acumulado con glifos (mismo lenguaje que el
            preloader). Click en cualquier parte del texto = completar ya. */}
        <div className="space-y-4 mb-7 min-h-[10rem] cursor-pointer" onPointerDown={skipTypewriter}>
          {[t('zoidian.line1'), t('zoidian.line2'), t('zoidian.question')].map((txt, i) => {
            if (i > tw.line) return null
            const display = (i === tw.line && !tw.done) ? txt.slice(0, tw.chars) : txt
            if (!display) return null
            const isQuestion = i === 2
            const cls = isQuestion
              ? 'argus-beat argus-display text-white text-[1.75rem] sm:text-3xl pt-2'
              : 'argus-beat text-white/75 text-base sm:text-[1.0625rem] leading-relaxed'
            return (
              <p key={i} className={cls}>
                {isQuestion && accentReady
                  ? <AccentLastWord text={txt} />
                  : <GlyphedText text={display} complete={Boolean(tw.skipped)} />}
              </p>
            )
          })}
        </div>

        {/* Acciones — entran cuando el texto terminó, como el ENTER del
            preloader cae donde el usuario termina de leer. */}
        {tw.done && (
          <div className="argus-actions-in flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={handlePlay}
              className="shop-btn argus-btn--primary h-12 px-8 text-sm"
            >
              {t('zoidian.play')}
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="shop-btn shop-btn--ghost h-12 px-6 text-xs"
            >
              {t('zoidian.notNow')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
