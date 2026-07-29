import { randomBytes, randomUUID } from 'node:crypto'
import { pack } from 'msgpackr'
import { CFG, createAuthoritativeSimulation } from '#simulation'
import { MULTIPLAYER_PROTOCOL, RECONNECT_MS, SERVER_TICK_RATE, SNAPSHOT_RATE, roomCapacity } from '#shared/protocol'
import { recordMatch } from './stats.js'

const INVITE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'

function inviteCode() {
  const bytes = randomBytes(6)
  return Array.from(bytes, value => INVITE_ALPHABET[value % INVITE_ALPHABET.length]).join('')
}

function send(peer, value) {
  peer?.send(pack(value))
}

function broadcast(members, value) {
  const bytes = pack(value)
  for (const member of members) member.peer?.send(bytes)
}

class Room {
  constructor(manager, { modeId, name, visibility, system = false }) {
    this.manager = manager
    this.id = randomUUID()
    this.modeId = modeId
    this.name = name
    this.visibility = visibility
    this.system = system
    this.invite = visibility === 'private' ? inviteCode() : null
    this.status = system ? 'countdown' : 'waiting'
    this.countdownAt = system ? Date.now() + 5000 : 0
    this.hostId = null
    this.members = new Map()
    this.kicked = new Set()
    this.simulation = null
    this.startedAt = 0
    this.resultAt = 0
    this.matchId = null
    this.snapshotCounter = 0
  }

  publicState() {
    return {
      id: this.id, modeId: this.modeId, name: this.name, visibility: this.visibility,
      invite: this.invite, status: this.status, capacity: roomCapacity(this.modeId), hostId: this.hostId,
      countdownAt: this.countdownAt,
      members: [...this.members.values()].map(member => ({
        userId: member.user.id, displayName: member.user.displayName, team: member.team,
        connected: !!member.peer, host: member.user.id === this.hostId,
      })),
    }
  }

  broadcast(value) {
    broadcast(this.members.values(), value)
  }

  updateState() {
    this.broadcast({ type: 'room_state', room: this.publicState() })
    this.manager.broadcastLobby()
  }

  sendSnapshots(type, extra = {}, includeDefinitions = false) {
    const snapshot = this.simulation.createSnapshot(null, includeDefinitions)
    for (const member of this.members.values()) {
      if (!member.peer) continue
      const playerId = `player-${member.user.id}`
      send(member.peer, { type, ...extra,
        snapshot: { ...snapshot, player: this.simulation.createPlayerSnapshot(playerId) } })
    }
  }

  chooseTeam() {
    if (this.modeId === 'zombie') return 'allies'
    const counts = { allies: 0, axis: 0 }
    for (const member of this.members.values()) counts[member.team]++
    return counts.allies <= counts.axis ? 'allies' : 'axis'
  }

  join(connection) {
    if (this.kicked.has(connection.user.id)) throw new Error('你已被该房间移除')
    let member = this.members.get(connection.user.id)
    if (!member && this.members.size >= roomCapacity(this.modeId)) throw new Error('房间已满')
    if (!member) {
      member = { user: connection.user, peer: connection.peer, team: this.chooseTeam(), disconnectedAt: 0 }
      this.members.set(connection.user.id, member)
      this.hostId ??= connection.user.id
      if (this.simulation) this.simulation.addPlayer({
        id: `player-${connection.user.id}`, userId: connection.user.id, name: connection.user.displayName,
        team: member.team, loadout: CFG.loadout,
      })
    } else {
      member.peer = connection.peer
      member.disconnectedAt = 0
      this.simulation?.setConnected(`player-${connection.user.id}`, true)
    }
    connection.room = this
    send(connection.peer, { type: 'joined', protocol: MULTIPLAYER_PROTOCOL, room: this.publicState(), playerId: `player-${connection.user.id}` })
    if (this.simulation) {
      const playerId = `player-${connection.user.id}`
      send(connection.peer, { type: 'match_start', map: this.simulation.map,
        snapshot: this.simulation.createSnapshot(playerId, true), playerId })
    }
    this.updateState()
  }

  changeTeam(userId, team) {
    if (this.modeId !== 'classic' || this.simulation) throw new Error('当前不能切换阵营')
    const member = this.members.get(userId)
    if (!member) throw new Error('房间成员不存在')
    member.team = team
    this.updateState()
  }

  disconnect(userId) {
    const member = this.members.get(userId)
    if (!member) return
    member.peer = null
    member.disconnectedAt = Date.now()
    this.simulation?.setConnected(`player-${userId}`, false)
    this.updateState()
  }

