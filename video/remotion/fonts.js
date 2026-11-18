import { continueRender, delayRender, staticFile } from 'remotion'

export const RUNAS = 'SkulleyGlyphBold'
export const LETRAS = 'LuckiestGuy'
// La del cuerpo del sitio (los subtítulos de la historia van en Outfit 600).
export const CUERPO = 'Outfit'

let listo = null
export function cargarFuentes() {
  if (listo) return listo
  const h = delayRender('fuentes')
  const caras = [
    new FontFace(RUNAS, `url(${staticFile('fonts/SkulleyGlyphVariable-Bold.otf')}) format('opentype')`),
    new FontFace(LETRAS, `url(${staticFile('fonts/LuckiestGuy-Regular.ttf')}) format('truetype')`),
  ]
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = 'https://fonts.googleapis.com/css2?family=Outfit:wght@600;700;800&display=block'
  document.head.appendChild(link)
  const outfit = new Promise((res) => { link.onload = res; link.onerror = res })
    .then(() => Promise.all([document.fonts.load(`700 40px ${CUERPO}`), document.fonts.load(`800 40px ${CUERPO}`)]))
    .catch(() => null)
  listo = Promise.all([...caras.map((c) => c.load().then((f) => document.fonts.add(f))), outfit])
    .then(() => continueRender(h))
    .catch((e) => { console.error(e); continueRender(h) })
  return listo
}
