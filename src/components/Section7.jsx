import React from 'react'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import {
  loadState,
  saveState,
  getAllArchiveDocIds,
  trackArchiveDocSeen,
  getCurrentQuest,
} from '../lib/questEngine.js'
import { ARCHIVE_DOCS } from '../lib/questData.js'
import { playSfx } from '../lib/sfx.js'

// Section7 — Fragmented Memories (fullscreen, HTML/CSS).
//
// Escena: "desk noir". Backdrop oscuro con spotlight cenital cálido (radial
// gradient), grano de película, vignette. Folders de manila tirados tipo
// expediente forense, con rotación y posición deterministas por id. Click →
// modal con el contenido.
//
// Se rehace todo desde cero (sin R3F): el prototipo 3D se sentía "escena de
// teatro", esto es más "mesa de trabajo real".

// -----------------------------------------------------------------------------
// Seeded helpers para layout determinista
// -----------------------------------------------------------------------------
function seeded(seed, min, max) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0
  const n = Math.abs(h % 1000) / 1000
  return min + n * (max - min)
}

// Layout scattered de N folders. Posiciones en % del viewport — responsive-safe.
// Distribuye en grid con jitter para que se sientan "tirados", no ordenados.
function getLayout(ids) {
  const cols = Math.max(2, Math.min(4, Math.ceil(Math.sqrt(ids.length))))
  const rows = Math.ceil(ids.length / cols)
  return ids.map((id, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    // Base grid cell (range ~15-85% evitando edges)
    const baseX = 18 + (col + 0.5) * (64 / cols)
    const baseY = 22 + (row + 0.5) * (60 / rows)
    // Jitter seeded por id — siempre mismo resultado, pero scattered
    const jitterX = seeded(id + 'x', -7, 7)
    const jitterY = seeded(id + 'y', -6, 6)
    const rot = seeded(id + 'r', -9, 9)
    const z = Math.floor(seeded(id + 'z', 1, 100))
    return {
      id,
      left: `${baseX + jitterX}%`,
      top: `${baseY + jitterY}%`,
      rotate: rot,
      zIndex: z,
    }
  })
}

// -----------------------------------------------------------------------------
// Folder card (CSS-only, paper feel)
// -----------------------------------------------------------------------------
function FolderCard({ doc, docId, layout, unlocked, highlighted, onClick, lang }) {
  const tagLabel = docId.toUpperCase().replace('DOC_', '')
  const title = unlocked
    ? (doc.title[lang] || doc.title.en)
    : (lang === 'es' ? '— clasificado —' : '— classified —')
  const stamp = unlocked
    ? (doc.classification?.split(' — ')[0] || 'INTERNAL')
    : 'LOCKED'
  const ts = unlocked ? doc.timestamp : '████-██-██ ██:██:██'

  const handleClick = () => {
    if (!unlocked) return
    try { playSfx('click', { volume: 0.9 }) } catch {}
    onClick(docId)
  }
  const handleHover = () => {
    if (!unlocked) return
    try { playSfx('hover', { volume: 0.35 }) } catch {}
  }

  return (
    <button
      type="button"
      disabled={!unlocked}
      onClick={handleClick}
      onMouseEnter={handleHover}
      className={`folder-card group ${unlocked ? 'folder-unlocked' : 'folder-locked'} ${highlighted ? 'folder-highlighted' : ''}`}
      style={{
        left: layout.left,
        top: layout.top,
        transform: `translate(-50%, -50%) rotate(${layout.rotate}deg)`,
        zIndex: layout.zIndex,
      }}
      aria-label={unlocked ? (doc.title[lang] || doc.title.en) : 'Classified'}
    >
      <div className="folder-paper">
        {/* Tag amarillo esquina superior */}
        <div className="folder-tag">{tagLabel}</div>

        {/* Sello rojo esquina opuesta */}
        <div className="folder-stamp">{stamp}</div>

        {/* Título */}
        <div className="folder-title">{title}</div>

        {/* Timestamp */}
        <div className="folder-ts">TS {ts}</div>

        {/* Striping diagonal para locked */}
        {!unlocked && <div className="folder-locked-stripes" aria-hidden />}

        {/* Paper grain noise */}
        <div className="folder-grain" aria-hidden />
      </div>
      {highlighted && (
        <div className="folder-target-badge" aria-hidden>
          {lang === 'es' ? 'OBJETIVO' : 'TARGET'}
        </div>
      )}
    </button>
  )
}

