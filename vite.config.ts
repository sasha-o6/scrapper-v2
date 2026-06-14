import preact from '@preact/preset-vite'
import { defineConfig } from 'vite'
import { resolve } from 'node:path'

export default defineConfig({
  plugins: [preact()],
  resolve: {
    alias: {
      '@backend': resolve(__dirname, 'src/backend'),
      '@frontend': resolve(__dirname, 'src/frontend'),
      '@shared': resolve(__dirname, 'src/shared')
    }
  },
  build: {
    outDir: 'dist/client',
    emptyOutDir: true
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000'
    }
  }
})
