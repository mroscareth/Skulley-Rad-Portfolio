// Una palabra en SKULLEYGLYPH lista para armar letras de neón de bloque en Blender (Oscar, 2026-11-24:
// PESCA en el puesto de Argus y ESCENARIO en el foro, con su referencia: letras hondas de metal
// pintado y oxidado, el frente abierto lleno de tubos de neón horizontales y un tubo oxidado que
// sigue el contorno).
//
//   node scripts/estilo/runas_neon.mjs PESCA > scripts/estilo/neon_pesca.json
//
// Por letra sale:
//   trazos     el camino central de cada trazo de la runa (strokeSpine, el que pinta la pluma de la
//              fuente); `cerrado` es una figura de un trazo que da la vuelta (cortada donde regresa).
//   contornos  la silueta de la letra de bloque: la runa trazada con un grosor parejo (`grueso`; las
//              gotas y los picos, `gota`)
//              (lazos cerrados; `hueco` los de adentro, como el hueco de la C). Se extruye hacia atrás.
//   filas      los tubos de neón del frente: segmentos horizontales [x0, x1, y] cada `paso`, metidos
//              `margen` de la pared (alineados en toda la palabra).
//   marco      el tubo oxidado: la silueta separada `afuera` hacia fuera, en lazos cerrados.
// Unidades de las runas: cada una mide ~4 de ancho y 6 de alto, con la y hacia abajo; las letras van
// una tras otra a `separa` de distancia entre sus bloques y la palabra va centrada en x = 0.

import { UPPER } from '../../src/lib/runeStrokes.js'
import { strokeSpine } from '../../src/lib/runeBrush.js'

const palabra = (process.argv[2] || 'PESCA').toUpperCase()
const P = { grueso: 0.8, gota: 0.62, hueco: 0.14, junto: 0.35, recorteMax: 0.55, paso: 0.3, margen: 0.19, afuera: 0.07, separa: 0.55, filaMin: 0.12, celda: 0.02, simplifica: 0.006 }

function cortarCerrado(pts) {
  const [x0, y0] = pts[0]
  let lejos = false
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i][0] - x0, pts[i][1] - y0)
    if (d > 0.6) lejos = true
    else if (lejos && d < 0.06) return { pts: pts.slice(0, i), cerrado: true }
  }
  return { pts, cerrado: false }
}

function segmentosDe(trazos) {
  const segs = []
  for (const t of trazos) {
    const n = t.pts.length
    const m = t.cerrado ? n : n - 1
    for (let i = 0; i < m; i++) segs.push([...t.pts[i], ...t.pts[(i + 1) % n], t.r])
    if (n === 1) segs.push([...t.pts[0], ...t.pts[0], t.r])
  }
  return segs
}

function aSegmentos(pts, desde = 0, hasta = pts.length - 1) {
  let mejor = Infinity
  return (x, y) => {
    mejor = Infinity
    for (let i = desde; i < hasta; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1]
      const dx = bx - ax, dy = by - ay
      const l2 = dx * dx + dy * dy
      let k = l2 > 0 ? ((x - ax) * dx + (y - ay) * dy) / l2 : 0
      k = k < 0 ? 0 : k > 1 ? 1 : k
      mejor = Math.min(mejor, Math.hypot(ax + k * dx - x, ay + k * dy - y))
    }
    return mejor
  }
}

// Con grosor parejo, lo que en la fuente va separado se pegaba (la gota de la P con su barra, los
// picos de la cresta, la abertura de la E): cada punta que queda a menos de los dos radios más
// `hueco` de un trazo separado (o de su propio otro extremo) se recorta, hasta `recorteMax` del trazo.
function separar(trazos) {
  const n = trazos.length
  const largo = trazos.map((t) => { const s = [0]; for (let i = 1; i < t.pts.length; i++) s.push(s[i - 1] + Math.hypot(t.pts[i][0] - t.pts[i - 1][0], t.pts[i][1] - t.pts[i - 1][1])); return s })
  const cerca = (a, b) => { const d = aSegmentos(b.pts); return Math.min(...a.pts.map(([x, y]) => d(x, y))) }
  const separados = trazos.map((a, i) => trazos.map((b, j) => i !== j && cerca(a, b) > P.junto))
  return trazos.map((t, i) => {
    if (t.cerrado || t.pts.length < 3) return t
    const s = largo[i], total = s[s.length - 1]
    const otros = trazos.map((o, j) => separados[i][j] ? { d: aSegmentos(o.pts), r: o.r } : null).filter(Boolean)
    const choca = (k, lejosDe) => {
      const [x, y] = t.pts[k]
      if (otros.some((o) => o.d(x, y) < t.r + o.r + P.hueco)) return true
      // su propio otro extremo (el ensō abierto de la E)
      const lejos = 2 * t.r + 0.6
      const idx = s.map((v, q) => (Math.abs(v - s[lejosDe]) > lejos && Math.abs(v - s[k]) > lejos ? q : -1)).filter((q) => q >= 0)
      if (idx.length < 2) return false
      const tramo = idx.map((q) => t.pts[q])
      return aSegmentos(tramo)(x, y) < 2 * t.r + P.hueco
    }
    let a = 0, b = t.pts.length - 1
    while (a < b && s[a] < total * P.recorteMax / 2 && choca(a, a)) a++
    while (b > a && total - s[b] < total * P.recorteMax / 2 && choca(b, b)) b--
    return { ...t, pts: t.pts.slice(a, b + 1) }
  })
}

