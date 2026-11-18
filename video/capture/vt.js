// Reloj falso para grabar el sitio cuadro por cuadro. Se inyecta antes que
// cualquier script de la página. Arranca en modo "auto" (el reloj sigue al
// tiempo real con el rAF de verdad) para que la página cargue normal; al
// primer `__vt.step(dt)` pasa a manual: el tiempo solo avanza cuando el
// grabador lo pide, así cada cuadro capturado dura exactamente dt aunque
// dibujarlo y capturarlo tarde 200 ms.
//
// Controla performance.now, Date.now, requestAnimationFrame, setTimeout,
// setInterval y las animaciones CSS / Web Animations (las pausa y les avanza
// el currentTime a mano).
(() => {
  if (window.__vt) return
  const RP = performance.now.bind(performance)
  const RD = Date.now.bind(Date)
  const rRAF = window.requestAnimationFrame.bind(window)
  const rMC = typeof MessageChannel !== 'undefined' ? MessageChannel : null

  const vt = {
    t: RP(),
    off: RD() - RP(),
    auto: true,
    last: RP(),
    raf: new Map(),
    rafId: 0,
    timers: new Map(),
    tId: 0,
    frames: 0,
    errors: [],
    rate: 1,
  }
  window.__vt = vt

  const report = (e) => {
    if (vt.errors.length < 200) vt.errors.push(String(e && (e.stack || e.message) || e).slice(0, 600))
  }

  performance.now = () => vt.t
  Date.now = () => Math.round(vt.off + vt.t)

  window.requestAnimationFrame = (cb) => {
    const id = ++vt.rafId
    vt.raf.set(id, cb)
    return id
  }
  window.cancelAnimationFrame = (id) => { vt.raf.delete(id) }

  const addTimer = (fn, ms, args, iv) => {
    const id = 1e7 + (++vt.tId)
    const d = Math.max(0, Number(ms) || 0)
    vt.timers.set(id, { fn, at: vt.t + d, args, iv: iv ? Math.max(1, d) : 0 })
    return id
  }
  window.setTimeout = (fn, ms, ...args) => addTimer(fn, ms, args, false)
  window.setInterval = (fn, ms, ...args) => addTimer(fn, ms, args, true)
  window.clearTimeout = (id) => { vt.timers.delete(id) }
  window.clearInterval = (id) => { vt.timers.delete(id) }

  const fire = (tm) => {
    try {
      if (typeof tm.fn === 'function') tm.fn(...tm.args)
      else (0, eval)(String(tm.fn))
    } catch (e) { report(e) }
  }

  // Avanza el reloj hasta `target` disparando los timers en orden, cada uno
  // con performance.now() en su hora.
  const advanceTo = (target) => {
    let guard = 0
    while (guard++ < 20000) {
      let bestId = 0, best = null
      for (const [id, tm] of vt.timers) {
        if (tm.at <= target && (!best || tm.at < best.at || (tm.at === best.at && id < bestId))) { best = tm; bestId = id }
      }
      if (!best) break
      if (best.at > vt.t) vt.t = best.at
      if (best.iv) best.at += best.iv
      else vt.timers.delete(bestId)
      fire(best)
    }
    vt.t = Math.max(vt.t, target)
  }

  const runRaf = () => {
    const q = vt.raf
    vt.raf = new Map()
    for (const cb of q.values()) {
      try { cb(vt.t) } catch (e) { report(e) }
    }
  }

  const autoLoop = () => {
    if (vt.auto) {
      const now = RP()
      const d = Math.min(100, now - vt.last)
      vt.last = now
      advanceTo(vt.t + d * vt.rate)
      runRaf()
    }
    rRAF(autoLoop)
  }
  rRAF(autoLoop)

  const macrotask = () => new Promise((resolve) => {
    if (!rMC) { Promise.resolve().then(resolve); return }
    const ch = new rMC()
    ch.port1.onmessage = () => { ch.port1.close(); resolve() }
    ch.port2.postMessage(0)
  })

  // Animaciones CSS y Web Animations: las que aparecen se pausan en 0 (nacieron
  // en este cuadro) y después avanzan dt por cuadro. Al llegar al final se
  // terminan con finish() para que disparen animationend / finish.
  const seen = new WeakSet()
  const stepAnims = (dt) => {
    let list
    try { list = document.getAnimations() } catch { return }
    for (const a of list) {
      try {
        if (!seen.has(a)) {
          seen.add(a)
          if (a.playState === 'paused') { a.__vtUser = true; continue }
          a.pause()
          a.currentTime = 0
          a.__vtOwn = true
          continue
        }
        if (!a.__vtOwn || a.__vtUser) continue
        if (a.playState === 'finished' || a.playState === 'idle') continue
        const rate = a.playbackRate || 1
        const next = (Number(a.currentTime) || 0) + dt * rate
        const end = a.effect && a.effect.getComputedTiming ? a.effect.getComputedTiming().endTime : Infinity
        if (rate > 0 && Number.isFinite(end) && next >= end) a.finish()
        else a.currentTime = next
      } catch (e) { report(e) }
    }
  }

  // Un cuadro manual: avanza dt, corre los rAF, deja que React haga commit y
  // avanza las animaciones CSS.
  vt.step = async (dt = 1000 / 60) => {
    if (vt.auto) {
      vt.auto = false
      // Las animaciones que ya corrían se toman desde donde van.
      try {
        for (const a of document.getAnimations()) {
          seen.add(a)
          if (a.playState === 'running') { a.pause(); a.__vtOwn = true } else if (a.playState === 'paused') a.__vtUser = true
        }
      } catch { }
    }
    advanceTo(vt.t + dt)
    runRaf()
    vt.frames++
    await macrotask(); await macrotask(); await macrotask()
    stepAnims(dt)
    return vt.frames
  }

  // Varios cuadros sin capturar (para adelantar esperas).
  vt.skip = async (ms, dt = 1000 / 60) => {
    const n = Math.max(1, Math.round(ms / dt))
    for (let i = 0; i < n; i++) await vt.step(dt)
    return vt.frames
  }

  vt.resume = () => {
    vt.auto = true
    vt.last = RP()
    try {
      for (const a of document.getAnimations()) if (a.__vtOwn && a.playState === 'paused') { a.__vtOwn = false; a.play() }
    } catch { }
  }
})()
