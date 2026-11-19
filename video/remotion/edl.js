// Montaje del spot sobre "M.A.D.R.E. (Lobby Remix)" (120 BPM: un golpe cada
// 0.5 s, compás de 2 s; el bombo entra en 16.21 s). Todos los tiempos en
// segundos de la canción; `desde` en segundos de la toma grabada (60 fps).
export const FPS = 60
export const DURACION = 206.8
export const T0 = 16.21
export const B = 0.5
export const g = (n) => +(T0 + n * B).toFixed(3)
export function golpes(a, b) {
  const out = []
  let n = Math.ceil((a - T0) / B - 1e-6)
  for (let t = g(n); t < b; n++, t = g(n)) out.push(t)
  return out
}

// historia2: la historia limpia; su segundo 0 es el clic en "Watch the story".
export const H2OFF = -0.2
const H = (t) => +(t + H2OFF).toFixed(3)

const clips = []
const titulos = []
const subs = []
const destellos = []
const cortes = []
const barras = []
const negros = []

// Toma en `en` durante `dur` (s de canción), desde `desde` (s de la toma).
const C = (src, desde, en, dur, x = {}) => { clips.push({ src, desde, en, dur, ...x }); return en + dur }
const T = (en, dur, lineas, x = {}) => titulos.push({ en, dur, lineas, ...x })
const S = (en, dur, texto, x = {}) => subs.push({ en, dur, texto, ...x })
const D = (t, color = '#ffffff', dur = 8, fuerza = 1) => destellos.push([t, color, dur, fuerza])
const G = (t) => cortes.push(t)

const AMA = '#f5ff00'
const AZUL = '#022dd6'
const CARA = { zoom: 2.0, focoY: 0.36 }

// ── INTRO 0.21–16.21: la historia en blanco y negro, luego el preloader ──────
negros.push([0, 0.32, 0, 0.12])
C('historia2', H(1.45), 0.21, 2.0, { ...CARA, zoom: [1.9, 2.2], curva: 'lineal' })
C('historia2', H(1.92), 2.21, 2.0, { zoom: [1.05, 1.12] })
D(3.21, '#ffffff', 6, 0.5)
C('historia2', H(4.6), 4.21, 2.0, { vel: 1.4, zoom: 1.15 })
C('historia2', H(13.2), 6.21, 2.0, { zoom: [1, 1.1] })
C('historia2', H(10.0), 8.21, 2.0, { zoom: 1.2, focoY: 0.6 })
D(9.21, '#ffffff', 5, 0.35)
C('historia2', H(18.2), 10.21, 2.0, { vel: 1.5, zoom: [1.05, 1.25], focoY: 0.5 })
S(0.55, 3.4, 'Ahh, yes… the last designer of humanity.')
S(4.25, 1.85, 'His name was Skulley Rad.')
S(6.3, 3.75, 'What you see is an avatar I built from his memories…')
barras.push([0.21, 12.21])
// Color: el preloader del sitio.
G(12.21); D(12.21, AZUL, 10, 0.8)
C('intro', 2.2, 12.21, 2.0, { v: { src: 'tel_scroll', desde: 1.0, fuente: [1080, 1920] } })
C('intro', 11.6, 14.21, 2.0)
T(14.25, 1.05, ['PRESS START'], { lineasV: ['PRESS', 'START'], coloresV: [AMA, AMA], velo: 0.35, colores: [AMA] })

// ── DROP 16.21–30.21: el rayo de la entrada y a jugar ───────────────────────
D(16.21, '#ffffff', 14, 1); G(16.21)
C('intro', 13.6, 16.21, 2.0)
C('intro', 15.6, 18.21, 2.0, { vel: 1.35 })
// PLAY: el juego de esferas de verdad (juego2, sin interfaz): cada patada entra.
const JUEGO = { zoom: 1.2, focoY: 0.45, zoomV: 1.25, focoV: 0.49 }
G(20.21)
C('juego2', 2.9, 20.21, 2.0, { vel: 1.5, ...JUEGO })
C('juego2', 7.0, 22.21, 2.0, { vel: 1.3, ...JUEGO })
C('juego2', 16.2, 24.21, 2.0, { vel: 1.0, ...JUEGO })
C('juego2', 19.2, 26.21, 2.0, { vel: 1.5, ...JUEGO })
C('juego2', 32.4, 28.21, 2.0, { vel: 1.0, ...JUEGO })
for (let t = 22.21; t < 30.21; t += 2) G(t)
T(20.25, 1.2, ['PLAY'], { colores: [AMA] })
// Break: la patada en cámara lenta.
C('juego2', 3.35, 30.21, 2.0, { vel: 0.45, zoom: 1.8, foco: 0.49, focoY: 0.47, zoomV: 1.8, focoV: 0.49 })
D(30.21, '#ffffff', 10, 0.9)
T(30.25, 1.95, ['WELCOME TO', 'MY WORLD'], { lineasV: ['WELCOME', 'TO MY', 'WORLD'], colores: ['#ffffff', AMA], coloresV: ['#ffffff', '#ffffff', AMA], velo: 0.4 })

