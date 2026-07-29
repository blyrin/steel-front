import { defineWebSocketHandler } from 'nitro'
import { pack, unpack } from 'msgpackr'
import { z } from 'zod'
import {
  MAX_MESSAGE_BYTES,
  MESSAGE_RATE_LIMIT,
  MULTIPLAYER_PROTOCOL,
} from '#shared/protocol'
import { getSessionFromRequest } from '../utils/auth.js'
import { multiplayer } from '../utils/multiplayer.js'

const loadout = z.object({
  weapon: z.enum(['garand', 'shotgun', 'thompson', 'bar']),
  secondary: z.enum(['c4', 'rpg']),
  grenade: z.enum(['frag', 'smoke']),
  item: z.enum(['medkit', 'ammoPouch']),
})
const messageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('quick_match'), modeId: z.enum(['classic', 'zombie']) }),
  z.object({ type: z.literal('create_room'), modeId: z.enum(['classic', 'zombie']), name: z.string().trim().min(1).max(20).refine(value => !/[\p{Cc}\p{Cf}]/u.test(value)), visibility: z.enum(['public', 'private']) }),
  z.object({ type: z.literal('join_room'), roomId: z.string().uuid().optional(), invite: z.string().regex(/^[2-9A-HJ-NP-Z]{6}$/).optional() }).refine(value => value.roomId || value.invite),
  z.object({ type: z.literal('change_team'), team: z.enum(['allies', 'axis']) }),
  z.object({ type: z.literal('leave_room') }),
  z.object({ type: z.literal('kick_member'), userId: z.string().uuid() }),
  z.object({ type: z.literal('start_match') }),
  z.object({ type: z.literal('deploy'), spawnId: z.string().min(1).max(40), loadout }),
  z.object({ type: z.literal('redeploy') }),
  z.object({
    type: z.literal('chat'),
    channel: z.enum(['world', 'room', 'squad']),
    text: z.string().trim().min(1).max(160).refine(value => !/[\p{Cc}\p{Cf}]/u.test(value)),
  }),
  z.object({ type: z.literal('request_resync') }),
  z.object({ type: z.literal('ping'), at: z.number().finite() }),
])

const INPUT_BOOLS = ['crouch', 'sprint', 'aim', 'fire']

function parseClientMessage(bytes) {
  let message = unpack(bytes)
  if (Array.isArray(message)) {
    if (message.length !== 11) throw new Error('输入消息无效')
    message = {
      type: 'input', seq: message[0], moveX: message[1], moveZ: message[2],
      yaw: message[3], pitch: message[4], slot: message[5], crouch: message[6],
      sprint: message[7], aim: message[8], fire: message[9], actions: message[10],
    }
  }
  if (message?.type !== 'input') return messageSchema.parse(message)
  if (!Number.isSafeInteger(message.seq) || message.seq < 0 ||
    !Number.isFinite(message.moveX) || message.moveX < -1 || message.moveX > 1 ||
    !Number.isFinite(message.moveZ) || message.moveZ < -1 || message.moveZ > 1 ||
    !Number.isFinite(message.yaw) || !Number.isFinite(message.pitch) ||
    message.pitch < -1.6 || message.pitch > 1.6 ||
    (message.slot !== 1 && message.slot !== 2) ||
    !Number.isSafeInteger(message.actions) || message.actions < 0 || message.actions > 127 ||
    INPUT_BOOLS.some(key => typeof message[key] !== 'boolean'))
    throw new Error('输入消息无效')
  return message
}

export default defineWebSocketHandler({
  async upgrade(request) {
    if (new URL(request.url).searchParams.get('protocol') !== String(MULTIPLAYER_PROTOCOL))
      throw new Response('协议版本不兼容', { status: 426 })
    const origin = request.headers.get('origin')
    if (origin && new URL(origin).host !== new URL(request.url).host)
      throw new Response('来源无效', { status: 403 })
    const user = await getSessionFromRequest(request)
    if (!user) throw new Response('未登录', { status: 401 })
    return { context: { user } }
  },
  open(peer) {
    multiplayer.attach(peer, peer.context.user)
  },
  message(peer, raw) {
    const bytes = raw.uint8Array()
    if (bytes.byteLength > MAX_MESSAGE_BYTES) return peer.close(1009, '消息过大')
    const connection = multiplayer.connections.get(peer.context.user.id)
    try {
      const now = Date.now()
      if (!connection.messageWindowAt || now - connection.messageWindowAt >= 1000) {
        connection.messageWindowAt = now
        connection.messageCount = 0
      }
      if (++connection.messageCount > MESSAGE_RATE_LIMIT) return peer.close(1008, '消息频率过高')
      const message = parseClientMessage(bytes)
      multiplayer.handle(connection, message)
    } catch (error) {
      peer.send(pack({ type: 'error', message: error.issues?.[0]?.message || error.message }))
    }
  },
  close(peer) {
    multiplayer.detach(peer)
  },
  error(peer, error) {
    console.error('联机连接错误', peer.id, error)
  },
})
