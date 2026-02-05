import React from 'react'

export default function DissolveOverlay({ imgSrc, progress = 0, center = [0.5, 0.5], active = false }) {
  if (!active || !imgSrc) return null
  const r = Math.max(0, Math.min(100, progress * 140))
  const feather = 8 // approximate px equivalent via % (simple)
  const cx = Math.max(0, Math.min(100, (center[0] || 0.5) * 100))
  const cy = Math.max(0, Math.min(100, (center[1] || 0.5) * 100))
  // Mask: growing center hole (reveals new scene beneath overlay)
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
          // Slight global fade so the outer edge cut isn't visible
          opacity: 0.96,
        }}
      />
    </div>
  )
}






