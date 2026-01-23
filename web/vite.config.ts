import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// Check if certs exist for HTTPS
const certsPath = path.resolve(__dirname, '../certs')
const hasCerts = fs.existsSync(path.join(certsPath, 'cert.pem')) && fs.existsSync(path.join(certsPath, 'key.pem'))

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    https: hasCerts ? {
      key: fs.readFileSync(path.join(certsPath, 'key.pem')),
      cert: fs.readFileSync(path.join(certsPath, 'cert.pem')),
    } : undefined,
    proxy: {
      '/api': {
        target: 'https://localhost:8080',
        changeOrigin: true,
        ws: true,
        secure: false, // Accept self-signed certs
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
})
