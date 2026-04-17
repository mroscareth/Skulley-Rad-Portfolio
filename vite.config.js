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
    // Vite's default modulePreload pre-warms all transitive chunks. We want:
    // - HomeCanvas + three-stack + postfx preloaded (scene is visible RIGHT AFTER
    //   the boot terminal finishes; if we truly-lazy them, shaders compile mid-fall
    //   and the character's first seconds feel laggy).
    // - auth-web3 / admin-libs / Section[2-5] / AdminApp truly lazy (only download
    //   when the user actually navigates to them).
    modulePreload: {
      resolveDependencies: (_filename, deps) => deps.filter((dep) => (
        !/\b(auth-web3|admin-libs|AdminApp|Section[2-5]|AnalyticsDashboard|MusicEditor|BlogEditor|ProjectEditor|AboutEditor|CodesEditor|UsersPanel|ContactInbox)[-.]/.test(dep)
      )),
    },
    commonjsOptions: {
      transformMixedEsModules: true,
      // `auto` (default) para evitar romper React interop al separar chunks.
      requireReturnsDefault: 'auto',
      // CRÍTICO: `strictRequires: true` envuelve cada módulo CJS en una función
      // lazy que sólo se ejecuta al primer `require()`. Esto desacopla la
      // inicialización entre chunks y evita la carrera donde un chunk lee
      // un binding que aún no se resolvió (el famoso
      // "Cannot read properties of undefined (reading 'useLayoutEffect')"
      // que sale cuando react-reconciler/CJS se evalúa antes que React).
      strictRequires: true,
    },
    rollupOptions: {
      // Sin manualChunks: cualquier split manual que involucre React (o sus
      // wrappers CJS) crea dependencias circulares entre chunks porque Rollup
      // comparte el código de React y los helpers `@rollup/plugin-commonjs`
      // a través de cross-chunk imports. El resultado es chunks "lazy" que se
      // vuelven eager y race conditions de evaluación que truenan con
      // "Cannot read properties of undefined (reading 'useLayoutEffect')".
      // Con auto-chunking, Rollup genera un chunk por cada `lazy()` boundary
      // más los shared que necesite — sin ciclos.
      output: {
        // (intencionalmente vacío — ver comentario arriba)
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