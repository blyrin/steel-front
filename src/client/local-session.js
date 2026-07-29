import { CFG, createAuthoritativeSimulation } from '#simulation'
import { recordMatchResult, saveRecords } from './state.js'
import { SERVER_TICK_RATE, SNAPSHOT_RATE } from '../../shared/multiplayer/protocol.js'

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

  start(modeId) {
    this.simulation = createAuthoritativeSimulation({
      modeId,
      seed: Math.floor(Math.random() * 0x100000000),
    })
    this.simulation.addPlayer({
      id: this.playerId,
      userId: 'local',
      name: '你',
      team: 'allies',
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
    if (message.type === 'deploy')
      this.simulation.deployPlayer(this.playerId, message.spawnId, message.loadout)
    else if (message.type === 'redeploy') this.simulation.redeployPlayer(this.playerId)
    else if (message.type === 'leave_room') this.close()
    return true
  }

  sendInput(input) {
    this.simulation.submitInput(this.playerId, input)
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
