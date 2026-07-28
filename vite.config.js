import { defineConfig } from 'vite'

import { cloudflare } from "@cloudflare/vite-plugin";

const port = Number(process.env.PORT) || 5173

export default defineConfig({
  plugins: [cloudflare()],
  server: {
    host: '0.0.0.0',
    port,
    strictPort: true,
  },
  preview: {
    host: '0.0.0.0',
    port,
    strictPort: true,
  },
})