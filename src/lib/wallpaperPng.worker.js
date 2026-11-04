// Comprime el wallpaper a PNG fuera del hilo principal (ver wallpaperPng.js).
self.onmessage = async ({ data: { id, bmp } }) => {
  try {
    const lienzo = new OffscreenCanvas(bmp.width, bmp.height)
    lienzo.getContext('2d').drawImage(bmp, 0, 0)
    bmp.close()
    const blob = await lienzo.convertToBlob({ type: 'image/png' })
    self.postMessage({ id, blob })
  } catch (e) {
    self.postMessage({ id, error: String(e) })
  }
}
