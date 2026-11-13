import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const api = `http://127.0.0.1:${process.env.CYGNET_PORT || '4179'}`

export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': api, '/media': api } },
})
