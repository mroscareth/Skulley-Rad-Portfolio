// Guiones de las tomas. `node capture/shots.mjs intro` graba una.
import { abrir, esperar, Grabacion, cerrar, sleep, saltar, tecla } from './rig.mjs'
import { Raton } from './raton.mjs'
import { instalar, Jugador } from './jugador.mjs'

const rect = (ctx, sel, texto) => ctx.page.evaluate((sel, texto) => {
  const els = [...document.querySelectorAll(sel)]
  const el = texto ? els.find((e) => (e.textContent || '').trim().toLowerCase().includes(texto.toLowerCase())) : els[0]
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height }
}, sel, texto)

const SHOTS = {}

// Preloader: el título, Skulley siguiendo el cursor, clic en Full experience,
// el rayo de la entrada y la caída al mundo.
SHOTS.intro = async () => {
  const ctx = await abrir({ ruta: '/', storage: { lang: 'en', ...SIN_LENTES } })
  await esperar(ctx, () => !!document.querySelector('.dsp-root'), { timeout: 120000 })
  const g = new Grabacion(ctx, 'intro')
  const m = new Raton(ctx, 1560, 1010, 11)
  // Primero 7 s quieto con el cursor paseando cerca de la cara.
  m.ir(1800, 1380, 560, 1400)
  m.ir(4200, 820, 420, 1500)
  m.ir(6600, 1180, 300, 1300)
  m.ir(9000, 980, 640, 1200)
  let t = 0
  const dt = g.dt
  for (; t < 11000; t += dt) { await m.aplicar(t); await g.cuadro() }
  const b = await rect(ctx, 'button', 'full experience')
  console.log('boton', b)
  const llega = m.ir(t + 100, b.x + 8, b.y + 3)
  m.clic(llega + 650)
  const fin = llega + 650 + 16000
  for (; t < fin; t += dt) { await m.aplicar(t); await g.cuadro() }
  await g.cerrar()
  console.log('errores', ctx.errores.slice(0, 6))
  await cerrar(ctx)
}

const OCULTA_CURSOR = `img[src*="hand-pointer"],img[src*="hand-grab"]{display:none!important}`
const css = (ctx, texto) => ctx.page.evaluate((t) => {
  const s = document.createElement('style'); s.textContent = t; document.head.appendChild(s)
}, texto)

// Sin barra de reproducción ni subtítulos (los subtítulos van grandes en el montaje).
SHOTS.historia2 = async () => {
  const ctx = await abrir({ ruta: '/', storage: { lang: 'en' } })
  await esperar(ctx, () => !!document.querySelector('.dsp-root'), { timeout: 120000 })
  await sleep(9000)
  const b = await rect(ctx, 'button', 'watch the story')
  await ctx.page.mouse.move(b.x, b.y)
  await sleep(6000)
  await css(ctx, '.dsp-arriba,.dsp-tiempo,.dsp-pausa-centro,.site-tip{display:none!important}.dsp-subtitulos{visibility:hidden!important}')
  const g = new Grabacion(ctx, 'historia2')
  await ctx.page.evaluate(() => { const e = [...document.querySelectorAll('.dsp-botones > button')].find((x) => x.textContent.includes('Watch the story')); e.click() })
  await css(ctx, OCULTA_CURSOR)
  for (let t = 0; t < 67000; t += g.dt) await g.cuadro()
  await g.cerrar()
  await cerrar(ctx)
}

// "Watch the story" completa, para sacar los pedazos.
SHOTS.historia = async () => {
  const ctx = await abrir({ ruta: '/', storage: { lang: 'en' } })
  await esperar(ctx, () => !!document.querySelector('.dsp-root'), { timeout: 120000 })
  await sleep(9000)
  const b = await rect(ctx, 'button', 'watch the story')
  console.log('boton', b)
  await ctx.page.mouse.move(b.x, b.y)
  await sleep(6000)
  const g = new Grabacion(ctx, 'historia')
  const m = new Raton(ctx, b.x, b.y, 3)
  m.clic(300)
  let t = 0
  for (; t < 700; t += g.dt) { await m.aplicar(t); await g.cuadro() }
  await css(ctx, OCULTA_CURSOR)
  const dur = Number(process.env.DUR || 175000)
  for (; t < dur; t += g.dt) await g.cuadro()
  await g.cerrar()
  console.log('plan', JSON.stringify(await ctx.page.evaluate(() => window.__historiaPlan || null)).slice(0, 3000))
  console.log('errores', ctx.errores.slice(0, 6))
  await cerrar(ctx)
}

// Teclas programadas en tiempo de toma: [desde, hasta, tecla].
function teclado(ctx, plan) {
  const hechos = new Set()
  return async (t) => {
    for (let i = 0; i < plan.length; i++) {
      const [a, b, k] = plan[i]
      if (t >= a && !hechos.has(i + 'd')) { hechos.add(i + 'd'); await tecla(ctx, k, 'down') }
      if (t >= b && !hechos.has(i + 'u')) { hechos.add(i + 'u'); await tecla(ctx, k, 'up') }
    }
  }
}

const TODO_DESBLOQUEADO = {
  skulley_achievements: JSON.stringify(['skin_oilslick', 'skin_hologram', 'skin_void', 'skin_slime', 'skin_pixel', 'skin_lava', 'skin_poltergeist']),
  goldSkinUnlocked: '1',
  skulley_wallpaper_guia: '1',
}
// Sin lentes de inicio (vienen puestos por defecto): solo donde se pidan.
const SIN_LENTES = { skulley_accesorios: JSON.stringify({ lentes: false }) }
async function mundo(storage = {}) {
  const ctx = await abrir({ ruta: '/world', storage: { lang: 'en', tutorial_shown: 'true', ...TODO_DESBLOQUEADO, ...SIN_LENTES, ...storage }, session: { skulley_dpr_escala: '1' } })
  await esperar(ctx, () => !!document.querySelector('.puertas') && document.querySelector('.iris-layer')?.dataset.mode === 'off' && typeof window.__kick === 'function', { timeout: 150000 })
  await sleep(2500)
  return ctx
}

