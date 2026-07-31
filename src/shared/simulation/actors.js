import {
  createBoxHitbox,
  createCircleHitbox,
  getObstacleNormal,
  rayHitObstacle,
  resolveObstacleCollision,
  sweepSphereObstacle,
} from './collision.js'

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

export function stepPlayerMotion(state, input, dt, config, world) {
  const crouching = input.crouch && !input.sprint
  const sprinting = input.sprint && !crouching && !input.aim
  const targetHeight = crouching ? config.crouchHeight : config.standHeight
  const currentHeight = state.currentHeight +
    (targetHeight - state.currentHeight) * Math.min(1, dt * config.crouchTransitionSpeed)
  const speed = crouching ? config.crouchSpeed : sprinting ? config.sprintSpeed : config.walkSpeed
  const length = Math.hypot(input.moveX, input.moveZ)
  let vx = state.vx
  let vz = state.vz
  if (length > 0) {
    const moveX = input.moveX / Math.max(1, length)
    const moveZ = input.moveZ / Math.max(1, length)
    vx = (moveX * Math.cos(input.yaw) + moveZ * Math.sin(input.yaw)) * speed
    vz = (-moveX * Math.sin(input.yaw) + moveZ * Math.cos(input.yaw)) * speed
  } else {
    vx *= config.movementDamping
    vz *= config.movementDamping
  }

  let vy = state.vy
  let grounded = state.grounded
  if (input.jump && grounded) {
    vy = config.jumpVelocity
    grounded = false
  }
  vy -= config.gravity * dt
  const position = { x: state.x + vx * dt, y: state.y, z: state.z + vz * dt }
  const floor = world.groundHeightAt(position.x, position.z) + currentHeight
  if (grounded) {
    position.y = floor
    vy = 0
  }
  else {
    position.y += vy * dt
    if (position.y < floor) {
      position.y = floor
      vy = 0
      grounded = true
    }
  }
  for (const obstacle of world.obstacles) {
    if (obstacle.type === 'ground' || obstacle.type === 'crater') continue
    resolveObstacleCollision(position, state.radius, obstacle, position.y - currentHeight)
  }
  const half = world.mapSize / 2 - 2
  position.x = clamp(position.x, -half, half)
  position.z = clamp(position.z, -half, half)
  return {
    ...position, vx, vy, vz, yaw: input.yaw, pitch: input.pitch, currentHeight,
    grounded, crouching, sprinting, moving: length > 0 && grounded,
  }
}

export function calculateWeaponSpread({
  baseSpread, speed, aiming, crouching, sprinting, grounded, reloading, bloom = 0,
}, config) {
  const moving = speed > config.playerMovingThreshold
  let spread = baseSpread
  if (aiming) spread *= config.aimingSpreadMultiplier
  else if (crouching) spread *= config.crouchingSpreadMultiplier
  if (sprinting && moving) spread *= config.sprintingSpreadMultiplier
  else if (moving) spread *= config.movingSpreadMultiplier
  if (!grounded) spread *= config.airborneSpreadMultiplier
  if (reloading) spread *= config.reloadingSpreadMultiplier
  return Math.min(spread + bloom, config.maxSpread)
}

export function directionFromAngles(yaw, pitch) {
  return {
    x: -Math.sin(yaw) * Math.cos(pitch),
    y: Math.sin(pitch),
    z: -Math.cos(yaw) * Math.cos(pitch),
  }
}

export function applyWeaponSpread(direction, spread, random = Math.random) {
  const result = {
    x: direction.x + (random() - 0.5) * spread * 2,
    y: direction.y + (random() - 0.5) * spread * 2,
    z: direction.z + (random() - 0.5) * spread * 2,
  }
  const length = Math.hypot(result.x, result.y, result.z)
  result.x /= length
  result.y /= length
  result.z /= length
  return result
}

export function createWeaponRecoil(aiming, multiplier, config, random = Math.random) {
  return {
    pitch: ((aiming ? config.aimingRecoilPitch : config.hipRecoilPitch) +
      random() * config.recoilPitchRandom) * multiplier,
    yaw: (random() - 0.5) *
      (aiming ? config.aimingRecoilYaw : config.hipRecoilYaw) * multiplier,
    roll: (random() - 0.5) *
      (aiming ? config.aimingRecoilRoll : config.hipRecoilRoll) * multiplier,
  }
}

