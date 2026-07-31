import { CFG } from './config.js'
import { createMapDefinition, groundHeightAt } from './maps.js'
import { createAiEngine } from './ai.js'
import {
  classicOutcome,
  hasInputAction,
  INPUT_ACTION,
  recordActorElimination,
  scoringTeam,
  zombiePackSize,
  zombieWaveTotal,
} from './rules.js'
import { actionDuration, actionMarker, createPlayerWeaponActions } from './actions.js'
import {
  addWeaponBloom,
  applyWeaponSpread,
  calculateWeaponSpread,
  createActorHitboxes,
  createWeaponRecoil,
  directionFromAngles,
  explosionDamage,
  reloadMagazine,
  resupplyInventory,
  stepPlayerMotion,
  stepThrownProjectile,
  traceHitscan,
  updateActorHitboxes,
  useCarriedItem,
} from './actors.js'

const DEFAULT_INPUT = Object.freeze({
  seq: 0, moveX: 0, moveZ: 0, yaw: 0, pitch: 0, crouch: false,
  sprint: false, aim: false, fire: false, slot: 1, actions: 0, firePressed: false,
})

function randomId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function vector(x = 0, y = 0, z = 0) {
  return { x, y, z }
}

function distance2D(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z)
}

function makeLoadout(loadout = CFG.loadout, classicConfig = null) {
  const selected = {
    weapon: loadout.weapon ?? CFG.loadout.defaultWeapon,
    secondary: loadout.secondary ?? CFG.loadout.defaultSecondary,
    grenade: loadout.grenade ?? CFG.loadout.defaultGrenade,
    item: loadout.item ?? CFG.loadout.defaultItem,
  }
  const weapon = CFG.weapons[selected.weapon]
  const magazineCount = classicConfig?.magazineCount
  const weaponEnabled = classicConfig?.enabled.weapon ?? true
  const secondaryEnabled = classicConfig?.enabled.secondary ?? true
  const grenadeEnabled = classicConfig?.enabled.grenade ?? true
  const itemEnabled = classicConfig?.enabled.item ?? true
  const ammo = magazineCount == null || magazineCount > 0 ? weapon.magazineSize : 0
  const reserveAmmoLimit = magazineCount == null ? weapon.reserveAmmo : Math.max(0, magazineCount - 1) * weapon.magazineSize
  return {
    ...selected,
    ammo: weaponEnabled ? ammo : 0,
    reserveAmmo: weaponEnabled ? reserveAmmoLimit : 0,
    reserveAmmoLimit: weaponEnabled ? reserveAmmoLimit : 0,
    weaponEnabled,
    secondaryCount: secondaryEnabled ? CFG.secondaries[selected.secondary].count : 0,
    secondaryEnabled,
    grenadeCount: grenadeEnabled ? CFG.grenades[selected.grenade].count : 0,
    grenadeEnabled,
    itemUses: itemEnabled ? CFG.items[selected.item].uses : 0,
    itemEnabled,
  }
}

function randomBotLoadout() {
  const pick = values => values[Math.floor(Math.random() * values.length)]
  return {
    weapon: pick(Object.keys(CFG.weapons)),
    secondary: pick(Object.keys(CFG.secondaries)),
    grenade: pick(Object.keys(CFG.grenades)),
    item: pick(Object.keys(CFG.items)),
  }
}

function createActor(definition) {
  const loadout = makeLoadout(definition.loadout, definition.classicConfig)
  const maxHealth = definition.maxHealth ?? (definition.kind === 'zombie' ? CFG.modes.zombie.enemy.maxHealth : CFG.player.maxHealth)
  return {
    id: definition.id,
    userId: definition.userId ?? null,
    name: definition.name,
    kind: definition.kind,
    controller: definition.controller,
    team: definition.team,
    connected: true,
    deployed: definition.controller !== 'human',
    alive: definition.controller !== 'human',
    x: definition.x ?? 0,
    y: definition.y ?? 0,
    z: definition.z ?? 0,
    vx: 0,
    vy: 0,
    vz: 0,
    yaw: definition.yaw ?? 0,
    pitch: 0,
    grounded: true,
    crouching: false,
    sprinting: false,
    aiming: false,
    currentHeight: CFG.player.standHeight,
    radius: definition.kind === 'zombie' ? CFG.modes.zombie.enemy.radius : CFG.player.radius,
    maxHealth,
    health: maxHealth,
    kills: 0,
    deaths: 0,
    headshots: 0,
    meleeKills: 0,
    grenadeKills: 0,
    bestKillStreak: 0,
    killStreak: 0,
    ...loadout,
    input: { ...DEFAULT_INPUT },
    lastInputSeq: 0,
    lastFireAt: -Infinity,
    lastMeleeAt: -Infinity,
    meleeAt: 0,
    lastGrenadeAt: -Infinity,
    nextSupplyAt: 0,
    reloadAt: 0,
    autoReloadAt: 0,
    respawnAt: 0,
    diedAt: 0,
    targetId: null,
    plantedCharges: [],
    rpgLoaded: loadout.secondaryEnabled && loadout.secondaryCount > 0,
    rpgReloadAt: 0,
    autoRpgReloadAt: 0,
    activeSlot: 1,
    pendingSlot: 1,
    switchAt: 0,
    spreadBloom: 0,
    viewRecoilPitch: 0,
    viewRecoilYaw: 0,
    viewRecoilRoll: 0,
    botSkill: CFG.bot.skillMin + Math.random() * CFG.bot.skillRange,
    lastShot: null,
  }
}

function resetActorActions(actor) {
  actor.reloadAt = 0
  actor.autoReloadAt = 0
  actor.meleeAt = 0
  actor.rpgReloadAt = 0
  actor.autoRpgReloadAt = 0
  actor.switchAt = 0
  actor.pendingSlot = actor.activeSlot
  actor.viewRecoilPitch = 0
  actor.viewRecoilYaw = 0
  actor.viewRecoilRoll = 0
}

