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
          // Single vendor chunk to avoid TDZ errors from circular deps
          // between three.js / @react-three / postprocessing
          if (id.includes('node_modules')) return 'vendor'
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