export function addWeaponBloom(actor, weapon, config, aiming) {
  actor.spreadBloom = Math.min(config.spreadBloomMax, actor.spreadBloom +
    (aiming ? weapon.aimedSpreadBloomPerShot : weapon.spreadBloomPerShot))
}

export function createActorHitboxes(kind, config) {
  if (kind === 'player') return [
    createCircleHitbox(config.player.radius, 0, config.player.standHeight - config.player.bodyHitboxHeightOffset),
    createCircleHitbox(config.player.radius * config.player.headHitboxRadiusMultiplier,
      config.player.standHeight - config.player.headHitboxHeightOffset, config.player.standHeight, true),
  ]
  if (kind === 'zombie') return [
    createBoxHitbox(0.8, 0.58, 0, 1.5),
    createBoxHitbox(0.5, 0.5, 1.48, 1.95, true),
  ]
  return [
    createBoxHitbox(config.bot.hitboxBodyWidth, config.bot.hitboxBodyDepth, 0, config.bot.hitboxBodyMaxY),
    createBoxHitbox(config.bot.hitboxHeadWidth, config.bot.hitboxHeadDepth,
      config.bot.hitboxHeadMinY, config.bot.hitboxHeadMaxY, true),
  ]
}

export function updateActorHitboxes(actor, hitboxes, kind, config) {
  const x = actor.position?.x ?? actor.x
  const y = actor.position?.y ?? actor.y
  const z = actor.position?.z ?? actor.z
  if (kind === 'player') {
    const height = actor.currentHeight
    const ground = y - height
    hitboxes[0].minY = ground
    hitboxes[0].maxY = ground + height - config.player.bodyHitboxHeightOffset
    hitboxes[1].minY = ground + height - config.player.headHitboxHeightOffset
    hitboxes[1].maxY = ground + height
  } else {
    const data = kind === 'zombie'
      ? { bodyMin: 0, bodyMax: 1.5, headMin: 1.48, headMax: 1.95 }
      : { bodyMin: 0, bodyMax: config.bot.hitboxBodyMaxY,
          headMin: config.bot.hitboxHeadMinY, headMax: config.bot.hitboxHeadMaxY }
    hitboxes[0].minY = y + data.bodyMin
    hitboxes[0].maxY = y + data.bodyMax
    hitboxes[1].minY = y + data.headMin
    hitboxes[1].maxY = y + data.headMax
    const yaw = actor.yaw
    for (const hitbox of hitboxes) {
      hitbox.rot = yaw
      hitbox.cos = Math.cos(yaw)
      hitbox.sin = Math.sin(yaw)
    }
  }
  for (const hitbox of hitboxes) {
    hitbox.x = x
    hitbox.z = z
  }
  return hitboxes
}

export function reloadMagazine(actor, weapon) {
  const amount = Math.min(weapon.magazineSize - actor.ammo, actor.reserveAmmo)
  actor.ammo += amount
  actor.reserveAmmo -= amount
  return amount
}

export function useCarriedItem(actor, item, weapon) {
  if (actor.itemUses <= 0) return false
  if (item.kind === 'heal') {
    if (actor.health >= actor.maxHealth) return false
    actor.health = Math.min(actor.maxHealth, actor.health + item.amount)
  } else {
    if (actor.reserveAmmo >= (actor.reserveAmmoLimit ?? weapon.reserveAmmo)) return false
    actor.reserveAmmo = actor.reserveAmmoLimit ?? weapon.reserveAmmo
  }
  actor.itemUses--
  return true
}

export function resupplyInventory(actor, equipment) {
  const changed = actor.reserveAmmo < equipment.weapon.reserveAmmo ||
    actor.grenadeCount < equipment.grenade.count || actor.itemUses < (equipment.item.uses || 0) ||
    actor.secondaryCount < equipment.secondary.count
  if (!changed) return false
  actor.reserveAmmo = equipment.weapon.reserveAmmo
  actor.grenadeCount = equipment.grenade.count
  actor.itemUses = equipment.item.uses || 0
  actor.secondaryCount = equipment.secondary.count
  if (equipment.secondary.kind === 'rpg' && actor.secondaryCount > 0) actor.rpgLoaded = true
  return true
}

