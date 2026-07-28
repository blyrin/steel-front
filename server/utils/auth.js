import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { hash, verify } from '@node-rs/argon2'
import { RateLimiterMemory } from 'rate-limiter-flexible'
import { deleteCookie, getCookie, getRequestIP, setCookie } from 'nitro/h3'
import { ensureDatabase } from './database.js'

const COOKIE = 'steel_front_session'
const SESSION_MS = 30 * 24 * 60 * 60 * 1000
const loginIpLimiter = new RateLimiterMemory({ points: 10, duration: 600 })
const loginUserLimiter = new RateLimiterMemory({ points: 5, duration: 600 })
const registerLimiter = new RateLimiterMemory({ points: 5, duration: 3600 })

async function consume(limiter, key) {
  try {
    await limiter.consume(key)
  } catch {
    throw new Response('请求过于频繁', { status: 429 })
  }
}

function tokenHash(token) {
  return createHash('sha256').update(token).digest('hex')
}

function publicUser(row) {
  return row ? { id: row.id, username: row.username, displayName: row.display_name } : null
}

function cookieOptions(event) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: new URL(event.req.url).protocol === 'https:',
    path: '/',
    maxAge: SESSION_MS / 1000,
  }
}

export async function passwordHash(password) {
  return hash(password, { memoryCost: 19 * 1024, timeCost: 2, parallelism: 1 })
}

export async function createSession(event, userId) {
  const db = await ensureDatabase()
  const token = randomBytes(32).toString('base64url')
  const now = Date.now()
  await db.sql`INSERT INTO sessions(token_hash, user_id, created_at, last_used_at, expires_at)
    VALUES (${tokenHash(token)}, ${userId}, ${now}, ${now}, ${now + SESSION_MS})`
  setCookie(event, COOKIE, token, cookieOptions(event))
}

export async function getSession(event) {
  const token = getCookie(event, COOKIE)
  if (!token) return null
  const db = await ensureDatabase()
  const now = Date.now()
  const result = await db.sql`SELECT users.id, users.username, users.display_name, sessions.token_hash
    FROM sessions JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ${tokenHash(token)} AND sessions.expires_at > ${now}`
  const row = result.rows?.[0]
  if (!row) return null
  await db.sql`UPDATE sessions SET last_used_at = ${now} WHERE token_hash = ${row.token_hash}`
  return { user: publicUser(row), tokenHash: row.token_hash }
}

export async function getSessionFromRequest(request) {
  const cookieHeader = request.headers.get('cookie') || ''
  const token = cookieHeader.split(';').map(part => part.trim()).find(part => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1)
  if (!token) return null
  const db = await ensureDatabase()
  const result = await db.sql`SELECT users.id, users.username, users.display_name
    FROM sessions JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ${tokenHash(decodeURIComponent(token))} AND sessions.expires_at > ${Date.now()}`
  return publicUser(result.rows?.[0])
}

export async function requireSession(event) {
  const session = await getSession(event)
  if (!session) throw new Response('未登录', { status: 401 })
  return session
}

export async function revokeCurrentSession(event) {
  const token = getCookie(event, COOKIE)
  if (token) {
    const db = await ensureDatabase()
    await db.sql`DELETE FROM sessions WHERE token_hash = ${tokenHash(token)}`
  }
  deleteCookie(event, COOKIE, { path: '/' })
}

export async function registerUser(event, { username, displayName, password }) {
  await consume(registerLimiter, getRequestIP(event) || 'unknown')
  const db = await ensureDatabase()
  const id = randomUUID()
  const now = Date.now()
  const passwordValue = await passwordHash(password)
  try {
    await db.sql`INSERT INTO users(id, username, display_name, password_hash, created_at, updated_at)
      VALUES (${id}, ${username.toLowerCase()}, ${displayName}, ${passwordValue}, ${now}, ${now})`
  } catch (error) {
    if (String(error).includes('UNIQUE')) throw new Response('用户名已存在', { status: 409 })
    throw error
  }
  await createSession(event, id)
  return { id, username: username.toLowerCase(), displayName }
}

export async function loginUser(event, { username, password }) {
  const ip = getRequestIP(event) || 'unknown'
  await Promise.all([consume(loginIpLimiter, ip), consume(loginUserLimiter, username.toLowerCase())])
  const db = await ensureDatabase()
  const result = await db.sql`SELECT * FROM users WHERE username = ${username.toLowerCase()}`
  const row = result.rows?.[0]
  if (!row || !(await verify(row.password_hash, password)))
    throw new Response('用户名或密码错误', { status: 401 })
  await createSession(event, row.id)
  return publicUser(row)
}

export async function verifyUserPassword(userId, password) {
  const db = await ensureDatabase()
  const result = await db.sql`SELECT password_hash FROM users WHERE id = ${userId}`
  const row = result.rows?.[0]
  return !!row && verify(row.password_hash, password)
}

export function assertSameOrigin(event) {
  const origin = event.req.headers.get('origin')
  if (!origin) return
  if (new URL(origin).host !== new URL(event.req.url).host)
    throw new Response('来源无效', { status: 403 })
}