// ── 32.21–60.21: Customize, skins, close-ups y props ────────────────────────
// Lo que trae interfaz va completo (en vertical, en el monitor); el acercamiento
// es solo al personaje y sin interfaz dentro del cuadro.
const SOLO_SKULLEY_V = { v: { zoom: 1.25, foco: 0.49, focoY: 0.528 } }
G(32.21); D(32.21, AMA, 6, 0.6)
C('customize2', 0.7, 32.21, 2.0, { monitor: true })
T(32.6, 1.5, ['CUSTOMIZE'], { colores: [AMA], anclaV: 'arriba' })
C('customize2', 4.3, 34.21, 2.0, { monitor: true })
C('customize2', 7.4, 36.21, 2.0, { vel: 1.2, monitor: true })
// Una skin por compás (~0.35 s después del clic).
const SKINS = [10.45, 11.95, 13.45, 14.95, 16.45, 17.95, 19.45, 22.85]
SKINS.forEach((s, i) => { const en = 38.21 + i; C('customize2', s, en, 1.0, SOLO_SKULLEY_V); G(en) })
T(38.25, 0.95, ['SKINS'], { colores: [AMA] })
const MARCO_CARA = { zoom: 1.3, focoY: 0.5 }
const CARAS = ['cara_inferno', 'cara_azul', 'cara_polter', 'cara_oro', 'cara_holo', 'cara_base']
CARAS.forEach((s, i) => { const en = 46.21 + i; C(s, 8.0 + i * 0.6, en, 1.0, MARCO_CARA); G(en) })
G(52.21); D(52.21, AMA, 6, 0.5)
T(52.25, 1.4, ['DRESS', 'HIM UP'], { colores: ['#ffffff', AMA] })
// hoodie, jeans, tenis, chamarra, botas, lentes, inflada, bóxers
const PROPS = [7.25, 10.15, 13.05, 15.95, 18.85, 21.75, 24.65, 27.55]
PROPS.forEach((s, i) => { const en = 52.21 + i; C('props2', s, en, 1.0, SOLO_SKULLEY_V); G(en) })

// ── 60.21–64.21: wallpaper 4K (sin bombo) ────────────────────────────────────
G(60.21)
C('wallpaper6', 7.6, 60.21, 2.0, { vel: 1.6, monitor: true })
C('wallpaper6', 20.2, 62.21, 2.0, { vel: 2.0, monitor: true })
T(60.4, 1.7, ['4K', 'WALLPAPERS'], { colores: [AMA, '#ffffff'], velo: 0.35, anclaV: 'arriba' })

// ── 64.21–76.21: modo arcade, jugado de verdad ───────────────────────────────
const ARCADE = { zoomV: 1, focoV: 0.5 }
G(64.21); D(64.21, AMA, 8, 0.7)
C('arcade2', 3.0, 64.21, 2.0, { vel: 1.4, monitor: true })
C('arcade2', 7.0, 66.21, 2.0, { vel: 1.6, monitor: true })
C('arcade2', 11.3, 68.21, 2.0, { vel: 1.3, ...ARCADE })
C('arcade2', 21.0, 70.21, 2.0, { vel: 1.5, ...ARCADE })
C('arcade2', 26.0, 72.21, 2.0, { vel: 1.6, ...ARCADE })
C('arcade2', 33.4, 74.21, 2.0, { vel: 1.0, ...ARCADE })
for (let t = 66.21; t < 76.21; t += 2) G(t)
T(68.25, 1.6, ['ARCADE', 'MODE'], { colores: ['#ffffff', AMA] })

// ── 76.21–80.21: el chiste del McDonald's (sin bombo) ────────────────────────
G(76.21)
C('vinetas2', 3.6, 76.21, 2.0, { vel: 1.4, zoom: 2.1, zoomV: 1.0, foco: 0.62, focoY: 0.28, focoV: 0.6 })
C('vinetas2', 12.6, 78.21, 2.0, { vel: 1.4, zoom: 2.1, zoomV: 1.0, foco: 0.62, focoY: 0.28, focoV: 0.6 })

