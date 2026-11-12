import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// En producción, three no revisa los errores de los shaders. Con el chequeo
// prendido (su valor por defecto), el primer uso de cada programa pide su log
// y los de sus dos shaders: llamadas síncronas que esperan a que el proceso de
// la GPU vacíe todo lo que tiene en cola. Medido el 2026-11-11 en el warm-up
// del home detrás del About: 247 ms de un cuadro de 521 ms eran esas llamadas.
// three recomienda apagarlo en producción; en desarrollo sigue prendido para
// ver los errores. Aplica a todos los canvas del sitio, también los del teléfono.
function sinChequeoDeShaders() {
  const BUSCA = 'checkShaderErrors: true,'
  return {
    name: 'sin-chequeo-de-shaders',
    apply: 'build',
    transform(code, id) {
      if (!/[\\/]three[\\/]build[\\/]three\.module(\.min)?\.js$/.test(id)) return null
      if (!code.includes(BUSCA)) {
        this.warn('three ya no trae "checkShaderErrors: true,": revisa el plugin sin-chequeo-de-shaders')
        return null
      }
      return { code: code.replace(BUSCA, 'checkShaderErrors: false,'), map: null }
    },
  }
}

// Vite configuration for the interactive portal site.
// We enable the React plugin to get fast refresh and JSX support.
export default defineConfig(({ mode }) => ({
  // Base URL del sitio. Para skulleyrad.com (root) debe ser "/".
  // Si algún día lo sirves bajo subcarpeta (ej. /development/), define VITE_BASE="/development/" al build.
  base: process.env.VITE_BASE || '/',
  plugins: [react(), sinChequeoDeShaders()],
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
    // API_PROXY=https://skulleyrad.com trae los datos reales (proyectos,
    // tienda, About) sin levantar PHP: solo lectura, para revisar en local.
    proxy: {
      '/api': {
        target: process.env.API_PROXY || 'http://localhost:8080',
        changeOrigin: true,
      },
      // Las imágenes que sube el CMS viven en el servidor.
      ...(process.env.API_PROXY ? { '/uploads': { target: process.env.API_PROXY, changeOrigin: true } } : {}),
    },
  },
}))