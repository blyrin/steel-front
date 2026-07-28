import { defineHandler } from 'nitro'
import { getQuery } from 'nitro/h3'
import { requireSession } from '../../utils/auth.js'
import { leaderboard } from '../../utils/stats.js'

export default defineHandler(async event => {
  await requireSession(event)
  const mode = getQuery(event).mode
  if (mode !== 'classic' && mode !== 'zombie') throw new Response('模式无效', { status: 400 })
  return { entries: await leaderboard(mode) }
})
