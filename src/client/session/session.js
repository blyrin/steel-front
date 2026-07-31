import { CFG, createAuthoritativeSimulation } from '#simulation'
import { pack, unpack } from 'msgpackr'
import { MULTIPLAYER_PROTOCOL, SERVER_TICK_RATE, SNAPSHOT_RATE } from '#shared/protocol'
import { recordMatchResult, saveRecords } from '../game/state.js'

export class LocalSession {
  constructor(handlers, records) {
    this.handlers = handlers
    this.records = records
    this.playerId = 'player-local'
    this.simulation = null
    this.tickCount = 0
    this.snapshotCount = 0
    this.lastPumpAt = 0
    this.accumulator = 0
    this.timer = 0
    this.ended = false
    this.paused = false
  }

  start(modeId, team = 'allies', classic = null) {
    this.simulation = createAuthoritativeSimulation({
      modeId,
      seed: Math.floor(Math.random() * 0x100000000),
      classic,
    })
    this.simulation.addPlayer({
      id: this.playerId,
      userId: 'local',
      name: '你',
      team,
      loadout: CFG.loadout,
    })
    this.handlers.message({
      type: 'match_start',
      playerId: this.playerId,
      map: this.simulation.map,
      snapshot: this.simulation.createSnapshot(this.playerId, true),
    })
    this.lastPumpAt = performance.now()
    this.timer = setInterval(() => this.pump(), 500 / SERVER_TICK_RATE)
  }

  send(message) {
    if (message.type === 'deploy') {
      this.simulation.deployPlayer(this.playerId, message.spawnId, message.loadout)
    } else if (message.type === 'redeploy') {
      this.simulation.redeployPlayer(this.playerId)
    } else if (message.type === 'leave_room') this.close()
    return true
  }

  sendInput(input) {
    this.simulation.submitInput(this.playerId, input)
    return true
  }

  canPause() {
    return true
  }

  setPaused(paused) {
    this.paused = paused
    this.accumulator = 0
    this.lastPumpAt = performance.now()
  }

  pump() {
    const now = performance.now()
    const stepMs = 1000 / SERVER_TICK_RATE
    if (this.paused) {
      this.lastPumpAt = now
      return
    }
    this.accumulator += Math.min(250, now - this.lastPumpAt)
    this.lastPumpAt = now
    let steps = 0
    while (this.accumulator >= stepMs && steps < 5 && !this.ended) {
      this.simulation.step(1 / SERVER_TICK_RATE)
      this.tickCount++
      this.accumulator -= stepMs
      steps++
      const events = this.simulation.drainEvents()
      for (const event of events) {
        if (event.type !== 'elimination') continue
        const records = this.records[this.simulation.modeId]
        if (event.victimId === this.playerId) records.deaths++
        if (event.attackerId === this.playerId) {
          records.kills++
          if (event.headshot) records.headshots++
          if (event.attackType === 'melee') records.meleeKills++
          if (event.attackType === 'grenade') records.grenadeKills++
          records.bestKillStreak = Math.max(records.bestKillStreak, event.killStreak)
        }
        saveRecords(this.records)
      }
      if (events.length) this.handlers.message({ type: 'events', events })
      if (this.tickCount % (SERVER_TICK_RATE / SNAPSHOT_RATE) === 0) {
        this.handlers.message({
          type: 'snapshot',
          tick: this.snapshotCount++,
          snapshot: this.simulation.createSnapshot(this.playerId),
        })
      }
      if (this.simulation.getOutcome()) {
        this.ended = true
        const actor = this.simulation.actors.get(this.playerId)
        recordMatchResult(this.records, this.simulation.modeId,
          this.simulation.getOutcome().winner === actor.team, this.simulation.timeMs / 1000)
        this.handlers.message({ type: 'match_end', snapshot: this.simulation.createSnapshot(this.playerId) })
      }
    }
  }

  resultStats({ modeId }) {
    const records = this.records[modeId]
    return [`累计 K/D: ${(records.kills / Math.max(1, records.deaths)).toFixed(2)}    胜率: ${records.matches ? Math.round(records.wins / records.matches * 100) : 0}%`]
  }

  close() {
    clearInterval(this.timer)
  }
}

export class NetworkSession {
  constructor(handlers) {
    this.handlers = handlers
    this.socket = null
    this.reconnectTimer = 0
    this.wantConnection = false
    this.latency = 0
  }

  connect() {
    this.wantConnection = true
    if (this.socket?.readyState === WebSocket.OPEN || this.socket?.readyState === WebSocket.CONNECTING) return
    this.handlers.status?.('connecting')
    const socket = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/multiplayer?protocol=${MULTIPLAYER_PROTOCOL}`)
    socket.binaryType = 'arraybuffer'
    this.socket = socket
    socket.addEventListener('open', () => {
      if (this.socket !== socket) return
      this.handlers.status?.('online')
      this.ping()
      this.pingTimer = setInterval(() => this.ping(), 2000)
    })
    socket.addEventListener('message', event => {
      if (this.socket !== socket) return
      const message = unpack(new Uint8Array(event.data))
      if (message.type === 'pong') {
        this.latency = Math.max(0, performance.now() - Number(message.at))
        this.handlers.latency?.(this.latency)
      }
      this.handlers.message?.(message)
    })
    socket.addEventListener('close', event => {
      if (this.socket !== socket) return
      clearInterval(this.pingTimer)
      this.socket = null
      this.handlers.status?.(event.code === 4002 ? 'taken_over' : 'offline')
      this.handlers.disconnected?.(event)
      if (this.wantConnection && event.code !== 4002 && event.code !== 4001) {
        clearTimeout(this.reconnectTimer)
        this.reconnectTimer = setTimeout(() => this.connect(), 1400)
      }
    })
  }

  send(message) {
    if (this.socket?.readyState !== WebSocket.OPEN) return false
    this.socket.send(pack(message))
    return true
  }

  sendInput(input) {
    if (this.socket?.readyState !== WebSocket.OPEN) return false
    const payload = [
      input.seq, input.moveX, input.moveZ, input.yaw, input.pitch, input.slot,
      input.crouch, input.sprint, input.aim, input.fire, input.actions,
    ]
    this.socket.send(pack(payload))
    return true
  }

  canPause() {
    return false
  }

  resultStats() {
    return [`网络延迟: ${Math.round(this.latency)} ms`]
  }

  ping() {
    this.send({ type: 'ping', at: performance.now() })
  }

  close() {
    this.wantConnection = false
    clearTimeout(this.reconnectTimer)
    clearInterval(this.pingTimer)
    this.socket?.close(1000, '客户端退出')
  }
}