// distancia con signo a la runa de grosor parejo (negativa adentro)
function distancia(segs, x, y) {
  let mejor = Infinity
  for (const [ax, ay, bx, by, r] of segs) {
    const dx = bx - ax, dy = by - ay
    const l2 = dx * dx + dy * dy
    let t = l2 > 0 ? ((x - ax) * dx + (y - ay) * dy) / l2 : 0
    t = t < 0 ? 0 : t > 1 ? 1 : t
    const ex = ax + t * dx - x, ey = ay + t * dy - y
    const d = Math.sqrt(ex * ex + ey * ey) - r
    if (d < mejor) mejor = d
  }
  return mejor
}

// lazos donde el campo cruza `nivel` (marching squares con las orillas compartidas)
function lazos(campo, nx, ny, x0, y0, h, nivel) {
  const v = (i, j) => campo[j * nx + i] - nivel
  const punto = new Map()
  const llave = (tipo, i, j) => `${tipo}${i},${j}`
  const cruce = (tipo, i, j) => {
    const k = llave(tipo, i, j)
    if (!punto.has(k)) {
      const [a, b] = tipo === 'h' ? [v(i, j), v(i + 1, j)] : [v(i, j), v(i, j + 1)]
      const t = a / (a - b)
      punto.set(k, tipo === 'h' ? [x0 + (i + t) * h, y0 + j * h] : [x0 + i * h, y0 + (j + t) * h])
    }
    return k
  }
  const sig = new Map()
  const unir = (a, b) => { sig.set(a, b) }
  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const a = v(i, j), b = v(i + 1, j), c = v(i + 1, j + 1), d = v(i, j + 1)
      const caso = (a < 0 ? 1 : 0) | (b < 0 ? 2 : 0) | (c < 0 ? 4 : 0) | (d < 0 ? 8 : 0)
      if (caso === 0 || caso === 15) continue
      const arriba = () => cruce('h', i, j), abajo = () => cruce('h', i, j + 1)
      const izq = () => cruce('v', i, j), der = () => cruce('v', i + 1, j)
      // lo de adentro (negativo) queda a la izquierda al recorrer
      switch (caso) {
        case 1: unir(izq(), arriba()); break
        case 2: unir(arriba(), der()); break
        case 3: unir(izq(), der()); break
        case 4: unir(der(), abajo()); break
        case 5: if ((a + b + c + d) / 4 < 0) { unir(izq(), abajo()); unir(der(), arriba()) } else { unir(izq(), arriba()); unir(der(), abajo()) } break
        case 6: unir(arriba(), abajo()); break
        case 7: unir(izq(), abajo()); break
        case 8: unir(abajo(), izq()); break
        case 9: unir(abajo(), arriba()); break
        case 10: if ((a + b + c + d) / 4 < 0) { unir(arriba(), izq()); unir(abajo(), der()) } else { unir(arriba(), der()); unir(abajo(), izq()) } break
        case 11: unir(abajo(), der()); break
        case 12: unir(der(), izq()); break
        case 13: unir(der(), arriba()); break
        case 14: unir(arriba(), izq()); break
      }
    }
  }
  const salida = []
  const usado = new Set()
  for (const inicio of sig.keys()) {
    if (usado.has(inicio)) continue
    const lazo = []
    let k = inicio
    while (k && !usado.has(k)) { usado.add(k); lazo.push(punto.get(k)); k = sig.get(k) }
    if (lazo.length > 3) salida.push(lazo)
  }
  return salida
}

function simplificar(pts, tol) {
  // Douglas-Peucker sobre un lazo cerrado: se parte en el punto más lejano del primero
  let lejos = 0, dl = -1
  for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[0][0], pts[i][1] - pts[0][1]); if (d > dl) { dl = d; lejos = i } }
  const dp = (a) => {
    if (a.length < 3) return a
    const [x1, y1] = a[0], [x2, y2] = a[a.length - 1]
    const l = Math.hypot(x2 - x1, y2 - y1) || 1e-9
    let mx = -1, mi = 0
    for (let i = 1; i < a.length - 1; i++) {
      const d = Math.abs((x2 - x1) * (y1 - a[i][1]) - (x1 - a[i][0]) * (y2 - y1)) / l
      if (d > mx) { mx = d; mi = i }
    }
    if (mx <= tol) return [a[0], a[a.length - 1]]
    const izq = dp(a.slice(0, mi + 1)), der = dp(a.slice(mi))
    return izq.slice(0, -1).concat(der)
  }
  const a = dp(pts.slice(0, lejos + 1)), b = dp(pts.slice(lejos).concat([pts[0]]))
  return a.slice(0, -1).concat(b.slice(0, -1))
}

