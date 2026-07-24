import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages project site: https://<user>.github.io/sprint-lens/
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react()],
  build: {
    cssMinify: 'esbuild',
  },
})