export function createAuthoritativeSimulation({ modeId, seed, now = 0, classic = null } = {}) {
  const classicConfig = modeId === 'classic' ? {
    teamSize: { allies: classic?.teamSize?.allies ?? CFG.modes.classic.teamSize, axis: classic?.teamSize?.axis ?? CFG.modes.classic.teamSize },
    botFill: { allies: classic?.botFill?.allies ?? CFG.modes.classic.botFill.allies, axis: classic?.botFill?.axis ?? CFG.modes.classic.botFill.axis },
    enabled: {
      weapon: classic?.enabled?.weapon ?? CFG.modes.classic.enabled.weapon,
      secondary: classic?.enabled?.secondary ?? CFG.modes.classic.enabled.secondary,
      grenade: classic?.enabled?.grenade ?? CFG.modes.classic.enabled.grenade,
      item: classic?.enabled?.item ?? CFG.modes.classic.enabled.item,
    },
    magazineCount: classic?.magazineCount ?? CFG.modes.classic.magazineCount,
    mapSupplies: classic?.mapSupplies ?? CFG.modes.classic.mapSupplies,
    damageMultiplier: classic?.damageMultiplier ?? CFG.modes.classic.damageMultiplier,
    maxHealth: classic?.maxHealth ?? CFG.modes.classic.maxHealth,
  } : null
  const map = createMapDefinition(modeId, CFG, seed, classicConfig)
  const actors = new Map()
  const projectiles = new Map()
  const smokeClouds = []
  const events = []
  const score = { allies: 0, axis: 0 }
  const modeState = modeId === 'zombie'
    ? { phase: 'waiting', wave: 0, waveTotal: 0, waveSpawned: 0, waveDefeated: 0, nextWaveAt: 0, fortressHealth: CFG.modes.zombie.fortress.maxHealth }
    : { phase: 'active' }
  let timeMs = now
  let outcome = null
  let nextBot = 1
  let spawnTimer = 0
  const ai = createAiEngine()
  const actionDefs = createPlayerWeaponActions(CFG.weapon)
  let aiReady = false

  function aiActor(actor) {
    return {
      id: actor.id, kind: actor.kind, team: actor.team,
      x: actor.x, y: actor.y, z: actor.z, vx: actor.vx, vz: actor.vz, yaw: actor.yaw,
      alive: actor.alive, health: actor.health, maxHealth: actor.maxHealth, radius: actor.radius,
      weaponId: actor.weapon, secondaryId: actor.secondary, grenadeId: actor.grenade, itemId: actor.item,
      magazine: actor.ammo, reserveAmmo: actor.reserveAmmo, reserveAmmoLimit: actor.reserveAmmoLimit,
      secondaryCount: actor.secondaryCount, rpgLoaded: actor.rpgLoaded,
      weaponEnabled: actor.weaponEnabled, secondaryEnabled: actor.secondaryEnabled,
      grenadeEnabled: actor.grenadeEnabled, itemEnabled: actor.itemEnabled,
      grenadeCount: actor.grenadeCount,
      itemUses: actor.itemUses, skill: actor.botSkill,
    }
  }

  function aiPlayer(actor) {
    return {
      id: actor.id, kind: 'player', team: actor.team, x: actor.x, y: actor.y, z: actor.z,
      vx: actor.vx, vy: actor.vy, vz: actor.vz, yaw: actor.yaw, alive: actor.alive,
      health: actor.health, maxHealth: actor.maxHealth, currentHeight: actor.currentHeight,
      lastShot: actor.lastShot,
    }
  }

  function stationData(station, id) {
    return { id, x: station.position.x, z: station.position.z }
  }

  function fortressData() {
    const fortress = map.objectives.fortress
    return fortress ? { ...fortress, health: modeState.fortressHealth } : null
  }

  function emit(type, data = {}) {
    events.push({ type, at: timeMs, ...data })
  }

  function spawns(team) {
    return map.spawnPoints[team]
  }

  function randomSpawn(team) {
    const points = spawns(team)
    const point = points[Math.floor(Math.random() * points.length)]
    const scatter = CFG.modes[modeId].spawnScatter
    return {
      x: point.x + (Math.random() - 0.5) * scatter,
      y: groundHeightAt(map, point.x, point.z),
      z: point.z + (Math.random() - 0.5) * scatter,
    }
  }

  function addBot(team, kind = 'soldier', spawnPosition = null) {
    const position = spawnPosition ?? (kind === 'zombie' ? randomZombieSpawn() : randomSpawn(team))
    const actor = createActor({
      id: `bot-${nextBot++}`,
      name: kind === 'zombie' ? '丧尸' : `${team === 'allies' ? '盟军' : '轴心'}士兵`,
      kind,
      controller: kind === 'zombie' ? 'zombie' : 'bot',
      team,
      loadout: kind === 'zombie' ? CFG.loadout : randomBotLoadout(),
      classicConfig: modeId === 'classic' ? classicConfig : null,
      maxHealth: modeId === 'classic' ? classicConfig.maxHealth : undefined,
      ...position,
    })
    actors.set(actor.id, actor)
    if (aiReady) ai.addActor(aiActor(actor))
    emit('actor_added', { actor: actorDefinition(actor) })
    if (kind === 'zombie') emit('zombie_groan', { position: { x: actor.x, y: actor.y, z: actor.z } })
    return actor
  }

  function initializeBots() {
    if (modeId === 'classic') {
      for (const team of ['allies', 'axis']) {
        if (!classicConfig.botFill[team]) continue
        for (let i = 0; i < classicConfig.teamSize[team]; i++) addBot(team)
      }
    } else {
      for (let i = 0; i < CFG.modes.zombie.alliedBotCount + 1; i++) addBot('allies')
    }
  }

  function removeOneBot(team) {
    const bot = [...actors.values()].find(actor => actor.controller === 'bot' && actor.team === team)
    if (!bot) return
    actors.delete(bot.id)
    if (aiReady) ai.removeActor(bot.id)
    emit('actor_removed', { actorId: bot.id })
  }

  function addPlayer({ id, userId, name, team, loadout }) {
    if (actors.has(id)) return actors.get(id)
    removeOneBot(team)
    const position = randomSpawn(team)
    const actor = createActor({
      id, userId, name, kind: 'player', controller: 'human', team,
      loadout, classicConfig, maxHealth: classicConfig?.maxHealth, ...position,
    })
    actors.set(id, actor)
    emit('actor_added', { actor: actorDefinition(actor) })
    return actor
  }

  function removePlayer(id) {
    const actor = actors.get(id)
    if (!actor || actor.controller !== 'human') return
    actors.delete(id)
    emit('actor_removed', { actorId: id })
    if (!outcome && (modeId !== 'classic' || classicConfig.botFill[actor.team])) addBot(actor.team)
  }

  function setConnected(id, connected) {
    const actor = actors.get(id)
    if (!actor) return
    actor.connected = connected
    if (!connected) actor.input = { ...DEFAULT_INPUT, seq: actor.lastInputSeq }
  }

  function submitInput(id, input) {
    const actor = actors.get(id)
    if (!actor || actor.controller !== 'human' || input.seq <= actor.lastInputSeq) return
    actor.lastInputSeq = input.seq
    const firePressed = actor.input.firePressed || (input.fire && !actor.input.fire)
    const actions = actor.input.actions | input.actions
    actor.input = {
      ...actor.input, ...input, seq: input.seq, actions, firePressed,
    }
  }

  function deployPlayer(id, spawnId, loadout) {
    const actor = actors.get(id)
    if (!actor || actor.alive || outcome) return false
    const point = spawns(actor.team).find(item => item.id === spawnId)
    if (!point) return false
    Object.assign(actor, makeLoadout(loadout, classicConfig))
    actor.x = point.x
    actor.z = point.z
    actor.y = groundHeightAt(map, point.x, point.z) + CFG.player.standHeight
    actor.vx = actor.vy = actor.vz = 0
    actor.health = actor.maxHealth
    actor.alive = true
    actor.deployed = true
    actor.respawnAt = 0
    resetActorActions(actor)
    emit('deployed', { actorId: actor.id, x: actor.x, y: actor.y, z: actor.z })
    if (modeId === 'zombie' && modeState.phase === 'waiting') startIntermission()
    return true
  }

  function redeployPlayer(id) {
    const actor = actors.get(id)
    if (!actor?.alive || actor.controller !== 'human' || outcome) return false
    damage(actor, actor.health, null, 'redeploy')
    return true
  }

  function resolveMovement(actor, dt) {
    if (!actor.alive || actor.controller !== 'human') return
    const input = actor.input
    const canAim = actor.activeSlot === 1 || CFG.secondaries[actor.secondary].kind === 'rpg'
    actor.aiming = canAim && input.aim && !actor.reloadAt && !actor.meleeAt && !actor.switchAt && !actor.rpgReloadAt
    Object.assign(actor, stepPlayerMotion(actor, {
      ...input, aim: actor.aiming,
      jump: hasInputAction(input.actions, INPUT_ACTION.JUMP),
    }, dt, CFG.player, {
      obstacles: map.obstacles, mapSize: map.size,
      groundHeightAt: (x, z) => groundHeightAt(map, x, z),
    }))
  }

  function actorDirection(actor) {
    return directionFromAngles(
      actor.yaw + (actor.controller === 'human' ? actor.viewRecoilYaw : 0),
      actor.pitch + (actor.controller === 'human' ? actor.viewRecoilPitch : 0),
    )
  }

  function hitboxes(actor) {
    const kind = actor.controller === 'human' ? 'player' : actor.kind
    actor.hitboxes ??= createActorHitboxes(kind, CFG)
    return updateActorHitboxes(actor, actor.hitboxes, kind, CFG)
  }

  function enemies(actor) {
    return [...actors.values()].filter(target => target.alive && target.team !== actor.team)
  }

  function damage(target, amount, attacker, attackType, headshot = false) {
    if (!target.alive || amount <= 0) return
    target.health = Math.max(0, target.health - amount)
    if (target.controller !== 'human') ai.damageActor({ id: target.id, amount, attackerId: attacker?.id ?? null, attackType })
    emit('damage', { targetId: target.id, attackerId: attacker?.id ?? null, amount, attackType, headshot })
    if (target.health > 0) return
    target.alive = false
    target.health = 0
    target.diedAt = timeMs
    target.respawnAt = timeMs + (target.controller === 'human' ? CFG.player.deathTimer : modeId === 'classic' ? CFG.modes.classic.respawnTime : CFG.modes.zombie.alliedRespawnTime) * 1000
    if (target.controller === 'human') {
      for (const id of target.plantedCharges) {
        if (!projectiles.delete(id)) continue
        emit('projectile_removed', { projectileId: id })
      }
      target.plantedCharges.length = 0
      target.activeSlot = 1
      target.pendingSlot = 1
      target.crouching = false
      target.sprinting = false
      target.aiming = false
      target.input = { ...DEFAULT_INPUT, seq: target.lastInputSeq }
    }
    recordActorElimination(target, attacker, headshot, attackType, timeMs, CFG.hud.killStreakWindow)
    score[scoringTeam(target, attacker)]++
    resetActorActions(target)
    if (target.kind === 'zombie') modeState.waveDefeated++
    emit('elimination', {
      victimId: target.id, attackerId: attacker?.id ?? null, attackType, headshot,
      killStreak: attacker?.killStreak ?? 0,
    })
    checkOutcome()
  }

  function fireBullet(actor, direction, weapon) {
    const origin = { x: actor.x, y: actor.controller === 'human' ? actor.y : actor.y + 1.4, z: actor.z }
    const trace = traceHitscan({
      origin, direction, range: CFG.combat.bulletRange, obstacles: map.obstacles,
      targets: enemies(actor), getHitboxes: hitboxes,
    })
    emit('shot', {
      actorId: actor.id, origin, direction, end: trace.point, weaponId: actor.weapon,
      hit: trace.target ? 'actor' : trace.obstacleHit ? 'obstacle' : null,
    })
    if (!trace.target) return
    const falloff = clamp((trace.distance - weapon.effectiveRange) / (CFG.combat.bulletRange - weapon.effectiveRange), 0, 1)
    const base = trace.headshot ? weapon.headDamage : weapon.bodyDamage
    damage(trace.target, base * (1 + (weapon.minDamageMultiplier - 1) * falloff) * (modeId === 'classic' ? classicConfig.damageMultiplier : 1), actor, 'weapon', trace.headshot)
  }

  function tryFire(actor) {
    const weapon = CFG.weapons[actor.weapon]
    const trigger = weapon.automatic
      ? actor.input.fire || actor.input.firePressed
      : actor.input.firePressed
    if (!trigger || actor.activeSlot !== 1 || actor.reloadAt || actor.meleeAt || actor.switchAt || actor.ammo <= 0) return
    if (timeMs - actor.lastFireAt < weapon.fireDelay * 1000) return
    actor.lastFireAt = timeMs
    actor.lastShot = { x: actor.x, z: actor.z, at: timeMs }
    actor.ammo--
    const spread = calculateWeaponSpread({
      baseSpread: weapon.baseSpread,
      speed: Math.hypot(actor.vx, actor.vz),
      aiming: actor.aiming,
      crouching: actor.crouching,
      sprinting: actor.sprinting,
      grounded: actor.grounded,
      reloading: !!actor.reloadAt,
      bloom: actor.spreadBloom,
    }, CFG.weapon)
    const baseDirection = actorDirection(actor)
    const recoil = createWeaponRecoil(actor.aiming, weapon.recoilMultiplier, CFG.weapon)
    actor.viewRecoilPitch += recoil.pitch
    actor.viewRecoilYaw += recoil.yaw
    actor.viewRecoilRoll += recoil.roll
    emit('weapon_fired', {
      actorId: actor.id, weaponId: actor.weapon, direction: baseDirection,
      recoil, empty: actor.ammo === 0,
    })
    const pellets = weapon.pellets ?? 1
    for (let i = 0; i < pellets; i++) {
      fireBullet(actor, applyWeaponSpread(baseDirection, spread), weapon)
    }
    addWeaponBloom(actor, weapon, CFG.weapon, actor.aiming)
    if (!actor.ammo) actor.autoReloadAt = timeMs + actionDuration(actionDefs.queueReload) * 1000
  }

  function handleActions(actor) {
    if (!actor.alive || actor.controller !== 'human') return
    const weapon = CFG.weapons[actor.weapon]
    const inputActions = actor.input.actions
    if (actor.autoReloadAt && timeMs >= actor.autoReloadAt) {
      actor.autoReloadAt = 0
      if (actor.activeSlot === 1 && !actor.reloadAt && !actor.meleeAt && !actor.switchAt && actor.reserveAmmo > 0)
        startReload(actor, weapon)
    }
    if (actor.autoRpgReloadAt && timeMs >= actor.autoRpgReloadAt) {
      actor.autoRpgReloadAt = 0
      if (actor.activeSlot === 2 && !actor.rpgReloadAt) startRpgReload(actor)
    }
    if (actor.switchAt && timeMs >= actor.switchAt) {
      actor.activeSlot = actor.pendingSlot
      actor.switchAt = 0
    }
    if (actor.input.slot !== actor.activeSlot && actor.input.slot !== actor.pendingSlot && !actor.reloadAt && !actor.meleeAt) {
      actor.pendingSlot = actor.input.slot
      actor.switchAt = timeMs + actionDuration(actionDefs.weaponSwitch) *
        actionMarker(actionDefs.weaponSwitch, 'swap') * 1000
      emit('weapon_switch', { actorId: actor.id, slot: actor.pendingSlot })
    }
    if (actor.reloadAt && timeMs >= actor.reloadAt) {
      reloadMagazine(actor, weapon)
      actor.reloadAt = 0
      emit('reloaded', { actorId: actor.id })
    }
    if (hasInputAction(inputActions, INPUT_ACTION.RELOAD) && actor.activeSlot === 1 && !actor.reloadAt && !actor.meleeAt && !actor.switchAt && actor.ammo < weapon.magazineSize && actor.reserveAmmo > 0) {
      actor.autoReloadAt = 0
      startReload(actor, weapon)
    }
    if (actor.activeSlot === 1) tryFire(actor)
    else handleSecondary(actor)
    if (actor.meleeAt && timeMs >= actor.meleeAt) {
      actor.meleeAt = 0
      const direction = actorDirection(actor)
      const trace = traceHitscan({
        origin: { x: actor.x, y: actor.y, z: actor.z }, direction,
        range: CFG.weapon.meleeRange, obstacles: map.obstacles,
        targets: enemies(actor), getHitboxes: hitboxes,
      })
      emit('melee_hit', {
        actorId: actor.id,
        targetId: trace.target?.id ?? null,
        hit: trace.target ? 'actor' : trace.obstacleHit ? 'obstacle' : null,
        point: trace.point,
      })
      if (trace.target && trace.distance >= 0.15)
        damage(trace.target, CFG.weapon.meleeDamage, actor, 'melee')
    }
    if (hasInputAction(inputActions, INPUT_ACTION.MELEE) && actor.activeSlot === 1 && weapon.bayonet && !actor.switchAt && !actor.meleeAt && timeMs - actor.lastMeleeAt >= CFG.weapon.meleeDelay * 1000) {
      actor.reloadAt = 0
      actor.autoReloadAt = 0
      actor.lastMeleeAt = timeMs
      actor.meleeAt = timeMs + actionDuration(actionDefs.melee) *
        actionMarker(actionDefs.melee, 'hit') * 1000
      emit('melee', { actorId: actor.id })
    }
    if (hasInputAction(inputActions, INPUT_ACTION.GRENADE) && !actor.reloadAt && !actor.meleeAt && !actor.switchAt && actor.grenadeCount > 0 && timeMs - actor.lastGrenadeAt >= CFG.grenade.cooldown * 1000) {
      actor.lastGrenadeAt = timeMs
      actor.grenadeCount--
      spawnProjectile(actor, actor.grenade, CFG.grenades[actor.grenade])
    }
    if (hasInputAction(inputActions, INPUT_ACTION.ITEM) && useCarriedItem(actor, CFG.items[actor.item], weapon)) {
      emit('item_used', { actorId: actor.id, itemId: actor.item })
    }
    if (hasInputAction(inputActions, INPUT_ACTION.SUPPLY)) useSupplyStation(actor)
    actor.input.actions = 0
    actor.input.firePressed = false
  }

  function startReload(actor, weapon) {
    const empty = actor.ammo === 0
    actor.reloadAt = timeMs + actionDuration(actionDefs.reload, {
      empty, reloadDuration: weapon.reloadDuration, emptyReloadDuration: weapon.emptyReloadDuration,
    }) * 1000
    emit('reload_started', { actorId: actor.id, empty })
  }

  function startRpgReload(actor) {
    if (actor.rpgLoaded || actor.secondaryCount <= 0 || actor.reloadAt || actor.meleeAt || actor.switchAt) return
    actor.rpgReloadAt = timeMs + actionDuration(actionDefs.rpgReload) * 1000
    emit('rpg_reload_started', { actorId: actor.id })
  }

  function useSupplyStation(actor) {
    const stations = [
      ...map.medicalStations.map(station => ({ ...station.position, kind: 'medical' })),
      ...map.ammoStations.map(station => ({ ...station.position, kind: 'ammo' })),
    ]
    const station = stations.find(item => distance2D(actor, item) <= CFG.supply.interactRadius)
    if (!station) return false
    if (timeMs < actor.nextSupplyAt) {
      emit('supply_result', { actorId: actor.id, result: 'cooldown', remaining: Math.ceil((actor.nextSupplyAt - timeMs) / 1000) })
      return false
    }
    if (station.kind === 'medical') {
      if (actor.health >= actor.maxHealth) {
        emit('supply_result', { actorId: actor.id, result: 'health_full' })
        return false
      }
      actor.health = actor.maxHealth
    } else if (!resupplyInventory(actor, {
      weapon: { ...CFG.weapons[actor.weapon], reserveAmmo: actor.weaponEnabled ? actor.reserveAmmoLimit : 0 },
      grenade: { ...CFG.grenades[actor.grenade], count: actor.grenadeEnabled ? CFG.grenades[actor.grenade].count : 0 },
      item: { ...CFG.items[actor.item], uses: actor.itemEnabled ? CFG.items[actor.item].uses : 0 },
      secondary: { ...CFG.secondaries[actor.secondary], count: actor.secondaryEnabled ? CFG.secondaries[actor.secondary].count : 0 },
    })) {
      emit('supply_result', { actorId: actor.id, result: 'ammo_full' })
      return false
    }
    actor.nextSupplyAt = timeMs + CFG.supply.cooldown * 1000
    emit('resupplied', { actorId: actor.id, kind: station.kind })
    return true
  }

  function handleSecondary(actor) {
    const secondary = CFG.secondaries[actor.secondary]
    if (secondary.kind === 'rpg') {
      if (actor.rpgReloadAt && timeMs >= actor.rpgReloadAt) {
        actor.rpgReloadAt = 0
        actor.rpgLoaded = true
        emit('reloaded', { actorId: actor.id, secondary: true })
      }
      if (hasInputAction(actor.input.actions, INPUT_ACTION.RELOAD) && !actor.rpgLoaded && actor.secondaryCount > 0 && !actor.rpgReloadAt) {
        actor.autoRpgReloadAt = 0
        startRpgReload(actor)
      }
      if (!actor.input.firePressed || actor.reloadAt || actor.meleeAt || actor.switchAt ||
        !actor.rpgLoaded || actor.secondaryCount <= 0 || timeMs - actor.lastFireAt < secondary.fireDelay * 1000) return
      actor.lastFireAt = timeMs
      actor.lastShot = { x: actor.x, z: actor.z, at: timeMs }
      actor.secondaryCount--
      actor.rpgLoaded = false
      spawnProjectile(actor, actor.secondary, { ...secondary, throwSpeed: secondary.rocketSpeed, fuse: 4, rocket: true })
      if (actor.secondaryCount > 0)
        actor.autoRpgReloadAt = timeMs + actionDuration(actionDefs.queueRpgReload) * 1000
      return
    }
    if (hasInputAction(actor.input.actions, INPUT_ACTION.SECONDARY) && !actor.reloadAt && !actor.meleeAt && !actor.switchAt &&
      actor.secondaryCount > 0 && timeMs - actor.lastGrenadeAt >= CFG.grenade.cooldown * 1000) {
      actor.lastGrenadeAt = timeMs
      actor.secondaryCount--
      const charge = spawnProjectile(actor, actor.secondary, { ...secondary, fuse: 120, sticky: true })
      actor.plantedCharges.push(charge.id)
    }
    if (actor.input.firePressed && !actor.reloadAt && !actor.meleeAt && !actor.switchAt && actor.plantedCharges.length) {
      for (const id of actor.plantedCharges.splice(0)) {
        const charge = projectiles.get(id)
        if (charge) explode(charge)
      }
    }
  }

  function spawnProjectile(actor, kind, data, directionOverride = null) {
    const direction = directionOverride ?? actorDirection(actor)
    const projectile = {
      id: randomId('projectile'), ownerId: actor.id, team: actor.team, kind,
      x: actor.x + direction.x * 0.5, y: actor.y + direction.y * 0.5, z: actor.z + direction.z * 0.5,
      vx: direction.x * data.throwSpeed,
      vy: direction.y * data.throwSpeed + (data.rocket ? 0 : data.throwSpeed * CFG.grenade.throwLift),
      vz: direction.z * data.throwSpeed, radius: data.radius,
      explodeAt: timeMs + data.fuse * 1000,
      collisionRadius: data.rocket ? 0.08 : data.sticky ? 0.11 : 0.09,
      damage: data.damage * (modeId === 'classic' ? classicConfig.damageMultiplier : 1),
      rocket: !!data.rocket, sticky: !!data.sticky,
    }
    projectiles.set(projectile.id, projectile)
    emit('projectile_added', { projectile })
    return projectile
  }

  function explode(projectile) {
    projectiles.delete(projectile.id)
    const data = CFG.grenades[projectile.kind]
    if (data?.kind === 'smoke') {
      smokeClouds.push({ x: projectile.x, y: projectile.y, z: projectile.z, radius: data.radius, expiresAt: timeMs + data.duration * 1000 })
      emit('smoke', { projectileId: projectile.id, x: projectile.x, y: projectile.y, z: projectile.z, radius: data.radius, duration: data.duration })
      return
    }
    const owner = actors.get(projectile.ownerId)
    emit('explosion', { projectileId: projectile.id, x: projectile.x, y: projectile.y, z: projectile.z, radius: projectile.radius })
    for (const target of actors.values()) {
      if (!target.alive || target.team === projectile.team) continue
      const distance = Math.hypot(target.x - projectile.x, target.y - projectile.y, target.z - projectile.z)
      const amount = explosionDamage(projectile.damage, distance, projectile.radius)
      if (amount > 0) damage(target, amount, owner, 'grenade')
    }
  }

  function updateProjectiles(dt) {
    for (const projectile of projectiles.values()) {
      const obstacles = [...map.obstacles]
      if (projectile.rocket) {
        const owner = actors.get(projectile.ownerId)
        for (const target of owner ? enemies(owner) : []) obstacles.push(...hitboxes(target))
      }
      const collision = stepThrownProjectile(projectile, dt, {
        gravity: projectile.rocket ? 0 : CFG.grenade.gravity,
        bounce: CFG.grenade.bounce, sticky: projectile.sticky,
        radius: projectile.collisionRadius, obstacles,
        groundHeightAt: (x, z) => groundHeightAt(map, x, z),
      })
      if (projectile.rocket && collision.hit) { explode(projectile); continue }
      if (timeMs >= projectile.explodeAt) explode(projectile)
    }
  }

  function fireAiWeapon(actor, target) {
    const weapon = CFG.weapons[actor.weapon]
    const dx = target.x - actor.x
    const dz = target.z - actor.z
    const distance = Math.hypot(dx, dz)
    const leadTime = clamp((distance / 90) * (0.16 + actor.botSkill * 0.22), 0, 0.28)
    const targetY = target.y - (target.controller === 'human' ? target.currentHeight : 0) + CFG.bot.targetHeight
    const aim = {
      x: target.x + target.vx * leadTime - actor.x,
      y: targetY - (actor.y + CFG.bot.viewOriginHeight),
      z: target.z + target.vz * leadTime - actor.z,
    }
    const length = Math.hypot(aim.x, aim.y, aim.z)
    const spread = calculateWeaponSpread({
      baseSpread: weapon.baseSpread, speed: Math.hypot(actor.vx, actor.vz),
      aiming: actor.targetVisible, crouching: false, sprinting: false, grounded: true,
      reloading: actor.reloading, bloom: actor.spreadBloom,
    }, CFG.weapon)
    const baseDirection = { x: aim.x / length, y: aim.y / length, z: aim.z / length }
    emit('weapon_fired', { actorId: actor.id, weaponId: actor.weapon, direction: baseDirection })
    for (let pellet = 0; pellet < (weapon.pellets ?? 1); pellet++) {
      fireBullet(actor, applyWeaponSpread(baseDirection, spread), weapon)
    }
    addWeaponBloom(actor, weapon, CFG.weapon, true)
  }

  function fireAiSecondary(actor, direction) {
    const secondary = CFG.secondaries[actor.secondary]
    if (secondary.kind === 'rpg') {
      spawnProjectile(actor, actor.secondary, {
        ...secondary,
        throwSpeed: secondary.rocketSpeed,
        fuse: 4,
        rocket: true,
      }, direction)
    } else {
      spawnProjectile(actor, actor.secondary, { ...secondary, fuse: 120, sticky: true }, direction)
    }
  }

  function fireAiMelee(actor, target) {
    const origin = { x: actor.x, y: actor.y + 1.1, z: actor.z }
    const targetY = target.y - (target.controller === 'human' ? target.currentHeight : 0) + CFG.bot.targetHeight
    const aim = { x: target.x - origin.x, y: targetY - origin.y, z: target.z - origin.z }
    const length = Math.hypot(aim.x, aim.y, aim.z)
    if (length < 1e-6) return
    const direction = { x: aim.x / length, y: aim.y / length, z: aim.z / length }
    const trace = traceHitscan({
      origin, direction, range: CFG.weapon.meleeRange, obstacles: map.obstacles,
      targets: enemies(actor), getHitboxes: hitboxes,
    })
    emit('melee_hit', {
      actorId: actor.id,
      targetId: trace.target?.id ?? null,
      hit: trace.target ? 'actor' : trace.obstacleHit ? 'obstacle' : null,
      point: trace.point,
    })
    if (trace.target && trace.distance >= 0.15) damage(trace.target, CFG.weapon.meleeDamage, actor, 'melee')
  }

  function updateSharedAi(dt) {
    const snapshot = ai.tick({
      dt, now: timeMs,
      players: [...actors.values()].filter(actor => actor.controller === 'human').map(aiPlayer),
      fortress: fortressData(), smokeClouds,
    })
    for (const data of snapshot.actors) {
      const actor = actors.get(data.id)
      if (!actor?.alive) continue
      actor.x = data.x
      actor.y = data.y
      actor.z = data.z
      actor.vx = data.vx
      actor.vz = data.vz
      actor.yaw = data.yaw
      actor.stateName = data.stateName
      actor.targetId = data.targetId
      actor.targetVisible = data.targetVisible
      actor.reloading = data.reloading
      actor.ammo = data.magazine
      actor.reserveAmmo = data.reserveAmmo
      actor.secondaryCount = data.secondaryCount
      actor.rpgLoaded = data.rpgLoaded
      actor.grenadeCount = data.grenadeCount
      actor.itemUses = data.itemUses
    }
    for (const event of snapshot.events) {
      const actor = actors.get(event.actorId)
      if (!actor?.alive) continue
      if (event.type === 'fire') {
        const target = actors.get(event.targetId)
        if (target?.alive) fireAiWeapon(actor, target)
      } else if (event.type === 'secondary') {
        fireAiSecondary(actor, event.direction)
      } else if (event.type === 'detonate-secondary') {
        for (const projectile of [...projectiles.values()]) {
          if (projectile.ownerId === actor.id && projectile.sticky) explode(projectile)
        }
      } else if (event.type === 'melee') {
        const target = actors.get(event.targetId)
        if (target?.alive) fireAiMelee(actor, target)
      } else if (event.type === 'throw-grenade') spawnProjectile(actor, actor.grenade, CFG.grenades[actor.grenade], event.direction)
      else if (event.type === 'zombie-attack') {
        const target = actors.get(event.targetId)
        if (target?.alive) { emit('zombie_attack', { actorId: actor.id, targetId: target.id }); damage(target, CFG.modes.zombie.enemy.attackDamage, actor, 'melee') }
      } else if (event.type === 'fortress-attack') {
        modeState.fortressHealth = Math.max(0, modeState.fortressHealth - event.damage)
        emit('fortress_hit', { actorId: actor.id, health: modeState.fortressHealth })
        if (!modeState.fortressHealth) {
          outcome = {
            winner: 'axis', reason: '堡垒已被摧毁', title: '防线失守',
            details: [`最高波次: ${modeState.wave}`, '堡垒被摧毁'],
          }
          emit('match_end', outcome)
        }
      } else if (event.type === 'use-item') {
        actor.health = event.health ?? actor.health
        actor.itemUses = event.itemUses
      } else if (event.type === 'resupply') {
        actor.health = event.health ?? actor.health
        actor.itemUses = event.itemUses ?? actor.itemUses
      }
    }
  }

  function respawnActors() {
    for (const actor of actors.values()) {
      if (actor.alive || !actor.respawnAt || timeMs < actor.respawnAt || outcome) continue
      if (actor.controller === 'human') {
        actor.respawnAt = 0
        emit('deploy_available', { actorId: actor.id })
        continue
      }
      if (actor.kind === 'zombie') continue
      const position = randomSpawn(actor.team)
      Object.assign(actor, position, makeLoadout(randomBotLoadout(), classicConfig))
      actor.rpgLoaded = actor.secondaryEnabled && actor.secondaryCount > 0
      actor.alive = true
      actor.health = actor.maxHealth
      actor.respawnAt = 0
      resetActorActions(actor)
      ai.respawnActor(aiActor(actor))
      emit('respawned', { actorId: actor.id, ...position })
    }
  }

  function randomZombieSpawn() {
    const half = map.size / 2 - 2
    let x, z
    do {
      x = (Math.random() * 2 - 1) * half
      z = (Math.random() * 2 - 1) * half
    } while (Math.hypot(x, z) < CFG.modes.zombie.guardRadius)
    return { x, y: groundHeightAt(map, x, z), z }
  }

  function startIntermission() {
    modeState.phase = 'intermission'
    modeState.nextWaveAt = timeMs + CFG.modes.zombie.waveIntermission * 1000
    emit('center_message', { text: `第 ${modeState.wave + 1} 波即将来袭`, duration: 1800 })
  }

  function updateZombieMode(dt) {
    if (modeState.phase === 'waiting') return
    if (modeState.phase === 'intermission' && timeMs >= modeState.nextWaveAt) {
      modeState.phase = 'assault'
      modeState.wave++
      modeState.waveTotal = zombieWaveTotal(modeState.wave, CFG.modes.zombie)
      modeState.waveSpawned = modeState.waveDefeated = 0
      spawnTimer = CFG.modes.zombie.waveSpawnInterval
      emit('wave_started', { wave: modeState.wave, total: modeState.waveTotal })
      emit('center_message', { text: `第 ${modeState.wave} 波`, duration: 1400, big: '丧尸来袭' })
    }
    if (modeState.phase !== 'assault') return
    for (const actor of [...actors.values()]) {
      if (actor.kind === 'zombie' && !actor.alive && timeMs - actor.diedAt > 700) {
        actors.delete(actor.id)
        ai.removeActor(actor.id)
        emit('actor_removed', { actorId: actor.id })
      }
    }
    const active = [...actors.values()].filter(actor => actor.kind === 'zombie' && actor.alive).length
    spawnTimer += dt
    if (modeState.waveSpawned < modeState.waveTotal && active < CFG.modes.zombie.maxConcurrent && spawnTimer >= CFG.modes.zombie.waveSpawnInterval) {
      spawnTimer = 0
      const center = randomZombieSpawn()
      const half = map.size / 2 - 2
      const count = Math.min(
        zombiePackSize(Math.hypot(center.x, center.z), half, CFG.modes.zombie),
        modeState.waveTotal - modeState.waveSpawned,
        CFG.modes.zombie.maxConcurrent - active,
      )
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2
        const radius = count === 1 ? 0 : Math.random() * CFG.modes.zombie.wavePackScatter
        const x = center.x + Math.cos(angle) * radius
        const z = center.z + Math.sin(angle) * radius
        addBot('axis', 'zombie', { x, y: groundHeightAt(map, x, z), z })
      }
      modeState.waveSpawned += count
    }
    if (modeState.waveSpawned >= modeState.waveTotal && active === 0) startIntermission()
  }

  function checkOutcome() {
    if (modeId !== 'classic' || outcome) return
    outcome = classicOutcome(score, CFG.modes.classic.killTarget)
    if (outcome) emit('match_end', outcome)
  }

  function step(dt) {
    if (outcome) return
    timeMs += dt * 1000
    for (const actor of actors.values()) {
      actor.viewRecoilPitch *= Math.pow(CFG.weapon.viewRecoilPitchDecay, dt)
      actor.viewRecoilYaw *= Math.pow(CFG.weapon.viewRecoilYawDecay, dt)
      actor.viewRecoilRoll *= Math.pow(CFG.weapon.viewRecoilRollDecay, dt)
      resolveMovement(actor, dt)
      handleActions(actor)
      actor.spreadBloom = Math.max(0, actor.spreadBloom - dt * CFG.weapon.spreadBloomRecovery)
      if (actor.alive && actor.controller === 'human' && modeId === 'classic' && actor.health < actor.maxHealth)
        actor.health = Math.min(actor.maxHealth, actor.health + CFG.player.healthRegen * dt)
    }
    updateSharedAi(dt)
    updateProjectiles(dt)
    for (let index = smokeClouds.length - 1; index >= 0; index--)
      if (smokeClouds[index].expiresAt <= timeMs) smokeClouds.splice(index, 1)
    respawnActors()
    if (modeId === 'zombie') updateZombieMode(dt)
  }

  function publicActor(actor) {
    return {
      id: actor.id, name: actor.name, kind: actor.kind, controller: actor.controller, team: actor.team,
      deployed: actor.deployed, alive: actor.alive,
      x: actor.x, y: actor.y, z: actor.z, vx: actor.vx, vy: actor.vy, vz: actor.vz,
      yaw: actor.yaw, pitch: actor.pitch, currentHeight: actor.currentHeight,
      health: actor.health, maxHealth: actor.maxHealth, weapon: actor.weapon,
      kills: actor.kills, deaths: actor.deaths, stateName: actor.stateName,
      targetVisible: actor.controller === 'human' ? actor.aiming : actor.targetVisible,
      reloading: !!actor.reloading || !!actor.reloadAt || !!actor.rpgReloadAt,
    }
  }

  function actorDefinition(actor) {
    return {
      id: actor.id, name: actor.name, kind: actor.kind,
      controller: actor.controller, team: actor.team, weapon: actor.weapon,
      maxHealth: actor.maxHealth,
    }
  }

  function actorFrame(actor) {
    return [
      actor.id, actor.x, actor.y, actor.z, actor.vx, actor.vy, actor.vz,
      actor.yaw, actor.pitch, actor.alive, actor.health, actor.kills, actor.deaths,
      actor.stateName, actor.controller === 'human' ? actor.aiming : actor.targetVisible,
      !!actor.reloading || !!actor.reloadAt || !!actor.rpgReloadAt,
      actor.currentHeight, actor.deployed, actor.weapon,
    ]
  }

  function privatePlayer(actor) {
    return {
      ...publicActor(actor), grounded: actor.grounded, crouching: actor.crouching,
      ammo: actor.ammo, reserveAmmo: actor.reserveAmmo,
      secondary: actor.secondary, secondaryCount: actor.secondaryCount, rpgLoaded: actor.rpgLoaded,
      grenade: actor.grenade, grenadeCount: actor.grenadeCount, item: actor.item, itemUses: actor.itemUses,
      activeSlot: actor.activeSlot, aiming: actor.aiming, sprinting: actor.sprinting,
      spreadBloom: actor.spreadBloom, headshots: actor.headshots,
      meleeKills: actor.meleeKills, grenadeKills: actor.grenadeKills,
      killStreak: actor.killStreak, bestKillStreak: actor.bestKillStreak,
      lastInputSeq: actor.lastInputSeq,
    }
  }

  function createSnapshot(playerId = null, includeDefinitions = false) {
    return {
      timeMs, modeId, score: { ...score }, modeState: { ...modeState }, outcome,
      player: playerId ? privatePlayer(actors.get(playerId)) : null,
      definitions: includeDefinitions ? [...actors.values()].map(actorDefinition) : null,
      actors: [...actors.values()].map(actorFrame),
    }
  }

  initializeBots()
  ai.init({
    modeId, config: CFG, mapSize: map.size, obstacles: map.obstacles,
    coverPoints: map.coverPoints.map((point, index) => ({ id: index, ...point })),
    medicalStations: map.medicalStations.map(stationData),
    ammoStations: map.ammoStations.map(stationData),
    groundRegions: map.groundRegions, fortress: fortressData(),
    actors: [...actors.values()].filter(actor => actor.controller !== 'human').map(aiActor),
    players: [],
  })
  aiReady = true
  events.length = 0
  return {
    modeId, map, actors, addPlayer, removePlayer, setConnected, submitInput, deployPlayer, redeployPlayer,
    step, createSnapshot, createPlayerSnapshot: id => privatePlayer(actors.get(id)),
    drainEvents: () => events.splice(0), getOutcome: () => outcome,
    get timeMs() { return timeMs },
  }
}
