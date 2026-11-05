// Los stickers del wallpaper. Basta dejar los archivos en src/assets/stickers/
// (PNG o WebP con fondo transparente): salen solos, todos los que haya, ordenados
// por nombre (2-… antes que 10-…). Sin archivos, el control no se enseña.
const archivos = import.meta.glob('../assets/stickers/*.{png,webp}', { eager: true, query: '?url', import: 'default' })

export const STICKERS = Object.keys(archivos)
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  .map((id) => ({ id, src: archivos[id] }))
