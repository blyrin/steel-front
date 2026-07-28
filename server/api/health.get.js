import { defineHandler } from 'nitro'
import { ensureDatabase } from '../utils/database.js'
import { multiplayer } from '../utils/multiplayer.js'

export default defineHandler(async () => {
  await ensureDatabase()
  return {
    ok: true,
    database: 'ready',
    connections: multiplayer.connections.size,
    rooms: multiplayer.rooms.size,
    schedulerLagMs: Math.round(multiplayer.schedulerLagMs * 100) / 100,
    tickDurationMs: Math.round(multiplayer.tickDurationMs * 100) / 100,
  }
})
