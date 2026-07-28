import { definePlugin } from 'nitro'
import { ensureDatabase } from '../utils/database.js'
import { multiplayer } from '../utils/multiplayer.js'

export default definePlugin(nitro => {
  ensureDatabase().catch(error => nitro.captureError(error, { tags: ['database', 'startup'] }))
  nitro.hooks.hook('close', () => multiplayer.close())
})
