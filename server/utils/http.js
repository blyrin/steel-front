import { readBody } from 'nitro/h3'
import { ZodError } from 'zod'

export async function validatedBody(event, schema) {
  try {
    return schema.parse(await readBody(event))
  } catch (error) {
    if (error instanceof ZodError) throw new Response(error.issues[0]?.message || '请求无效', { status: 400 })
    throw error
  }
}
