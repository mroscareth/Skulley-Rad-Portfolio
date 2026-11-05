import { useLayoutEffect, useRef } from 'react'

// Los colores son de Personalizada, y se ve: viven adentro de su rueda. Al
// elegirla salen disparados de ella, caen cada uno en su lugar y rebotan; al
// elegir otra skin toman vuelo y la rueda se los traga. La rueda acusa cada uno,
// la bandeja se abre o se cierra desde ella y el panel le regresa ese espacio a
// Skulley (el rig lo sigue solo: lee el alto del panel).
//
// Todo son transformaciones con la Web Animations API, que corren en el
// compositor: el loop 3D no las traba en un teléfono lento. Cada vuelo se hornea
// en cuadros porque lleva cosas que una curva no da: el arco, y estirarse a lo
// largo de la velocidad y aplastarse al caer.

// Cuadros por vuelo y cuánto se estira un círculo por px/ms de velocidad.
const PASOS = 18
const ESTIRA = 0.16
const ESTIRA_MAX = 0.5
const TICK = 20

// Al salir: del más cercano a la rueda al más lejano.
const SALE = { vuelo: 340, turno: 44, alza: 46, remate: 210, arranque: 70 }
// Al regresar: se encogen tantito, toman vuelo y se van.
const REGRESA = { vuelo: 300, turno: 36, alza: 20 }

const ESCALA_ADENTRO = 0.16
const EXPO_OUT = 'cubic-bezier(0.16, 1, 0.3, 1)'
const RESORTE = 'cubic-bezier(0.34, 1.56, 0.64, 1)'

const lerp = (a, b, t) => a + (b - a) * t

// La curva de regresar: empieza hacia atrás (la anticipación) y acelera.
const tomaVuelo = (t) => t * t * (2.2 * t - 1.2)

// Estirar a lo largo de `ang`: girar, escalar y deshacer el giro, para que el
// dado no se ladee. `estira` negativo aplasta.
function pose({ x, y, s }, ang = 0, estira = 0) {
  const largo = s * (1 + estira)
  const ancho = s / (1 + estira)
  return `translate(${x}px, ${y}px) rotate(${ang}rad) scale(${largo}, ${ancho}) rotate(${-ang}rad)`
}

function cuadrosDeVuelo({ de, a, alza, ms, ritmo }) {
  const puntos = []
  for (let i = 0; i <= PASOS; i += 1) {
    const u = ritmo(i / PASOS)
    puntos.push({ x: lerp(de.x, a.x, u), y: lerp(de.y, a.y, u) - alza * 4 * u * (1 - u), s: lerp(de.s, a.s, u) })
  }
  const dt = (ms / PASOS) * 2
  let previo = null
  return puntos.map((p, i) => {
    const antes = puntos[Math.max(0, i - 1)]
    const luego = puntos[Math.min(PASOS, i + 1)]
    const dx = luego.x - antes.x
    const dy = luego.y - antes.y
    let ang = Math.atan2(dy, dx)
    // Continuo: un brinco de -π a π daría una vuelta entera entre dos cuadros.
    if (previo !== null) {
      while (ang - previo > Math.PI) ang -= Math.PI * 2
      while (ang - previo < -Math.PI) ang += Math.PI * 2
    }
    previo = ang
    const estira = Math.min(ESTIRA_MAX, (Math.hypot(dx, dy) / dt) * ESTIRA)
    return { p, ang, estira }
  })
}

// Sale de la rueda: tiro parabólico y, al caer, se aplasta y rebota.
function salir(el, { de, a, retraso }) {
  const { vuelo, alza, remate } = SALE
  const total = vuelo + remate
  const cuadros = cuadrosDeVuelo({ de, a, alza, ms: vuelo, ritmo: (t) => t })
  const frames = cuadros.map((c, i) => ({
    transform: pose(c.p, c.ang, c.estira),
    offset: ((i / PASOS) * vuelo) / total,
  }))
  const ang = cuadros[PASOS].ang
  frames.push(
    { transform: pose(a, ang, -0.26), offset: (vuelo + 70) / total },
    { transform: pose(a, ang, 0.1), offset: (vuelo + 140) / total },
    { transform: pose(a, ang, 0), offset: 1 },
  )
  return el.animate(frames, { duration: total, delay: retraso, easing: 'linear', fill: 'both' })
}

