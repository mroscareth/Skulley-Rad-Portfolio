// Pluma plana (Oscar, 2026-11-10, con una referencia de letra china: "líneas
// horizontales gruesas y las verticales o diagonales delgadas"). En vez de la
// brocha redonda, que pinta círculos, cada trazo se pinta con una punta plana
// casi vertical: moverla de lado deja todo su alto (grueso), moverla hacia
// abajo solo su canto (delgado). Los remates salen rectos y sesgados, y donde
// el trazo afloja (colas) la punta se encoge en cuña. Las gotas y los picos se
// pintan con la punta de través: quedan cuñas filosas y no rayitas.
import { strokeSpine } from './brush5.mjs'

// Afinada contra la referencia: planchas más gruesas (huecos chicos), punta un
// poco más inclinada para los cortes en diagonal, gotas y picos como hojas de
// doble punta y los acentos muy cortos como puntos redondos.
export const NIB = { h: 0.68, w: 0.085, angle: 0.1, ref: 0.46, blade: 0.34, dotMax: 0.7 }

// Rectángulos [x, y, medio ancho, medio alto, giro] a lo largo de cada trazo.
// La presión sale del grosor que el pincel le daba al trazo.
export function nibBoxes(ss, weight, nib = NIB) {
  const out = []
  for (const s of ss) {
    const { pts, rad } = strokeSpine(s, { step: 0.012, weight })
    const n = pts.length
    let len = 0
    for (let i = 1; i < n; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
    if (s.kind === 'dot' && len < nib.dotMax) {
      // Punto redondo, como los de la referencia.
      const c = pts[Math.floor(n * 0.6)]
      out.push([c[0], c[1], nib.h * weight * 0.55, nib.h * weight * 0.55, 0, true])
      continue
    }
    // Para el remate en diagonal: lo más grueso del trazo (hasta el alto de la punta).
    const pFull = Math.min(1, Math.max(...rad) / (nib.ref * weight))
    for (let i = 0; i < n; i++) {
      const p = Math.min(1.15, rad[i] / (nib.ref * weight))
      if (s.kind === 'dot') {
        // Cuña: la punta atraviesa el trazo, así la gota es todo su grosor.
        const a = pts[Math.min(n - 1, i + 1)], b = pts[Math.max(0, i - 1)]
        const ang = Math.atan2(a[1] - b[1], a[0] - b[0])
        // Media luna filosa: afilada en las dos puntas, llena al centro, y con
        // una orilla casi recta (el centro se corre hacia un lado al adelgazar).
        const t = i / (n - 1), leaf = Math.pow(Math.sin(Math.PI * Math.min(1, t * 0.94 + 0.03)), 0.6)
        const half = nib.h * weight * nib.blade, off = half * 0.85 * (1 - leaf)
        out.push([pts[i][0] - Math.sin(ang) * off, pts[i][1] + Math.cos(ang) * off, nib.w * weight * 0.5, half * leaf, ang])
      } else {
        // Remate en diagonal (referencia de Oscar): al afilarse, la orilla de
        // abajo sigue recta y la de arriba baja hasta clavarse en una punta.
        // Antes la punta se encogía hacia el centro y quedaba una cuña.
        const full = nib.h * weight * pFull, cur = nib.h * weight * Math.min(p, pFull), drop = full - cur
        out.push([pts[i][0] - Math.sin(nib.angle) * drop, pts[i][1] + Math.cos(nib.angle) * drop, nib.w * weight * Math.max(0.35, p), cur, nib.angle])
      }
    }
  }
  return out
}

// Campo de distancia a la unión de los rectángulos (en unidades de la runa).
export function nibField(boxes, view, ppu, band = 0.6) {
  const w = Math.ceil((view.x1 - view.x0) * ppu), h = Math.ceil((view.y1 - view.y0) * ppu)
  const f = new Float32Array(w * h).fill(band)
  for (const [cx, cy, bx, by, ang = 0, round = false] of boxes) {
    const c = Math.cos(ang), sn = Math.sin(ang), R = Math.hypot(bx, by) + band
    const x0 = Math.max(0, Math.floor((cx - R - view.x0) * ppu)), x1 = Math.min(w - 1, Math.ceil((cx + R - view.x0) * ppu))
    const y0 = Math.max(0, Math.floor((cy - R - view.y0) * ppu)), y1 = Math.min(h - 1, Math.ceil((cy + R - view.y0) * ppu))
    for (let py = y0; py <= y1; py++) {
      const dy = view.y0 + (py + 0.5) / ppu - cy
      for (let px = x0; px <= x1; px++) {
        const dx = view.x0 + (px + 0.5) / ppu - cx
        // Al marco del rectángulo: su eje "ancho" va en la dirección del giro.
        const u = Math.abs(dx * c + dy * sn) - bx, v = Math.abs(-dx * sn + dy * c) - by
        const d = round ? Math.hypot(dx, dy) - bx : Math.hypot(Math.max(u, 0), Math.max(v, 0)) + Math.min(Math.max(u, v), 0)
        const k = py * w + px
        if (d < f[k]) f[k] = d
      }
    }
  }
  return { f, w, h }
}
