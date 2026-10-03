import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { defineConfig } from 'vite'

// `npm run dev:https` serves over HTTPS on your LAN so you can log in to
// Spotify from your phone (Spotify only allows http for 127.0.0.1).
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [react(), ...(mode === 'https' ? [basicSsl()] : [])],
  server: { host: true },
}))
