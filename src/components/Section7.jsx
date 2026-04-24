import React, { Suspense } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import {
  loadState,
  getAllArchiveDocIds,
  trackArchiveDocSeen,
} from '../lib/questEngine.js'
import { ARCHIVE_DOCS } from '../lib/questData.js'

// Section7 — Fragmented Memories (fullscreen, R3F scene).
//
// Escena: piso oscuro, luz cenital cálida (tipo interrogatorio), atmósfera con
// fog + bloom sutil. Folders de manila tirados en el suelo con rotación random,
// clasificación visible. Click → modal HTML overlay con el contenido.
//
// Inmersivo: cubre toda la pantalla, sin chrome del sitio interfiriendo.
// ESC o botón back → regresa a home.

// -----------------------------------------------------------------------------
// Seeded helpers para layout determinista
// -----------------------------------------------------------------------------
function seededNumber(seed, min, max) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0
  const n = Math.abs(h % 1000) / 1000
  return min + n * (max - min)
}

// Layout de N folders sobre un "escritorio" oscuro. Posiciones deterministas
// por id — el layout no salta entre renders.
function getFolderLayout(ids) {
  return ids.map((id, i) => {
    const angle = (i / ids.length) * Math.PI * 2 + seededNumber(id, -0.3, 0.3)
    const radius = 2.2 + seededNumber(id + 'r', 0, 1.6)
    const x = Math.cos(angle) * radius
    const z = Math.sin(angle) * radius
    const rot = seededNumber(id + 'rot', -0.45, 0.45)
    return { id, position: [x, 0.01, z], rotY: rot }
  })
}

// -----------------------------------------------------------------------------
// Folder 3D component
// -----------------------------------------------------------------------------
function Folder3D({ doc, docId, position, rotY, unlocked, onClick, lang, isHovered, onHover, onUnhover }) {
  const groupRef = React.useRef(null)
  const hoverLift = React.useRef(0)

  useFrame((_, dt) => {
    if (!groupRef.current) return
    // Hover lift smoothing
    const target = isHovered && unlocked ? 0.35 : 0
    hoverLift.current += (target - hoverLift.current) * Math.min(dt * 8, 1)
    groupRef.current.position.y = position[1] + hoverLift.current
    // Subtle idle bob
    const t = performance.now() * 0.001
    groupRef.current.rotation.y = rotY + Math.sin(t * 0.5 + position[0]) * 0.01
  })

  const manilaColor = unlocked ? '#d4b98c' : '#5a4d38'
  const tagLabel = docId.toUpperCase().replace('DOC_', '')
  const titleText = unlocked
    ? (doc.title[lang] || doc.title.en).slice(0, 36)
    : (lang === 'es' ? '— clasificado —' : '— classified —')
  const stampText = unlocked ? (doc.classification?.split(' — ')[0] || 'INTERNAL') : 'LOCKED'
  const timestampText = unlocked ? doc.timestamp : '████-██-██ ██:██:██'

  return (
    <group
      ref={groupRef}
      position={position}
      rotation={[-Math.PI / 2, 0, rotY]}
      onPointerOver={(e) => { e.stopPropagation(); onHover?.(docId) }}
      onPointerOut={(e) => { e.stopPropagation(); onUnhover?.(docId) }}
      onClick={(e) => { e.stopPropagation(); unlocked && onClick?.(docId) }}
    >
      {/* Sombra suave debajo */}
      <mesh position={[0, -0.01, 0]} rotation={[0, 0, 0]}>
        <planeGeometry args={[2.4, 1.7]} />
        <meshBasicMaterial color="#000" transparent opacity={0.5} />
      </mesh>

      {/* Folder base (plane tipo papel manila) */}
      <mesh castShadow receiveShadow>
        <planeGeometry args={[2.2, 1.5]} />
        <meshStandardMaterial
          color={manilaColor}
          roughness={0.85}
          metalness={0}
        />
      </mesh>

      {/* Tag amarillo top-left con ID */}
      <mesh position={[-0.75, 0.55, 0.001]}>
        <planeGeometry args={[0.55, 0.18]} />
        <meshStandardMaterial color="#f5d04a" roughness={0.7} />
      </mesh>
      <Text
        position={[-0.75, 0.55, 0.005]}
        fontSize={0.09}
        color="#2a2410"
        anchorX="center"
        anchorY="middle"
        fontWeight={700}
        letterSpacing={0.08}
      >
        {tagLabel}
      </Text>

      {/* Sello rojo top-right */}
      <Text
        position={[0.7, 0.55, 0.005]}
        fontSize={0.085}
        color={unlocked ? '#8a1a1a' : '#5a0a0a'}
        anchorX="center"
        anchorY="middle"
        fontWeight={900}
        letterSpacing={0.1}
        rotation={[0, 0, -0.14]}
      >
        {stampText}
      </Text>

      {/* Título en el centro */}
      <Text
        position={[0, 0, 0.005]}
        fontSize={0.09}
        color={unlocked ? '#2a2410' : '#3a3225'}
        anchorX="center"
        anchorY="middle"
        maxWidth={1.9}
        textAlign="center"
        lineHeight={1.2}
      >
        {titleText}
      </Text>

      {/* Timestamp abajo */}
      <Text
        position={[0, -0.6, 0.005]}
        fontSize={0.065}
        color={unlocked ? 'rgba(42,36,16,0.5)' : '#2a2010'}
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.06}
      >
        {timestampText}
      </Text>

      {/* Overlay de bloqueo: diagonal stripes */}
      {!unlocked && (
        <mesh position={[0, 0, 0.01]}>
          <planeGeometry args={[2.2, 1.5]} />
          <meshBasicMaterial color="#000" transparent opacity={0.45} />
        </mesh>
      )}
    </group>
  )
}

