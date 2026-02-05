import React from 'react'

export default function PsychoOverlay({ active = false }) {
  // DOM overlay independent of compositor. Uses backdrop-filter (to boost luminance)
  // and layers with gradients/mix-blend for an acid look visible on dark backgrounds.
  return (
    <div
      aria-hidden
      className="fixed inset-0 z-[18000] pointer-events-none"
      style={{
        opacity: active ? 1 : 0,
        transition: 'opacity 220ms ease',
        mixBlendMode: 'screen',
      }}
    >
      {/* Local styles for animations */}
      <style>{`
        @keyframes psychoHue {
          0% { filter: hue-rotate(0deg); }
          50% { filter: hue-rotate(120deg); }
          100% { filter: hue-rotate(360deg); }
        }
        @keyframes blobMoveA {
          0% { transform: translate(-10%, -8%) scale(1) rotate(0deg); }
          50% { transform: translate(12%, 8%) scale(1.2) rotate(180deg); }
          100% { transform: translate(-10%, -8%) scale(1) rotate(360deg); }
        }
        @keyframes blobMoveB {
          0% { transform: translate(18%, 12%) scale(1.1) rotate(0deg); }
          50% { transform: translate(-8%, -6%) scale(0.9) rotate(-180deg); }
          100% { transform: translate(18%, 12%) scale(1.1) rotate(-360deg); }
        }
      `}</style>
      {/* Global adjustment layer: boost brightness/contrast/saturation of background */}
      <div
        className="absolute inset-0"
        style={{
          backdropFilter: 'saturate(1.6) contrast(1.25) brightness(1.18)',
          WebkitBackdropFilter: 'saturate(1.6) contrast(1.25) brightness(1.18)',
          animation: 'psychoHue 1.6s ease-in-out infinite',
        }}
      />
      {/* Blob layer 1 (radial + gradient), screen blend */}
      <div
        className="absolute -inset-[12%] opacity-55"
        style={{
          background:
            'radial-gradient(35% 35% at 35% 35%, rgba(255,0,200,0.28) 0%, rgba(255,0,200,0.0) 60%), radial-gradient(30% 30% at 70% 60%, rgba(0,200,255,0.24) 0%, rgba(0,200,255,0.0) 60%)',
          animation: 'blobMoveA 2.2s ease-in-out infinite',
          mixBlendMode: 'screen',
        }}
      />
      {/* Blob layer 2 */}
      <div
        className="absolute -inset-[14%] opacity-45"
        style={{
          background:
            'radial-gradient(40% 40% at 60% 30%, rgba(255,255,0,0.22) 0%, rgba(255,255,0,0.0) 60%), radial-gradient(28% 28% at 30% 70%, rgba(0,255,140,0.20) 0%, rgba(0,255,140,0.0) 60%)',
          animation: 'blobMoveB 2.6s ease-in-out infinite',
          mixBlendMode: 'screen',
        }}
      />
      {/* Subtle dot pattern to reinforce the psychedelic effect */}
      <div
        className="absolute inset-0 opacity-18"
        style={{
          backgroundImage:
            'radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)',
          backgroundSize: '16px 16px, 12px 12px',
          backgroundPosition: '0 0, 8px 8px',
          mixBlendMode: 'screen',
        }}
      />
    </div>
  )
}






