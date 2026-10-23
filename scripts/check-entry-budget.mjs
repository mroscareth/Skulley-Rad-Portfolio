/**
 * Presupuesto del chunk de entrada.
 *
 * El <script> que cuelga de dist/index.html es lo único que el navegador tiene
 * que bajar, parsear y ejecutar ANTES de poder pintar el preloader. En
 * 2026-10-22 pesaba 503 KB gzip porque three.js se había colado por cuatro
 * imports estáticos; sacarlo lo dejó en 220 KB. Este check existe para que no
 * vuelva a pasar sin que nadie se entere: un `import` inocente en App.jsx
 * puede arrastrar una librería entera de vuelta al arranque.
 *
 * Si el presupuesto se excede a propósito, subí BUDGET_KB_GZIP y dejá dicho
 * por qué en el commit.
 */

import { readFile, readdir } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { gzipSync } from 'zlib'

const BUDGET_KB_GZIP = 260

const __dirname = dirname(fileURLToPath(import.meta.url))
const distDir = join(__dirname, '..', 'dist')

export async function checkEntryBudget() {
  let html
  try {
    html = await readFile(join(distDir, 'index.html'), 'utf8')
  } catch {
    console.log('⏭️  Presupuesto de entrada: no hay dist/index.html, salteado.')
    return true
  }

  // El entry es el único <script type="module"> con src propio del build.
  const match = html.match(/<script[^>]+src="([^"]+\.js)"/)
  if (!match) {
    console.log('⏭️  Presupuesto de entrada: no se encontró el script de entrada.')
    return true
  }

  const rel = match[1].replace(/^\//, '')
  let bytes
  try {
    bytes = await readFile(join(distDir, rel))
  } catch {
    console.log(`⏭️  Presupuesto de entrada: no se pudo leer ${rel}.`)
    return true
  }

  const gzipKb = Math.round(gzipSync(bytes).length / 1024)
  const rawKb = Math.round(bytes.length / 1024)

  if (gzipKb > BUDGET_KB_GZIP) {
    console.error('')
    console.error(`❌ El chunk de entrada se pasó del presupuesto: ${gzipKb} KB gzip (máximo ${BUDGET_KB_GZIP} KB).`)
    console.error(`   Archivo: ${rel} — ${rawKb} KB crudos.`)
    console.error('')
    console.error('   Casi siempre es un import estático nuevo que arrastra una librería pesada.')
    console.error('   Para ver qué cadenas llegan a three desde main.jsx:')
    console.error('     node scripts/check-entry-budget.mjs --trace')
    console.error('')
    return false
  }

  console.log(`✅ Chunk de entrada: ${gzipKb} KB gzip (presupuesto ${BUDGET_KB_GZIP} KB).`)
  return true
}

/**
 * Recorre los imports ESTÁTICOS desde src/main.jsx y lista las cadenas que
 * terminan en una dependencia pesada. Lo que aparezca acá se evalúa en el
 * arranque, aunque el componente no se monte nunca.
 */
async function trace(heavy = ['three', '@react-three']) {
  const { existsSync, statSync, readFileSync } = await import('fs')
  const srcDir = join(__dirname, '..', 'src')
  const seen = new Set()
  const chains = []

  const resolve = (from, spec) => {
    if (!spec.startsWith('.')) return null
    const base = join(dirname(from), spec)
    for (const cand of [base, `${base}.js`, `${base}.jsx`, join(base, 'index.js'), join(base, 'index.jsx')]) {
      if (existsSync(cand) && statSync(cand).isFile()) return cand
    }
    return null
  }

  const walk = (file, chain) => {
    if (seen.has(file)) return
    seen.add(file)
    let src
    try { src = readFileSync(file, 'utf8') } catch { return }
    const re = /^\s*import\s+(?:[^'"]*?from\s+)?['"]([^'"]+)['"]/gm
    let m
    while ((m = re.exec(src))) {
      const spec = m[1]
      if (heavy.some((h) => spec === h || spec.startsWith(`${h}/`))) {
        chains.push(`${chain.concat(file.replace(srcDir, 'src')).join(' → ')}  ⇒ ${spec}`)
        continue
      }
      const next = resolve(file, spec)
      if (next) walk(next, chain.concat(file.replace(srcDir, 'src')))
    }
  }

  walk(join(srcDir, 'main.jsx'), [])
  const uniq = [...new Set(chains)]
  if (!uniq.length) {
    console.log('✅ Ninguna cadena de imports estáticos desde main.jsx llega a three.')
  } else {
    console.log('Cadenas estáticas que arrastran three al arranque:')
    uniq.forEach((c) => console.log(' •', c))
  }
}

const invokedDirectly = process.argv[1] && process.argv[1].endsWith('check-entry-budget.mjs')
if (invokedDirectly) {
  if (process.argv.includes('--trace')) {
    await trace()
  } else {
    const ok = await checkEntryBudget()
    process.exit(ok ? 0 : 1)
  }
}
