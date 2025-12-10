// Generate a manifest.json for images inside public/<dir>
// Usage:
//   node scripts/gen-images-manifest.mjs 3Dheads
// Writes: public/<dir>/manifest.json with [{ src }]
import { readdir, writeFile, stat } from 'node:fs/promises'
import { join, extname } from 'node:path'

async function main() {
  const dirArg = process.argv[2] || '3Dheads'
  const root = process.cwd()
  const baseDir = join(root, 'public', dirArg)
  let entries
  try {
    entries = await readdir(baseDir)
  } catch (e) {
    console.error('[gen-images-manifest] dir not found:', baseDir)
    process.exit(0)
  }
  const exts = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif'])
  const items = []
  for (const name of entries) {
    const p = join(baseDir, name)
    try {
      const st = await stat(p)
      if (!st.isFile()) continue
    } catch {
      continue
    }
    const ext = extname(name).toLowerCase()
    if (!exts.has(ext)) continue
    items.push({ src: `${dirArg}/${name}` })
  }
  // sort by filename naturally
  items.sort((a, b) => a.src.localeCompare(b.src, undefined, { numeric: true, sensitivity: 'base' }))
  const outPath = join(baseDir, 'manifest.json')
  await writeFile(outPath, JSON.stringify(items, null, 2))
  console.log(`[gen-images-manifest] wrote ${items.length} items -> ${outPath}`)
}

main().catch((e) => {
  console.error('[gen-images-manifest] error', e)
  process.exit(1)
})







