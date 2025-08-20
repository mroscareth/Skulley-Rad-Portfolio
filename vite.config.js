import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite configuration for the interactive portal site.
// We enable the React plugin to get fast refresh and JSX support.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
})