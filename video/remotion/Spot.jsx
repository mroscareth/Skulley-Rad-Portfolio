import React from 'react'
import { AbsoluteFill, Sequence, Audio, staticFile, useCurrentFrame, useVideoConfig, interpolate } from 'remotion'
import { Clip } from './Clip.jsx'
import { GlitchTitle } from './GlitchTitle.jsx'
import { Subtitulo } from './Subtitulo.jsx'
import { Destello, Barras, CorteGlitch, Velo } from './Efectos.jsx'
import { EDL, FPS, DURACION, golpes } from './edl.js'

const F = (s) => Math.round(s * FPS)

// Rebote al compás: en los tramos con bombo, la imagen da un empujón chico en
// cada golpe (como un juego que vibra con la música).
function Rebote({ children, tramos }) {
  const frame = useCurrentFrame()
  const t = frame / FPS
  let s = 1
  for (const [a, b, fuerza] of tramos) {
    if (t < a || t >= b) continue
    let ultimo = null
    for (const gg of golpes(a, b)) { if (gg <= t + 1e-6) ultimo = gg; else break }
    if (ultimo != null) s += fuerza * Math.exp(-(t - ultimo) * 12)
  }
  return <AbsoluteFill style={{ transform: `scale(${s})` }}>{children}</AbsoluteFill>
}

// Una toma del teléfono: en horizontal va dentro de un teléfono sobre el azul
// del sitio; en vertical llena la pantalla (ya es 1080 × 1920).
function Telefono({ c, dur }) {
  const { width, height } = useVideoConfig()
  if (height > width) return <Clip {...c} fuente={[1080, 1920]} durationInFrames={dur} />
  const h = height * 0.88
  const w = (h * 9) / 16
  const marco = Math.round(h * 0.018)
  return (
    <AbsoluteFill style={{ background: '#022dd6', backgroundImage: 'radial-gradient(rgba(0,0,0,0.28) 1.6px, transparent 1.8px)', backgroundSize: '14px 14px', justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ width: w + marco * 2, height: h + marco * 2, borderRadius: h * 0.07, background: '#0b0b0b', padding: marco, boxShadow: `${h * 0.02}px ${h * 0.02}px 0 #000`, transform: 'rotate(-2deg)' }}>
        <div style={{ width: w, height: h, borderRadius: h * 0.06, overflow: 'hidden', position: 'relative' }}>
          <Clip {...c} fuente={[1080, 1920]} durationInFrames={dur} encaja={[w, h]} />
        </div>
      </div>
    </AbsoluteFill>
  )
}

// Una toma con interfaz en la versión vertical: completa, sin recortar, en un
// monitor sobre el azul del sitio (en horizontal llena la pantalla tal cual).
function Monitor({ c, dur, i }) {
  const { width } = useVideoConfig()
  const w = width * 0.94
  const h = (w * 9) / 16
  const marco = Math.round(w * 0.012)
  return (
    <AbsoluteFill style={{ background: '#022dd6', backgroundImage: 'radial-gradient(rgba(0,0,0,0.28) 1.6px, transparent 1.8px)', backgroundSize: '14px 14px', justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ width: w + marco * 2, height: h + marco * 2, borderRadius: w * 0.02, background: '#0b0b0b', padding: marco, boxShadow: `${w * 0.018}px ${w * 0.018}px 0 #000`, transform: `rotate(${i % 2 ? 1.2 : -1.2}deg)` }}>
        <div style={{ width: w, height: h, borderRadius: w * 0.012, overflow: 'hidden', position: 'relative' }}>
          <Clip {...c} zoom={c.zoomMonitor ?? 1} zoomV={null} focoV={null} durationInFrames={dur} encaja={[w, h]} />
        </div>
      </div>
    </AbsoluteFill>
  )
}

// Versión corta: todo lo que pasa antes de `corte` y luego el cierre de 4 s.
const FINAL_CORTO = 4
function armar(corte) {
  if (!corte) return EDL
  const antes = (t) => t < corte - 0.01
  const clips = EDL.clips.filter((c) => antes(c.en)).map((c) => (c.en + c.dur > corte ? { ...c, dur: corte - c.en } : c))
  clips.push({ src: 'intro', desde: 5.0, en: corte, dur: FINAL_CORTO, zoom: 2.2, focoY: 0.64, filtro: 'brightness(0.5) saturate(1.1)' })
  const cierre = EDL.titulos.find((t) => t.final)
  return {
    ...EDL,
    clips,
    titulos: [...EDL.titulos.filter((t) => !t.final && antes(t.en)).map((t) => (t.en + t.dur > corte ? { ...t, dur: corte - t.en } : t)), { ...cierre, en: corte + 0.04, dur: FINAL_CORTO - 0.1 }],
    subs: EDL.subs.filter((s) => antes(s.en)),
    destellos: [...EDL.destellos.filter(([t]) => antes(t)), [corte, '#022dd6', 10, 1]],
    cortes: [...EDL.cortes.filter(antes), corte],
    barras: EDL.barras.filter(([a]) => antes(a)).map(([a, b]) => [a, Math.min(b, corte)]),
    negros: [...EDL.negros.filter(([a]) => antes(a)), [corte + FINAL_CORTO - 0.5, corte + FINAL_CORTO, 0.45, 0]],
    rebote: EDL.rebote.filter(([a]) => antes(a)).map(([a, b, f]) => [a, Math.min(b, corte), f]),
  }
}
export const duracionCorte = (corte) => F(corte + FINAL_CORTO)

