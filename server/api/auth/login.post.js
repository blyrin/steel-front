import { defineHandler } from 'nitro'
import { z } from 'zod'
import { assertSameOrigin, loginUser } from '../../utils/auth.js'
import { validatedBody } from '../../utils/http.js'

const schema = z.object({
  username: z.string().min(3).max(20),
  password: z.string().min(1).max(128),
})

export default defineHandler(async event => {
  assertSameOrigin(event)
  return { user: await loginUser(event, await validatedBody(event, schema)) }
})