// Jugando: acercar la cámara, correr, patear, bolas de fuego.
SHOTS.juego1 = async () => {
  const ctx = await mundo()
  const g = new Grabacion(ctx, 'juego1')
  const m = new Raton(ctx, 1300, 700, 21)
  // zoom con la rueda
  for (let i = 0; i < 9; i++) m.ruedaEn(400 + i * 110, -100)
  m.ir(300, 1180, 520, 900)
  const keys = teclado(ctx, [
    [2200, 4200, 'w'], [3000, 6800, 'Shift'], [4000, 5600, 'd'], [5400, 6800, 's'],
    [7600, 8900, 'e'],
    [10200, 11600, 'a'], [10200, 12600, 'w'], [12000, 12900, ' '],
    [14000, 15600, 'd'], [14400, 16600, 'Shift'], [15400, 16600, 's'],
    [17400, 18800, 'e'],
    [19600, 21600, 'w'], [19600, 21600, 'Shift'], [21000, 22200, 'a'],
    [23000, 24600, 'e'],
    [25400, 26600, ' '],
    [27200, 29600, 's'], [27200, 29600, 'Shift'], [28000, 29600, 'd'],
    [30400, 31800, 'e'],
  ])
  m.ir(6800, 1420, 360, 700)
  m.ir(9200, 760, 640)
  m.ir(13200, 1500, 760)
  m.ir(16800, 620, 420)
  m.ir(22400, 1240, 330)
  m.ir(26800, 800, 760)
  m.ir(29800, 1100, 280)
  for (let t = 0; t < 34000; t += g.dt) { await m.aplicar(t); await keys(t); await g.cuadro() }
  await g.cerrar()
  console.log('errores', ctx.errores.slice(0, 6))
  await cerrar(ctx)
}

// Busca un elemento visible por selector, texto o aria-label (sin mayúsculas).
const busca = (ctx, { sel = 'button', texto, aria } = {}) => ctx.page.evaluate((sel, texto, aria) => {
  const ok = (e) => { const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2 && getComputedStyle(e).visibility !== 'hidden' }
  const els = [...document.querySelectorAll(sel)].filter(ok)
  const el = els.find((e) => (!texto || (e.textContent || '').trim().toLowerCase().includes(texto.toLowerCase()))
    && (!aria || (e.getAttribute('aria-label') || '').toLowerCase() === aria.toLowerCase()))
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height }
}, sel, texto || null, aria || null)

// Corre una toma. `acciones` = [[t, async (t) => {}]]: se ejecutan cuando el
// tiempo de la toma llega a t (pueden programar trayectos del mouse).
async function correr(ctx, nombre, dur, { m, acciones = [], keys, ocultar, alFinal } = {}) {
  const g = new Grabacion(ctx, nombre)
  if (ocultar) await css(ctx, ocultar)
  const acc = acciones.slice().sort((a, b) => a[0] - b[0])
  let k = 0
  for (let t = 0; t < dur; t += g.dt) {
    while (k < acc.length && acc[k][0] <= t) { try { await acc[k][1](t) } catch (e) { console.log('accion', acc[k][0], e.message) } k++ }
    if (m) await m.aplicar(t)
    if (keys) await keys(t)
    await g.cuadro()
  }
  await g.cerrar()
  if (alFinal) await alFinal()
  console.log('errores', ctx.errores.filter((e) => !/privy|403/i.test(e)).slice(0, 6))
  console.log('vt', await ctx.page.evaluate(() => window.__vt.errors.slice(0, 4)))
  await cerrar(ctx)
}

// Mueve el mouse a un elemento y le da clic. Devuelve la hora del clic.
async function irClic(ctx, m, t, q, { pausa = 380, dx = 0, dy = 0 } = {}) {
  const r = await busca(ctx, q)
  if (!r) { console.log('no encontré', JSON.stringify(q)); return t }
  const llega = m.ir(t, r.x + dx + (Math.random() - 0.5) * Math.min(10, r.w * 0.2), r.y + dy + (Math.random() - 0.5) * Math.min(6, r.h * 0.2))
  m.clic(llega + pausa)
  return llega + pausa
}

const UI_FUERA = `.puertas,[data-portrait-root],.kick-hud,.site-tip,[class*="z-[999993]"],[class*="z-[999991]"],[class*="z-[20]"]:has(.title-banner),button[style*="z-index: 999995"],.z-toast{visibility:hidden!important}`

const disparar = (ctx, nombre, detail) => ctx.page.evaluate((n, d) => window.dispatchEvent(new CustomEvent(n, { detail: d })), nombre, detail)
const enSkulley = (ctx, nombre) => ctx.page.evaluate((n) => {
  const [x, , z] = window.__laserDbg().player
  const d = n === 'bolt-strike' ? { at: performance.now() } : n === 'bolt-ground-impact' ? { x, z } : { x, y: 0, z }
  window.dispatchEvent(new CustomEvent(n, { detail: d }))
  return [x, z]
}, nombre)

// Customize: entra (la trama se come al mundo), lo gira, Randomize con el
// vórtice de runas y todas las skins.
SHOTS.customize = async () => {
  const ctx = await mundo()
  const m = new Raton(ctx, 1150, 560, 31)
  const acciones = [
    [300, async (t) => { await irClic(ctx, m, t, { aria: 'Customize character' }) }],
    [3800, async (t) => {
      const a = m.ir(t, 760, 620, 700); m.bajar(a + 80); m.ir(a + 100, 1120, 640, 1100); m.soltar(a + 1250)
    }],
    [6200, async (t) => { await irClic(ctx, m, t, { aria: 'Randomize' }) }],
    [8000, async (t) => { await irClic(ctx, m, t, { aria: 'Randomize' }, { pausa: 200 }) }],
    [9500, async (t) => { await irClic(ctx, m, t, { aria: 'Randomize' }, { pausa: 200 }) }],
  ]
  const skins = ['Legendary Gold', 'Oil Slick', 'Hologram', 'Void', 'Green Slime', 'Pixel Art', 'Inferno', 'BLUE', 'Poltergeist', 'Custom']
  let t0 = 11500
  for (const s of skins) {
    const q = s === 'BLUE' ? { texto: 'Blue', sel: '[aria-label="Flame color"] button' } : { aria: s }
    acciones.push([t0, async (t) => { await irClic(ctx, m, t, q, { pausa: 250 }) }])
    t0 += s === 'Inferno' ? 1900 : 1500
  }
  acciones.push([t0 + 200, async (t) => { const a = m.ir(t, 700, 600, 600); m.bajar(a + 60); m.ir(a + 80, 1180, 590, 1300); m.soltar(a + 1450) }])
  await correr(ctx, 'customize', t0 + 2600, { m, acciones })
}

