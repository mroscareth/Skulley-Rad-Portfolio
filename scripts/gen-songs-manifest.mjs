// Generate public/songs/manifest.json from files in public/songs
import { readdir, writeFile, stat } from 'node:fs/promises'
import { join, extname, basename } from 'node:path'

async function main() {
  const root = process.cwd()
  const songsDir = join(root, 'public', 'songs')
  let entries
  try {
    entries = await readdir(songsDir)
  } catch (e) {
    console.error('[gen-songs-manifest] songs dir not found:', songsDir)
    process.exit(0)
  }
  const exts = new Set(['.mp3', '.ogg', '.wav', '.m4a', '.flac'])
  const tracks = []
  for (const name of entries) {
    const p = join(songsDir, name)
    try {
      const st = await stat(p)
      if (!st.isFile()) continue
    } catch {
      continue
    }
    const ext = extname(name).toLowerCase()
    if (!exts.has(ext)) continue
    const title = basename(name, ext)
    tracks.push({ title, artist: '', src: `songs/${name}` })
  }
  tracks.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }))
  const outPath = join(songsDir, 'manifest.json')
  await writeFile(outPath, JSON.stringify(tracks, null, 2))
  console.log(`[gen-songs-manifest] wrote ${tracks.length} tracks -> ${outPath}`)
}

main().catch((e) => {
  console.error('[gen-songs-manifest] error', e)
  process.exit(1)
})