const area = (pts) => pts.reduce((s, [x, y], i) => { const [u, w] = pts[(i + 1) % pts.length]; return s + x * w - u * y }, 0) / 2
const r4 = (n) => +n.toFixed(4)

const letras = []
for (const letra of palabra) {
  const trazos = separar((UPPER[letra] || []).map((s) => ({ ...cortarCerrado(strokeSpine(s, { step: 0.06 }).pts.map(([x, y]) => [x, y])), r: (s.kind === 'dot' ? P.gota : P.grueso) / 2 })))
  const segs = segmentosDe(trazos)
  const xs = segs.flatMap((s) => [s[0], s[2]]), ys = segs.flatMap((s) => [s[1], s[3]])
  const pad = P.grueso / 2 + P.afuera + 0.1
  const bx0 = Math.min(...xs) - pad, bx1 = Math.max(...xs) + pad, by0 = Math.min(...ys) - pad, by1 = Math.max(...ys) + pad
  const h = P.celda
  const nx = Math.ceil((bx1 - bx0) / h) + 1, ny = Math.ceil((by1 - by0) / h) + 1
  const campo = new Float32Array(nx * ny)
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) campo[j * nx + i] = distancia(segs, bx0 + i * h, by0 + j * h)
  const contornos = lazos(campo, nx, ny, bx0, by0, h, 0).map((l) => simplificar(l, P.simplifica))
  const marco = lazos(campo, nx, ny, bx0, by0, h, P.afuera).map((l) => simplificar(l, P.simplifica))
  // el ancho del bloque, para acomodar la palabra
  let ix0 = Infinity, ix1 = -Infinity
  for (const l of contornos) for (const [x] of l) { ix0 = Math.min(ix0, x); ix1 = Math.max(ix1, x) }
  letras.push({ letra, trazos, segs, contornos, marco, ix0, ix1, by0, by1 })
}

// acomodar: cada letra pegada a la anterior a `separa` entre bloques, la palabra centrada
let cursor = 0
for (const l of letras) { l.dx = cursor - l.ix0; cursor += l.ix1 - l.ix0 + P.separa }
const total = cursor - P.separa
for (const l of letras) l.dx -= total / 2

// filas de neón alineadas en toda la palabra
const yTop = Math.min(...letras.map((l) => l.by0)), yBot = Math.max(...letras.map((l) => l.by1))
for (const l of letras) {
  l.filas = []
  for (let y = Math.ceil(yTop / P.paso) * P.paso; y <= yBot; y += P.paso) {
    if (y < l.by0 || y > l.by1) continue
    const paso = 0.01
    let dentro = false, desde = 0, dPrev = 0, xPrev = 0
    for (let x = l.ix0 - 0.05; x <= l.ix1 + 0.05; x += paso) {
      const d = distancia(l.segs, x, y) + P.margen
      const ahora = d < 0
      if (ahora !== dentro) {
        const xc = xPrev + (x - xPrev) * (dPrev / (dPrev - d))
        if (ahora) desde = xc
        else if (xc - desde >= P.filaMin) l.filas.push([desde, xc, y])
        dentro = ahora
      }
      dPrev = d; xPrev = x
    }
  }
}

const mover = (pts, dx) => pts.map(([x, y]) => [r4(x + dx), r4(y)])
const salida = letras.map((l) => {
  const contornos = l.contornos.map((pts) => ({ pts: mover(pts, l.dx), area: r4(area(pts)) }))
  // de afuera o hueco: un lazo es hueco si queda dentro de otro
  const adentro = (p, lazo) => {
    let c = false
    for (let i = 0, j = lazo.length - 1; i < lazo.length; j = i++) {
      const [xi, yi] = lazo[i], [xj, yj] = lazo[j]
      if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c
    }
    return c
  }
  for (const c of contornos) c.hueco = contornos.some((o) => o !== c && adentro(c.pts[0], o.pts))
  return {
    letra: l.letra,
    ancho: r4(l.ix1 - l.ix0),
    trazos: l.trazos.map((t) => ({ pts: mover(t.pts, l.dx), cerrado: t.cerrado })),
    contornos: contornos.map(({ pts, hueco }) => ({ pts, hueco })),
    filas: l.filas.map(([a, b, y]) => [r4(a + l.dx), r4(b + l.dx), r4(y)]),
    marco: l.marco.map((pts) => mover(pts, l.dx)),
  }
})

const todos = salida.flatMap((l) => l.contornos.flatMap((c) => c.pts))
process.stdout.write(JSON.stringify({
  palabra, parametros: P, ancho: r4(total),
  y0: r4(Math.min(...todos.map(([, y]) => y))), y1: r4(Math.max(...todos.map(([, y]) => y))),
  letras: salida,
}) + '\n')