// Props: guardarropa por partes del cuerpo.
SHOTS.props = async () => {
  const ctx = await mundo()
  const m = new Raton(ctx, 1150, 560, 41)
  const acciones = [
    [300, async (t) => { await irClic(ctx, m, t, { aria: 'Customize character' }) }],
    [3600, async (t) => { await irClic(ctx, m, t, { sel: '#cc-pestana-props' }) }],
  ]
  const pasos = [['Torso', 'Wear hoodie'], ['Legs', 'Wear jeans'], ['Feet', 'Wear boots'], ['Torso', 'Wear jacket'], ['Feet', 'Wear sneakers'], ['Torso', 'Wear puffer'], ['Legs', 'Wear boxers']]
  let t0 = 5000
  let parte = null
  for (const [p, prop] of pasos) {
    if (p !== parte) { acciones.push([t0, async (t) => { await irClic(ctx, m, t, { aria: p }, { pausa: 200 }) }]); t0 += 900; parte = p }
    acciones.push([t0, async (t) => { await irClic(ctx, m, t, { aria: prop }, { pausa: 220 }) }])
    t0 += 1700
  }
  acciones.push([t0, async (t) => { const a = m.ir(t, 700, 600, 600); m.bajar(a + 60); m.ir(a + 80, 1250, 580, 1600); m.soltar(a + 1700) }])
  await correr(ctx, 'props', t0 + 3200, { m, acciones })
}

// Wallpaper 4K: texto gigante, stickers, girar, cara.
SHOTS.wallpaper2 = async () => {
  const ctx = await mundo({ skulley_accesorios: JSON.stringify({ lentes: true, hoodie: true, pantalones: true, botas: true }), skulley_active_skin: 'base' })
  const m = new Raton(ctx, 1150, 560, 51)
  const escribe = (texto, t0, cada = 110) => [...texto].map((c, i) => [t0 + i * cada, async () => { await ctx.client.send('Input.insertText', { text: c }) }])
  const acciones = [
    [300, async (t) => { await irClic(ctx, m, t, { aria: 'Customize character' }) }],
    [3500, async (t) => { await irClic(ctx, m, t, { texto: 'Wallpaper 4K' }) }],
    [6200, async (t) => { await irClic(ctx, m, t, { sel: '.dwp-cap--riel button', aria: 'Text' }) }],
    ...escribe('RAD', 7400, 260),
    [10000, async (t) => { await irClic(ctx, m, t, { sel: '.dwp-cap--riel button', aria: 'Sticker' }) }],
    [11400, async (t) => { await irClic(ctx, m, t, { sel: '.dwp-miniatura', aria: 'Sticker 1' }) }],
    [12600, async (t) => { await irClic(ctx, m, t, { sel: '.dwp-miniatura', aria: 'Sticker 3' }) }],
    [13800, async (t) => { await irClic(ctx, m, t, { sel: '.dwp-miniatura', aria: 'Sticker 2' }) }],
    [15200, async (t) => {
      const r = await busca(ctx, { sel: '.dwp-sticker' })
      if (!r) return
      const a = m.ir(t, r.x, r.y, 600); m.bajar(a + 80); m.ir(a + 100, r.x - 520, r.y - 260, 900); m.soltar(a + 1100)
    }],
    [17200, async (t) => { await irClic(ctx, m, t, { sel: '.dwp-cap--riel button', aria: 'Rotate' }) }],
    [18400, async (t) => {
      const r = await busca(ctx, { sel: '.dwp-escenario' })
      if (!r) return
      const a = m.ir(t, r.x - 150, r.y, 600); m.bajar(a + 60); m.ir(a + 80, r.x + 320, r.y + 10, 1500); m.soltar(a + 1650)
    }],
    [21500, async (t) => { await irClic(ctx, m, t, { sel: '.dwp-chip', texto: 'Face' }) }],
  ]
  await correr(ctx, 'wallpaper2', 25500, { m, acciones })
}

SHOTS.wallpaper3 = async () => {
  const ctx = await mundo({ skulley_accesorios: JSON.stringify({ lentes: true, hoodie: true, pantalones: true, botas: true }), skulley_active_skin: 'base' })
  const m = new Raton(ctx, 1150, 560, 51)
  const escribe = (texto, t0, cada = 110) => [...texto].map((c, i) => [t0 + i * cada, async () => { await ctx.client.send('Input.insertText', { text: c }) }])
  const acciones = [
    [300, async (t) => { await irClic(ctx, m, t, { aria: 'Customize character' }) }],
    [3500, async (t) => { await irClic(ctx, m, t, { texto: 'Wallpaper 4K' }) }],
    [6200, async (t) => { await irClic(ctx, m, t, { sel: '.dwp-cap--riel button', aria: 'Text' }) }],
    [7300, async () => { await ctx.page.evaluate(() => { const e = document.querySelector('.dwp-texto'); if (e) { e.focus(); e.select?.() } }) }],
    ...escribe('RAD', 7600, 260),
    [10000, async (t) => { await irClic(ctx, m, t, { sel: '.dwp-cap--riel button', aria: 'Sticker' }) }],
    [11400, async (t) => { await irClic(ctx, m, t, { sel: '.dwp-miniatura', aria: 'Sticker 1' }) }],
    [12600, async (t) => { await irClic(ctx, m, t, { sel: '.dwp-miniatura', aria: 'Sticker 3' }) }],
    [13800, async (t) => { await irClic(ctx, m, t, { sel: '.dwp-miniatura', aria: 'Sticker 2' }) }],
    [15200, async (t) => {
      const r = await busca(ctx, { sel: '.dwp-sticker' })
      if (!r) return
      const a = m.ir(t, r.x, r.y, 600); m.bajar(a + 80); m.ir(a + 100, r.x - 520, r.y - 260, 900); m.soltar(a + 1100)
    }],
    [17200, async (t) => { await irClic(ctx, m, t, { sel: '.dwp-cap--riel button', aria: 'Rotate' }) }],
    [18400, async (t) => {
      const r = await busca(ctx, { sel: '.dwp-escenario' })
      if (!r) return
      const a = m.ir(t, r.x - 150, r.y, 600); m.bajar(a + 60); m.ir(a + 80, r.x + 320, r.y + 10, 1500); m.soltar(a + 1650)
    }],
    [21500, async (t) => { await irClic(ctx, m, t, { sel: '.dwp-chip', texto: 'Face' }) }],
  ]
  await correr(ctx, 'wallpaper3', 25500, { m, acciones })
}