function regresar(el, { de, a, retraso }) {
  const { vuelo, alza } = REGRESA
  const cuadros = cuadrosDeVuelo({ de, a, alza, ms: vuelo, ritmo: tomaVuelo })
  const frames = cuadros.map((c) => ({ transform: pose(c.p, c.ang, c.estira) }))
  return el.animate(frames, { duration: vuelo, delay: retraso, easing: 'linear', fill: 'both' })
}

// La rueda acusa cada círculo: un latido amortiguado por cada `momentos`. Se
// aprieta al escupir uno (fuerza negativa) y se infla al tragárselo.
function latir(rueda, momentos, fuerza) {
  const total = Math.max(...momentos) + 420
  const frames = []
  for (let t = 0; t <= total; t += TICK) {
    let s = 1
    for (const m of momentos) {
      if (t < m) continue
      const d = t - m
      s += fuerza * Math.exp(-d / 90) * Math.sin(d / 24)
    }
    frames.push({ transform: `scale(${s})` })
  }
  frames.push({ transform: 'scale(1)' })
  return rueda.animate(frames, { duration: total, easing: 'linear', fill: 'both' })
}

// El alto de la bandeja al abrirse: se pasa un poco y se asienta.
function cuadrosDeResorte(de, a) {
  const frames = []
  for (let i = 0; i <= 24; i += 1) {
    const t = i / 24
    frames.push({ height: `${lerp(de, a, 1 - Math.exp(-7 * t) * Math.cos(8 * t))}px` })
  }
  frames[24] = { height: `${a}px` }
  return frames
}

// Dónde va un círculo que la animación anterior dejó a medias.
function poseActual(el) {
  const m = new DOMMatrixReadOnly(getComputedStyle(el).transform)
  return { x: m.e, y: m.f, s: Math.hypot(m.a, m.b) }
}

function elMismo(animaciones, el) {
  return animaciones.some((a) => a.effect?.target === el)
}

