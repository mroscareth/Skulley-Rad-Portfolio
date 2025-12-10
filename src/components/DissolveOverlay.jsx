import React from 'react'

export default function DissolveOverlay({ imgSrc, progress = 0, center = [0.5, 0.5], active = false }) {
  if (!active || !imgSrc) return null
  const r = Math.max(0, Math.min(100, progress * 140))
  const feather = 8 // px equivalentes aproximados vía % (simple)
  const cx = Math.max(0, Math.min(100, (center[0] || 0.5) * 100))
  const cy = Math.max(0, Math.min(100, (center[1] || 0.5) * 100))
  // Máscara: agujero central que crece (revela la nueva escena bajo el overlay)
  const mask = `radial-gradient(circle at ${cx}% ${cy}%, transparent ${Math.max(0, r - feather)}%, black ${r}%)`
  return (
    <div className="fixed inset-0 z-[19500] pointer-events-none" aria-hidden>
      <img
        src={imgSrc}
        alt=""
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          WebkitMaskImage: mask,
          maskImage: mask,
          transition: 'mask-image 40ms linear, -webkit-mask-image 40ms linear',
          // Un leve atenuado global para que no se note el corte exterior
          opacity: 0.96,
        }}
      />
    </div>
  )
}