// El rayo de la esfera corrupta lo despedaza.
async function tomaRayo(nombre, props) {
  const ctx = await mundo(props ? { skulley_accesorios: JSON.stringify(props) } : {})
  const m = new Raton(ctx, 1250, 640, 61)
  for (let i = 0; i < 8; i++) m.ruedaEn(200 + i * 120, -100)
  const keys = teclado(ctx, [[1500, 2600, 'a'], [1500, 2600, 'Shift']])
  const acciones = [
    [3400, async () => { await enSkulley(ctx, 'antimatter-orb-strike'); await enSkulley(ctx, 'bolt-strike'); await enSkulley(ctx, 'bolt-ground-impact') }],
  ]
  await correr(ctx, nombre, 11500, { m, keys, acciones, ocultar: UI_FUERA + 'img[src*="hand-"]{display:none!important}' })
}
SHOTS.rayo = () => tomaRayo('rayo')
SHOTS.rayo_boxers = () => tomaRayo('rayo_boxers', { lentes: true, boxers: true })
SHOTS.rayo_ropa = () => tomaRayo('rayo_ropa', { lentes: true, hoodie: true, pantalones: true, botas: true })

// Argus lo empuja y lo parte.
SHOTS.argus = async () => {
  const ctx = await mundo()
  const m = new Raton(ctx, 1250, 640, 71)
  for (let i = 0; i < 6; i++) m.ruedaEn(200 + i * 120, -100)
  let soltado = false
  const keys = async (t) => {
    if (t > 1500 && t < 1520) await tecla(ctx, 'w', 'down')
    if (!soltado && t > 1600) {
      const z = await ctx.page.evaluate(() => window.__laserDbg().player[2])
      if (z > 9.6) { soltado = true; await tecla(ctx, 'w', 'up'); await ctx.page.evaluate(() => window.__argusPush()) }
    }
  }
  await correr(ctx, 'argus', 10000, { m, keys, ocultar: UI_FUERA + 'img[src*="hand-"]{display:none!important}' })
}

// Las viñetas: el chiste del McDonald's.
SHOTS.vinetas = async () => {
  const ctx = await mundo({ skulley_accesorios: JSON.stringify({ lentes: true }) })
  const m = new Raton(ctx, 1250, 640, 81)
  for (let i = 0; i < 10; i++) m.ruedaEn(150 + i * 100, -100)
  const say = (idx) => ctx.page.evaluate((i) => window.dispatchEvent(new CustomEvent('speech-bubble-override', { detail: { phrasesKey: 'portrait.phrases', idx: i, durationMs: 7200 } })), idx)
  const acciones = [[1800, () => say(7)], [10400, () => say(8)]]
  await correr(ctx, 'vinetas', 18500, { m, acciones, ocultar: UI_FUERA + 'img[src*="hand-"]{display:none!important}' })
}

// Easter egg: cinco clics al retrato.
SHOTS.egg = async () => {
  const ctx = await mundo()
  const m = new Raton(ctx, 900, 600, 91)
  const acciones = [[400, async (t) => {
    const r = await busca(ctx, { sel: '[data-portrait-root] [aria-label="Character portrait"]', aria: 'Character portrait' })
    if (!r) { console.log('sin retrato'); return }
    const a = m.ir(t, r.x - 10, r.y - 30, 900)
    for (let i = 0; i < 5; i++) m.clic(a + 200 + i * 330)
  }]]
  await correr(ctx, 'egg', 12000, { m, acciones })
}

// Cuando aparezca `q`, mueve el mouse y dale clic (se revisa cada cuadro).
function cuandoAparezca(ctx, m, q, opciones = {}) {
  let hecho = false
  return async (t) => {
    if (hecho) return
    const r = await busca(ctx, q)
    if (!r) return
    hecho = true
    await irClic(ctx, m, t, q, opciones)
  }
}

// Modo arcade: Argus, el trato, las reglas y la partida (aciertos simulados
// con el mismo módulo del juego para que el HUD llegue a racha y fiebre).
SHOTS.arcade = async () => {
  const ctx = await mundo({ skulley_accesorios: JSON.stringify({ lentes: true }) })
  const m = new Raton(ctx, 1200, 640, 101)
  let inicio = null
  const dialogo = cuandoAparezca(ctx, m, { sel: '[aria-label="Argus dialog"] button.argus-btn--primary' }, { pausa: 500 })
  const reglas = cuandoAparezca(ctx, m, { sel: '[aria-label="Sphere game rules"] button.argus-btn--primary' }, { pausa: 600 })
  const acierto = (base, tamano) => ctx.page.evaluate(async (base, tamano) => {
    const J = await import('/src/lib/juegoEsferas.js')
    const S = await import('/src/lib/scoreStore.js')
    const r = J.capturar({ base, tamano })
    S.scoreStore.add(r.puntos)
    return r
  }, base, tamano)
  const golpes = [0, 1300, 2400, 3300, 4300, 5100, 5900, 6700, 7400, 8100, 9300, 10200, 11000, 11800]
  const tam = ['mediana', 'chica', 'mediana', 'grande', 'chica', 'mediana', 'mediana', 'chica', 'grande', 'chica', 'mediana', 'chica', 'mediana', 'chica']
  let k = 0
  let plan = null
  const cada = async (t) => {
    await dialogo(t)
    await reglas(t)
    if (inicio == null) {
      const activo = await ctx.page.evaluate(async () => (await import('/src/lib/juegoEsferas.js')).juego.activo)
      if (activo) {
        inicio = t
        console.log('arranca la partida en', t)
        plan = teclado(ctx, [
          [t + 600, t + 2000, 'w'], [t + 600, t + 2600, 'Shift'], [t + 1500, t + 2600, 'd'],
          [t + 3200, t + 4400, ' '], [t + 5200, t + 6500, 'e'], [t + 7000, t + 8600, 's'], [t + 7600, t + 8600, 'a'],
          [t + 9000, t + 10300, 'e'], [t + 11000, t + 12100, ' '], [t + 12600, t + 14200, 'w'], [t + 12600, t + 14200, 'Shift'],
          [t + 14800, t + 16100, 'e'],
        ])
        m.ir(t + 4500, 1350, 380); m.ir(t + 8800, 700, 470); m.ir(t + 14200, 1180, 300)
      }
    }
    if (plan) await plan(t)
    while (inicio != null && k < golpes.length && t >= inicio + 2500 + golpes[k]) {
      const base = { chica: 100, mediana: 30, grande: 5 }[tam[k]]
      await acierto(base, tam[k]); k++
    }
  }
  const acciones = [[700, async (t) => { const a = m.ir(t, 962, 205); m.clic(a + 400) }]]
  await correr(ctx, 'arcade', 34000, { m, acciones, keys: cada })
}

