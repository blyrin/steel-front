import { defineHandler } from 'nitro'
import { assertSameOrigin, revokeCurrentSession } from '../../utils/auth.js'

export default defineHandler(async event => {
  assertSameOrigin(event)
  await revokeCurrentSession(event)
  return { ok: true }
})