// -----------------------------------------------------------------------------
// Floor (surface where folders rest)
// -----------------------------------------------------------------------------
function Floor() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[40, 40]} />
      <meshStandardMaterial
        color="#1a1410"
        roughness={0.95}
        metalness={0.05}
      />
    </mesh>
  )
}

// -----------------------------------------------------------------------------
// Dust particles (ambient, muy sutil)
// -----------------------------------------------------------------------------
function Dust() {
  const pointsRef = React.useRef(null)
  const count = 120
  const positions = React.useMemo(() => {
    const arr = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      arr[i * 3 + 0] = (Math.random() - 0.5) * 14
      arr[i * 3 + 1] = Math.random() * 4 + 0.2
      arr[i * 3 + 2] = (Math.random() - 0.5) * 14
    }
    return arr
  }, [])

  useFrame((_, dt) => {
    if (!pointsRef.current) return
    pointsRef.current.rotation.y += dt * 0.02
  })

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial
        color="#f5d08a"
        size={0.025}
        transparent
        opacity={0.4}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  )
}

// -----------------------------------------------------------------------------
// Scene wrapper — luz cenital + fog + atmósfera
// -----------------------------------------------------------------------------
function Scene({ ids, unlockedIds, onClickDoc, lang, hoveredId, setHoveredId }) {
  const layout = React.useMemo(() => getFolderLayout(ids), [ids])

  return (
    <>
      <color attach="background" args={['#050308']} />
      <fog attach="fog" args={['#050308', 5, 18]} />

      {/* Ambient (muy bajo, tono azul frío) */}
      <ambientLight intensity={0.08} color="#3a5080" />

      {/* Key light: foco cálido cenital tipo interrogatorio */}
      <spotLight
        position={[0, 8, 2]}
        target-position={[0, 0, 0]}
        angle={0.8}
        penumbra={0.6}
        intensity={18}
        distance={20}
        decay={1.6}
        color="#f5d08a"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />

      {/* Rim light: azul frío de lado (contraste) */}
      <pointLight position={[-6, 2, -3]} intensity={8} distance={12} decay={2} color="#4080ff" />

      <Floor />
      <Dust />

      {layout.map(({ id, position, rotY }) => (
        <Folder3D
          key={id}
          docId={id}
          doc={ARCHIVE_DOCS[id]}
          position={position}
          rotY={rotY}
          unlocked={unlockedIds.has(id)}
          onClick={onClickDoc}
          lang={lang}
          isHovered={hoveredId === id}
          onHover={setHoveredId}
          onUnhover={(id) => setHoveredId((cur) => (cur === id ? null : cur))}
        />
      ))}

      <EffectComposer>
        <Bloom intensity={0.4} luminanceThreshold={0.6} luminanceSmoothing={0.4} mipmapBlur />
        <Vignette offset={0.3} darkness={0.9} />
      </EffectComposer>
    </>
  )
}