export function useVueloColores({ visibles, activo, bandejaRef, skinsRef }) {
  const anterior = useRef(visibles)
  const corriendo = useRef([])

  useLayoutEffect(() => {
    if (anterior.current === visibles) return
    anterior.current = visibles
    const bandeja = bandejaRef.current
    const chip = skinsRef.current?.querySelector('[data-skin-item]')
    const rueda = chip?.querySelector('.skin-chip__swatch')
    const interno = bandeja?.querySelector('.mcz-colores')
    const fondo = bandeja?.querySelector('.mcz-bandeja__fondo')
    if (!rueda || !interno || !fondo || !bandeja.animate) return
    let quieto = false
    try { quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { }
    if (!activo || quieto) return

    const puntos = [...interno.querySelectorAll('.color-well__swatch, .mcz-dado__circulo')]
    const nombres = [...interno.querySelectorAll('.color-well__label')]
    const dado = interno.querySelector('.mcz-dado__circulo svg')

    // Si te adelantaste a la animación, se sigue desde donde iba.
    const previas = corriendo.current
    const aMedias = previas.length > 0
    const altoVisto = bandeja.getBoundingClientRect().height
    const posesVistas = puntos.map((el) => (elMismo(previas, el) ? poseActual(el) : null))
    previas.forEach((a) => a.cancel())
    bandeja.dataset.vuelo = '1'

    const margen = parseFloat(getComputedStyle(interno).marginTop) || 0
    const altoLleno = margen + interno.offsetHeight
    const altoDesde = aMedias ? altoVisto : visibles ? 0 : altoLleno

    // El centro de la rueda, medido en su chip: ella misma se mueve.
    const caja = chip.getBoundingClientRect()
    const centro = { x: caja.left + caja.width / 2, y: caja.top + rueda.offsetHeight / 2 }
    const adentro = puntos.map((el) => {
      const r = el.getBoundingClientRect()
      return { x: centro.x - (r.left + r.width / 2), y: centro.y - (r.top + r.height / 2), s: ESCALA_ADENTRO }
    })

    const cajaFondo = fondo.getBoundingClientRect()
    const fx = centro.x - cajaFondo.left
    const fy = centro.y - cajaFondo.top
    const radio = Math.hypot(Math.max(fx, cajaFondo.width - fx), altoLleno - fy)
    const circulo = (r) => `circle(${r}px at ${fx}px ${fy}px)`

    const nuevas = []
    if (visibles) {
      const { turno, vuelo, arranque } = SALE
      const salidas = puntos.map((_, i) => arranque + i * turno)
      nuevas.push(latir(rueda, salidas, -0.16))
      nuevas.push(bandeja.animate(cuadrosDeResorte(altoDesde, altoLleno), { duration: 460, delay: arranque, easing: 'linear', fill: 'both' }))
      nuevas.push(fondo.animate([{ clipPath: circulo(0) }, { clipPath: circulo(radio) }], { duration: 460, delay: arranque, easing: EXPO_OUT, fill: 'both' }))
      puntos.forEach((el, i) => {
        const de = posesVistas[i] || adentro[i]
        nuevas.push(salir(el, { de, a: { x: 0, y: 0, s: 1 }, retraso: salidas[i] }))
      })
      nombres.forEach((el, i) => {
        nuevas.push(el.animate(
          [{ opacity: 0, transform: 'translateY(-8px) scale(0.6)' }, { opacity: 1, transform: 'none' }],
          { duration: 280, delay: salidas[i] + vuelo - 30, easing: RESORTE, fill: 'both' },
        ))
      })
      // El dado rueda mientras vuela.
      if (dado) {
        nuevas.push(dado.animate(
          [{ transform: 'rotate(-540deg)' }, { transform: 'none' }],
          { duration: vuelo + SALE.remate, delay: salidas[salidas.length - 1], easing: EXPO_OUT, fill: 'both' },
        ))
      }
    } else {
      const { turno, vuelo } = REGRESA
      const salidas = puntos.map((_, i) => i * turno)
      const llegadas = salidas.map((s) => s + vuelo)
      nuevas.push(latir(rueda, llegadas, 0.13))
      nuevas.push(bandeja.animate(
        [{ height: `${altoDesde}px` }, { height: '0px' }],
        { duration: 300, delay: 120, easing: 'cubic-bezier(0.5, 0, 0.2, 1)', fill: 'both' },
      ))
      nuevas.push(fondo.animate([{ clipPath: circulo(radio) }, { clipPath: circulo(0) }], { duration: 340, delay: 40, easing: 'cubic-bezier(0.5, 0, 0.75, 0.3)', fill: 'both' }))
      puntos.forEach((el, i) => {
        nuevas.push(regresar(el, { de: posesVistas[i] || { x: 0, y: 0, s: 1 }, a: { ...adentro[i], s: 0 }, retraso: salidas[i] }))
      })
      nombres.forEach((el, i) => {
        nuevas.push(el.animate(
          [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-8px) scale(0.6)' }],
          { duration: 120, delay: salidas[i], easing: 'ease-in', fill: 'both' },
        ))
      })
    }

    corriendo.current = nuevas
    Promise.allSettled(nuevas.map((a) => a.finished)).then(() => {
      if (corriendo.current !== nuevas) return
      nuevas.forEach((a) => a.cancel())
      corriendo.current = []
      delete bandeja.dataset.vuelo
    })
  }, [visibles, activo, bandejaRef, skinsRef])
}