// Close-ups en tercera persona, con skin.
async function tomaCerca(nombre, storage) {
  const ctx = await mundo({ cameraMode: 'third-person', ...storage })
  const m = new Raton(ctx, 1100, 560, 111)
  for (let i = 0; i < 7; i++) m.ruedaEn(300 + i * 140, -100)
  const acciones = [
    [1800, async (t) => { const a = m.ir(t, 760, 560, 700); m.bajar(a + 60); m.ir(a + 80, 1260, 600, 3800); m.soltar(a + 3900) }],
    [7200, async (t) => { const a = m.ir(t, 1300, 520, 600); m.bajar(a + 60); m.ir(a + 80, 820, 470, 3600); m.soltar(a + 3700) }],
  ]
  await correr(ctx, nombre, 12500, { m, acciones, ocultar: UI_FUERA + 'img[src*="hand-"]{display:none!important}' })
}
SHOTS.cerca_base = () => tomaCerca('cerca_base', {})
SHOTS.cerca_inferno = () => tomaCerca('cerca_inferno', { skulley_active_skin: 'lava', skulley_inferno_color: 'rojo' })
SHOTS.cerca_azul = () => tomaCerca('cerca_azul', { skulley_active_skin: 'lava', skulley_inferno_color: 'azul', skulley_accesorios: JSON.stringify({ lentes: true, hoodie: true, pantalones: true, botas: true }) })
SHOTS.cerca_polter = () => tomaCerca('cerca_polter', { skulley_active_skin: 'poltergeist' })
SHOTS.cerca_oro = () => tomaCerca('cerca_oro', { skulley_active_skin: 'gold' })
SHOTS.cerca_holo = () => tomaCerca('cerca_holo', { skulley_active_skin: 'hologram', skulley_accesorios: JSON.stringify({ lentes: true, chamarra: true, pantalones: true, tenis: true }) })

// Secciones del sitio desde la barra de abajo.
async function tomaSeccion(nombre, etiqueta) {
  const ctx = await mundo()
  const m = new Raton(ctx, 1100, 600, 121)
  const acciones = [[500, async (t) => { await irClic(ctx, m, t, { sel: 'button,a', texto: etiqueta }) }]]
  for (let i = 0; i < 14; i++) acciones.push([7000 + i * 280, async (t) => { m.ruedaEn(t, 120) }])
  acciones.push([6200, async (t) => { m.ir(t, 1150, 640, 800) }])
  await correr(ctx, nombre, 13500, { m, acciones })
}
SHOTS.sec_work = () => tomaSeccion('sec_work', 'WORK')
SHOTS.sec_about = () => tomaSeccion('sec_about', 'ABOUT')
SHOTS.sec_store = () => tomaSeccion('sec_store', 'STORE')

// Versión de teléfono (1080 × 1920): la primera pantalla, el scroll que lo
// desarma y el personalizador.
async function telefono(storage = {}) {
  const ctx = await abrir({ ruta: '/', width: 540, height: 960, dsf: 2, mobile: true, storage: { lang: 'en', ...SIN_LENTES, ...storage } })
  await esperar(ctx, () => !!document.querySelector('.msh-audio') && !!document.querySelector('canvas'), { timeout: 150000 })
  // Con el servidor recién prendido Skulley tarda más que eso: esperar a que exista.
  await esperar(ctx, () => (window.__lentes || []).length > 0, { timeout: 150000 })
  await sleep(6000)
  return ctx
}
const jsClic = (ctx, sel) => ctx.page.evaluate((s) => { const e = document.querySelector(s); if (e) { e.focus?.(); e.click() } return !!e }, sel)

SHOTS.tel_scroll = async () => {
  const ctx = await telefono()
  const acciones = [[3500, async () => { console.log('sin audio', await jsClic(ctx, '.msh-audio .msh-btn--vidrio:not(.msh-btn--con-audio)')) }]]
  // Scroll suave de arriba abajo (Skulley se desarma con el scroll).
  const keys = async (t) => {
    if (t < 5000) return
    const p = Math.min(1, (t - 5000) / 14000)
    const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2
    await ctx.page.evaluate((f) => { const s = document.querySelector('.msh-scroller'); if (s) s.scrollTop = f * (s.scrollHeight - s.clientHeight) }, e)
  }
  await correr(ctx, 'tel_scroll', 20500, { acciones, keys })
}

SHOTS.tel_custom = async () => {
  const ctx = await telefono({ goldSkinUnlocked: '1' })
  const acciones = [
    [300, async () => { await jsClic(ctx, '.msh-audio .msh-btn--vidrio:not(.msh-btn--con-audio)') }],
    [1500, async () => { console.log('personalizar', await jsClic(ctx, 'button[aria-label="Customize character"]')) }],
  ]
  const skins = await (async () => ['slime', 'void', 'oilslick', 'gold', 'base'])()
  skins.forEach((s, i) => acciones.push([4500 + i * 1700, async () => {
    const ok = await ctx.page.evaluate((i) => { const b = document.querySelectorAll('.mcz-skins button'); if (b[i]) { b[i].click(); return b.length } return 0 }, i + 1)
    if (!i) console.log('chips', ok)
  }]))
  acciones.push([13500, async () => { await jsClic(ctx, '.mcz-dado') }])
  acciones.push([15000, async () => { await jsClic(ctx, '.mcz-dado') }])
  await correr(ctx, 'tel_custom', 17500, { acciones })
}

