import React, { useEffect, useRef, useState } from 'react'

export default function GpuStats({ gl, sampleMs = 1000 }) {
  const [stats, setStats] = useState({ fps: 0, calls: 0, triangles: 0, lines: 0, points: 0, geometries: 0, textures: 0 })
  const lastTRef = useRef(performance.now())
  const frameCountRef = useRef(0)
  const rafRef = useRef(0)

  useEffect(() => {
    const loop = () => {
      frameCountRef.current += 1
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  useEffect(() => {
    let timer = null
    const tick = () => {
      const now = performance.now()
      const dtMs = now - lastTRef.current
      lastTRef.current = now
      const fps = dtMs > 0 ? Math.round((frameCountRef.current * 1000) / dtMs) : 0
      frameCountRef.current = 0
      try {
        const info = gl?.info
        setStats({
          fps,
          calls: info?.render?.calls || 0,
          triangles: info?.render?.triangles || 0,
          lines: info?.render?.lines || 0,
          points: info?.render?.points || 0,
          geometries: info?.memory?.geometries || 0,
          textures: info?.memory?.textures || 0,
        })
      } catch {
        // noop
      }
      timer = setTimeout(tick, sampleMs)
    }
    timer = setTimeout(tick, sampleMs)
    return () => { if (timer) clearTimeout(timer) }
  }, [gl, sampleMs])

  return (
    <div style={{ position: 'fixed', top: 8, left: 8, zIndex: 20000, pointerEvents: 'auto' }}>
      <div style={{ background: 'rgba(0,0,0,0.6)', color: 'white', padding: '6px 8px', borderRadius: 6, fontSize: 11, lineHeight: 1.25, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' }}>
        <div>FPS: {stats.fps}</div>
        <div>Draws: {stats.calls}</div>
        <div>Tris: {stats.triangles}</div>
        <div>Geom: {stats.geometries} · Tex: {stats.textures}</div>
      </div>
    </div>
  )
}


