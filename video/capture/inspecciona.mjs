// Abre una ruta y lista los ganchos de desarrollo (window.__*) y botones.
import { abrir, cerrar, sleep } from './rig.mjs'
const ruta = process.argv[2] || '/world'
const ctx = await abrir({ ruta, dsf: 1, storage: { lang: 'en', tutorial_shown: 'true' } })
await sleep(Number(process.argv[3] || 25000))
const info = await ctx.page.evaluate(() => ({
  ganchos: Object.keys(window).filter((k) => k.startsWith('__')).sort(),
  botones: [...document.querySelectorAll('button,[role=button],a')].filter((b) => b.offsetParent).map((b) => (b.getAttribute('aria-label') || b.textContent || '').trim().slice(0, 40)).filter(Boolean),
  path: location.pathname,
}))
console.log(JSON.stringify(info, null, 1))
await ctx.page.screenshot({ path: (process.env.SCRATCH || '.') + '/insp.jpg', type: 'jpeg', quality: 70 })
console.log('errores', ctx.errores.slice(0, 5))
await cerrar(ctx)
