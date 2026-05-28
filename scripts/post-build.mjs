/**
 * Post-build script
 * 
 * By default, KEEPS uploads in dist/ for initial deployment.
 * Use CLEAN_UPLOADS=1 to remove uploads (for updates after initial deploy).
 * 
 * Usage:
 *   npm run build              - Keeps uploads (for first deploy or full sync)
 *   npm run build:update       - Removes uploads (for updates, preserves server uploads)
 */

import { rm, access, mkdir, writeFile, readdir, readFile } from 'fs/promises'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const distDir = join(__dirname, '..', 'dist')
const uploadsDir = join(distDir, 'uploads')
const songsDir = join(distDir, 'songs')

// Check if we should clean uploads (via --clean flag or env var)
const cleanUploads = process.argv.includes('--clean') || process.env.CLEAN_UPLOADS === '1'

async function main() {
  console.log('\n📦 Post-build: Preparing dist/ for deployment...\n')

  // ORDEN CRÍTICO: el cleanup de dist/songs/ y dist/uploads/ corre PRIMERO,
  // antes del sanity check del config. Razón: si el config falla y el script
  // aborta con exit(1) antes del cleanup, dist/songs/ queda con la copia local
  // (heredada de vite copiar public/songs/) → el usuario hace deploy por FTP
  // sin darse cuenta y SOBRESCRIBE el manifest del server, "desapareciendo"
  // las canciones subidas via CMS. Hacer cleanup primero garantiza que dist/
  // siempre quede en estado seguro para deploy, pase o no el sanity check.
  if (cleanUploads) {
    // Remove uploads folder from dist (for update deployments)
    try {
      await access(uploadsDir)
      await rm(uploadsDir, { recursive: true, force: true })
      console.log('✅ Removed dist/uploads/ (CLEAN_UPLOADS mode)')
    } catch (e) {
      console.log('ℹ️  No uploads folder in dist/')
    }

    // Create empty uploads folder with just .htaccess
    try {
      await mkdir(uploadsDir, { recursive: true })
      await writeFile(join(uploadsDir, '.gitkeep'), '')
      await writeHtaccess()
      console.log('✅ Created empty dist/uploads/ with .htaccess')
    } catch (e) {
      console.error('⚠️  Could not create uploads folder:', e.message)
    }

    // Remove songs folder from dist (for update deployments).
    // En prod, public_html/songs/ + songs/manifest.json son la fuente de verdad:
    // el CMS (music.php) sube mp3 y reescribe el manifest ahí. Si dejamos dist/songs/
    // (copia estática de public/songs/, siempre desactualizada), el deploy pisa el
    // manifest del server y las canciones subidas por CMS "desaparecen".
    try {
      await access(songsDir)
      await rm(songsDir, { recursive: true, force: true })
      console.log('✅ Removed dist/songs/ (preserves CMS-uploaded songs on server)')
    } catch (e) {
      console.log('ℹ️  No songs folder in dist/')
    }

    console.log('\n✨ Build ready for UPDATE deployment!')
    console.log('\n📋 Deploy instructions:')
    console.log('   1. Upload dist/ contents to public_html/')
    console.log('   2. Server uploads/ y songs/ NO se sobreescriben')
    console.log('   3. config.local.php SE incluye — va a sobreescribir el del server')
    console.log('      (si las credenciales de local coinciden con prod está OK)\n')
  } else {
    // Keep uploads in dist (for initial deployment or full sync)
    try {
      const files = await readdir(uploadsDir, { recursive: true })
      const count = files.filter(f => !f.startsWith('.')).length
      console.log(`✅ Keeping dist/uploads/ with ${count} files`)

      // Add .htaccess if not present
      await writeHtaccess()
      console.log('✅ Added .htaccess to dist/uploads/')
    } catch (e) {
      console.log('ℹ️  No uploads folder in dist/')
    }

    console.log('\n✨ Build ready for FULL deployment!')
    console.log('\n📋 Deploy instructions:')
    console.log('   1. Upload dist/ contents to public_html/')
    console.log('   2. This will include all uploads/')
    console.log('\n⚠️  For future updates (to preserve server uploads), use:')
    console.log('   npm run build:update\n')
  }

  // Sanity check del config.local.php — corre AL FINAL (después del cleanup)
  // para que un config faltante o stub no pueda dejar dist/songs/ con la copia
  // local que sobrescribiría el manifest del server al hacer FTP.
  const configLocal = join(distDir, 'api', 'config.local.php')
  try {
    await access(configLocal)
    const contents = await readFile(configLocal, 'utf8')
    const looksLikeStub = (
      contents.includes('TU_PASSWORD_AQUI') ||
      contents.includes('TU_CLIENT_ID') ||
      contents.includes('u123456789_') || // placeholder del example
      contents.trim().length < 200
    )
    if (looksLikeStub) {
      console.error('\n❌ dist/api/config.local.php parece ser el template/stub.')
      console.error('   Editá public/api/config.local.php con los valores reales de prod ANTES de buildear.')
      console.error('   (DB creds, OAuth keys, SMTP, Shopify Admin token, etc.)\n')
      process.exit(1)
    }
    console.log('✅ Keeping dist/api/config.local.php (passed sanity check)')
  } catch (e) {
    if (e.code === 'ENOENT') {
      console.error('\n❌ public/api/config.local.php no existe — el build no incluye credenciales de prod.')
      console.error('   Bajalo desde public_html/api/config.local.php del server (FileZilla) y ponelo en public/api/.')
      console.error('   (Está en .gitignore — solo vive local y en prod.)\n')
      console.error('   ⚠️  Aunque este check falle, dist/songs/ ya quedó limpio — si subis ahora,')
      console.error('       las canciones del CMS no se borran, PERO el server se queda sin config y rompe.\n')
      process.exit(1)
    }
    throw e
  }
}

async function writeHtaccess() {
  const htaccess = `# MIME types for media files
AddType video/mp4 .mp4
AddType video/webm .webm
AddType image/jpeg .jpg .jpeg
AddType image/png .png
AddType image/webp .webp
AddType image/gif .gif

# Allow direct access to files
<IfModule mod_rewrite.c>
    RewriteEngine Off
</IfModule>

# Enable CORS for media files
<IfModule mod_headers.c>
    <FilesMatch "\\.(mp4|webm|jpg|jpeg|png|webp|gif)$">
        Header set Access-Control-Allow-Origin "*"
    </FilesMatch>
</IfModule>

# Prevent PHP execution (security)
<FilesMatch "\\.php$">
    Order Deny,Allow
    Deny from all
</FilesMatch>
`
  await writeFile(join(uploadsDir, '.htaccess'), htaccess)
}

main().catch(console.error)
