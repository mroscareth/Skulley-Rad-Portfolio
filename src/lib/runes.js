// Rune generation — lógica compartida entre el shader de los portales
// (Portal.jsx), el CTA (PortalCTA.jsx) y la nueva sección del abecedario
// rúnico (Section6.jsx / font generator).
//
// Cada runa son 4 segmentos de línea cuyos endpoints están snappeados a un
// grid 4x4 (valores 0, 1/3, 2/3, 1). El seed controla qué combinación sale.
// Idéntica fórmula a la del GLSL del disco del portal → lenguaje visual
// 100% coherente entre 3D y 2D.

export function hash21(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return s - Math.floor(s)
}

export function runeSegments(seed) {
  const segs = new Array(4)
  for (let i = 0; i < 4; i++) {
    const fi = i
    segs[i] = {
      x1: Math.floor(hash21(seed + fi * 3.13, 1.0) * 4.0) / 3.0,
      y1: Math.floor(hash21(seed + fi * 5.17, 2.0) * 4.0) / 3.0,
      x2: Math.floor(hash21(seed + fi * 7.11, 3.0) * 4.0) / 3.0,
      y2: Math.floor(hash21(seed + fi * 11.3, 4.0) * 4.0) / 3.0,
    }
  }
  return segs
}

// Helper: normaliza los segmentos removiendo duplicados/colapsados.
// Un segmento colapsado (x1==x2 && y1==y2) es solo un punto — visualmente
// invisible pero válido. Los duplicados (mismos endpoints) agregan grosor
// pero no forma.
export function runeIsDegenerate(segments) {
  // True si TODOS los segmentos son puntos colapsados.
  return segments.every((s) => s.x1 === s.x2 && s.y1 === s.y2)
}

// Cuenta segmentos "visibles" (no colapsados) — métrica de legibilidad.
export function runeComplexity(segments) {
  return segments.filter((s) => !(s.x1 === s.x2 && s.y1 === s.y2)).length
}
