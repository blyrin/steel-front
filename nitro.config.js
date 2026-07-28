import { defineConfig } from 'nitro'

export default defineConfig({
  serverDir: './server',
  features: {
    websocket: true,
  },
  experimental: {
    database: true,
  },
  database: {
    default: {
      connector: 'sqlite',
      options: { name: 'db' },
    },
  },
})
