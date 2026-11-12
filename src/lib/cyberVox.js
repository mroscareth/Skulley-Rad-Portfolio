// CYBER_VOX, la voz de M.A.D.R.E.: el audio de Google TTS (por el proxy
// /api/tts.php, que solo atiende al propio dominio) pasado por una cadena de
// Web Audio que lo vuelve robot. La usan el lector del blog (BlogTTS) y la
// historia del preloader de escritorio (DesktopScrollPreloader).
const TTS_API = '/api/tts.php'

export function urlVoz(texto, lang) {
  const tl = lang === 'es' ? 'es' : 'en'
  return `${TTS_API}?text=${encodeURIComponent(texto)}&lang=${tl}`
}

// Soft clip para el crujido digital del waveshaper.
function curvaDistorsion(amount = 20) {
  const samples = 44100
  const curve = new Float32Array(samples)
  const deg = Math.PI / 180
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1
    curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x))
  }
  return curve
}

// Los ajustes de la cadena. CYBER_VOX es la del lector del blog, pensada para
// la voz de Google TTS. VOZ_LIGERA es la de la historia del preloader, que
// trae una voz neural ya clara: menos ring mod, sin filtro de radio cerrado y
// menos distorsión, para que se entienda cada palabra (Oscar: con la otra no
// se entendía la dicción). `velocidad` también dice cuánto dura al sonar.
export const CYBER_VOX = { velocidad: 1.05, seco: 0.45, ring1: 0.35, ring2: 0.20, bandaQ: 0.8, filo: 8, distorsion: 35, salida: 2.0 }
export const VOZ_LIGERA = { velocidad: 1, seco: 0.82, ring1: 0.12, ring2: 0.06, bandaQ: 0.25, filo: 4, distorsion: 6, salida: 1.5 }

/**
 * Arma la cadena para un buffer ya decodificado y la conecta a `destino`.
 * Devuelve la fuente (sin arrancar) y `limpiar`, que apaga los osciladores
 * del ring modulator: llamarlo en el onended de la fuente.
 *
 *  Fuente (1.05×)
 *    → Ring modulator (30 Hz, seno: la voz de robot clásica)
 *    → Ring modulator 2 (80 Hz, cuadrada: armónicos metálicos)
 *    → Pasabanda (1600 Hz: walkie-talkie / intercom)
 *    → Peaking (+8 dB @ 2200 Hz: filo metálico)
 *    → Waveshaper (distorsión digital)
 *    → Pasaaltos (quita los graves lodosos)
 *    → Compresor (pegada y nivel parejo)
 *    → Ganancia de salida
 */
export function cadenaCyberVox(ctx, buffer, destino = ctx.destination, a = CYBER_VOX) {
  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.playbackRate.value = a.velocidad

  // Ring modulators: la señal multiplicada por un oscilador lento.
  const ringOsc1 = ctx.createOscillator()
  ringOsc1.type = 'sine'
  ringOsc1.frequency.value = 30
  const ringGain1 = ctx.createGain()
  ringGain1.gain.value = 0
  ringOsc1.connect(ringGain1.gain)
  ringOsc1.start()

  const ringOsc2 = ctx.createOscillator()
  ringOsc2.type = 'square'
  ringOsc2.frequency.value = 80
  const ringGain2 = ctx.createGain()
  ringGain2.gain.value = 0
  ringOsc2.connect(ringGain2.gain)
  ringOsc2.start()

  // 45 % seco: con más ring mod la voz deja de entenderse.
  const dryGain = ctx.createGain()
  dryGain.gain.value = a.seco
  const wetGain1 = ctx.createGain()
  wetGain1.gain.value = a.ring1
  const wetGain2 = ctx.createGain()
  wetGain2.gain.value = a.ring2
  const mixBus = ctx.createGain()
  mixBus.gain.value = 1.0

  source.connect(ringGain1)
  ringGain1.connect(wetGain1)
  wetGain1.connect(mixBus)
  source.connect(ringGain2)
  ringGain2.connect(wetGain2)
  wetGain2.connect(mixBus)
  source.connect(dryGain)
  dryGain.connect(mixBus)

  const bandpass = ctx.createBiquadFilter()
  bandpass.type = 'bandpass'
  bandpass.frequency.value = 1600
  bandpass.Q.value = a.bandaQ

  const peaking = ctx.createBiquadFilter()
  peaking.type = 'peaking'
  peaking.frequency.value = 2200
  peaking.Q.value = 2.0
  peaking.gain.value = a.filo

  const waveshaper = ctx.createWaveShaper()
  waveshaper.curve = curvaDistorsion(a.distorsion)
  waveshaper.oversample = '4x'

  const highpass = ctx.createBiquadFilter()
  highpass.type = 'highpass'
  highpass.frequency.value = 300
  highpass.Q.value = 0.7

  const compressor = ctx.createDynamicsCompressor()
  compressor.threshold.value = -20
  compressor.knee.value = 6
  compressor.ratio.value = 12
  compressor.attack.value = 0.002
  compressor.release.value = 0.1

  // Compensa lo que se come el procesado.
  const outputGain = ctx.createGain()
  outputGain.gain.value = a.salida

  mixBus.connect(bandpass)
  bandpass.connect(peaking)
  peaking.connect(waveshaper)
  waveshaper.connect(highpass)
  highpass.connect(compressor)
  compressor.connect(outputGain)
  outputGain.connect(destino)

  const limpiar = () => {
    try { ringOsc1.stop() } catch { }
    try { ringOsc2.stop() } catch { }
  }
  return { source, limpiar }
}