// Close-ups de la cara con el encuadre "Face" del wallpaper, por skin.
async function tomaCara(nombre, storage) {
  const ctx = await mundo(storage)
  const m = new Raton(ctx, 1150, 560, 131)
  const acciones = [
    [300, async (t) => { await irClic(ctx, m, t, { aria: 'Customize character' }) }],
    [3300, async (t) => { await irClic(ctx, m, t, { texto: 'Wallpaper 4K' }) }],
    [5600, async (t) => { await irClic(ctx, m, t, { sel: '.dwp-chip', texto: 'Face' }) }],
    [7000, async (t) => {
      const r = await busca(ctx, { sel: '.dwp-escenario' })
      if (!r) return
      m.ir(t, r.x + 40, r.y - 60, 900)
      for (let i = 0; i < 10; i++) m.ruedaEn(t + 1200 + i * 260, -60)
    }],
    [11000, async (t) => { m.ir(t, 1700, 980, 1200) }],
  ]
  await correr(ctx, nombre, 15000, { m, acciones })
}
SHOTS.cara_base = () => tomaCara('cara_base', {})
SHOTS.cara_inferno = () => tomaCara('cara_inferno', { skulley_active_skin: 'lava', skulley_inferno_color: 'rojo' })
SHOTS.cara_polter = () => tomaCara('cara_polter', { skulley_active_skin: 'poltergeist', skulley_accesorios: JSON.stringify({ lentes: false }) })
SHOTS.cara_oro = () => tomaCara('cara_oro', { skulley_active_skin: 'gold' })
SHOTS.cara_holo = () => tomaCara('cara_holo', { skulley_active_skin: 'hologram', skulley_accesorios: JSON.stringify({ lentes: true, chamarra: true }) })
SHOTS.cara_azul = () => tomaCara('cara_azul', { skulley_active_skin: 'lava', skulley_inferno_color: 'azul', skulley_accesorios: JSON.stringify({ lentes: false, hoodie: true }) })

// Sin grabar: solo avanza el reloj (para probar guiones rápido).
async function seco(ctx, dur, cada) {
  for (let t = 0; t < dur; t += 1000 / 60) {
    await ctx.page.evaluate(async () => { await window.__vt.step(1000 / 60) })
    await cada(t)
  }
}

SHOTS.prueba_jugador = async () => {
  const ctx = await mundo()
  console.log('instalar', await instalar(ctx))
  const m = new Raton(ctx, 1200, 640, 7)
  for (let i = 0; i < 5; i++) m.ruedaEn(200 + i * 120, -100)
  const j = new Jugador(ctx, m)
  const e0 = await ctx.page.evaluate(() => window.__vid.estado())
  console.log(JSON.stringify({ p: e0.p, f: e0.f, argus: e0.argus, portales: e0.portales, orbs: e0.orbs.map((o) => [o.i, o.color, o.x.toFixed(1), o.y.toFixed(2), o.z.toFixed(1), o.r, o.malo, Math.hypot(o.vx, o.vz).toFixed(2)]) }))
  let ult = 0
  await seco(ctx, Number(process.env.DUR || 40000), async (t) => {
    await m.aplicar(t)
    if (t > 1200) await j.paso(t)
    if (t - ult > 1000) {
      ult = t
      const e = j.ultimo
      if (e) console.log(Math.round(t), 'p', e.p.map((v) => v.toFixed(1)).join(','), 'fase', j.fase, 'carga', e.charge.toFixed(2))
    }
  })
  console.log('errores', ctx.errores.filter((e) => !/privy|403/i.test(e)).slice(0, 6))
  await cerrar(ctx)
}

// El juego de esferas de verdad: Skulley mete esferas en el portal de su
// color (jugador automático), con dos bolas de fuego a las esferas.
async function tomaJuego(nombre, { dur = 38000, zoom = 5, disparos = [], ocultar = UI_FUERA, storage = {}, antes } = {}) {
  const ctx = await mundo(storage)
  console.log('instalar', await instalar(ctx))
  const m = new Raton(ctx, 1200, 640, 17)
  for (let i = 0; i < zoom; i++) m.ruedaEn(150 + i * 120, -100)
  const j = new Jugador(ctx, m, { disparos })
  await correr(ctx, nombre, dur, { m, ocultar, keys: async (t) => { if (antes) await antes(t, j); if (t > 900) await j.paso(t) } })
  console.log('pateadas', j.pateadas)
}
SHOTS.juego2 = () => tomaJuego('juego2', { disparos: [[14000, 700], [29000, 800]] })

// Modo arcade de verdad: el trato de Argus, las reglas y la partida jugada
// por el jugador automático (cada acierto es una esfera que entró).
SHOTS.arcade2 = async () => {
  const ctx = await mundo()
  console.log('instalar', await instalar(ctx))
  const m = new Raton(ctx, 1200, 640, 103)
  const dialogo = cuandoAparezca(ctx, m, { sel: '[aria-label="Argus dialog"] button.argus-btn--primary' }, { pausa: 500 })
  const reglas = cuandoAparezca(ctx, m, { sel: '[aria-label="Sphere game rules"] button.argus-btn--primary' }, { pausa: 600 })
  const j = new Jugador(ctx, m)
  let inicio = null
  const keys = async (t) => {
    if (inicio == null) {
      await dialogo(t)
      await reglas(t)
      const activo = await ctx.page.evaluate(async () => (await import('/src/lib/juegoEsferas.js')).juego.activo)
      if (activo) {
        inicio = t
        console.log('arranca la partida en', Math.round(t))
        for (let i = 0; i < 5; i++) m.ruedaEn(t + 200 + i * 120, -100)
      }
      return
    }
    if (t > inicio + 1000) await j.paso(t)
  }
  const acciones = [[700, async (t) => { const a = m.ir(t, 962, 205); m.clic(a + 400) }]]
  await correr(ctx, 'arcade2', Number(process.env.DUR || 62000), { m, acciones, keys })
  console.log('pateadas', j.pateadas)
}

// Customize de frente: entra, Randomize con el vórtice, todas las skins y al
// final una vuelta completa arrastrando (598 px = 360°).
SHOTS.customize2 = async () => {
  const ctx = await mundo()
  const m = new Raton(ctx, 1150, 560, 33)
  const acciones = [
    [300, async (t) => { await irClic(ctx, m, t, { aria: 'Customize character' }) }],
    [4200, async (t) => { await irClic(ctx, m, t, { aria: 'Randomize' }) }],
    [6000, async (t) => { await irClic(ctx, m, t, { aria: 'Randomize' }, { pausa: 200 }) }],
    [7500, async (t) => { await irClic(ctx, m, t, { aria: 'Randomize' }, { pausa: 200 }) }],
  ]
  const skins = ['Legendary Gold', 'Oil Slick', 'Hologram', 'Void', 'Green Slime', 'Pixel Art', 'Inferno', 'BLUE', 'Poltergeist', 'Custom']
  let t0 = 9500
  for (const sk of skins) {
    const q = sk === 'BLUE' ? { texto: 'Blue', sel: '[aria-label="Flame color"] button' } : { aria: sk }
    acciones.push([t0, async (t) => { await irClic(ctx, m, t, q, { pausa: 250 }) }])
    t0 += sk === 'Inferno' ? 1900 : 1500
  }
  acciones.push([t0 + 200, async (t) => { const a = m.ir(t, 640, 600, 600); m.bajar(a + 60); m.ir(a + 80, 640 + 598, 590, 1700); m.soltar(a + 1850) }])
  await correr(ctx, 'customize2', t0 + 3400, { m, acciones })
}

