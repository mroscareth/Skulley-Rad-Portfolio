// Piezas toon de los diálogos de Argus (juego de esferas): los rayos de sol del premio
// y los destellos. Las usan ZoidianDialog y GameOverModal. Viven aparte para que la
// pantalla de puntuación, que va en el arranque, no se traiga el 3D de ZoidianDialog.

// Rayos de sol toon del premio: 16 cuñas planas desde el centro.
export const PRIZE_RAYS = (() => {
  const n = 16
  const half = (Math.PI / n) * 0.5
  let d = ''
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * Math.PI * 2
    const p1 = [Math.cos(a - half) * 50, Math.sin(a - half) * 50]
    const p2 = [Math.cos(a + half) * 50, Math.sin(a + half) * 50]
    d += `M0 0 L${p1[0].toFixed(2)} ${p1[1].toFixed(2)} L${p2[0].toFixed(2)} ${p2[1].toFixed(2)} Z `
  }
  return d
})()

const SPARKLE_PATH = 'M0 -11 C2 -3 3 -2 11 0 C3 2 2 3 0 11 C-2 3 -3 2 -11 0 C-3 -2 -2 -3 0 -11 Z'

export function Sparkle({ style }) {
  return (
    <svg className="argus-sparkle" viewBox="-14 -14 28 28" style={style} aria-hidden>
      <path d={SPARKLE_PATH} fill="#fff" stroke="#0a0510" strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
  )
}