  leave(userId, abandoned = false) {
    const member = this.members.get(userId)
    if (!member) return
    if (abandoned && this.simulation && this.status === 'active') {
      const actor = this.simulation.actors.get(`player-${userId}`)
      if (actor) recordMatch(this.matchId, this, actor, false, true).catch(error => console.error('记录放弃失败', error))
    }
    this.members.delete(userId)
    this.simulation?.removePlayer(`player-${userId}`)
    if (this.hostId === userId) this.hostId = this.members.keys().next().value ?? null
    if (!this.members.size) {
      this.manager.rooms.delete(this.id)
      this.manager.broadcastLobby()
    } else this.updateState()
  }

  start() {
    if (this.simulation || !this.members.size) return
    this.status = 'active'
    this.startedAt = Date.now()
    this.matchId = randomUUID()
    this.simulation = createAuthoritativeSimulation({ modeId: this.modeId, seed: Math.floor(Math.random() * 0x100000000) })
    for (const member of this.members.values()) this.simulation.addPlayer({
      id: `player-${member.user.id}`, userId: member.user.id, name: member.user.displayName,
      team: member.team, loadout: CFG.loadout,
    })
    this.sendSnapshots('match_start', { map: this.simulation.map }, true)
    this.updateState()
  }

  finish() {
    if (this.status !== 'active') return
    this.status = 'results'
    this.resultAt = Date.now()
    const snapshot = this.simulation.createSnapshot()
    const winner = snapshot.outcome?.winner
    for (const member of this.members.values()) {
      const actor = this.simulation.actors.get(`player-${member.user.id}`)
      if (!actor) continue
      const won = this.modeId === 'zombie' ? winner === 'allies' : actor.team === winner
      recordMatch(this.matchId, this, actor, won).catch(error => console.error('记录比赛失败', error))
    }
    this.sendSnapshots('match_end')
    this.updateState()
  }

  tick(dt, tick, now, maintenance) {
    if (this.status === 'countdown' && now >= this.countdownAt) this.start()
    if (this.status === 'results' && now - this.resultAt >= 10_000) {
      this.simulation = null
      this.status = this.system ? 'countdown' : 'waiting'
      this.countdownAt = this.system ? now + 5000 : 0
      this.updateState()
    }
    if (maintenance) {
      for (const [userId, member] of this.members) {
        if (!member.peer && member.disconnectedAt && now - member.disconnectedAt >= RECONNECT_MS) this.leave(userId, true)
      }
    }
    if (!this.simulation || this.status !== 'active') return
    this.simulation.step(dt)
    const events = this.simulation.drainEvents()
    if (events.length) this.broadcast({ type: 'events', events })
    if (tick % (SERVER_TICK_RATE / SNAPSHOT_RATE) === 0)
      this.sendSnapshots('snapshot', { tick: this.snapshotCounter++ })
    if (this.simulation.getOutcome()) this.finish()
  }
}

class MultiplayerManager {
  constructor() {
    this.connections = new Map()
    this.rooms = new Map()
    this.tickCount = 0
    this.lastPumpAt = performance.now()
    this.accumulatorMs = 0
    this.schedulerLagMs = 0
    this.tickDurationMs = 0
    this.timer = setInterval(() => this.pump(), 500 / SERVER_TICK_RATE)
    this.timer.unref?.()
  }

  attach(peer, user) {
    const previous = this.connections.get(user.id)
    if (previous?.peer !== peer) previous?.peer.close(4002, '账号已在其他位置连接')
    const reservedRoom = previous?.room ?? [...this.rooms.values()].find(room => room.members.has(user.id)) ?? null
    const connection = { peer, user, room: reservedRoom, messageWindowAt: 0, messageCount: 0 }
    this.connections.set(user.id, connection)
    send(peer, { type: 'hello', protocol: MULTIPLAYER_PROTOCOL, user, rooms: this.roomList() })
    if (connection.room) connection.room.join(connection)
    return connection
  }

  detach(peer) {
    const connection = this.connections.get(peer.context.user.id)
    if (connection?.peer !== peer) return
    connection.room?.disconnect(connection.user.id)
    if (this.connections.get(connection.user.id) === connection) this.connections.delete(connection.user.id)
  }

  roomList() {
    return [...this.rooms.values()].filter(room => room.visibility === 'public').map(room => ({
      id: room.id, modeId: room.modeId, name: room.name, status: room.status,
      players: room.members.size, capacity: roomCapacity(room.modeId),
    }))
  }

  broadcastLobby() {
    const message = { type: 'lobby_snapshot', rooms: this.roomList() }
    const bytes = pack(message)
    for (const connection of this.connections.values()) if (!connection.room) connection.peer?.send(bytes)
  }

  create(connection, values) {
    connection.room?.leave(connection.user.id)
    const room = new Room(this, values)
    this.rooms.set(room.id, room)
    room.join(connection)
    return room
  }

