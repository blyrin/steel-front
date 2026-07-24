export function createAiSystem({ state, config, getMode }) {
  const worker = new Worker(new URL('./ai-worker.js', import.meta.url), {
    type: 'module',
  })
  const actorsById = new Map()
  let nextActorId = 1
  let initialized = false
  let tickInFlight = false
  let pendingDt = 0

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
      lastShot: lastShot
        ? {
          x: lastShot.x,
          z: lastShot.z,
          at: lastShot.at,
        }
        : null,
    }
  }

  function serializePoint(point, id) {
    if (point.position) {
      return {
        id,
        x: point.position.x,
        z: point.position.z,
      }
    }
    return {
      id,
      x: point.x,
      z: point.z,
      r: point.r,
      type: point.type,
    }
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

  function start() {
    if (initialized) return
    for (const actor of state.actors) actorsById.set(actor.id, actor)
    worker.postMessage({
      type: 'init',
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
    worker.postMessage({ type: 'add-actor', actor: serializeActor(actor) })
  }

  function removeActor(actor) {
    actorsById.delete(actor.id)
    worker.postMessage({ type: 'remove-actor', id: actor.id })
  }

  function respawnActor(actor) {
    actorsById.set(actor.id, actor)
    worker.postMessage({ type: 'respawn-actor', actor: serializeActor(actor) })
  }

  function reportDamage(victim, amount, attacker, attackType) {
    let attackerId = null
    if (attacker === state.player) attackerId = 'player'
    else if (attacker) attackerId = attacker.id
    worker.postMessage({
      type: 'damage',
      id: victim.id,
      amount,
      attackerId,
      attackType,
    })
  }

  function reportDeath(actor) {
    worker.postMessage({ type: 'death', id: actor.id })
  }

  function flushTick() {
    if (!initialized || tickInFlight || pendingDt <= 0) return
    const dt = pendingDt
    pendingDt = 0
    tickInFlight = true
    worker.postMessage({
      type: 'tick',
      dt,
      now: performance.now(),
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
  }

  function update(dt) {
    pendingDt = Math.min(config.match.maxAiFrameDelta, pendingDt + dt)
    flushTick()
  }

  function resolveTarget(id) {
    if (id === 'player') return state.player
    return actorsById.get(id) ?? null
  }

  function applySnapshot(snapshot) {
    for (const data of snapshot.actors) {
      const actor = actorsById.get(data.id)
      if (!actor) continue
      actor.applyAiState(data, resolveTarget)
    }
  }

  function handleEvent(event) {
    const actor = actorsById.get(event.actorId)
    if (!actor || !actor.alive) return
    switch (event.type) {
      case 'fire':
        actor.fireFromWorker(event.targetId)
        return
      case 'throw-grenade':
        actor.throwGrenadeFromWorker(event.direction)
        return
      case 'zombie-attack': {
        const target = resolveTarget(event.targetId)
        if (target?.alive) actor.attackFromWorker(target)
        return
      }
      case 'fortress-attack': {
        const mode = getMode()
        if (mode.id === 'zombie') mode.damageFortress(event.damage)
        return
      }
      case 'use-item':
        actor.applyWorkerItem(event.health, event.itemUses)
        return
      case 'resupply':
        actor.applyWorkerResupply(event.kind)
        return
    }
  }

  worker.onmessage = event => {
    const message = event.data
    tickInFlight = false
    applySnapshot(message)
    for (const workerEvent of message.events) handleEvent(workerEvent)
    flushTick()
  }

  worker.onerror = event => {
    throw event.error || new Error(event.message || 'AI Worker 运行失败')
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
