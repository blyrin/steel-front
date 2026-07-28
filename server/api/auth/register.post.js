import { defineHandler } from 'nitro'
import { z } from 'zod'
import { assertSameOrigin, registerUser } from '../../utils/auth.js'
import { validatedBody } from '../../utils/http.js'

const schema = z.object({
  username: z.string().regex(/^[A-Za-z0-9_]{3,20}$/, '用户名须为 3-20 位字母、数字或下划线'),
  displayName: z.string().trim().min(1).max(16).refine(value => !/[\p{Cc}\p{Cf}]/u.test(value), '昵称包含无效字符'),
  password: z.string().min(10, '密码至少 10 位').max(128),
})

export default defineHandler(async event => {
  assertSameOrigin(event)
  return { user: await registerUser(event, await validatedBody(event, schema)) }
})