// -----------------------------------------------------------------------------
// Main section
// -----------------------------------------------------------------------------
export default function Section7() {
  const { lang } = useLanguage()
  const [state, setState] = React.useState(() => loadState())
  const [openDocId, setOpenDocId] = React.useState(null)

  React.useEffect(() => {
    const onFocus = () => setState(loadState())
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  // Self-heal: si la quest activa tiene archiveUnlock pero el doc no está
  // en archiveDocs (state corrupto por bug previo de race), lo restauramos.
  React.useEffect(() => {
    const fresh = loadState()
    const q = getCurrentQuest(fresh)
    if (!q?.archiveUnlock) return
    if ((fresh.archiveDocs || []).includes(q.archiveUnlock)) return
    const repaired = { ...fresh, archiveDocs: [...(fresh.archiveDocs || []), q.archiveUnlock] }
    saveState(repaired)
    setState(repaired)
  }, [])

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
  const layout = React.useMemo(() => getLayout(allDocIds), [allDocIds])

  // Doc que la quest activa está pidiendo. Si todavía no se vio (docSeen falsy)
  // → glow pulsante para que el user no se pierda en el ambiente noir.
  const targetDocId = React.useMemo(() => {
    const q = getCurrentQuest(state)
    if (!q) return null
    if (q.completion?.type !== 'archive_and_answer') return null
    const docId = q.completion.docId
    if (!docId) return null
    const seen = state.questProgress?.[q.id]?.docSeen
    if (seen) return null
    return docId
  }, [state])

  const handleOpenDoc = React.useCallback((docId) => {
    // El botón ya está disabled cuando !unlocked — confiamos en eso y abrimos.
    setOpenDocId(docId)
    try { trackArchiveDocSeen(docId) } catch {}
    setState(loadState())
  }, [])

  const openDoc = openDocId ? ARCHIVE_DOCS[openDocId] : null

  return (
    <div className="fixed inset-0 w-screen h-screen overflow-hidden" style={{ zIndex: 200 }}>
      <style>{`
        /* ────────── BACKDROP ────────── */
        .archive-backdrop {
          position: absolute; inset: 0;
          background:
            radial-gradient(ellipse 70% 55% at 50% 20%, rgba(255, 204, 128, 0.09) 0%, rgba(255, 204, 128, 0) 60%),
            radial-gradient(ellipse 90% 120% at 50% 100%, rgba(20, 10, 30, 0.75) 0%, rgba(5, 3, 10, 0) 65%),
            linear-gradient(180deg, #0a0810 0%, #070510 60%, #050309 100%);
        }
        /* Film grain overlay (SVG noise via data URI) */
        .archive-grain {
          position: absolute; inset: 0; pointer-events: none;
          background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' seed='5'/><feColorMatrix values='0 0 0 0 0.78  0 0 0 0 0.62  0 0 0 0 0.38  0 0 0 0.42 0'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.65'/></svg>");
          opacity: 0.14;
          mix-blend-mode: overlay;
          z-index: 3;
        }
        .archive-scanlines {
          position: absolute; inset: 0; pointer-events: none;
          background: repeating-linear-gradient(0deg,
            rgba(0,0,0,0.08) 0px, rgba(0,0,0,0.08) 1px,
            transparent 1px, transparent 3px);
          mix-blend-mode: overlay;
          z-index: 4;
        }
        .archive-vignette {
          position: absolute; inset: 0; pointer-events: none;
          background: radial-gradient(ellipse 80% 75% at 50% 50%,
            rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 85%, rgba(0,0,0,0.85) 100%);
          z-index: 5;
        }
        /* Dust particles CSS-only */
        .archive-dust { position: absolute; inset: 0; pointer-events: none; z-index: 6; overflow: hidden; }
        .archive-dust span {
          position: absolute;
          width: 2px; height: 2px;
          background: rgba(245, 208, 138, 0.5);
          border-radius: 50%;
          box-shadow: 0 0 3px rgba(245, 208, 138, 0.4);
          animation: dustFloat linear infinite;
        }
        @keyframes dustFloat {
          0% { transform: translateY(0) translateX(0); opacity: 0; }
          10% { opacity: 0.8; }
          90% { opacity: 0.5; }
          100% { transform: translateY(-120vh) translateX(30px); opacity: 0; }
        }

        /* ────────── FOLDERS ────────── */
        .folder-card {
          position: absolute;
          width: clamp(200px, 22vw, 280px);
          aspect-ratio: 1.45 / 1;
          padding: 0;
          background: transparent;
          border: none;
          cursor: pointer;
          transition: transform 280ms cubic-bezier(0.2, 0.7, 0.3, 1);
          filter: drop-shadow(0 12px 18px rgba(0,0,0,0.55));
          z-index: 10;
        }
        .folder-card:disabled { cursor: default; }
        .folder-unlocked:hover {
          transform: translate(-50%, calc(-50% - 14px)) rotate(0deg) scale(1.04) !important;
          z-index: 999 !important;
          filter: drop-shadow(0 24px 34px rgba(0,0,0,0.7)) drop-shadow(0 0 18px rgba(255,204,128,0.22));
        }
        .folder-unlocked:focus-visible {
          outline: none;
          transform: translate(-50%, calc(-50% - 8px)) rotate(0deg) !important;
          filter: drop-shadow(0 18px 24px rgba(0,0,0,0.6)) drop-shadow(0 0 14px rgba(96,165,250,0.35));
        }

        /* Quest target — M.A.D.R.E. te apunta al doc relevante */
        @keyframes folderTargetPulse {
          0%, 100% {
            filter:
              drop-shadow(0 12px 18px rgba(0,0,0,0.55))
              drop-shadow(0 0 14px rgba(96,165,250,0.45))
              drop-shadow(0 0 28px rgba(59,130,246,0.35));
          }
          50% {
            filter:
              drop-shadow(0 12px 18px rgba(0,0,0,0.55))
              drop-shadow(0 0 22px rgba(96,165,250,0.75))
              drop-shadow(0 0 50px rgba(59,130,246,0.55));
          }
        }
        .folder-highlighted {
          animation: folderTargetPulse 2.2s ease-in-out infinite;
          z-index: 500 !important;
        }
        .folder-highlighted .folder-paper {
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.3),
            inset 0 -2px 4px rgba(90,60,20,0.25),
            inset 0 0 0 1.5px rgba(96,165,250,0.6),
            0 1px 0 rgba(0,0,0,0.3);
        }
        .folder-target-badge {
          position: absolute;
          top: -10px; right: -8px;
          background: rgba(59,130,246,0.95);
          color: #f0f9ff;
          font-family: 'Cascadia Code', 'Fira Code', monospace;
          font-size: 0.6rem;
          font-weight: 700;
          letter-spacing: 0.18em;
          padding: 3px 8px;
          border-radius: 2px;
          border: 1px solid rgba(147, 197, 253, 0.7);
          box-shadow: 0 0 12px rgba(59,130,246,0.6);
          transform: rotate(8deg);
          pointer-events: none;
          z-index: 2;
        }

        .folder-paper {
          position: relative;
          width: 100%; height: 100%;
          background: linear-gradient(135deg, #d8bc8a 0%, #c9ab77 55%, #bd9d6a 100%);
          border-radius: 3px;
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.25),
            inset 0 -2px 4px rgba(90,60,20,0.25),
            inset 0 0 12px rgba(90,60,20,0.12),
            0 1px 0 rgba(0,0,0,0.3);
          overflow: hidden;
          padding: 14px 16px 12px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          font-family: 'Courier New', 'Cascadia Code', monospace;
        }
        .folder-locked .folder-paper {
          background: linear-gradient(135deg, #3a2f22 0%, #2e251b 55%, #23190f 100%);
        }
        /* Tag amarillo */
        .folder-tag {
          position: absolute;
          top: 10px; left: 12px;
          background: #f5d04a;
          color: #2a2010;
          padding: 3px 8px;
          font-size: 0.58rem;
          font-weight: 900;
          letter-spacing: 0.12em;
          border-radius: 2px;
          box-shadow: 0 1px 2px rgba(0,0,0,0.3);
          text-transform: uppercase;
        }
        .folder-locked .folder-tag {
          background: #8a7030;
          color: #1a1408;
        }
        /* Sello rojo */
        .folder-stamp {
          position: absolute;
          top: 14px; right: 10px;
          color: #982020;
          font-size: 0.72rem;
          font-weight: 900;
          letter-spacing: 0.18em;
          transform: rotate(-8deg);
          text-shadow: 0 0 1px rgba(152,32,32,0.5);
          font-family: 'Impact', 'Arial Black', sans-serif;
          opacity: 0.85;
          border: 2px solid currentColor;
          padding: 2px 6px 1px;
          border-radius: 1px;
        }
        .folder-locked .folder-stamp {
          color: #5a1010;
          border-color: #5a1010;
        }
        /* Título */
        .folder-title {
          margin-top: 34px;
          font-size: 0.88rem;
          font-weight: 600;
          color: #2a2010;
          line-height: 1.25;
          padding: 0 2px;
          flex: 1;
          display: flex;
          align-items: center;
          text-align: left;
        }
        .folder-locked .folder-title {
          color: #6a5540;
          font-style: italic;
        }
        /* Timestamp */
        .folder-ts {
          font-size: 0.62rem;
          color: rgba(42,32,16,0.55);
          letter-spacing: 0.08em;
          border-top: 1px dashed rgba(42,32,16,0.2);
          padding-top: 6px;
        }
        .folder-locked .folder-ts {
          color: rgba(140,110,80,0.5);
          border-top-color: rgba(140,110,80,0.18);
        }
        /* Locked striping */
        .folder-locked-stripes {
          position: absolute; inset: 0;
          background: repeating-linear-gradient(45deg,
            transparent 0px, transparent 14px,
            rgba(0,0,0,0.18) 14px, rgba(0,0,0,0.18) 22px);
          pointer-events: none;
          mix-blend-mode: multiply;
        }
        /* Paper grain */
        .folder-grain {
          position: absolute; inset: 0;
          background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='p'><feTurbulence type='fractalNoise' baseFrequency='1.1' numOctaves='2' seed='3'/><feColorMatrix values='0 0 0 0 0.2  0 0 0 0 0.15  0 0 0 0 0.08  0 0 0 0.55 0'/></filter><rect width='100%' height='100%' filter='url(%23p)'/></svg>");
          opacity: 0.22;
          mix-blend-mode: multiply;
          pointer-events: none;
        }

        /* ────────── EXIT ────────── */
        .archive-exit {
          position: absolute; top: 0; right: 0;
          padding: 24px 28px;
          z-index: 50;
        }
        .archive-empty-hint {
          position: absolute;
          left: 50%; bottom: 56px;
          transform: translateX(-50%);
          text-align: center;
          color: rgba(147, 197, 253, 0.7);
          font-family: 'Cascadia Code', 'Fira Code', monospace;
          font-size: 0.85rem;
          max-width: 420px;
          padding: 0 20px;
          z-index: 50;
          pointer-events: none;
        }

        /* ────────── MOBILE ────────── */
        @media (max-width: 720px) {
          .folder-card {
            width: clamp(180px, 72vw, 300px);
          }
        }

        /* ────────── MODAL (feel expediente abriéndose) ────────── */
        @keyframes archiveBackdropIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes archiveModalIn {
          0% {
            opacity: 0;
            transform: translateY(24px) scale(0.88) rotateX(8deg);
            filter: blur(6px);
          }
          55% {
            opacity: 1;
            filter: blur(0);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1) rotateX(0deg);
            filter: blur(0);
          }
        }
        .archive-modal-backdrop {
          animation: archiveBackdropIn 240ms ease-out;
          perspective: 1200px;
        }
        .archive-modal-card {
          animation: archiveModalIn 420ms cubic-bezier(0.2, 0.7, 0.25, 1);
          transform-origin: center top;
        }
        .folder-card:active .folder-paper {
          transform: scale(0.98);
          transition: transform 80ms ease-out;
        }
      `}</style>

      {/* Backdrop layers */}
      <div className="archive-backdrop" />
      <div className="archive-dust">
        {/* 18 dust particles with varied timing */}
        {Array.from({ length: 18 }).map((_, i) => {
          const left = (i * 53) % 100
          const duration = 18 + (i % 7) * 3
          const delay = (i * 1.3) % 12
          const size = 1 + (i % 3)
          return (
            <span
              key={i}
              style={{
                left: `${left}%`,
                bottom: `-${10 + (i % 5) * 6}%`,
                width: `${size}px`,
                height: `${size}px`,
                animationDuration: `${duration}s`,
                animationDelay: `${delay}s`,
              }}
            />
          )
        })}
      </div>

      {/* Exit */}
      <div className="archive-exit">
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

      {/* Folders scattered */}
      {layout.map((l) => (
        <FolderCard
          key={l.id}
          docId={l.id}
          doc={ARCHIVE_DOCS[l.id]}
          layout={l}
          unlocked={unlockedIds.has(l.id)}
          highlighted={l.id === targetDocId}
          onClick={handleOpenDoc}
          lang={lang}
        />
      ))}

      {/* Empty hint */}
      {unlockedIds.size === 0 && (
        <div className="archive-empty-hint">
          {lang === 'es'
            ? 'No hay documentos desbloqueados. M.A.D.R.E. te dará acceso cuando sea momento.'
            : 'No documents unlocked. M.A.D.R.E. will grant access when the time comes.'}
        </div>
      )}

      {/* Atmosphere layers (front of folders) */}
      <div className="archive-scanlines" />
      <div className="archive-vignette" />
      <div className="archive-grain" />

      {/* Modal */}
      {openDoc && (
        <div
          className="archive-modal-backdrop absolute inset-0 grid place-items-center p-4"
          style={{ zIndex: 100, background: 'rgba(0,3,12,0.82)', backdropFilter: 'blur(4px)' }}
          onClick={() => setOpenDocId(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="archive-modal-card w-full max-w-3xl rounded-md overflow-hidden relative"
            style={{
              background: 'rgba(2, 8, 22, 0.97)',
              border: '1px solid rgba(96, 165, 250, 0.35)',
              boxShadow: '0 24px 64px rgba(0,0,0,0.7), 0 0 80px rgba(59,130,246,0.08)',
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
