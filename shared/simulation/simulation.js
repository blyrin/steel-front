import { createAiEngine } from './ai-engine.js'

export function createSimulation({ state, config, getMode, getCombat, getEffects, createEntity }) {
  const engine = createAiEngine()
  const actorsById = new Map()
  let nextActorId = 1
  let initialized = false

  function allocateActorId() {
    return `actor-${nextActorId++}`
  }

  function serializeActor(actor) {
    const isSoldier = actor.actorKind === 'soldier'
    const equipment = isSoldier
      ? {
          weaponId: actor.loadout.weapon,
          grenadeId: actor.loadout.grenade,
          itemId: actor.loadout.item,
          magazine: actor.magazine,
          reserveAmmo: actor.reserveAmmo,
          grenadeCount: actor.grenadeCount,
          itemUses: actor.itemUses,
          skill: actor.botSkill,
        }
      : {
          weaponId: null,
          grenadeId: null,
          itemId: null,
          magazine: 0,
          reserveAmmo: 0,
          grenadeCount: 0,
          itemUses: 0,
          skill: 0,
        }
    return {
      id: actor.id,
      kind: actor.actorKind,
      team: actor.team,
      x: actor.position.x,
      y: actor.position.y,
      z: actor.position.z,
      vx: actor.velocity.x,
      vz: actor.velocity.z,
      yaw: actor.yaw,
      alive: actor.alive,
      health: actor.health,
      maxHealth: actor.maxHealth,
      radius: actor.radius,
      ...equipment,
    }
  }

  function serializePlayer() {
    const player = state.player
    const lastShot = state.lastPlayerShot
    return {
      id: 'player',
      kind: 'player',
      team: player.team,
      x: player.position.x,
      y: player.position.y,
      z: player.position.z,
      vx: player.velocity.x,
      vy: player.velocity.y,
      vz: player.velocity.z,
      yaw: player.yaw,
      alive: player.alive,
      health: player.health,
      maxHealth: player.maxHealth,
      currentHeight: player.currentHeight,
      lastShot: lastShot ? { x: lastShot.x, z: lastShot.z, at: lastShot.at } : null,
    }
  }

  function serializePoint(point, id) {
    if (point.position) return { id, x: point.position.x, z: point.position.z }
    return { id, x: point.x, z: point.z, r: point.r, type: point.type }
  }

  function getFortressData() {
    const fortress = state.objectives.fortress
    if (!fortress) return null
    return {
      x: fortress.position.x,
      z: fortress.position.z,
      attackRadius: fortress.attackRadius,
      deckHeight: fortress.deckHeight,
      health: fortress.health,
    }
  }

  function flushSpawnQueue() {
    for (const definition of state.spawnQueue.splice(0)) {
      const actor = createEntity(definition, getMode())
      if (definition.kind === 'player') {
        state.player = actor
        continue
      }
      state.actors.push(actor)
      actorsById.set(actor.id, actor)
      if (initialized) engine.addActor(serializeActor(actor))
    }
  }

  function flushRemoveQueue() {
    for (const id of state.removeQueue.splice(0)) {
      actorsById.delete(id)
      if (initialized) engine.removeActor(id)
    }
  }

  function start() {
    if (initialized) return
    flushSpawnQueue()
    for (const actor of state.actors) actorsById.set(actor.id, actor)
    engine.init({
      modeId: state.match.modeId,
      config,
      mapSize: state.mapSize,
      obstacles: state.obstacles,
      coverPoints: state.coverPoints.map(serializePoint),
      medicalStations: state.medicalStations.map(serializePoint),
      ammoStations: state.ammoStations.map(serializePoint),
      groundRegions: state.groundRegions,
      fortress: getFortressData(),
      actors: state.actors.map(serializeActor),
      player: serializePlayer(),
    })
    initialized = true
  }

  function addActor(actor) {
    actorsById.set(actor.id, actor)
    if (initialized) engine.addActor(serializeActor(actor))
  }

  function removeActor(actor) {
    actorsById.delete(actor.id)
    if (initialized) engine.removeActor(actor.id)
  }

  function respawnActor(actor) {
    actorsById.set(actor.id, actor)
    engine.respawnActor(serializeActor(actor))
  }

  function reportDamage(victim, amount, attacker, attackType) {
    engine.damageActor({
      id: victim.id,
      amount,
      attackerId: attacker === state.player ? 'player' : (attacker?.id ?? null),
      attackType,
    })
  }

  function reportDeath(actor) {
    engine.killActor(actor.id)
  }

  function resolveTarget(id) {
    return id === 'player' ? state.player : (actorsById.get(id) ?? null)
  }

  function applySnapshot(snapshot) {
    for (const data of snapshot.actors) {
      const actor = actorsById.get(data.id)
      if (actor) actor.applySimulationState(data, resolveTarget)
    }
  }

  function handleEvent(event) {
    const actor = actorsById.get(event.actorId)
    if (!actor || !actor.alive) return
    switch (event.type) {
      case 'fire':
        actor.fireFromSimulation(event.targetId)
        return
      case 'throw-grenade':
        actor.throwGrenadeFromSimulation(event.direction)
        return
      case 'zombie-attack': {
        const target = resolveTarget(event.targetId)
        if (target?.alive) actor.attackFromSimulation(target)
        return
      }
      case 'fortress-attack':
        getMode().damageFortress(event.damage)
        return
      case 'use-item':
        actor.applySimulationItem(event.health, event.itemUses)
        return
      case 'resupply':
        actor.applySimulationResupply(event.kind)
    }
  }

  function updateAi(dt) {
    const snapshot = engine.tick({
      dt,
      now: state.simulationTimeMs,
      player: serializePlayer(),
      fortress: getFortressData(),
      smokeClouds: state.smokeClouds.map(smoke => ({
        x: smoke.position.x,
        y: smoke.position.y,
        z: smoke.position.z,
        radius: smoke.radius,
        expiresAt: smoke.expiresAt,
      })),
    })
    applySnapshot(snapshot)
    for (const event of snapshot.events) handleEvent(event)
  }

  function update(dt) {
    state.simulationTimeMs += dt * 1000
    state.player.update(dt)
    getMode().update(dt)
    flushRemoveQueue()
    flushSpawnQueue()
    updateAi(dt)
    for (const actor of state.actors) actor.update(dt)
    getCombat().update()
    getEffects().update(dt)
    const outcome = getMode().getOutcome()
    if (outcome) state.running = false
    return { outcome, events: state.events.splice(0) }
  }

  return {
    allocateActorId,
    start,
    update,
    addActor,
    removeActor,
    respawnActor,
    reportDamage,
    reportDeath,
    resolveTarget,
  }
}
