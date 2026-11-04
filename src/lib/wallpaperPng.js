// canvas.toBlob comprime el PNG en el tiempo libre del hilo principal, y con
// Skulley animándose casi no hay: medido con el CPU a 6×, una imagen de 240 × 520
// tardaba 1,119 ms con el loop corriendo y 26 ms en un Worker. Aquí se copia el
// canvas a un ImageBitmap (5 ms) y el Worker hace lo demás. Es un archivo y no
// un blob porque la política de seguridad del sitio solo deja scripts propios.
// Sin OffscreenCanvas, o si el Worker falla, regresa a toBlob.
let worker = null
let siguiente = 0
const pendientes = new Map()

function conToBlob(lienzo) {
  return new Promise((resolve, reject) => {
    lienzo.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('toBlob'))), 'image/png')
  })
}

function soltarWorker() {
  try { worker?.terminate() } catch { }
  worker = null
  for (const p of pendientes.values()) p.reject(new Error('worker'))
  pendientes.clear()
}

function obtenerWorker() {
  if (worker) return worker
  worker = new Worker(new URL('./wallpaperPng.worker.js', import.meta.url), { type: 'module' })
  worker.onmessage = ({ data: { id, blob, error } }) => {
    const p = pendientes.get(id)
    if (!p) return
    pendientes.delete(id)
    if (blob) p.resolve(blob)
    else p.reject(new Error(error || 'worker'))
  }
  worker.onerror = soltarWorker
  return worker
}

export async function pngDeCanvas(lienzo) {
  if (typeof OffscreenCanvas !== 'function' || typeof createImageBitmap !== 'function' || typeof Worker !== 'function') {
    return conToBlob(lienzo)
  }
  try {
    const bmp = await createImageBitmap(lienzo)
    siguiente += 1
    const id = siguiente
    return await new Promise((resolve, reject) => {
      pendientes.set(id, { resolve, reject })
      obtenerWorker().postMessage({ id, bmp }, [bmp])
    })
  } catch {
    return conToBlob(lienzo)
  }
}
