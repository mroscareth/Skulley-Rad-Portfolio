import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite configuration for the interactive portal site.
// We enable the React plugin to get fast refresh and JSX support.
export default defineConfig(({ mode }) => ({
  // Base URL del sitio. Para mroscar.xyz (root) debe ser "/".
  // Si algún día lo sirves bajo subcarpeta (ej. /development/), define VITE_BASE="/development/" al build.
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom', 'three'],
  },
  build: {
    sourcemap: false,
    target: 'es2020',
    cssMinify: true,
    // Use esbuild for minification (safer than terser for TDZ edge cases)
    minify: 'esbuild',
    commonjsOptions: {
      transformMixedEsModules: true,
      requireReturnsDefault: 'preferred',
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          // Privy + Solana wallet connectors: se cargan sólo cuando el
          // usuario solicita login (lazy via src/auth/AuthShell.jsx).
          // Separarlos del vendor evita descargar ~500KB gzip al primer paint.
          if (
            id.includes('@privy-io') ||
            id.includes('@solana') ||
            id.includes('viem') ||
            id.includes('@wagmi') ||
            id.includes('wagmi') ||
            id.includes('@walletconnect') ||
            id.includes('@coinbase/wallet-sdk') ||
            id.includes('@metamask') ||
            id.includes('eciesjs') ||
            id.includes('ethers') ||
            id.includes('permissionless')
          ) {
            return 'auth-web3'
          }
          // Postprocessing: se usa sólo desde PostFX y CharacterPortrait,
          // ambos lazy-cargados desde App.jsx. Al separarlo del vendor,
          // sólo se descarga cuando la escena pide efectos.
          if (
            id.includes('@react-three/postprocessing') ||
            id.includes('node_modules/postprocessing')
          ) {
            return 'postfx'
          }
          // Admin-only: TipTap, @dnd-kit, Leaflet, html2canvas, jsmediatags.
          // Sólo se alcanzan a través del chunk lazy AdminApp — no deben
          // estar en el bundle eager.
          if (
            id.includes('@tiptap') ||
            id.includes('prosemirror') ||
            id.includes('@dnd-kit') ||
            id.includes('node_modules/leaflet') ||
            id.includes('react-leaflet') ||
            id.includes('html2canvas') ||
            id.includes('jsmediatags')
          ) {
            return 'admin-libs'
          }
          // Todo lo demás queda en un único vendor chunk para evitar
          // TDZ errors por circular deps entre three / @react-three.
          return 'vendor'
        },
      },
      onwarn(warning, warn) {
        if (warning.code === 'THIS_IS_UNDEFINED') return
        warn(warning)
      },
    },
  },
  server: {
    port: 5173,
    // Proxy /api requests to a local PHP server for dev testing.
    // Run: php -S localhost:8080 -t public  (from project root)
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
}))