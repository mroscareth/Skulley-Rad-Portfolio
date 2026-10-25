import React, { useEffect, useId, useRef, useState, Suspense } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { XMarkIcon } from '@heroicons/react/24/solid'
import { playSfx } from '../lib/sfx.js'
import { useShopData } from '../lib/shopDataContext.jsx'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import { ZoidianModel, ZOIDIAN_HEAD_BONE } from './ZoidianNPC.jsx'
import GlyphedText from './GlyphedText.jsx'
import { GoldenTicketArt, TicketArt } from './GoldenTicketBadge.jsx'

// ZoidianDialog — Argus (el NPC del juego de esferas) te presenta el juego
// antes de las reglas (SphereGameModal). Modal estándar del sitio
// (.site-modal) con la anatomía de la pieza destacada de la tienda: Argus en
// 3D grande a la izquierda (su "foto", con paspartú y sin borde: no es una
// caja dentro de otra), y a la derecha su nombre + una línea de detalle, lo
// que dice y una barra fija con el premio y la acción de color al final.
// En mobile el retrato va arriba. Se monta SOLO mientras está abierto: el
// canvas del retrato vive y muere con el diálogo.
//
// Flujo: click a Argus/"!" en escena → este diálogo → "jugar" → onPlay
// (App cierra esto y abre SphereGameModal).

// Encuadre a la CABEZA: la cámara ortográfica se centra en el hueso head_05
// durante el primer medio segundo (mientras Argus levanta la cabeza para
// mirarte) y después se QUEDA QUIETA. Antes lo seguía cada frame: en el
// círculo chiquito no se notaba, pero en el retrato grande cada balanceo de la
// cabeza movía el cuerpo entero y Argus parecía flotar. El prop `camera` del
// Canvas no basta para el zoom ortográfico (igual que en CharacterPortrait):
// hay que aplicarlo con updateProjectionMatrix.
const FRAME_SETTLE_FRAMES = 30
// `viewHeight` = unidades de mundo visibles en el lado corto del cuadro.
// `headLift` < 0 baja la cámara: la cara queda en el tercio de arriba.
const PORTRAIT_VIEW = 1.0
// Grosor del contorno en PIXELES de pantalla: el retrato es grande y el
// grosor de la escena (0.02 de mundo) aquí daba una franja de ~10px dentada.
const PORTRAIT_INK_PX = 2.5

// Argus con el contorno medido contra el zoom del retrato.
function PortraitModel(props) {
  const size = useThree((s) => Math.min(s.size.width, s.size.height))
  return <ZoidianModel {...props} outlineWorld={(PORTRAIT_INK_PX * PORTRAIT_VIEW) / Math.max(1, size)} />
}