export function Spot({ vertical = false, corte = 0 }) {
  const EDL = armar(corte)
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <Rebote tramos={EDL.rebote}>
        {EDL.clips.map((c0, i) => {
          const c = vertical && c0.v ? { ...c0, ...c0.v } : c0
          const d = F(c.dur)
          return (
            <Sequence key={'c' + i} from={F(c.en)} durationInFrames={d} premountFor={20}>
              {c.telefono ? <Telefono c={c} dur={d} /> : (vertical && c.monitor) ? <Monitor c={{ ...c, vel: c.vel ?? 1 }} dur={d} i={i} /> : <Clip {...c} vel={c.vel ?? 1} durationInFrames={d} />}
            </Sequence>
          )
        })}
      </Rebote>
      {EDL.barras.map(([a, b], i) => (
        <Sequence key={'b' + i} from={F(a)} durationInFrames={F(b - a)}><Barras /></Sequence>
      ))}
      {EDL.subs.map((s, i) => (
        <Sequence key={'s' + i} from={F(s.en)} durationInFrames={F(s.dur)}>
          <Subtitulo texto={s.texto} enojo={s.enojo} durationInFrames={F(s.dur)} />
        </Sequence>
      ))}
      {EDL.cortes.map((t, i) => (
        <Sequence key={'g' + i} from={F(t)} durationInFrames={12}><CorteGlitch seed={i + 3} /></Sequence>
      ))}
      {EDL.destellos.map(([t, color, dur = 8, fuerza = 1], i) => (
        <Sequence key={'d' + i} from={F(t)} durationInFrames={dur + 1}><Destello color={color} dur={dur} fuerza={fuerza} /></Sequence>
      ))}
      {EDL.titulos.map((ti, i) => {
        const d = F(ti.dur)
        return (
          <Sequence key={'t' + i} from={F(ti.en)} durationInFrames={d}>
            {ti.velo ? <Velo fuerza={ti.velo} dur={d} /> : null}
            {ti.final ? <Final ti={ti} d={d} vertical={vertical} seed={i * 11 + 5} /> : (
              <GlitchTitle
                lineas={vertical && ti.lineasV ? ti.lineasV : ti.lineas}
                colores={vertical && ti.coloresV ? ti.coloresV : ti.colores}
                durationInFrames={d} fondo={ti.fondo} color={ti.color}
                ancla={(vertical && ti.anclaV) || ti.ancla || 'centro'} seed={i * 11 + 5}
                maxAlto={vertical ? (ti.maxAltoV ?? 0.42) : (ti.maxAlto ?? 0.8)}
              />
            )}
          </Sequence>
        )
      })}
      {EDL.negros.map(([a, b, entra = 0.2, sale = 0.2], i) => (
        <Sequence key={'n' + i} from={F(a)} durationInFrames={F(b - a)}><Negro dur={F(b - a)} entra={F(entra)} sale={F(sale)} /></Sequence>
      ))}
      <Audio src={staticFile('madre-lobby-remix.mp3')} volume={corte ? (f) => interpolate(f, [F(corte + 1.2), F(corte + FINAL_CORTO)], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) : 1} />
    </AbsoluteFill>
  )
}

// El cierre: SKULLEYRAD.COM, que se rompe y deja ver OSCAR MOCTEZUMA en rosa,
// como el título del preloader.
function Final({ ti, d, vertical, seed }) {
  const max = vertical ? 0.5 : 0.62
const lineas = vertical && ti.lineasV ? ti.lineasV : ti.lineas
const colores = vertical && ti.coloresV ? ti.coloresV : ti.colores
const oscar = vertical ? ['OSCAR', 'MOCTE', 'ZUMA'] : ['OSCAR MOCTEZUMA']
  const a = Math.round(d * 0.42)
  const b = a + 30
  return (
    <>
      <Sequence durationInFrames={a + 2}><GlitchTitle lineas={lineas} colores={colores} durationInFrames={a + 2} seed={seed} maxAlto={max} sinSalida /></Sequence>
      <Sequence from={a} durationInFrames={b - a}><GlitchTitle lineas={oscar} colores={oscar.map(() => '#f472b6')} durationInFrames={b - a} seed={seed + 3} maxAlto={max} adelanto={14} /></Sequence>
      <Sequence from={b} durationInFrames={d - b}><GlitchTitle lineas={lineas} colores={colores} durationInFrames={d - b} seed={seed + 5} maxAlto={max} adelanto={16} /></Sequence>
    </>
  )
}

function Negro({ dur, entra, sale }) {
  const f = useCurrentFrame()
  const pts = [0]
  const vals = [entra ? 0 : 1]
  if (entra) { pts.push(entra); vals.push(1) }
  const fin = Math.max(pts[pts.length - 1] + 1, sale ? dur - sale : dur)
  pts.push(fin); vals.push(1)
  if (sale) { pts.push(Math.max(fin + 1, dur)); vals.push(0) }
  const a = interpolate(f, pts, vals, { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return <AbsoluteFill style={{ background: '#000', opacity: a }} />
}

export const DURACION_CUADROS = F(DURACION)