// Props de frente: el guardarropa por partes; los lentes una sola vez.
SHOTS.props2 = async () => {
  const ctx = await mundo()
  const m = new Raton(ctx, 1150, 560, 43)
  const acciones = [
    [300, async (t) => { await irClic(ctx, m, t, { aria: 'Customize character' }) }],
    [3600, async (t) => { await irClic(ctx, m, t, { sel: '#cc-pestana-props' }) }],
  ]
  const pasos = [['Torso', 'Wear hoodie'], ['Legs', 'Wear jeans'], ['Feet', 'Wear sneakers'], ['Torso', 'Wear jacket'], ['Feet', 'Wear boots'], ['Head', 'Wear sunglasses'], ['Torso', 'Wear puffer'], ['Legs', 'Wear boxers']]
  let t0 = 5000
  let parte = null
  for (const [pt, prop] of pasos) {
    if (pt !== parte) { acciones.push([t0, async (t) => { await irClic(ctx, m, t, { aria: pt }, { pausa: 200 }) }]); t0 += 1400; parte = pt }
    acciones.push([t0, async (t) => { await irClic(ctx, m, t, { aria: prop }, { pausa: 220 }) }])
    t0 += 1500
  }
  acciones.push([t0 + 300, async (t) => { const a = m.ir(t, 640, 600, 600); m.bajar(a + 60); m.ir(a + 80, 640 + 598, 590, 1700); m.soltar(a + 1850) }])
  await correr(ctx, 'props2', t0 + 3600, { m, acciones })
}

SHOTS.wallpaper4 = async () => {
  const ctx = await mundo({ skulley_accesorios: JSON.stringify({ lentes: false, hoodie: true, pantalones: true, botas: true }), skulley_active_skin: 'base' })
  const m = new Raton(ctx, 1150, 560, 53)
  const escribe = (texto, t0, cada = 110) => [...texto].map((c, i) => [t0 + i * cada, async () => { await ctx.client.send('Input.insertText', { text: c }) }])
  const acciones = [
    [300, async (t) => { await irClic(ctx, m, t, { aria: 'Customize character' }) }],
    [3500, async (t) => { await irClic(ctx, m, t, { texto: 'Wallpaper 4K' }) }],
    [6200, async (t) => { await irClic(ctx, m, t, { sel: '.dwp-cap--riel button', aria: 'Text' }) }],
    [7300, async () => { await ctx.page.evaluate(() => { const e = document.querySelector('.dwp-texto'); if (e) { e.focus(); e.select?.() } }) }],
    ...escribe('RAD', 7600, 260),
    [10000, async (t) => { await irClic(ctx, m, t, { sel: '.dwp-cap--riel button', aria: 'Sticker' }) }],
    [11400, async (t) => { await irClic(ctx, m, t, { sel: '.dwp-miniatura', aria: 'Sticker 1' }) }],
    [12600, async (t) => { await irClic(ctx, m, t, { sel: '.dwp-miniatura', aria: 'Sticker 3' }) }],
    [13800, async (t) => { await irClic(ctx, m, t, { sel: '.dwp-miniatura', aria: 'Sticker 2' }) }],
    [15200, async (t) => {
      const r = await busca(ctx, { sel: '.dwp-sticker' })
      if (!r) return
      const a = m.ir(t, r.x, r.y, 600); m.bajar(a + 80); m.ir(a + 100, r.x - 520, r.y - 260, 900); m.soltar(a + 1100)
    }],
    [17200, async (t) => { await irClic(ctx, m, t, { sel: '.dwp-cap--riel button', aria: 'Rotate' }) }],
    [18400, async (t) => {
      const r = await busca(ctx, { sel: '.dwp-escenario' })
      if (!r) return
      const a = m.ir(t, r.x - 300, r.y, 600); m.bajar(a + 60); m.ir(a + 80, r.x + 298, r.y + 10, 1700); m.soltar(a + 1850)
    }],
    [21800, async (t) => { await irClic(ctx, m, t, { sel: '.dwp-chip', texto: 'Face' }) }],
  ]
  await correr(ctx, 'wallpaper4', 26000, { m, acciones })
}

SHOTS.wallpaper5 = async () => {
  const ctx = await mundo({ skulley_accesorios: JSON.stringify({ lentes: false, hoodie: true, pantalones: true, botas: true }), skulley_active_skin: 'base' })
  const m = new Raton(ctx, 1150, 560, 53)
  const escribe = (texto, t0, cada = 110) => [...texto].map((c, i) => [t0 + i * cada, async () => {
    const ok = await ctx.page.evaluate((primero) => { const e = document.querySelector('.dwp-texto'); if (!e) return false; if (document.activeElement !== e) e.focus(); if (primero) e.select?.(); return true }, i === 0)
    if (!ok) console.log('sin campo de texto', c)
    await ctx.client.send('Input.insertText', { text: c })
  }])
  const acciones = [
    [300, async (t) => { await irClic(ctx, m, t, { aria: 'Customize character' }) }],
    [3500, async (t) => { await irClic(ctx, m, t, { texto: 'Wallpaper 4K' }) }],
    [6200, async (t) => { await irClic(ctx, m, t, { sel: '.dwp-cap--riel button', aria: 'Text' }) }],
    ...escribe('RAD', 8000, 260),
    [10000, async (t) => { await irClic(ctx, m, t, { sel: '.dwp-cap--riel button', aria: 'Sticker' }) }],
    [11400, async (t) => { await irClic(ctx, m, t, { sel: '.dwp-miniatura', aria: 'Sticker 1' }) }],
    [12600, async (t) => { await irClic(ctx, m, t, { sel: '.dwp-miniatura', aria: 'Sticker 3' }) }],
    [13800, async (t) => { await irClic(ctx, m, t, { sel: '.dwp-miniatura', aria: 'Sticker 2' }) }],
    [15200, async (t) => {
      const r = await busca(ctx, { sel: '.dwp-sticker' })
      if (!r) return
      const a = m.ir(t, r.x, r.y, 600); m.bajar(a + 80); m.ir(a + 100, r.x - 520, r.y - 260, 900); m.soltar(a + 1100)
    }],
    [17200, async (t) => { await irClic(ctx, m, t, { sel: '.dwp-cap--riel button', aria: 'Rotate' }) }],
    [18400, async (t) => {
      const r = await busca(ctx, { sel: '.dwp-escenario' })
      if (!r) return
      const a = m.ir(t, r.x - 300, r.y, 600); m.bajar(a + 60); m.ir(a + 80, r.x + 298, r.y + 10, 1700); m.soltar(a + 1850)
    }],
    [21800, async (t) => { await irClic(ctx, m, t, { sel: '.dwp-chip', texto: 'Face' }) }],
  ]
  await correr(ctx, 'wallpaper5', 26000, { m, acciones })
}