function HeadFramer({ targetHeight, viewHeight = PORTRAIT_VIEW, headLift = -0.12 }) {
  const camera = useThree((s) => s.camera)
  const scene = useThree((s) => s.scene)
  const size = useThree((s) => Math.min(s.size.width, s.size.height))
  const headRef = useRef(null)
  const _v = useRef(null)
  const framesRef = useRef(0)
  useFrame(() => {
    if (!_v.current) _v.current = new THREE.Vector3()
    if (!headRef.current) headRef.current = scene.getObjectByName(ZOIDIAN_HEAD_BONE) || null
    // R3F hace lookAt(0,0,0) al crear la cámara → quedaba INCLINADA hacia
    // abajo y subir position.y no subía el encuadre (solo la ladeaba más).
    // Ortográfica de retrato = mirada recta al frente, siempre.
    camera.rotation.set(0, 0, 0)
    if (headRef.current) {
      if (framesRef.current < FRAME_SETTLE_FRAMES) {
        framesRef.current += 1
        headRef.current.getWorldPosition(_v.current)
        camera.position.x = _v.current.x
        camera.position.y = _v.current.y + headLift
      }
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

function ZoidianPortrait() {
  const targetHeight = 1.7
  // El idle lo tiene encorvado con la cabeza agachada — de frente se le ve el
  // pecho. Un target de mirada EN LA CÁMARA reusa el head-tracking del NPC:
  // levanta la cabeza y te mira mientras te habla.
  const lookTarget = useRef(null)
  return (
    <div className="absolute inset-0" aria-hidden>
      <Canvas
        dpr={[1, 2]}
        orthographic
        camera={{ position: [0, targetHeight * 0.55, 10], zoom: 300, near: -100, far: 100 }}
        frameloop="always"
        // Antialias: en un retrato de este tamaño el contorno se veía dentado.
        gl={{ antialias: true, powerPreference: 'high-performance', alpha: true, stencil: false, preserveDrawingBuffer: false }}
      >
        <HeadFramer targetHeight={targetHeight} />
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
            <PortraitModel targetHeight={targetHeight} lookAtRef={lookTarget} />
          </group>
        </Suspense>
      </Canvas>
    </div>
  )
}

// Rayos de sol toon del premio: 16 cuñas planas desde el centro.
const PRIZE_RAYS = (() => {
  const n = 16
  const half = (Math.PI / n) * 0.5
  let d = ''
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * Math.PI * 2
    const p1 = [Math.cos(a - half) * 50, Math.sin(a - half) * 50]
    const p2 = [Math.cos(a + half) * 50, Math.sin(a + half) * 50]
    d += `M0 0 L${p1[0].toFixed(2)} ${p1[1].toFixed(2)} L${p2[0].toFixed(2)} ${p2[1].toFixed(2)} Z `
  }
  return d
})()
const SPARKLE_PATH = 'M0 -11 C2 -3 3 -2 11 0 C3 2 2 3 0 11 C-2 3 -3 2 -11 0 C-3 -2 -2 -3 0 -11 Z'

function Sparkle({ style }) {
  return (
    <svg className="argus-sparkle" viewBox="-14 -14 28 28" style={style} aria-hidden>
      <path d={SPARKLE_PATH} fill="#fff" stroke="#0a0510" strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
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

const fmtNum = (n, lang) => Number(n || 0).toLocaleString(lang === 'es' ? 'es-MX' : 'en-US')

// "2026-11-01" → "1 de noviembre" / "November 1"
function fmtResetDate(iso, lang) {
  if (!iso) return ''
  const [y, m] = String(iso).split('-').map(Number)
  if (!y || !m) return ''
  return new Date(y, m - 1, 1).toLocaleDateString(lang === 'es' ? 'es-MX' : 'en-US', { day: 'numeric', month: 'long' })
}

// Cuánto pide y da cada ticket (catálogo de la tienda) y cuántos Golden
// quedan este mes (profile.php?action=tickets, se pide al abrir: el conteo
// cambia mientras otros juegan).
function useTicketStats(open) {
  const { tickets } = useShopData()
  const [stats, setStats] = useState(null)
  useEffect(() => {
    if (!open) return undefined
    let alive = true
    fetch('/api/profile.php?action=tickets')
      .then((r) => r.json())
      .then((j) => { if (alive && j?.ok) setStats(j) })
      .catch(() => { /* sin conteo: se muestran solo los niveles */ })
    return () => { alive = false }
  }, [open])
  const tiers = stats?.tiers || tickets
  return { gold: tiers.gold, silver: tiers.silver, resetsAt: stats?.resets_at || null }
}

// Un premio de la pestaña Premios: el boleto en su paspartú (como la foto de
// una pieza, §14.7), su nombre en el color del metal, cuánto da y cómo se gana.
// Columna, no tarjeta: el modal ya es la caja.
const TIER_COLOR = { gold: '#FFC21A', silver: '#DCE2EA' }
function PrizeColumn({ tier, info, lang, t, children }) {
  return (
    <div className="min-w-0">
      <div className="relative aspect-[16/10] rounded-2xl bg-[#150a1d] grid place-items-center">
        <TicketArt tier={tier} pct={info.pct} className="golden-ticket--idle w-[64%]" />
      </div>
      <h3 className="argus-display text-[1.75rem] leading-none mt-6" style={{ color: TIER_COLOR[tier] }}>{info.name}</h3>
      <p className="text-white font-semibold text-base mt-2">{t('zoidian.pctOff', { pct: info.pct })}</p>
      <p className="text-white/70 text-[0.9375rem] leading-relaxed mt-1">{t('zoidian.howTo', { score: fmtNum(info.score, lang) })}</p>
      {children}
    </div>
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
  // resuelven a latin. Cuando Argus termina de hablar aparecen abajo el
  // "¿Trato?" y los botones; un click en el texto antes de eso lo completa de
  // golpe (mismo rol que SKIP), así que nadie tiene que esperar (H03).
  const [tw, setTw] = useState({ line: 0, chars: 0, done: false, skipped: false })
  const twSkippedRef = useRef(false)
  useEffect(() => {
    if (!open) return undefined
    const texts = [t('zoidian.line1'), t('zoidian.line2')]
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
    setTw({ line: 1, chars: Number.MAX_SAFE_INTEGER, done: true, skipped: true })
  }

  const { lang } = useLanguage()
  const tickets = useTicketStats(open)
  // Dos pestañas: el trato (lo que dice Argus y el gran premio) y Premios
  // (los dos tickets, cómo se gana cada uno, cuántos Golden quedan y las
  // reglas). Cada vez que se abre, empieza en el trato.
  const [tab, setTab] = useState('deal')
  useEffect(() => { if (open) setTab('deal') }, [open])
  const tabsId = useId()

  if (!open) return null

  const handlePlay = () => {
    try { playSfx('click', { volume: 0.8 }) } catch { }
    try { onPlay?.() } catch { }
  }
  const handleClose = () => {
    try { playSfx('click', { volume: 0.8 }) } catch { }
    onClose?.()
  }

  // Ir a Premios termina de golpe lo que Argus estaba diciendo: así el
  // "¿Trato?" y los botones ya están abajo (H03).
  const selectTab = (id) => {
    if (id === tab) return
    try { playSfx('click', { volume: 0.6 }) } catch { }
    if (id === 'prizes') skipTypewriter()
    setTab(id)
  }
  const TABS = [
    { id: 'deal', label: t('zoidian.tabDeal') },
    { id: 'prizes', label: t('zoidian.tabPrizes') },
  ]
  const onTabsKeyDown = (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    const next = tab === 'deal' ? 'prizes' : 'deal'
    selectTab(next)
    document.getElementById(`${tabsId}-${next}`)?.focus()
  }

  const gold = tickets.gold
  const silver = tickets.silver
  const goldLeft = gold?.left_this_month
  const goldCap = gold?.monthly_cap || 0
  // Sin conteo todavía (o sin red) no se promete nada: solo los niveles.
  const stockText = goldLeft === undefined || goldLeft === null
    ? null
    : goldLeft > 0
      ? t('zoidian.goldLeft', { left: goldLeft, cap: goldCap })
      : t('zoidian.goldSoldOut', { date: fmtResetDate(tickets.resetsAt, lang) })
  const goldScore = fmtNum(gold.score, lang)

  return (
    <div
      className="fixed inset-0 z-modal flex items-stretch sm:items-center justify-center p-0 sm:p-4 lg:p-8"
      role="dialog"
      aria-modal="true"
      aria-label={t('zoidian.dialogAria')}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose?.()
      }}
    >
      {/* Backdrop — §6.1: con /70 el blur sí se nota */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-xl pointer-events-none" />

      <div className="site-modal text-white" onPointerDown={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-4 right-4 z-[10] w-11 h-11 grid place-items-center rounded-full border-2 border-white/40 bg-black/50 text-white hover:bg-white hover:text-black hover:border-white active:scale-90 transition-all"
          aria-label={lang === 'es' ? 'Cerrar' : 'Close'}
        >
          <XMarkIcon className="w-5 h-5" />
        </button>

        <div className="flex-1 min-h-0 flex flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          {/* Retrato: la "foto" de Argus, con paspartú y sin borde. */}
          <div className="relative shrink-0 h-[32vh] sm:h-[38vh] lg:h-auto bg-[#150a1d]">
            <ZoidianPortrait />
          </div>

          <div className="flex-1 min-h-0 flex flex-col">
            <header className="px-5 sm:px-8 lg:px-10 pt-6 sm:pt-8 pb-5 border-b-2 border-white/10 pr-16">
              <h2 className="shop-detail__title">{t('zoidian.title')}</h2>
              <p className="shop-meta shop-meta--lg mt-1">{t('zoidian.subtitle')}</p>
              <div
                role="tablist"
                aria-label={t('zoidian.title')}
                onKeyDown={onTabsKeyDown}
                className="flex gap-2 mt-5"
              >
                {TABS.map(({ id, label }) => (
                  <button
                    key={id}
                    id={`${tabsId}-${id}`}
                    type="button"
                    role="tab"
                    aria-selected={tab === id}
                    aria-controls={`${tabsId}-panel`}
                    tabIndex={tab === id ? 0 : -1}
                    onClick={() => selectTab(id)}
                    className="shop-chip shop-chip--argus inline-flex items-center min-h-[44px] px-5 text-xs whitespace-nowrap focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f5ff00]"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </header>

            {tab === 'prizes' ? (
              <div
                key="prizes"
                id={`${tabsId}-panel`}
                role="tabpanel"
                aria-labelledby={`${tabsId}-prizes`}
                className="flex-1 min-h-0 overflow-y-auto modal-scroll px-5 sm:px-8 lg:px-10 py-6 sm:py-8 flex flex-col gap-9"
              >
                <p className="text-white/80 text-base sm:text-[1.0625rem] leading-relaxed max-w-[62ch]">{t('zoidian.prizesIntro')}</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-10">
                  <PrizeColumn tier="gold" info={gold} lang={lang} t={t}>
                    {/* Un talón por Golden del mes: los ganados quedan
                        arrancados. Es el indicador de cuántos van. */}
                    {stockText && (
                      <div className="mt-4">
                        <div className="ticket-stock" aria-hidden>
                          {Array.from({ length: goldCap }, (_, i) => (
                            <span key={i} className={`ticket-stock__stub ${i >= goldLeft ? 'ticket-stock__stub--taken' : ''}`} />
                          ))}
                        </div>
                        <p className={`text-sm font-semibold mt-2.5 ${goldLeft > 0 ? 'text-[#FFC21A]' : 'text-white/60'}`}>{stockText}</p>
                      </div>
                    )}
                  </PrizeColumn>
                  <PrizeColumn tier="silver" info={silver} lang={lang} t={t}>
                    <p className="text-sm font-semibold text-white/60 mt-4">{t('zoidian.noLimit')}</p>
                  </PrizeColumn>
                </div>

                <section aria-labelledby={`${tabsId}-rules`} className="pt-7 border-t-2 border-white/10">
                  <h3 id={`${tabsId}-rules`} className="text-base font-bold text-white">{t('zoidian.rulesTitle')}</h3>
                  <ul className="mt-3 space-y-2.5 list-disc pl-5 marker:text-white/30 text-white/70 text-[0.9375rem] leading-relaxed max-w-[62ch]">
                    {['rule1', 'rule2', 'rule3', 'rule4', 'rule5', 'rule6'].map((k) => (
                      <li key={k}>{t(`zoidian.${k}`, { gold: goldScore })}</li>
                    ))}
                  </ul>
                </section>
              </div>
            ) : (
            /* Lo que dice — typewriter acumulado con glifos (mismo lenguaje
               que el preloader). Click en el texto = completar ya. */
            <div
              key="deal"
              id={`${tabsId}-panel`}
              role="tabpanel"
              aria-labelledby={`${tabsId}-deal`}
              className="flex-1 min-h-0 overflow-y-auto modal-scroll px-5 sm:px-8 lg:px-10 py-6 sm:py-8 flex flex-col gap-7 cursor-pointer"
              onPointerDown={skipTypewriter}
            >
              <div className="space-y-4">
              {[t('zoidian.line1'), t('zoidian.line2')].map((txt, i) => {
                if (i > tw.line) return null
                const display = (i === tw.line && !tw.done) ? txt.slice(0, tw.chars) : txt
                if (!display) return null
                return (
                  <p key={i} className="argus-beat text-white/80 text-base sm:text-[1.0625rem] leading-relaxed max-w-[62ch]">
                    <GlyphedText text={display} complete={Boolean(tw.skipped)} />
                  </p>
                )
              })}
              </div>

              {/* EL PREMIO — el gran premio del juego, en una pleca amarilla
                  como la de "¡Ojo!" de las reglas, pero de héroe: llena todo
                  lo que sobra debajo del texto (pegada abajo, sin huecos), con
                  rayos de sol toon detrás del boleto, destellos y la letra
                  display en grande. */}
              <div className="relative flex-1 min-h-[17rem] rounded-2xl bg-[#f5ff00] text-[#0a0510] overflow-hidden flex flex-col items-center justify-center text-center px-6 py-8">
                <svg className="argus-prize-rays" viewBox="-50 -50 100 100" aria-hidden>
                  <path d={PRIZE_RAYS} fill="#0a0510" opacity="0.07" />
                </svg>
                <Sparkle style={{ left: '14%', top: '12%', width: 30 }} />
                <Sparkle style={{ right: '15%', top: '18%', width: 22, animationDelay: '-0.7s' }} />
                <Sparkle style={{ left: '22%', top: '46%', width: 16, animationDelay: '-1.3s' }} />
                <Sparkle style={{ right: '22%', top: '50%', width: 14, animationDelay: '-0.4s' }} />
                <GoldenTicketArt pct={gold.pct} className="golden-ticket--idle relative w-[min(17rem,72%)]" />
                <p className="relative argus-display mt-6 text-[clamp(2rem,3vw,3rem)] leading-[0.92]">{t('zoidian.prizeTitle')}</p>
                {/* Cómo se gana, en el mismo banner (antes solo prometía). */}
                <p className="relative mt-2.5 text-base sm:text-lg font-semibold">{t('zoidian.prizeLabel', { pct: gold.pct, score: goldScore })}</p>
                {stockText && (
                  <p className="relative mt-4 inline-flex items-center h-8 px-4 rounded-full bg-[#0a0510] text-[#f5ff00] text-xs font-bold uppercase tracking-[0.14em]">
                    {stockText}
                  </p>
                )}
              </div>
            </div>
            )}

            {/* Barra fija: el "¿Trato?" pegado a la izquierda y la acción de
                color al final. Entran juntos cuando Argus termina de hablar;
                el alto de la barra se reserva para que nada brinque. */}
            <div className="shrink-0 min-h-[77px] border-t-2 border-white/10 px-5 sm:px-8 lg:px-10 py-4 flex items-center justify-between gap-4">
              {tw.done && (
                <p className="argus-actions-in argus-display text-white text-[1.75rem] sm:text-3xl leading-none min-w-0">
                  <AccentLastWord text={t('zoidian.question')} />
                </p>
              )}
              {tw.done && (
              <div className="argus-actions-in flex items-center gap-3 shrink-0 ml-auto">
                <button
                  type="button"
                  onClick={handleClose}
                  className="shop-btn shop-btn--ghost min-h-[44px] px-5 text-xs"
                >
                  {t('zoidian.notNow')}
                </button>
                <button
                  type="button"
                  onClick={handlePlay}
                  className="shop-btn argus-btn--primary min-h-[44px] px-6 text-xs"
                >
                  {t('zoidian.play')}
                </button>
              </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
