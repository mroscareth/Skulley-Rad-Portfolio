import React, { useEffect, useRef, useState } from 'react'
import { useLanguage } from '../i18n/LanguageContext.jsx'

export default function GpuStats({ gl, sampleMs = 1000 }) {
  const { t } = useLanguage()
  const [stats, setStats] = useState({
    fps: 0,
    avgMs: 0,
    maxMs: 0,
    spikes50: 0,
    calls: 0,
    triangles: 0,
    lines: 0,
    points: 0,
    geometries: 0,
    textures: 0,
  })
  const lastTRef = useRef(performance.now())
  const lastFrameTsRef = useRef(performance.now())
  const frameCountRef = useRef(0)
  const frameMsSumRef = useRef(0)
  const frameMsMaxRef = useRef(0)
  const frameMsCountRef = useRef(0)
  const spikes50Ref = useRef(0)
  const rafRef = useRef(0)

  useEffect(() => {
    const loop = () => {
      const now = performance.now()
      const dt = now - lastFrameTsRef.current
      lastFrameTsRef.current = now
      // dt <= 0 puede ocurrir en rarezas de clock; lo ignoramos
      if (dt > 0 && Number.isFinite(dt)) {
        frameMsSumRef.current += dt
        frameMsCountRef.current += 1
        if (dt > frameMsMaxRef.current) frameMsMaxRef.current = dt
        if (dt >= 50) spikes50Ref.current += 1
      }
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
      const avgMs = frameMsCountRef.current > 0 ? (frameMsSumRef.current / frameMsCountRef.current) : 0
      const maxMs = frameMsMaxRef.current || 0
      const spikes50 = spikes50Ref.current || 0
      frameMsSumRef.current = 0
      frameMsCountRef.current = 0
      frameMsMaxRef.current = 0
      spikes50Ref.current = 0
      try {
        const info = gl?.info
        setStats({
          fps,
          avgMs: Math.round(avgMs * 10) / 10,
          maxMs: Math.round(maxMs * 10) / 10,
          spikes50,
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
        <div>{t('gpu.fps')}: {stats.fps}</div>
        <div>Frame ms: {stats.avgMs} avg · {stats.maxMs} max · spikes≥50ms: {stats.spikes50}</div>
        <div>{t('gpu.draws')}: {stats.calls}</div>
        <div>{t('gpu.tris')}: {stats.triangles}</div>
        <div>{t('gpu.geom')}: {stats.geometries} · {t('gpu.tex')}: {stats.textures}</div>
        {(() => {
          try {
            // @ts-ignore
            const p = (typeof window !== 'undefined') ? window.__playerDebug : null
            if (!p) return null
            return (
              <>
                <div>Player: steps={p.steps} acc={Math.round((p.acc || 0) * 1000)}ms dt={Math.round((p.dtRaw || 0) * 1000)}ms</div>
                <div>Player: dtUsed={Math.round((p.dtUsed || 0) * 1000)}ms</div>
                <div>Player: alpha={Math.round((p.alpha || 0) * 100) / 100}</div>
                <div>Player: input={String(!!p.hasInput)} walkW={Math.round((p.walkW || 0) * 100) / 100}</div>
              </>
            )
          } catch { return null }
        })()}
      </div>
    </div>
  )
}


