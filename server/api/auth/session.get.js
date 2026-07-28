import { defineHandler } from 'nitro'
import { getSession } from '../../utils/auth.js'

export default defineHandler(async event => {
  const session = await getSession(event)
  return { authenticated: !!session, user: session?.user ?? null }
})
