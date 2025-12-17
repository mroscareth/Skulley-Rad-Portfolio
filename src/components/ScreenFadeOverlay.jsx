import React from 'react'

export default function ScreenFadeOverlay({
  visible = false,
  opacity = 0,
  mode = 'black', // 'black' | 'noise'
  durationMs = 300,
}) {
  const noiseDataUrl = React.useMemo(() => {
    if (mode !== 'noise') return null
    try {
      const size = 128
      const c = document.createElement('canvas')
      c.width = size
      c.height = size
      const ctx = c.getContext('2d', { willReadFrequently: true })
      const img = ctx.createImageData(size, size)
      for (let i = 0; i < img.data.length; i += 4) {
        const v = (Math.random() * 255) | 0
        img.data[i] = v
        img.data[i + 1] = v
        img.data[i + 2] = v
        img.data[i + 3] = 255
      }
      ctx.putImageData(img, 0, 0)
      return c.toDataURL('image/png')
    } catch {
      return null
    }
  }, [mode])
  if (!visible && opacity <= 0.001) return null
  return (
    <div
      className="fixed inset-0 z-[80000] pointer-events-none"
      aria-hidden
      style={{
        opacity,
        transition: `opacity ${Math.max(0, durationMs)}ms ease`,
        background: mode === 'black' ? '#000' : undefined,
        backgroundImage: mode === 'noise' && noiseDataUrl ? `url(${noiseDataUrl})` : undefined,
        backgroundSize: mode === 'noise' ? 'auto' : undefined,
        backgroundRepeat: mode === 'noise' ? 'repeat' : undefined,
        imageRendering: mode === 'noise' ? 'pixelated' : undefined,
        mixBlendMode: mode === 'noise' ? 'normal' : undefined,
      }}
    />
  )
}






