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

import { rm, access, mkdir, writeFile, readdir } from 'fs/promises'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const distDir = join(__dirname, '..', 'dist')
const uploadsDir = join(distDir, 'uploads')

// Check if we should clean uploads (via --clean flag or env var)
const cleanUploads = process.argv.includes('--clean') || process.env.CLEAN_UPLOADS === '1'

async function main() {
  console.log('\n📦 Post-build: Preparing dist/ for deployment...\n')

  // Remove config.local.php from dist — NEVER overwrite production config
  const configLocal = join(distDir, 'api', 'config.local.php')
  try {
    await access(configLocal)
    await rm(configLocal)
    console.log('✅ Removed dist/api/config.local.php (protects production config)')
  } catch (e) { /* does not exist */ }

  // Remove any test/diagnostic scripts
  try {
    const apiDir = join(distDir, 'api')
    const apiFiles = await readdir(apiDir)
    for (const f of apiFiles.filter(f => f.startsWith('test-') && f.endsWith('.php'))) {
      await rm(join(apiDir, f))
      console.log(`✅ Removed dist/api/${f} (test file)`)
    }
  } catch (e) { /* no api dir */ }

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

    console.log('\n✨ Build ready for UPDATE deployment!')
    console.log('\n📋 Deploy instructions:')
    console.log('   1. Upload dist/ contents to public_html/')
    console.log('   2. Server uploads/ will NOT be overwritten')
    console.log('   3. Only code/assets will be updated\n')
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