export function explosionDamage(baseDamage, distance, radius) {
  return distance >= radius ? 0 : baseDamage * (1 - (distance / radius) * 0.78)
}

export function traceHitscan({ origin, direction, range, obstacles, targets, getHitboxes }) {
  let distance = range
  let obstacleHit = false
  for (const obstacle of obstacles) {
    if (obstacle.type === 'ground' || obstacle.type === 'crater') continue
    const hit = rayHitObstacle(origin, direction, obstacle, distance)
    if (hit == null) continue
    distance = hit
    obstacleHit = true
  }
  let target = null
  let headshot = false
  for (const candidate of targets) {
    for (const hitbox of getHitboxes(candidate)) {
      const hit = rayHitObstacle(origin, direction, hitbox, distance)
      if (hit == null) continue
      distance = hit
      target = candidate
      headshot = !!hitbox.headshot
    }
  }
  return {
    distance, target, headshot, obstacleHit,
    point: {
      x: origin.x + direction.x * distance,
      y: origin.y + direction.y * distance,
      z: origin.z + direction.z * distance,
    },
  }
}

export function stepThrownProjectile(body, dt, options) {
  body.vy -= options.gravity * dt
  const previous = { x: body.x, y: body.y, z: body.z }
  const next = { x: body.x + body.vx * dt, y: body.y + body.vy * dt, z: body.z + body.vz * dt }
  let obstacle = null
  let obstacleTime = Infinity
  for (const candidate of options.obstacles) {
    if (candidate.type === 'ground' || candidate.type === 'crater') continue
    const hit = sweepSphereObstacle(previous, next, options.radius, candidate)
    if (hit == null || hit >= obstacleTime) continue
    obstacle = candidate
    obstacleTime = hit
  }
  const previousGround = options.groundHeightAt(previous.x, previous.z) + options.radius
  const nextGround = options.groundHeightAt(next.x, next.z) + options.radius
  let groundTime = Infinity
  if (previous.y <= previousGround + 0.002 && body.vy <= 0) groundTime = 0
  else if (next.y <= nextGround) {
    const span = previous.y - previousGround - (next.y - nextGround)
    groundTime = span > 1e-6 ? clamp((previous.y - previousGround) / span, 0, 1) : 0
  }
  if (groundTime < Infinity && groundTime <= obstacleTime) {
    body.x = previous.x + (next.x - previous.x) * groundTime
    body.y = options.groundHeightAt(body.x, previous.z + (next.z - previous.z) * groundTime) + options.radius
    body.z = previous.z + (next.z - previous.z) * groundTime
    if (options.sticky) body.vx = body.vy = body.vz = 0
    else {
      body.vy = Math.abs(body.vy) * options.bounce
      body.vx *= 0.68
      body.vz *= 0.68
    }
    return { hit: true, stuck: !!options.sticky, obstacle: null }
  }
  if (obstacle) {
    body.x = previous.x + (next.x - previous.x) * obstacleTime
    body.y = previous.y + (next.y - previous.y) * obstacleTime
    body.z = previous.z + (next.z - previous.z) * obstacleTime
    const normal = getObstacleNormal(body, obstacle, body)
    if (options.sticky) {
      body.x += normal.x * 0.02
      body.y += normal.y * 0.02
      body.z += normal.z * 0.02
      body.vx = body.vy = body.vz = 0
    } else {
      const dot = body.vx * normal.x + body.vy * normal.y + body.vz * normal.z
      if (dot < 0) {
        body.vx = (body.vx - 2 * dot * normal.x) * 0.62
        body.vy = (body.vy - 2 * dot * normal.y) * 0.62
        body.vz = (body.vz - 2 * dot * normal.z) * 0.62
      }
      body.x += normal.x * 0.004
      body.y += normal.y * 0.004
      body.z += normal.z * 0.004
    }
    return { hit: true, stuck: !!options.sticky, obstacle }
  }
  body.x = next.x
  body.y = next.y
  body.z = next.z
  return { hit: false, stuck: false, obstacle: null }
}
