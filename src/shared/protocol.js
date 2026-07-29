export const MULTIPLAYER_PROTOCOL = 6
export const SERVER_TICK_RATE = 60
export const SNAPSHOT_RATE = 15
export const MESSAGE_RATE_LIMIT = 180
export const RECONNECT_MS = 60_000
export const MAX_MESSAGE_BYTES = 8 * 1024
export const CLASSIC_CAPACITY = 12
export const ZOMBIE_CAPACITY = 4

export const ACTOR_FRAME = Object.freeze({
  ID: 0, X: 1, Y: 2, Z: 3, VX: 4, VY: 5, VZ: 6, YAW: 7, PITCH: 8,
  ALIVE: 9, HEALTH: 10, KILLS: 11, DEATHS: 12, STATE: 13,
  TARGET_VISIBLE: 14, RELOADING: 15, CURRENT_HEIGHT: 16, DEPLOYED: 17, WEAPON: 18,
})

export const CLIENT_MESSAGE = Object.freeze({
  QUICK_MATCH: 'quick_match',
  CREATE_ROOM: 'create_room',
  JOIN_ROOM: 'join_room',
  CHANGE_TEAM: 'change_team',
  LEAVE_ROOM: 'leave_room',
  KICK_MEMBER: 'kick_member',
  START_MATCH: 'start_match',
  DEPLOY: 'deploy',
  REDEPLOY: 'redeploy',
  INPUT: 'input',
  CHAT: 'chat',
  RESYNC: 'request_resync',
  PING: 'ping',
})

export function roomCapacity(modeId) {
  return modeId === 'classic' ? CLASSIC_CAPACITY : ZOMBIE_CAPACITY
}

export function sanitizeRoomName(value) {
  return String(value ?? '').normalize('NFKC').replace(/[\p{Cc}\p{Cf}]/gu, '').trim().slice(0, 20)
}

export function validLoadout(loadout, config) {
  return !!loadout &&
    Object.hasOwn(config.weapons, loadout.weapon) &&
    Object.hasOwn(config.secondaries, loadout.secondary) &&
    Object.hasOwn(config.grenades, loadout.grenade) &&
    Object.hasOwn(config.items, loadout.item)
}
