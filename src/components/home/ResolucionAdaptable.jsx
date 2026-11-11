import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'

// Resolución adaptable del home (rendimiento.md, 2026-11-11). Si la tarjeta de
// video no alcanza ~55 cuadros por segundo, baja el DPR un escalón; si después
// sobra, lo regresa. Antes estaba montado AdaptiveDpr de drei, que solo baja la
// resolución cuando alguien llama a performance.regress(), y nadie lo hacía.
//
// Mide en ventanas de 2 s, solo con el home jugándose (`activo`), los cuadros
// por segundo y, si el navegador lo permite (EXT_disjoint_timer_query_webgl2),
// el tiempo de GPU de cada cuadro. Solo baja si la GPU es el cuello de botella:
// si el límite es el JavaScript, menos píxeles no ayudan. Sin temporizador no
// puede saber si sobra, así que ahí solo baja. Cambiar el DPR redimensiona los
// buffers del composer (un tirón chico), por eso va por escalones y con
// paciencia: dos ventanas lentas para bajar, tres holgadas para subir, y si
// tras subir tiene que volver a bajar, se queda ahí.
//
// El escalón vive en HomeCanvas y entra por la prop `dpr` del <Canvas>, que R3F
// vuelve a aplicar en cada render (como `frameloop`, rendimiento.md regla 1).
// `window.__resolucion` deja ver lo que decide; `window.__resolucionForzar =
// 'lento' | 'holgado'` simula una máquina para probarlo.
export const ESCALAS_DPR = [1, 0.85, 0.72, 0.6]
const VENTANA_MS = 2000
const ASENTAR_MS = 1500        // tras activarse o tras un cambio, no mide
const LENTO_MS = 1000 / 55
const HOLGADO_GPU_MS = 10      // el siguiente escalón tendría que caber aquí
const TOPE_SUBIDAS = ESCALAS_DPR.length - 1   // lo justo para regresar una vez del fondo

const mediana = (a) => {
  if (!a.length) return null
  const s = [...a].sort((x, y) => x - y)
  return s[s.length >> 1]
}

export function escalaGuardada() {
  try {
    const v = parseFloat(sessionStorage.getItem('skulley_dpr_escala'))
    return ESCALAS_DPR.includes(v) ? v : 1
  } catch { return 1 }
}

export default function ResolucionAdaptable({ activo, escala, onEscala }) {
  const gl = useThree((s) => s.gl)
  const st = useRef(null)
  if (!st.current) {
    st.current = {
      frames: [], gpu: [], desde: 0, ventana: 0, lentas: 0, holgadas: 0,
      subidas: 0, congelada: false, ext: undefined, q: null, pend: [],
    }
  }

  useEffect(() => {
    st.current.desde = performance.now()
    st.current.lentas = 0
    st.current.holgadas = 0
  }, [escala, activo])

  // Cierra la consulta abierta al desmontar.
  useEffect(() => () => {
    const s = st.current
    const ctx = gl.getContext()
    try { if (s.q) { ctx.endQuery(s.ext.TIME_ELAPSED_EXT); ctx.deleteQuery(s.q) } } catch { }
    for (const q of s.pend) { try { ctx.deleteQuery(q) } catch { } }
    s.q = null
    s.pend = []
  }, [gl])

  useFrame((state, delta) => {
    const s = st.current
    const ctx = gl.getContext()
    if (s.ext === undefined) {
      try { s.ext = ctx.getExtension('EXT_disjoint_timer_query_webgl2') || null } catch { s.ext = null }
    }
    // La consulta de GPU abre al empezar el cuadro y cierra al empezar el
    // siguiente: mide todo lo que el cuadro le mandó a la tarjeta, sin tomar
    // prioridad de render (una prioridad > 0 le quitaría a R3F el dibujo).
    if (s.ext) {
      try {
        if (s.q) { ctx.endQuery(s.ext.TIME_ELAPSED_EXT); s.pend.push(s.q); s.q = null }
        while (s.pend.length && ctx.getQueryParameter(s.pend[0], ctx.QUERY_RESULT_AVAILABLE)) {
          const q = s.pend.shift()
          const valida = !ctx.getParameter(s.ext.GPU_DISJOINT_EXT)
          const ns = ctx.getQueryParameter(q, ctx.QUERY_RESULT)
          ctx.deleteQuery(q)
          if (valida && activo) s.gpu.push(ns / 1e6)
        }
        if (activo && s.pend.length < 6) {
          s.q = ctx.createQuery()
          ctx.beginQuery(s.ext.TIME_ELAPSED_EXT, s.q)
        }
      } catch { s.ext = null }
    }

    const t = performance.now()
    const reiniciar = () => { s.frames.length = 0; s.gpu.length = 0; s.ventana = t }
    if (!activo || document.hidden || t - s.desde < ASENTAR_MS || delta > 0.25) { reiniciar(); return }
    s.frames.push(delta * 1000)
    if (t - s.ventana < VENTANA_MS) return

    const forzar = typeof window !== 'undefined' ? window.__resolucionForzar : null
    let frameMs = mediana(s.frames)
    let gpuMs = s.gpu.length >= 10 ? mediana(s.gpu) : null
    if (forzar === 'lento') { frameMs = 30; gpuMs = s.ext ? 28 : null }
    if (forzar === 'holgado') { frameMs = 8; gpuMs = 3 }
    reiniciar()

    const i = Math.max(0, ESCALAS_DPR.indexOf(escala))
    const lento = frameMs > LENTO_MS && (gpuMs == null || gpuMs > frameMs * 0.7)
    s.lentas = lento ? s.lentas + 1 : 0
    const siguiente = ESCALAS_DPR[i - 1]
    const holgado = i > 0 && !s.congelada && s.subidas < TOPE_SUBIDAS && gpuMs != null
      && frameMs < 17 && gpuMs * (siguiente / escala) ** 2 < HOLGADO_GPU_MS
    s.holgadas = holgado ? s.holgadas + 1 : 0

    let nueva = escala
    if (s.lentas >= 2 && i < ESCALAS_DPR.length - 1) {
      nueva = ESCALAS_DPR[i + 1]
      if (s.subidas > 0) s.congelada = true
    } else if (s.holgadas >= 3) {
      nueva = siguiente
      s.subidas += 1
    }
    if (typeof window !== 'undefined') {
      window.__resolucion = { escala: nueva, frameMs: +frameMs.toFixed(1), gpuMs: gpuMs == null ? null : +gpuMs.toFixed(1), temporizador: !!s.ext, congelada: s.congelada }
    }
    if (nueva !== escala) {
      try { sessionStorage.setItem('skulley_dpr_escala', String(nueva)) } catch { }
      onEscala(nueva)
    }
  }, -10000)

  return null
}
