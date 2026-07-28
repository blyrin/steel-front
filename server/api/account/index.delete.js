import { defineHandler } from 'nitro'
import { deleteCookie } from 'nitro/h3'
import { z } from 'zod'
import { assertSameOrigin, requireSession, verifyUserPassword } from '../../utils/auth.js'
import { ensureDatabase } from '../../utils/database.js'
import { validatedBody } from '../../utils/http.js'
import { multiplayer } from '../../utils/multiplayer.js'

export default defineHandler(async event => {
  assertSameOrigin(event)
  const { user } = await requireSession(event)
  const { password } = await validatedBody(event, z.object({ password: z.string().max(128) }))
  if (!(await verifyUserPassword(user.id, password))) throw new Response('密码错误', { status: 401 })
  multiplayer.removeUser(user.id)
  const db = await ensureDatabase()
  await db.sql`DELETE FROM users WHERE id = ${user.id}`
  deleteCookie(event, 'steel_front_session', { path: '/' })
  return { ok: true }
})
