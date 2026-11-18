// Prueba en Node la capa de apartaManos con las muñequeras puestas, como la corre Player: por cuadro,
// restaurar → mixer → aplicar. Da por clip la apertura de cada brazo (grados de arm_stretch respecto a lo
// que dejó el mixer) en cada cuadro y lo más que cambia de un cuadro al siguiente.
//
// Uso (desde la raíz del repo): node scripts/skulley-anim/probar_munequeras.mjs <carpeta> [prendas...]
// <carpeta> trae character.glb, munequeras.glb, correr.glb (y las prendas) sin texturas ni Draco, hechas
// con gltf-transform (GLTFLoader en Node no lee imágenes ni Draco). prendas: chamarra, hoodie, inflada, boxers, pantalones;
// "sin" las deja sin muñequeras (para comparar contra lo que ya hacía la capa con esa ropa).
// Además, con la apertura ya puesta, revisa en cada cuadro TODOS los vértices del tórax, la pelvis y las
// piernas contra la forma de cada muñequera (en el marco de su hueso: el radio más lejano del aro y de los
// picos por cada 2°, sin margen): cuántos cuadros se meten y lo más hondo (cm).
import { createServer } from 'vite'
import fs from 'node:fs'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'

globalThis.navigator ??= { userAgent: 'node' }
// los bóxers pintan su tela en un canvas: aquí basta uno de mentiras
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => new Proxy({}, { get: (o, k) => (k in o ? o[k] : () => {}) }) }) }
const [DIR, ...ARGS] = process.argv.slice(2)
const SIN = ARGS.includes('sin')
const PRENDAS = ARGS.filter((a) => a !== 'sin')
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'error' })
try {
  const acc = await server.ssrLoadModule('/src/lib/accesorios.js')
  const { crearApartaManos } = await server.ssrLoadModule('/src/lib/apartaManos.js')
  const cargar = (f) => new Promise((res, rej) => {
    const b = fs.readFileSync(`${DIR}/${f}`)
    new GLTFLoader().parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '', res, rej)
  })
  const base = await cargar('character.glb')
  const s = SkeletonUtils.clone(base.scene)
  // las prendas antes que las muñequeras, como en Player (ponerMunequeras prepara las mangas ceñidas)
  const poner = { chamarra: acc.ponerChamarra, boxers: acc.ponerBoxers, pantalones: acc.ponerPantalones, hoodie: acc.ponerHoodie, inflada: acc.ponerInflada }
  for (const p of PRENDAS) poner[p](s, await cargar(`${p}.glb`))
  acc.ponerMunequeras(s, await cargar('munequeras.glb'))
  s.updateMatrixWorld(true)
  const raizInv = new THREE.Matrix4().copy(s.matrixWorld).invert()
  const am = crearApartaManos(s, (b) => new THREE.Matrix4().multiplyMatrices(raizInv, b.matrixWorld))
  console.log('perfil', am.lados.map((l) => !!l.perfil), 'puntos del cuerpo', am.cuerpo.reduce((a, g) => a + g.local.length / 3, 0), 'grupos', am.cuerpo.length)
  // forma de cada muñequera en el marco de forearm_twist en reposo (sin escala) y los vértices del cuerpo
  const forma = {}
  for (const k of ['l', 'r']) {
    let sm = null, hueso = null
    s.traverse((o) => { if (o.name === `Egg_Munequera${k.toUpperCase()}`) sm = o; if (o.isBone && o.name === `forearm_twist${k}`) hueso = o })
    const R = new THREE.Matrix4().multiplyMatrices(raizInv, hueso.matrixWorld)
    const t = new THREE.Vector3(), q = new THREE.Quaternion(), e = new THREE.Vector3()
    R.decompose(t, q, e)
    const marco = new THREE.Matrix4().compose(t, q, new THREE.Vector3(1, 1, 1))
    const inv = marco.clone().invert(), post = R.clone().invert().multiply(marco)
    const N = 180, aro = new Float32Array(N), pico = new Float32Array(N)
    const pos = sm.geometry.attributes.position, p = new THREE.Vector3(), loc = []
    let y0 = Infinity, y1 = -Infinity
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i).applyMatrix4(inv)
      const b = Math.min(N - 1, Math.floor((Math.atan2(p.z, p.x) + Math.PI) / (2 * Math.PI) * N))
      loc.push([p.y, Math.hypot(p.x, p.z), b]); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y)
    }
    const placa = (y1 - y0) * 0.3
    for (const [y, r, b] of loc) if (y < y0 + placa || y > y1 - placa) aro[b] = Math.max(aro[b], r)
    let ys0 = Infinity, ys1 = -Infinity
    for (const [y, r, b] of loc) if (r > aro[b] + 0.0002) { pico[b] = Math.max(pico[b], r); ys0 = Math.min(ys0, y); ys1 = Math.max(ys1, y) }
    const hueco = Math.min(...loc.map((v) => v[1]))
    forma[k] = { hueso, post, aro, pico, y0, y1, ys0, ys1, N, hueco }
  }
  const cuerpo = []
  s.traverse((o) => {
    if (!o.isSkinnedMesh || o.userData?.accesorio) return
    const si = o.geometry.attributes.skinIndex, sw = o.geometry.attributes.skinWeight
    for (let i = 0; i < si.count; i++) {
      let m = 0, w = -1
      for (let c = 0; c < 4; c++) if (sw.getComponent(i, c) > w) { w = sw.getComponent(i, c); m = si.getComponent(i, c) }
      if (/^(spine|root|thigh|leg|neck)/.test(o.skeleton.bones[m]?.name || '')) cuerpo.push([o, i])
    }
  })
  console.log('vértices del cuerpo revisados', cuerpo.length)
  // mangas del hoodie y la inflada (lo del brazo de cada lado), para ver que pasen por el hueco
  const mangas = { l: [], r: [] }
  s.traverse((o) => {
    if (!o.isSkinnedMesh || !['hoodie', 'inflada'].includes(o.userData?.accesorio)) return
    const si = o.geometry.attributes.skinIndex, sw = o.geometry.attributes.skinWeight
    const nb = o.skeleton.bones.map((b) => b.name)
    for (const k of ['l', 'r']) {
      const re = new RegExp(`^(arm|forearm|hand).*${k}$`)
      for (let i = 0; i < si.count; i++) {
        let w = 0
        for (let c = 0; c < 4; c++) if (re.test(nb[si.getComponent(i, c)])) w += sw.getComponent(i, c)
        if (w >= 0.5) mangas[k].push([o, i])
      }
    }
  })
  // el cuerpo de las prendas de arriba (lo que no es manga) contra la forma de la muñequera
  const torsoPrenda = []
  s.traverse((o) => {
    if (!o.isSkinnedMesh || !['hoodie', 'inflada', 'chamarra'].includes(o.userData?.accesorio)) return
    const si = o.geometry.attributes.skinIndex, sw = o.geometry.attributes.skinWeight
    const nb = o.skeleton.bones.map((b) => /^(arm|forearm|hand|shoulder)/.test(b.name))
    for (let i = 0; i < si.count; i += 2) {
      let w = 0
      for (let c = 0; c < 4; c++) if (nb[si.getComponent(i, c)]) w += sw.getComponent(i, c)
      if (w < 0.5) torsoPrenda.push([o, i])
    }
  })
  const prendaMetida = () => {
    const out = { l: 0, r: 0 }
    const mundo = torsoPrenda.map(([o, i]) => o.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(o.matrixWorld))
    for (const k of ['l', 'r']) {
      const F = forma[k]
      fw.multiplyMatrices(F.hueso.matrixWorld, F.post); inv.copy(fw).invert()
      for (const w of mundo) {
        pw.copy(w).applyMatrix4(inv)
        if (pw.y < F.y0 || pw.y > F.y1) continue
        const r = Math.hypot(pw.x, pw.z)
        const b = Math.min(F.N - 1, Math.floor((Math.atan2(pw.z, pw.x) + Math.PI) / (2 * Math.PI) * F.N))
        let lim = F.aro[b]
        if (pw.y > F.ys0 && pw.y < F.ys1) lim = Math.max(lim, F.pico[b])
        if (lim - r > out[k]) out[k] = lim - r
      }
    }
    return out
  }
  const mangaMetida = () => {
    const out = { l: 0, r: 0 }
    for (const k of ['l', 'r']) {
      const F = forma[k]
      fw.multiplyMatrices(F.hueso.matrixWorld, F.post); inv.copy(fw).invert()
      for (const [o, i] of mangas[k]) {
        pw.copy(o.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(o.matrixWorld)).applyMatrix4(inv)
        if (pw.y < F.y0 || pw.y > F.y1) continue
        // dentro del aro: más afuera que el hueco y más adentro que su orilla (más lejos es otra cosa)
        const r = Math.hypot(pw.x, pw.z)
        const b = Math.min(F.N - 1, Math.floor((Math.atan2(pw.z, pw.x) + Math.PI) / (2 * Math.PI) * F.N))
        let lim = F.aro[b]
        if (pw.y > F.ys0 && pw.y < F.ys1) lim = Math.max(lim, F.pico[b])
        if (r >= lim) continue
        const d = Math.min(r - F.hueco, lim - r)
        if (d > out[k]) out[k] = d
      }
    }
    return out
  }
  const fw = new THREE.Matrix4(), inv = new THREE.Matrix4(), pw = new THREE.Vector3()
  const metido = () => {
    const out = { l: 0, r: 0 }
    const mundo = cuerpo.map(([o, i]) => o.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(o.matrixWorld))
    for (const k of ['l', 'r']) {
      const F = forma[k]
      fw.multiplyMatrices(F.hueso.matrixWorld, F.post); inv.copy(fw).invert()
      for (const w of mundo) {
        pw.copy(w).applyMatrix4(inv)
        if (pw.y < F.y0 || pw.y > F.y1) continue
        const r = Math.hypot(pw.x, pw.z)
        const b = Math.min(F.N - 1, Math.floor((Math.atan2(pw.z, pw.x) + Math.PI) / (2 * Math.PI) * F.N))
        let lim = F.aro[b]
        if (pw.y > F.ys0 && pw.y < F.ys1) lim = Math.max(lim, F.pico[b])
        if (lim - r > out[k]) out[k] = lim - r
      }
    }
    return out
  }
  const clips = [...base.animations, ...(await cargar('correr.glb')).animations]
  const que = { munequeras: !SIN }
  for (const p of PRENDAS) que[p] = true
  s.userData.cenirMangas?.(que)
  const TRAZA = process.env.TRAZA ? process.env.TRAZA.split('-').map(Number) : null   // TRAZA=60-80: cuadros a detalle
  const HZ = Number(process.env.HZ || 60)   // cuadros por segundo (HZ=30 o 144 para probar otros)
  const dt = 1 / HZ
  for (const clip of clips) {
    const mixer = new THREE.AnimationMixer(s)
    const act = mixer.clipAction(clip)
    act.play()
    const n = Math.round(clip.duration * 2 / dt)
    const serie = { l: [], r: [] }, nec = { l: [], r: [] }, hondo = { l: [], r: [] }, manga = { l: [], r: [] }, prenda = { l: [], r: [] }, costo = []
    const t0 = performance.now()
    for (let f = 0; f < n; f++) {
      am.restaurar()
      mixer.update(dt)
      s.updateMatrixWorld(true)
      const ta = performance.now()
      am.aplicar(dt, que)
      costo.push(performance.now() - ta)
      for (const l of am.lados) {
        const d = Math.abs(l.brazo.quaternion.dot(l.crudo))
        serie[l.s].push(2 * Math.acos(Math.min(1, d)) * 180 / Math.PI)
        nec[l.s].push(Math.max(l.necesita, l.abdPide || 0) * 180 / Math.PI)
      }
      if (TRAZA && clip.name.includes(process.env.TRAZACLIP || 'Walk') && f >= TRAZA[0] && f <= TRAZA[1]) {
        console.log(f, am.lados.map((l) => `${l.s}: aplicada ${(2 * Math.acos(Math.min(1, Math.abs(l.brazo.quaternion.dot(l.crudo)))) * 180 / Math.PI).toFixed(2)} pide ${(l.necesita * 180 / Math.PI).toFixed(2)} muñ ${((l.abdPide || 0) * 180 / Math.PI).toFixed(2)}/${((l.abd || 0) * 180 / Math.PI).toFixed(2)} rv(${l.rv.toArray().map((x) => (x * 180 / Math.PI).toFixed(1)).join(',')}) sost(${l.sostiene.toArray().map((x) => (x * 180 / Math.PI).toFixed(1)).join(',')})`).join(' | '))
      }
      if (!SIN) {
        s.updateMatrixWorld(true)
        const h = metido()
        hondo.l.push(h.l); hondo.r.push(h.r)
        if (mangas.l.length) { const mm = mangaMetida(); manga.l.push(mm.l); manga.r.push(mm.r) }
        if (torsoPrenda.length) { const pm = prendaMetida(); prenda.l.push(pm.l); prenda.r.push(pm.r) }
      }
    }
    const ms = (performance.now() - t0) / n
    act.stop(); mixer.uncacheRoot(s)
    for (const lado of am.lados) { lado.brazo.quaternion.copy(lado.crudo) }
    am.soltar()
    const res = {}
    for (const k of ['l', 'r']) {
      const a = serie[k]
      let salto = 0, donde = 0
      for (let f = 1; f < a.length; f++) if (Math.abs(a[f] - a[f - 1]) > salto) { salto = Math.abs(a[f] - a[f - 1]); donde = f }
      res[k] = {
        max: +Math.max(...a).toFixed(2), necMax: +Math.max(...nec[k]).toFixed(2),
        saltoMax: +salto.toFixed(3), en: donde,
        cada10: a.filter((_, i) => i % 10 === 0).map((x) => +x.toFixed(1)).join(' '),
        metidos: hondo[k].filter((x) => x > 0.0005).length,
        hondo: hondo[k].length ? +(Math.max(...hondo[k]) * 100).toFixed(2) : 0,
        manga: (manga[k].length ? `; manga en el aro en ${manga[k].filter((x) => x > 0).length} cuadros (${(Math.max(...manga[k]) * 100).toFixed(2)} cm)` : '')
          + (prenda[k].length ? `; prenda metida en ${prenda[k].filter((x) => x > 0.0005).length} cuadros (${(Math.max(...prenda[k]) * 100).toFixed(2)} cm)` : '')
          + (prenda[k].length ? ' ' + prenda[k].map((x, i) => (x > 0.0005 ? `[${i}:${(x * 100).toFixed(1)}/${a[i].toFixed(1)}/${nec[k][i].toFixed(1)}]` : null)).filter(Boolean).join(' ') : ''),
        // cuadro:hondura(cm)/apertura/pedido de los cuadros que se meten
        donde: hondo[k].map((x, i) => (x > 0.0005 ? `${i}:${(x * 100).toFixed(1)}/${a[i].toFixed(1)}/${nec[k][i].toFixed(1)}` : null)).filter(Boolean).join(' '),
      }
    }
    const cs = [...costo].sort((x, y) => x - y)
    console.log(`
${clip.name} (${n} cuadros a ${HZ} Hz; aplicar: mediana ${cs[cs.length >> 1].toFixed(2)} ms, p90 ${cs[Math.floor(cs.length * 0.9)].toFixed(2)} ms)`)
    for (const k of ['l', 'r']) console.log(` ${k}: apertura max ${res[k].max}°, lo que pidió max ${res[k].necMax}°, salto max ${res[k].saltoMax}° (cuadro ${res[k].en}); cuerpo metido en ${res[k].metidos} cuadros, lo más hondo ${res[k].hondo} cm${res[k].manga}\n    ${res[k].cada10}
    ${res[k].donde}`)
  }
} finally {
  await server.close()
}
