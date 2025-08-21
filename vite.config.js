import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite configuration for the interactive portal site.
// We enable the React plugin to get fast refresh and JSX support.
export default defineConfig(({ mode }) => ({
  // En producción servimos bajo /development/ por defecto, sobreescribible con VITE_BASE
  base: process.env.VITE_BASE || (mode === 'production' ? '/development/' : '/'),
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom', 'three'],
  },
  build: {
    sourcemap: false,
    target: 'es2020',
    cssMinify: true,
    // Desactivar minificación para evitar errores TDZ en vendor-postfx en prod
    minify: false,
    commonjsOptions: {
      transformMixedEsModules: true,
      requireReturnsDefault: 'preferred',
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Un único vendor para evitar interop/ciclos CJS ↔ ESM entre chunks
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
  },
}))