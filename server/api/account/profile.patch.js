import { defineHandler } from 'nitro'
import { z } from 'zod'
import { assertSameOrigin, requireSession } from '../../utils/auth.js'
import { ensureDatabase } from '../../utils/database.js'
import { validatedBody } from '../../utils/http.js'

const schema = z.object({ displayName: z.string().trim().min(1).max(16).refine(value => !/[\p{Cc}\p{Cf}]/u.test(value), '昵称包含无效字符') })

export default defineHandler(async event => {
  assertSameOrigin(event)
  const { user } = await requireSession(event)
  const { displayName } = await validatedBody(event, schema)
  const db = await ensureDatabase()
  await db.sql`UPDATE users SET display_name = ${displayName}, updated_at = ${Date.now()} WHERE id = ${user.id}`
  return { user: { ...user, displayName } }
})
