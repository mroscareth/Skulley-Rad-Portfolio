import { abrir, esperar, Grabacion, cerrar, sleep } from './rig.mjs'

const ctx = await abrir({ ruta: '/', dsf: Number(process.env.DSF || 2), storage: { lang: 'en' } })
const gpu = await ctx.page.evaluate(() => {
  const c = document.createElement('canvas')
  const gl = c.getContext('webgl2')
  const ext = gl && gl.getExtension('WEBGL_debug_renderer_info')
  return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'sin webgl'
})
console.log('GPU:', gpu)
await sleep(15000)
console.log('canvas:', await ctx.page.evaluate(() => [...document.querySelectorAll('canvas')].map((c) => c.width + 'x' + c.height).join(', ')))
const g = new Grabacion(ctx, 'prueba')
await g.grabar(3000)
await g.cerrar()
console.log('errores:', ctx.errores.slice(0, 8))
console.log('vt errors:', await ctx.page.evaluate(() => window.__vt.errors.slice(0, 5)))
await cerrar(ctx)
