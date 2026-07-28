import { defineHandler } from 'nitro'
import { randomBytes, createHash } from 'node:crypto'
import { z } from 'zod'
import { assertSameOrigin, passwordHash, requireSession, verifyUserPassword } from '../../utils/auth.js'
import { ensureDatabase } from '../../utils/database.js'
import { validatedBody } from '../../utils/http.js'
import { setCookie } from 'nitro/h3'

const schema = z.object({ currentPassword: z.string().max(128), newPassword: z.string().min(10).max(128) })
const digest = value => createHash('sha256').update(value).digest('hex')

export default defineHandler(async event => {
  assertSameOrigin(event)
  const { user } = await requireSession(event)
  const body = await validatedBody(event, schema)
  if (!(await verifyUserPassword(user.id, body.currentPassword)))
    throw new Response('当前密码错误', { status: 401 })
  const db = await ensureDatabase()
  const token = randomBytes(32).toString('base64url')
  const now = Date.now()
  await db.exec('BEGIN IMMEDIATE')
  try {
    await db.sql`UPDATE users SET password_hash = ${await passwordHash(body.newPassword)}, updated_at = ${now} WHERE id = ${user.id}`
    await db.sql`DELETE FROM sessions WHERE user_id = ${user.id}`
    await db.sql`INSERT INTO sessions(token_hash, user_id, created_at, last_used_at, expires_at)
      VALUES (${digest(token)}, ${user.id}, ${now}, ${now}, ${now + 30 * 24 * 60 * 60 * 1000})`
    await db.exec('COMMIT')
  } catch (error) {
    await db.exec('ROLLBACK')
    throw error
  }
  setCookie(event, 'steel_front_session', token, { httpOnly: true, sameSite: 'lax', secure: new URL(event.req.url).protocol === 'https:', path: '/', maxAge: 30 * 24 * 60 * 60 })
  return { ok: true }
})
