// Los stickers del wallpaper. Basta dejar los archivos en src/assets/stickers/
// (PNG o WebP con fondo transparente, unos 1024 px): salen solos, en orden
// alfabético, hasta cinco. Sin archivos, el control no se enseña.
const archivos = import.meta.glob('../assets/stickers/*.{png,webp}', { eager: true, query: '?url', import: 'default' })

export const STICKERS = Object.keys(archivos).sort().slice(0, 5).map((id) => ({ id, src: archivos[id] }))