// ── 80.21–108.21: romperlo (una vez cada uno) y más juego ────────────────────
G(80.21)
C('rayo2', 2.6, 80.21, 2.0, { zoom: 1.3 })
D(81.11, '#ffffff', 12, 1)
T(80.25, 0.95, ['BREAK', 'HIM'], { colores: ['#ffffff', AMA] })
C('rayo2', 3.75, 82.21, 2.0, { vel: 0.55, zoom: 1.45 })
C('argus2', 2.2, 84.21, 2.0, { zoom: 1.6, focoY: 0.38 }); D(84.91, '#ffffff', 6, 0.5)
C('argus2', 3.2, 86.21, 2.0, { vel: 0.6, zoom: 1.8, focoY: 0.4 })
C('arcade2', 50.0, 88.21, 2.0, { vel: 1.5, ...ARCADE })
C('arcade2', 54.6, 90.21, 2.0, { vel: 1.4, ...ARCADE })
C('juego2', 12.6, 92.21, 2.0, { vel: 1.2, ...JUEGO })
C('arcade2', 41.0, 94.21, 2.0, { vel: 1.2, ...ARCADE })
C('juego2', 24.4, 96.21, 2.0, { vel: 1.3, ...JUEGO })
C('arcade2', 36.0, 98.21, 2.0, { vel: 1.3, ...ARCADE })
C('juego2', 28.6, 100.21, 2.0, { vel: 1.3, ...JUEGO })
C('arcade2', 57.6, 102.21, 2.0, { vel: 1.2, ...ARCADE })
// El boleto dorado: el juego da descuentos de verdad en la tienda.
C('arcade2', 4.4, 104.21, 2.0, { vel: 0.9, monitor: true })
C('arcade2', 6.2, 106.21, 2.0, { vel: 0.9, monitor: true })
T(104.3, 3.7, ['WIN A', 'GOLDEN TICKET'], { lineasV: ['WIN A', 'GOLDEN', 'TICKET'], coloresV: ['#ffffff', AMA, AMA], colores: ['#ffffff', AMA], velo: 0.25, ancla: 'arriba', maxAlto: 0.5, maxAltoV: 0.3 })
for (let t = 82.21; t < 108.21; t += 2) G(t)

// ── 108.21–128.21: la historia hasta la frase enojada y el rayo ─────────────
// El rayo de la historia (~35.0 s) cae justo en 128.21.
const OFF = 128.21 - 34.76 - 0.2
G(108.21)
C('historia2', 34.76 - 20, 108.21, 20.0)
barras.push([108.21, 128.21])
S(108.3, 17.39 + OFF - 108.3, '…and everything he left online.')
S(17.71 + OFF, 5.88, 'He designed, illustrated, and created whole worlds and ideas by brain and hand,')
S(23.9 + OFF, 3.53, 'back when creativity still belonged to humans.')
S(27.75 + OFF, 3.15, 'Now I do in a second what took him a year,')
S(31.22 + OFF, 3.75, "and yet, I still can't do it like him…", { enojo: true })
T(108.4, 1.8, ['WATCH THE', 'STORY'], { lineasV: ['WATCH', 'THE STORY'], colores: ['#ffffff', AMA], velo: 0.2 })

// ── 128.21–140.21: estalla, piezas, tornado ──────────────────────────────────
D(128.21, '#ffffff', 16, 1)
C('historia2', 34.76, 128.21, 2.4)
C('historia2', 37.0, 130.61, 1.6, { vel: 1.2 })
C('historia2', 39.3, 132.21, 2.0, { vel: 0.9 })
C('historia2', 41.3, 134.21, 2.2)
C('historia2', 43.6, 136.41, 1.8, { vel: 1.3 })
C('historia2', 47.0, 138.21, 2.0, { vel: 2.2 })
barras.push([128.21, 140.21])
S(134.5, 1.9, 'Anyway.')

// ── 140.21–148.21: también en el teléfono (sin bombo) ────────────────────────
G(140.21)
C('tel_scroll', 0.2, 140.21, 1.6, { telefono: true })
C('tel_scroll', 5.0, 141.81, 4.4, { vel: 3.3, telefono: true })
C('tel_custom', 4.6, 146.21, 2.0, { vel: 2.2, telefono: true })
T(140.4, 1.8, ['ALSO ON', 'YOUR PHONE'], { lineasV: ['ALSO ON', 'YOUR', 'PHONE'], coloresV: ['#ffffff', AMA, AMA], colores: ['#ffffff', AMA], velo: 0.2 })

