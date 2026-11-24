// La reverb de M.A.D.R.E.: un tren de ecos cada 1/`nota` s (el resonador) más
// ruido que cae `caida` por segundo (la sala), distinto en cada canal y con
// semilla fija. Con ella se arma la reverb al revés de su voz en la historia
// (historiaMadre.js, conPreReverb) y el fantasma de la canción rota de la
// ofrenda (cancionOfrenda.js). Sin `peine`, es una sala sola.

export function pasaBajos(x, hz, sr) {
  const a = Math.exp((-2 * Math.PI * hz) / sr)
  for (let i = 1; i < x.length; i++) x[i] = (1 - a) * x[i] + a * x[i - 1]
}

export function energia(x) {
  let e = 0
  for (let i = 0; i < x.length; i++) e += x[i] * x[i]
  return Math.sqrt(e) || 1
}

// P: { largo (s), caida (1/s), nota (Hz), realimenta, brilloPeine, brilloSala,
// peine, sala }. Regresa los dos canales.
export function impulsoReverb(sr, P) {
  const n = Math.floor(sr * P.largo)
  const peine = new Float32Array(n)
  if (P.peine > 0) {
    for (let k = 1; ; k++) {
      const i = Math.round((k * sr) / P.nota)
      if (i >= n) break
      peine[i] = Math.pow(P.realimenta, k)
    }
    pasaBajos(peine, P.brilloPeine, sr)
  }
  const kp = P.peine > 0 ? P.peine / energia(peine) : 0
  let semilla = 7
  const azar = () => { semilla = (semilla * 16807) % 2147483647; return (semilla - 1) / 2147483646 }
  return [0, 1].map(() => {
    const sala = new Float32Array(n)
    for (let i = 0; i < n; i++) sala[i] = (azar() * 2 - 1) * Math.exp((-P.caida * i) / sr)
    pasaBajos(sala, P.brilloSala, sr)
    const ks = P.sala / energia(sala)
    for (let i = 0; i < n; i++) sala[i] = sala[i] * ks + peine[i] * kp
    return sala
  })
}
