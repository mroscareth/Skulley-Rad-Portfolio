// El texto del wallpaper: un bloque gigante en la tipografía de la marquesina que
// llena el archivo. Cada renglón se mide por su tinta y se escala al ancho; se
// prueban todos los repartos de palabras y se queda el que más área cubre.
export const FUENTE_TEXTO = "'Luckiest Guy'"
const MARGEN = 0.03
const AIRE = 0.05
const MAX_RENGLONES = 6
const MEDIDA = 200

function medir(ctx, linea) {
  const m = ctx.measureText(linea)
  return {
    linea,
    izq: m.actualBoundingBoxLeft,
    ancho: m.actualBoundingBoxLeft + m.actualBoundingBoxRight,
    sube: m.actualBoundingBoxAscent,
    alto: m.actualBoundingBoxAscent + m.actualBoundingBoxDescent,
  }
}

// Reparte las palabras en `n` renglones parejos por número de letras.
function repartir(palabras, n) {
  const total = palabras.reduce((s, p) => s + p.length, 0) + palabras.length - 1
  const meta = total / n
  const lineas = []
  let actual = []
  let largo = 0
  palabras.forEach((p, i) => {
    const quedan = palabras.length - i
    const faltan = n - lineas.length
    if (actual.length && (largo + p.length / 2 > meta || quedan < faltan) && lineas.length < n - 1) {
      lineas.push(actual.join(' '))
      actual = []
      largo = 0
    }
    actual.push(p)
    largo += p.length + 1
  })
  lineas.push(actual.join(' '))
  return lineas
}

function bloque(ctx, palabras, n, W, H) {
  const renglones = repartir(palabras, n).map((l) => medir(ctx, l))
  const conEscala = renglones.map((r) => ({ ...r, k: W / Math.max(1, r.ancho) }))
  const alto = conEscala.reduce((s, r) => s + r.alto * r.k, 0) + AIRE * H * (n - 1) * 0.4
  const ajuste = Math.min(1, H / alto)
  const area = W * ajuste * alto * ajuste
  return { renglones: conEscala, ajuste, alto: alto * ajuste, area }
}

// Dibuja en un lienzo transparente del tamaño del archivo.
export function dibujarTexto(lienzo, texto, color) {
  const ctx = lienzo.getContext('2d')
  const w = lienzo.width
  const h = lienzo.height
  ctx.clearRect(0, 0, w, h)
  const palabras = texto.trim().toUpperCase().split(/\s+/).filter(Boolean)
  if (!palabras.length) return
  const W = w * (1 - MARGEN * 2)
  const H = h * (1 - MARGEN * 2)
  ctx.font = `${MEDIDA}px ${FUENTE_TEXTO}`
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'
  let mejor = null
  for (let n = 1; n <= Math.min(palabras.length, MAX_RENGLONES); n += 1) {
    const b = bloque(ctx, palabras, n, W, H)
    if (!mejor || b.area > mejor.area) mejor = b
  }
  ctx.fillStyle = color
  const hueco = (AIRE * H * 0.4) * mejor.ajuste
  let y = (h - mejor.alto) / 2
  for (const r of mejor.renglones) {
    const k = r.k * mejor.ajuste
    ctx.save()
    ctx.translate((w - r.ancho * k) / 2 + r.izq * k, y + r.sube * k)
    ctx.scale(k, k)
    ctx.fillText(r.linea, 0, 0)
    ctx.restore()
    y += r.alto * k + hueco
  }
}