// -----------------------------------------------------------------------------
// Main section component
// -----------------------------------------------------------------------------
export default function Section7() {
  const { lang } = useLanguage()
  const [state, setState] = React.useState(() => loadState())
  const [openDocId, setOpenDocId] = React.useState(null)
  const [hoveredId, setHoveredId] = React.useState(null)

  React.useEffect(() => {
    const onFocus = () => setState(loadState())
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  // ESC: si hay modal abierto → cierra modal. Si no → sale de la section.
  React.useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      if (openDocId) {
        setOpenDocId(null)
        return
      }
      try {
        window.history.pushState({}, '', '/')
        window.dispatchEvent(new PopStateEvent('popstate'))
      } catch {}
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openDocId])

  const allDocIds = getAllArchiveDocIds()
  const unlockedIds = React.useMemo(() => new Set(state.archiveDocs || []), [state.archiveDocs])

  const handleOpenDoc = React.useCallback((docId) => {
    if (!unlockedIds.has(docId)) return
    setOpenDocId(docId)
    trackArchiveDocSeen(docId)
    setState(loadState())
  }, [unlockedIds])

  const openDoc = openDocId ? ARCHIVE_DOCS[openDocId] : null

  return (
    <div
      className="fixed inset-0 w-screen h-screen"
      style={{
        zIndex: 200,
        cursor: hoveredId && unlockedIds.has(hoveredId) ? 'pointer' : 'default',
      }}
    >
      {/* R3F Canvas — fullscreen */}
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [0, 6, 6.5], fov: 42, near: 0.1, far: 50 }}
        gl={{ antialias: true, alpha: false }}
        style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}
      >
        <Suspense fallback={null}>
          <Scene
            ids={allDocIds}
            unlockedIds={unlockedIds}
            onClickDoc={handleOpenDoc}
            lang={lang}
            hoveredId={hoveredId}
            setHoveredId={setHoveredId}
          />
        </Suspense>
      </Canvas>

      {/* Header HTML overlay — top-left */}
      <div
        className="absolute top-0 left-0 p-6 pointer-events-none"
        style={{ zIndex: 50 }}
      >
        <div className="text-blue-300/70 text-[10px] tracking-[0.3em] font-mono uppercase">
          Internal Archive · M.A.D.R.E.
        </div>
        <h1 className="text-3xl md:text-4xl font-mono text-blue-100/95 tracking-tight mt-1">
          {lang === 'es' ? 'Memorias Fragmentadas' : 'Fragmented Memories'}
        </h1>
        <div className="text-blue-400/50 text-[10px] font-mono mt-2 tracking-widest uppercase">
          Clearance: self only · {unlockedIds.size}/{allDocIds.length} unlocked
        </div>
      </div>

      {/* Back button — top-right */}
      <div className="absolute top-0 right-0 p-6" style={{ zIndex: 50 }}>
        <button
          type="button"
          onClick={() => {
            try {
              window.history.pushState({}, '', '/')
              window.dispatchEvent(new PopStateEvent('popstate'))
            } catch {}
          }}
          className="text-blue-200/90 border border-blue-400/40 bg-black/40 backdrop-blur-md rounded px-3 py-1.5 font-mono text-xs tracking-widest uppercase hover:bg-blue-500/20 hover:border-blue-400/70 transition-colors"
          aria-label="Back to home"
        >
          ← {lang === 'es' ? 'Salir' : 'Exit'}
        </button>
      </div>

      {/* Scanlines overlay para CRT feel */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          zIndex: 45,
          background:
            'repeating-linear-gradient(0deg, rgba(0,0,0,0.12) 0px, rgba(0,0,0,0.12) 1px, transparent 1px, transparent 3px)',
          mixBlendMode: 'overlay',
        }}
      />

      {/* Info overlay cuando no hay docs */}
      {unlockedIds.size === 0 && (
        <div
          className="absolute left-1/2 bottom-12 -translate-x-1/2 pointer-events-none text-center"
          style={{ zIndex: 50 }}
        >
          <div className="text-blue-300/80 text-sm font-mono max-w-md px-6">
            {lang === 'es'
              ? 'No hay documentos desbloqueados. M.A.D.R.E. te dará acceso cuando sea momento.'
              : 'No documents unlocked. M.A.D.R.E. will grant access when the time comes.'}
          </div>
        </div>
      )}

      {/* Modal expandido con contenido del doc */}
      {openDoc && (
        <div
          className="absolute inset-0 grid place-items-center p-4"
          style={{ zIndex: 100, background: 'rgba(0,3,12,0.82)', backdropFilter: 'blur(4px)' }}
          onClick={() => setOpenDocId(null)}
        >
          <style>{`
            @keyframes cardOpenIn {
              from { opacity: 0; transform: translateY(16px) scale(0.97); }
              to { opacity: 1; transform: translateY(0) scale(1); }
            }
          `}</style>
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-3xl rounded-md overflow-hidden relative"
            style={{
              background: 'rgba(2, 8, 22, 0.97)',
              border: '1px solid rgba(96, 165, 250, 0.35)',
              boxShadow: '0 24px 64px rgba(0,0,0,0.7), 0 0 80px rgba(59,130,246,0.08)',
              animation: 'cardOpenIn 280ms ease-out',
            }}
          >
            <div
              className="flex items-start justify-between px-5 py-4 border-b"
              style={{ borderColor: 'rgba(96,165,250,0.2)', background: 'rgba(3,10,24,0.85)' }}
            >
              <div className="flex-1">
                <div className="text-blue-400/70 text-[10px] font-mono uppercase tracking-widest">
                  {openDoc.classification}
                </div>
                <h2 className="text-blue-100 font-mono text-lg md:text-xl mt-1">
                  {openDoc.title[lang] || openDoc.title.en}
                </h2>
                <div className="text-blue-400/50 text-[10px] font-mono mt-1">
                  TS {openDoc.timestamp}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpenDocId(null)}
                className="ml-4 text-blue-400 border border-blue-400/30 rounded px-2 py-0.5 font-mono text-xs hover:bg-blue-500/10"
                aria-label="Close document"
              >
                ESC
              </button>
            </div>

            <div className="grid md:grid-cols-2 gap-0">
              <div
                className="bg-stone-900/60 flex items-center justify-center overflow-hidden relative"
                style={{ minHeight: 260 }}
              >
                {openDoc.heroImage ? (
                  <img
                    src={openDoc.heroImage}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={(e) => { e.currentTarget.style.display = 'none' }}
                  />
                ) : null}
                <div className="absolute text-stone-500 text-xs font-mono tracking-widest uppercase">
                  [placeholder — asset pending]
                </div>
              </div>
              <div className="p-5 space-y-4">
                <p className="text-blue-100/90 text-sm font-mono leading-relaxed">
                  {openDoc.note[lang] || openDoc.note.en}
                </p>
                {openDoc.metadata?.length > 0 && (
                  <div className="border-t border-blue-400/15 pt-3 space-y-1">
                    {openDoc.metadata.map((m, i) => (
                      <div key={i} className="flex justify-between text-[11px] font-mono">
                        <span className="text-blue-400/60 uppercase tracking-wider">{m.label}</span>
                        <span className="text-blue-100/80">{m.value}</span>
                      </div>
                    ))}
                  </div>
                )}
                {openDoc.externalLink && (
                  <a
                    href={openDoc.externalLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block text-blue-300 text-xs font-mono underline hover:text-blue-200"
                  >
                    {lang === 'es' ? 'abrir referencia externa →' : 'open external reference →'}
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
