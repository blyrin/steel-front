import { defineHandler } from 'nitro'
import { deleteCookie } from 'nitro/h3'
import { assertSameOrigin, requireSession } from '../../utils/auth.js'
import { ensureDatabase } from '../../utils/database.js'

export default defineHandler(async event => {
  assertSameOrigin(event)
  const { user } = await requireSession(event)
  const db = await ensureDatabase()
  await db.sql`DELETE FROM sessions WHERE user_id = ${user.id}`
  deleteCookie(event, 'steel_front_session', { path: '/' })
  return { ok: true }
})