  join(connection, idOrInvite) {
    const room = this.rooms.get(idOrInvite) ?? [...this.rooms.values()].find(item => item.invite === idOrInvite)
    if (!room) throw new Error('房间不存在')
    connection.room?.leave(connection.user.id)
    room.join(connection)
  }

  quickMatch(connection, modeId) {
    let room = [...this.rooms.values()].find(item => item.system && item.modeId === modeId && item.members.size < roomCapacity(modeId))
    room ??= this.create(connection, { modeId, name: modeId === 'classic' ? '快速战场' : '合作防线', visibility: 'public', system: true })
    if (connection.room !== room) room.join(connection)
  }

  chat(connection, channel, text) {
    const room = connection.room
    if (channel === 'world' && ['active', 'results'].includes(room?.status)) throw new Error('对局中没有世界频道')
    if (channel !== 'world' && !room) throw new Error('当前频道不可用')
    const message = {
      type: 'chat', channel, userId: connection.user.id,
      displayName: connection.user.displayName, text, sentAt: Date.now(),
    }
    if (channel === 'world') {
      const recipients = [...this.connections.values()].filter(target =>
        !['active', 'results'].includes(target.room?.status))
      return broadcast(recipients, message)
    }
    if (channel === 'room') return room.broadcast(message)
    const team = room.members.get(connection.user.id).team
    return broadcast([...room.members.values()].filter(member => member.team === team), message)
  }

  handle(connection, message) {
    const room = connection.room
    switch (message.type) {
      case 'quick_match': return this.quickMatch(connection, message.modeId)
      case 'create_room': return this.create(connection, message)
      case 'join_room': return this.join(connection, message.roomId || message.invite)
      case 'change_team':
        if (!room) throw new Error('当前不在房间中')
        return room.changeTeam(connection.user.id, message.team)
      case 'leave_room': room?.leave(connection.user.id, true); connection.room = null; return send(connection.peer, { type: 'left' })
      case 'start_match':
        if (room?.hostId !== connection.user.id || room.status !== 'waiting') throw new Error('只有房主可开赛')
        return room.start()
      case 'kick_member':
        if (room?.hostId !== connection.user.id || room.status !== 'waiting') throw new Error('当前不能移除成员')
        if (message.userId === connection.user.id) throw new Error('不能移除自己')
        room.kicked.add(message.userId)
        room.members.get(message.userId)?.peer?.send(pack({ type: 'kicked' }))
        return room.leave(message.userId)
      case 'deploy':
        if (!room?.simulation?.deployPlayer(`player-${connection.user.id}`, message.spawnId, message.loadout)) throw new Error('部署请求无效')
        return
      case 'redeploy':
        if (!room?.simulation?.redeployPlayer(`player-${connection.user.id}`)) throw new Error('重新部署请求无效')
        return
      case 'chat': return this.chat(connection, message.channel, message.text)
      case 'input': return room?.simulation?.submitInput(`player-${connection.user.id}`, message)
      case 'request_resync':
        if (room?.simulation) {
          const playerId = `player-${connection.user.id}`
          send(connection.peer, { type: 'match_start', map: room.simulation.map,
            snapshot: room.simulation.createSnapshot(playerId, true), playerId })
        }
        return
      case 'ping': return send(connection.peer, { type: 'pong', at: message.at, serverTime: Date.now() })
      default: throw new Error('未知消息')
    }
  }

  removeUser(userId) {
    const connection = this.connections.get(userId)
    connection?.room?.leave(userId, true)
    connection?.peer.close(4001, '账号已注销')
    this.connections.delete(userId)
  }

  pump() {
    const current = performance.now()
    const stepMs = 1000 / SERVER_TICK_RATE
    this.accumulatorMs += Math.min(250, current - this.lastPumpAt)
    this.lastPumpAt = current
    const now = Date.now()
    let steps = 0
    while (this.accumulatorMs >= stepMs && steps < 5) {
      this.tick(now)
      this.accumulatorMs -= stepMs
      steps++
    }
    this.schedulerLagMs = Math.max(0, this.accumulatorMs - stepMs)
  }

  tick(now) {
    const startedAt = performance.now()
    this.tickCount++
    const maintenance = this.tickCount % SERVER_TICK_RATE === 0
    for (const room of this.rooms.values()) room.tick(1 / SERVER_TICK_RATE, this.tickCount, now, maintenance)
    const duration = performance.now() - startedAt
    this.tickDurationMs += (duration - this.tickDurationMs) * 0.1
  }

  close() {
    clearInterval(this.timer)
    for (const connection of this.connections.values()) connection.peer.close(1012, '服务器关闭')
  }
}

export const multiplayer = new MultiplayerManager()