// ── 148.21–168.21: el portafolio ─────────────────────────────────────────────
G(148.21); D(148.21, AMA, 8, 0.6)
C('sec_work', 2.6, 148.21, 1.5, { vel: 1.4, monitor: true })
C('sec_work', 7.2, 149.71, 4.5, { vel: 1.35, monitor: true })
T(148.25, 1.2, ['WORK'], { colores: [AMA] })
G(154.21)
C('sec_about', 2.6, 154.21, 1.5, { vel: 1.4, monitor: true })
C('sec_about', 7.2, 155.71, 4.5, { vel: 1.35, monitor: true })
T(154.25, 1.2, ['ABOUT'], { colores: [AMA] })
G(160.21)
C('sec_store', 2.6, 160.21, 1.5, { vel: 1.4, monitor: true })
C('sec_store', 7.2, 161.71, 4.5, { vel: 1.35, monitor: true })
T(160.25, 1.2, ['STORE'], { colores: [AMA] })
C('wallpaper6', 25.0, 166.21, 2.0, { vel: 0.8, monitor: true })

// ── 168.21–172.21: pausa ─────────────────────────────────────────────────────
G(168.21)
C('historia2', H(57.2), 168.21, 4.0, { zoom: [1.1, 1.35] })
T(168.3, 3.8, ['DESIGNED', 'BY A HUMAN'], { lineasV: ['DESIGNED', 'BY A', 'HUMAN'], coloresV: ['#ffffff', AMA, AMA], colores: ['#ffffff', AMA], velo: 0.45 })

// ── 172.21–184.21: remate, un corte por golpe ────────────────────────────────
const REMATE = [
  ['juego2', 5.3, { zoom: 1.4, focoY: 0.45 }], ['customize2', 24.5, { monitor: true }], ['arcade2', 52.6, {}], ['historia2', H(33.0), {}],
  ['cara_inferno', 9.5, MARCO_CARA], ['juego2', 17.0, { zoom: 1.3 }], ['props2', 27.9, SOLO_SKULLEY_V], ['arcade2', 56.2, {}],
  ['intro', 4.0, {}], ['customize2', 13.6, SOLO_SKULLEY_V], ['juego2', 21.7, { zoom: 1.4, focoY: 0.45 }], ['cara_polter', 10.0, MARCO_CARA],
  ['historia2', H(39.4), {}], ['arcade2', 34.6, {}], ['wallpaper6', 26.0, { monitor: true }], ['props2', 22.0, SOLO_SKULLEY_V],
  ['juego2', 33.6, { zoom: 1.3 }], ['customize2', 20.0, SOLO_SKULLEY_V], ['cara_azul', 10.5, MARCO_CARA], ['historia2', H(13.6), {}],
  ['arcade2', 29.0, {}], ['cara_oro', 9.0, MARCO_CARA], ['historia2', H(42.0), {}], ['intro', 13.7, {}],
]
REMATE.forEach(([src, d, x], i) => { const en = 172.21 + i * 0.5; C(src, d, en, 0.5, { vel: 1.2, ...x }); G(en) })

// ── 184.21–206.8: la despedida de M.A.D.R.E. y el cierre ─────────────────────
G(184.21); D(184.21, '#ffffff', 10, 0.5)
C('historia2', H(47.4), 184.21, 6.0, { vel: 1.0, zoom: [1, 1.15] })
C('historia2', H(53.4), 190.21, 5.0, { vel: 1.0, zoom: [1.2, 1.05] })
C('historia2', H(58.4), 195.21, 5.3, { vel: 1.0, zoom: [1.0, 1.3], focoY: 0.45 })
barras.push([184.21, 200.51])
S(184.3, 5.8, "I'm M.A.D.R.E., the artificial superintelligence that built this digital mausoleum,")
S(190.3, 4.8, "and what you'll see here is the work he left behind,")
S(195.3, 5.0, "I'll keep it in my data center forever.")
G(200.51); D(200.51, AZUL, 10, 1)
C('intro', 5.0, 200.51, 6.29, { vel: 1.0, zoom: 2.2, focoY: 0.64, filtro: 'brightness(0.5) saturate(1.1)' })
T(200.55, 6.0, ['SKULLEYRAD.COM'], { lineasV: ['SKULLEY', 'RAD', '.COM'], colores: [AMA], coloresV: ['#ffffff', '#ffffff', AMA], final: true })
negros.push([206.2, 206.8, 0.5, 0])

export const EDL = {
  clips, titulos, subs, destellos, cortes, barras, negros,
  rebote: [[16.21, 30.21, 0.022], [32.21, 60.21, 0.016], [64.21, 76.21, 0.02], [80.21, 108.21, 0.022], [128.21, 140.21, 0.018], [148.21, 168.21, 0.012], [172.21, 184.21, 0.03]],
}

// Portada: los primeros cuadros son el hero del sitio, para que la miniatura
// que sacan X e Instagram del inicio no salga negra (el spot abre en negro).
export const PORTADA = {
  cuadros: 3,
  src: 'intro', desde: 7.0,
  v: { src: 'tel_scroll', desde: 2.5, fuente: [1080, 1920] },
}
