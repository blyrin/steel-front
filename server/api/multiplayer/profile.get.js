import { defineHandler } from 'nitro'
import { requireSession } from '../../utils/auth.js'
import { profileStats } from '../../utils/stats.js'

export default defineHandler(async event => {
  const { user } = await requireSession(event)
  return { stats: await profileStats(user.id) }
})