// Como wallpaper5, pero cada sticker se lleva a una esquina del marco en cuanto
// sale (salen al centro, encima de Skulley).
SHOTS.wallpaper6 = async () => {
  const ctx = await mundo({ skulley_accesorios: JSON.stringify({ lentes: false, hoodie: true, pantalones: true, botas: true }), skulley_active_skin: 'base' })
  const m = new Raton(ctx, 1150, 560, 57)
  const escribe = (texto, t0, cada = 110) => [...texto].map((c, i) => [t0 + i * cada, async () => {
    const ok = await ctx.page.evaluate((primero) => { const e = document.querySelector('.dwp-texto'); if (!e) return false; if (document.activeElement !== e) e.focus(); if (primero) e.select?.(); return true }, i === 0)
    if (!ok) console.log('sin campo de texto', c)
    await ctx.client.send('Input.insertText', { text: c })
  }])
  // El sticker más cerca del centro del marco (los nuevos salen ahí, encimados).
  const ultimo = () => ctx.page.evaluate(() => {
    const m = document.querySelector('.dwp-escenario')?.getBoundingClientRect()
    const els = [...document.querySelectorAll('.dwp-sticker')]
    if (!m || !els.length) return null
    const cx = m.x + m.width / 2, cy = m.y + m.height / 2
    let mejor = null
    for (const e of els) {
      const r = e.getBoundingClientRect()
      const x = r.x + r.width / 2, y = r.y + r.height / 2
      const d = Math.hypot(x - cx, y - cy)
      if (!mejor || d < mejor.d) mejor = { x, y, d, n: els.length }
    }
    return mejor
  })
  const aEsquina = (fx, fy) => async (t) => {
    const s = await ultimo()
    const r = await busca(ctx, { sel: '.dwp-escenario' })
    if (!s || !r) { console.log('sin sticker o marco'); return }
    const a = m.ir(t, s.x, s.y, 550); m.bajar(a + 80)
    m.ir(a + 100, r.x + fx * r.w, r.y + fy * r.h, 800); m.soltar(a + 1000)
    console.log('sticker', s.n, '→', fx, fy)
  }
  const acciones = [
    [300, async (t) => { await irClic(ctx, m, t, { aria: 'Customize character' }) }],
    [3500, async (t) => { await irClic(ctx, m, t, { texto: 'Wallpaper 4K' }) }],
    [6200, async (t) => { await irClic(ctx, m, t, { sel: '.dwp-cap--riel button', aria: 'Text' }) }],
    ...escribe('RAD', 8000, 260),
    [10000, async (t) => { await irClic(ctx, m, t, { sel: '.dwp-cap--riel button', aria: 'Sticker' }) }],
    [11400, async (t) => { await irClic(ctx, m, t, { sel: '.dwp-miniatura', aria: 'Sticker 1' }) }],
    [12600, async (t) => { await irClic(ctx, m, t, { sel: '.dwp-miniatura', aria: 'Sticker 3' }) }],
    [13800, async (t) => { await irClic(ctx, m, t, { sel: '.dwp-miniatura', aria: 'Sticker 2' }) }],
    [15200, aEsquina(-0.37, -0.29)],
    [16900, aEsquina(0.37, -0.29)],
    [18600, aEsquina(-0.37, 0.27)],
    [20300, async (t) => { await irClic(ctx, m, t, { sel: '.dwp-cap--riel button', aria: 'Rotate' }) }],
    [21500, async (t) => {
      const r = await busca(ctx, { sel: '.dwp-escenario' })
      if (!r) return
      const a = m.ir(t, r.x - 300, r.y, 600); m.bajar(a + 60); m.ir(a + 80, r.x + 298, r.y + 10, 1700); m.soltar(a + 1850)
    }],
    [25000, async (t) => { await irClic(ctx, m, t, { sel: '.dwp-chip', texto: 'Face' }) }],
  ]
  await correr(ctx, 'wallpaper6', 29500, { m, acciones })
}

SHOTS.vinetas2 = async () => {
  const ctx = await mundo()
  const m = new Raton(ctx, 1250, 640, 83)
  for (let i = 0; i < 10; i++) m.ruedaEn(150 + i * 100, -100)
  const say = (idx) => ctx.page.evaluate((i) => window.dispatchEvent(new CustomEvent('speech-bubble-override', { detail: { phrasesKey: 'portrait.phrases', idx: i, durationMs: 7200 } })), idx)
  const acciones = [[1800, () => say(7)], [10400, () => say(8)]]
  await correr(ctx, 'vinetas2', 18500, { m, acciones, ocultar: UI_FUERA + 'img[src*="hand-"]{display:none!important}' })
}
SHOTS.rayo2 = () => tomaRayo('rayo2')

SHOTS.argus2 = async () => {
  const ctx = await mundo()
  const m = new Raton(ctx, 1250, 640, 73)
  for (let i = 0; i < 6; i++) m.ruedaEn(200 + i * 120, -100)
  let soltado = false
  const keys = async (t) => {
    if (t > 1500 && t < 1520) await tecla(ctx, 'w', 'down')
    if (!soltado && t > 1600) {
      const z = await ctx.page.evaluate(() => window.__laserDbg().player[2])
      if (z > 9.6) { soltado = true; await tecla(ctx, 'w', 'up'); await ctx.page.evaluate(() => window.__argusPush()) }
    }
  }
  await correr(ctx, 'argus2', 10000, { m, keys, ocultar: UI_FUERA + 'img[src*="hand-"]{display:none!important}' })
}

const lista = process.argv.slice(2)
for (const nombre of lista) {
  if (!SHOTS[nombre]) { console.log('tomas:', Object.keys(SHOTS).join(', ')); process.exit(1) }
}
for (const nombre of lista) {
  console.log('== toma', nombre)
  try { await SHOTS[nombre]() } catch (e) { console.log('falló', nombre, e.message) }
}

