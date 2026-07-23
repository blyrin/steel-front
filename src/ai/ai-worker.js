const actors = new Map()
let config = null
let modeId = null
let obstacles = []
let coverPoints = []
let medicalStations = []
let ammoStations = []
let groundRegions = []
let fortress = null
let player = null
let simulationTime = 0
let events = []

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function distance2D(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z)
}

function normalizeDirection(x, z) {
  const length = Math.hypot(x, z)
  if (length < 1e-8) return { x: 0, z: 0 }
  return { x: x / length, z: z / length }
}

function groundHeightAt(x, z) {
  let height = 0
  for (const region of groundRegions) {
    const distance = Math.hypot(x - region.x, z - region.z)
    if (distance > region.bottomRadius) continue
    let surfaceHeight = region.height
    if (distance > region.topRadius) {
      const span = region.bottomRadius - region.topRadius
      surfaceHeight = ((region.bottomRadius - distance) / span) * region.height
    }
    height = Math.max(height, surfaceHeight)
  }
  return height
}

function rayCircleFlat(ox, oz, dx, dz, cx, cz, radius, maxDist) {
  const fx = ox - cx
  const fz = oz - cz
  const b = fx * dx + fz * dz
  const c = fx * fx + fz * fz - radius * radius
  if (c > 0 && b > 0) return -1
  const discriminant = b * b - c
  if (discriminant < 0) return -1
  const t = -b - Math.sqrt(discriminant)
  if (t < 0) {
    const second = -b + Math.sqrt(discriminant)
    return second >= 0 && second <= maxDist ? second : -1
  }
  return t <= maxDist ? t : -1
}

function rayBoxFlat(ox, oz, dx, dz, obstacle, maxDist) {
  const cx = ox - obstacle.x
  const cz = oz - obstacle.z
  const lx = cx * obstacle.cos - cz * obstacle.sin
  const lz = cx * obstacle.sin + cz * obstacle.cos
  const ldx = dx * obstacle.cos - dz * obstacle.sin
  const ldz = dx * obstacle.sin + dz * obstacle.cos
  let min = 0
  let max = maxDist

  if (Math.abs(ldx) < 1e-8) {
    if (lx < -obstacle.hw || lx > obstacle.hw) return -1
  } else {
    let t1 = (-obstacle.hw - lx) / ldx
    let t2 = (obstacle.hw - lx) / ldx
    if (t1 > t2) [t1, t2] = [t2, t1]
    min = Math.max(min, t1)
    max = Math.min(max, t2)
    if (min > max) return -1
  }

  if (Math.abs(ldz) < 1e-8) {
    if (lz < -obstacle.hd || lz > obstacle.hd) return -1
  } else {
    let t1 = (-obstacle.hd - lz) / ldz
    let t2 = (obstacle.hd - lz) / ldz
    if (t1 > t2) [t1, t2] = [t2, t1]
    min = Math.max(min, t1)
    max = Math.min(max, t2)
    if (min > max) return -1
  }

  return min <= maxDist ? min : -1
}

function rayFrustum(origin, direction, obstacle, maxDist) {
  const minY = obstacle.minY
  const maxY = obstacle.maxY
  const height = maxY - minY
  const bottomRadius = obstacle.bottomRadius
  const topRadius = obstacle.topRadius
  if (height <= 1e-6 || bottomRadius <= 0 || topRadius < 0) return -1

  const ox = origin.x - obstacle.x
  const oy = origin.y - minY
  const oz = origin.z - obstacle.z
  const dx = direction.x
  const dy = direction.y
  const dz = direction.z
  const slope = (topRadius - bottomRadius) / height
  const radiusAtOrigin = bottomRadius + slope * oy
  const originRadiusSq = ox * ox + oz * oz
  if (
    oy >= 0 &&
    oy <= height &&
    radiusAtOrigin >= 0 &&
    originRadiusSq <= radiusAtOrigin * radiusAtOrigin
  ) {
    return 0
  }

  let nearest = maxDist + 1
  const testCandidate = t => {
    if (t < 0 || t > maxDist || t >= nearest) return
    const y = oy + dy * t
    if (y < -1e-6 || y > height + 1e-6) return
    const radius = bottomRadius + slope * y
    if (radius < 0) return
    const x = ox + dx * t
    const z = oz + dz * t
    if (x * x + z * z <= radius * radius + 1e-7) nearest = t
  }

  if (Math.abs(dy) > 1e-8) {
    testCandidate(-oy / dy)
    testCandidate((height - oy) / dy)
  }

  const radiusVelocity = slope * dy
  const a = dx * dx + dz * dz - radiusVelocity * radiusVelocity
  const b = 2 * (ox * dx + oz * dz - radiusAtOrigin * radiusVelocity)
  const c = originRadiusSq - radiusAtOrigin * radiusAtOrigin
  if (Math.abs(a) < 1e-8) {
    if (Math.abs(b) >= 1e-8) testCandidate(-c / b)
  } else {
    const discriminant = b * b - 4 * a * c
    if (discriminant >= 0) {
      const root = Math.sqrt(discriminant)
      const t1 = (-b - root) / (2 * a)
      const t2 = (-b + root) / (2 * a)
      testCandidate(Math.min(t1, t2))
      testCandidate(Math.max(t1, t2))
    }
  }

  return nearest <= maxDist ? nearest : -1
}

function rayHitObstacle(origin, direction, obstacle, maxDist) {
  if (obstacle.shape === 'frustum') return rayFrustum(origin, direction, obstacle, maxDist)

  const flatLengthSq = direction.x * direction.x + direction.z * direction.z
  if (flatLengthSq < 1e-12) return -1
  const flatLength = Math.sqrt(flatLengthSq)
  const invFlat = 1 / flatLength
  const dirX = direction.x * invFlat
  const dirZ = direction.z * invFlat
  const maxFlat = maxDist * flatLength
  const toX = obstacle.x - origin.x
  const toZ = obstacle.z - origin.z
  const projection = toX * dirX + toZ * dirZ
  const radius = obstacle.r
  if (projection < -radius || projection > maxFlat + radius) return -1
  const closestX = origin.x + dirX * clamp(projection, 0, maxFlat)
  const closestZ = origin.z + dirZ * clamp(projection, 0, maxFlat)
  const closestDx = closestX - obstacle.x
  const closestDz = closestZ - obstacle.z
  if (closestDx * closestDx + closestDz * closestDz > radius * radius) return -1

  const flatHit = obstacle.shape === 'box'
    ? rayBoxFlat(origin.x, origin.z, dirX, dirZ, obstacle, maxFlat)
    : rayCircleFlat(origin.x, origin.z, dirX, dirZ, obstacle.x, obstacle.z, radius, maxFlat)
  if (flatHit < 0) return -1
  const hitDistance = flatHit * invFlat
  if (hitDistance < 0 || hitDistance > maxDist) return -1
  const hitY = origin.y + direction.y * hitDistance
  const minY = obstacle.minY
  const maxY = obstacle.maxY
  return hitY >= minY && hitY <= maxY ? hitDistance : -1
}

function isSmokeBlocked(origin, point, smokeClouds) {
  const dx = point.x - origin.x
  const dy = point.y - origin.y
  const dz = point.z - origin.z
  const distance = Math.hypot(dx, dy, dz)
  if (distance < 1e-6) return false
  const direction = { x: dx / distance, y: dy / distance, z: dz / distance }
  for (const smoke of smokeClouds) {
    if (smoke.expiresAt <= simulationTime * 1000) continue
    const toX = smoke.x - origin.x
    const toY = smoke.y - origin.y
    const toZ = smoke.z - origin.z
    const along = clamp(
      toX * direction.x + toY * direction.y + toZ * direction.z,
      0,
      distance,
    )
    const closestX = origin.x + direction.x * along
    const closestY = origin.y + direction.y * along
    const closestZ = origin.z + direction.z * along
    if (
      Math.hypot(smoke.x - closestX, smoke.y - closestY, smoke.z - closestZ) <
      smoke.radius
    ) {
      return true
    }
  }
  return false
}

function hasLineOfSight(origin, point, smokeClouds) {
  if (isSmokeBlocked(origin, point, smokeClouds)) return false
  const dx = point.x - origin.x
  const dy = point.y - origin.y
  const dz = point.z - origin.z
  const distance = Math.hypot(dx, dy, dz)
  if (distance < 1e-6) return true
  const direction = { x: dx / distance, y: dy / distance, z: dz / distance }
  for (const obstacle of obstacles) {
    if (obstacle.type === 'ground' || obstacle.type === 'crater' || obstacle.type === 'wire') continue
    if (rayHitObstacle(origin, direction, obstacle, distance) >= 0) return false
  }
  return true
}

function resolveObstacleCollision(actor, radius) {
  for (const obstacle of obstacles) {
    if (obstacle.type === 'ground' || obstacle.type === 'crater' || obstacle.type === 'wire') continue
    if (actor.y >= obstacle.maxY && obstacle.shape !== 'frustum') continue

    if (obstacle.shape === 'frustum') {
      const minY = obstacle.minY
      const maxY = obstacle.maxY
      const height = maxY - minY
      if (height <= 1e-6 || actor.y >= maxY) continue
      const dx = actor.x - obstacle.x
      const dz = actor.z - obstacle.z
      const distance = Math.hypot(dx, dz)
      if (distance >= obstacle.bottomRadius + radius) continue
      let surfaceHeight = minY
      if (distance <= obstacle.topRadius) {
        surfaceHeight = maxY
      } else if (distance <= obstacle.bottomRadius) {
        surfaceHeight = minY +
          ((obstacle.bottomRadius - distance) /
            (obstacle.bottomRadius - obstacle.topRadius)) * height
      }
      if (actor.y >= surfaceHeight - 0.05) continue
      const section = clamp((actor.y - minY) / height, 0, 1)
      const sectionRadius =
        obstacle.bottomRadius + (obstacle.topRadius - obstacle.bottomRadius) * section
      const minDistance = sectionRadius + radius
      if (distance >= minDistance) continue
      if (distance < 1e-6) {
        actor.x = obstacle.x + minDistance
        actor.z = obstacle.z
      } else {
        const push = (minDistance - distance) / distance
        actor.x += dx * push
        actor.z += dz * push
      }
      continue
    }

    const dx = actor.x - obstacle.x
    const dz = actor.z - obstacle.z
    const bound = obstacle.r + radius
    if (dx * dx + dz * dz >= bound * bound) continue
    if (obstacle.shape !== 'box') {
      const distance = Math.hypot(dx, dz)
      if (distance < 1e-6) {
        actor.x += radius
        continue
      }
      const push = (bound - distance) / distance
      actor.x += dx * push
      actor.z += dz * push
      continue
    }

    const localX = dx * obstacle.cos - dz * obstacle.sin
    const localZ = dx * obstacle.sin + dz * obstacle.cos
    const closestX = clamp(localX, -obstacle.hw, obstacle.hw)
    const closestZ = clamp(localZ, -obstacle.hd, obstacle.hd)
    let offsetX = localX - closestX
    let offsetZ = localZ - closestZ
    const distanceSq = offsetX * offsetX + offsetZ * offsetZ
    let nextX = localX
    let nextZ = localZ
    if (distanceSq < 1e-12) {
      const penetrationX = obstacle.hw - Math.abs(localX) + radius
      const penetrationZ = obstacle.hd - Math.abs(localZ) + radius
      if (penetrationX < penetrationZ) {
        nextX = localX >= 0 ? obstacle.hw + radius : -obstacle.hw - radius
      } else {
        nextZ = localZ >= 0 ? obstacle.hd + radius : -obstacle.hd - radius
      }
    } else if (distanceSq < radius * radius) {
      const distance = Math.sqrt(distanceSq)
      const push = (radius - distance) / distance
      nextX = localX + offsetX * push
      nextZ = localZ + offsetZ * push
    } else {
      continue
    }
    actor.x = obstacle.x + nextX * obstacle.cos + nextZ * obstacle.sin
    actor.z = obstacle.z - nextX * obstacle.sin + nextZ * obstacle.cos
  }
}

function actorConfig(actor) {
  return actor.kind === 'zombie' ? config.modes.zombie.enemy : config.bot
}

function targetGroundY(target) {
  return target.kind === 'player' ? target.y - target.currentHeight : target.y
}

function targetPoint(target, height) {
  return { x: target.x, y: targetGroundY(target) + height, z: target.z }
}

function getTarget(id) {
  if (id === 'player') return player
  return actors.get(id) ?? null
}

function hostileTargets(actor) {
  const targets = []
  for (const candidate of actors.values()) {
    if (candidate.alive && candidate.team !== actor.team) targets.push(candidate)
  }
  if (player.alive && player.team !== actor.team) targets.push(player)
  return targets
}

function forwardDot(actor, target) {
  const dx = target.x - actor.x
  const dz = target.z - actor.z
  const distance = Math.hypot(dx, dz)
  if (distance < 1e-6) return 1
  const forwardX = -Math.sin(actor.yaw)
  const forwardZ = -Math.cos(actor.yaw)
  return (forwardX * dx + forwardZ * dz) / distance
}

function botCanSee(actor, target, smokeClouds) {
  const botConfig = config.bot
  const distance = distance2D(actor, target)
  if (distance > botConfig.viewDistance) return false
  const isPlayer = target.kind === 'player'
  const threshold = isPlayer ? -0.18 : botConfig.viewForwardThreshold
  const minimumDistance = isPlayer
    ? Math.max(botConfig.viewForwardMinDistance, 16)
    : botConfig.viewForwardMinDistance
  if (forwardDot(actor, target) < threshold && distance > minimumDistance) return false
  const origin = { x: actor.x, y: actor.y + botConfig.viewOriginHeight, z: actor.z }
  const point = targetPoint(target, botConfig.targetHeight)
  return hasLineOfSight(origin, point, smokeClouds)
}

function targetScore(actor, target, distance, visible) {
  const botConfig = config.bot
  const weapon = config.weapons[actor.weaponId]
  const idealRange = Math.max(8, weapon.effectiveRange * botConfig.idealRangeMultiplier)
  let score = (botConfig.viewDistance - distance) * 0.16
  score -= Math.abs(distance - idealRange) * 0.12
  if (visible) score += 40
  if (target.targetId === actor.id) score += 24
  if (target.targetId && getTarget(target.targetId)?.team === actor.team) score += 9
  if (target.kind === 'player') score += 12
  if (target.kind === 'zombie' && fortress) {
    const fortressDistance = Math.hypot(target.x - fortress.x, target.z - fortress.z)
    score += Math.max(0, 40 - fortressDistance) * 0.42
  }
  if (target.health < target.maxHealth * 0.35) score += 3
  return score
}

function selectBotTarget(actor, smokeClouds) {
  const botConfig = config.bot
  const candidates = hostileTargets(actor)
    .map(target => ({
      target,
      distance: distance2D(actor, target),
    }))
    .filter(candidate => candidate.distance <= botConfig.viewDistance)
    .map(candidate => ({
      ...candidate,
      score: targetScore(actor, candidate.target, candidate.distance, false) +
        (candidate.target.id === actor.targetId ? 12 : 0),
    }))
    .sort((a, b) => b.score - a.score)

  const limited = candidates.slice(0, botConfig.maxPerceptionTargets)
  const playerCandidate = candidates.find(candidate => candidate.target.kind === 'player')
  if (playerCandidate && !limited.includes(playerCandidate)) limited.push(playerCandidate)

  let best = null
  let bestScore = -Infinity
  for (const candidate of limited) {
    if (!botCanSee(actor, candidate.target, smokeClouds)) continue
    const score = targetScore(actor, candidate.target, candidate.distance, true)
    if (score > bestScore) {
      bestScore = score
      best = candidate.target
    }
  }
  if (best) {
    return {
      target: best,
      visible: true,
      x: best.x,
      y: targetGroundY(best),
      z: best.z,
      seenAt: actor.aiTime,
    }
  }

  const shot = player.lastShot
  if (player.alive && player.team !== actor.team && shot) {
    const age = (simulationTime * 1000 - shot.at) / 1000
    const distance = Math.hypot(shot.x - actor.x, shot.z - actor.z)
    if (age <= botConfig.playerShotMemory && distance <= botConfig.playerShotHearingDistance) {
      return { target: player, visible: false, x: shot.x, y: actor.y, z: shot.z, seenAt: actor.aiTime }
    }
  }

  let shared = null
  let sharedScore = -Infinity
  for (const ally of actors.values()) {
    if (
      ally === actor ||
      !ally.alive ||
      ally.team !== actor.team ||
      !ally.targetId ||
      ally.targetId === actor.id
    ) {
      continue
    }
    const contact = getTarget(ally.targetId)
    if (!contact?.alive || contact.team === actor.team) continue
    const allyDistance = distance2D(actor, ally)
    if (allyDistance > botConfig.communicationRadius) continue
    const age = actor.aiTime - ally.lastSeenAt
    if (age > botConfig.sharedContactMemory) continue
    const targetDistance = distance2D(actor, contact)
    const score = targetScore(actor, contact, targetDistance, false) - age * 5
    if (score > sharedScore) {
      sharedScore = score
      shared = {
        target: contact,
        visible: false,
        x: ally.lastSeenX,
        y: ally.lastSeenY,
        z: ally.lastSeenZ,
        seenAt: ally.lastSeenAt,
      }
    }
  }
  if (shared) return shared

  const current = getTarget(actor.targetId)
  if (current?.alive && actor.aiTime - actor.lastSeenAt <= botConfig.lostTargetTime) {
    return {
      target: current,
      visible: false,
      x: actor.lastSeenX,
      y: actor.lastSeenY,
      z: actor.lastSeenZ,
      seenAt: actor.lastSeenAt,
    }
  }
  return null
}

function selectZombieTarget(actor) {
  const enemyConfig = config.modes.zombie.enemy
  const searchRadiusSq = enemyConfig.targetSearchRadius ** 2
  let nearest = null
  let nearestDistance = Infinity
  for (const target of hostileTargets(actor)) {
    const dx = target.x - actor.x
    const dz = target.z - actor.z
    const distanceSq = dx * dx + dz * dz
    if (distanceSq > searchRadiusSq) continue
    let score = Math.sqrt(distanceSq)
    if (target.kind === 'player') score -= 1.8
    if (target.health < target.maxHealth * 0.35) score -= 0.8
    if (score < nearestDistance) {
      nearest = target
      nearestDistance = score
    }
  }

  const current = getTarget(actor.targetId)
  if (current?.alive) {
    const currentDistance = distance2D(actor, current)
    if (
      currentDistance <= Math.sqrt(searchRadiusSq) &&
      (!nearest || currentDistance <= nearestDistance + enemyConfig.targetSwitchBias)
    ) {
      return { target: current, visible: true, x: current.x, y: targetGroundY(current), z: current.z, seenAt: actor.aiTime }
    }
  }

  const shot = player.lastShot
  if (player.alive && shot) {
    const age = (simulationTime * 1000 - shot.at) / 1000
    const distance = Math.hypot(shot.x - actor.x, shot.z - actor.z)
    if (age <= enemyConfig.playerShotMemory && distance <= enemyConfig.playerShotHearingDistance) {
      return { target: player, visible: false, x: shot.x, y: actor.y, z: shot.z, seenAt: actor.aiTime }
    }
  }

  return nearest
    ? { target: nearest, visible: true, x: nearest.x, y: targetGroundY(nearest), z: nearest.z, seenAt: actor.aiTime }
    : null
}

function directionBlocked(actor, direction) {
  const actorConfigData = actorConfig(actor)
  const origin = {
    x: actor.x,
    y: actor.y + (actor.kind === 'zombie' ? 0.65 : 0.72),
    z: actor.z,
  }
  const lookAhead = actorConfigData.movementLookAhead
  for (const obstacle of obstacles) {
    if (
      obstacle.type === 'ground' ||
      obstacle.type === 'crater' ||
      obstacle.type === 'wire' ||
      obstacle.shape === 'frustum'
    ) {
      continue
    }
    if (rayHitObstacle(origin, { x: direction.x, y: 0, z: direction.z }, obstacle, lookAhead) >= 0) {
      return true
    }
  }
  return false
}

function addSeparation(actor, direction) {
  const actorConfigData = actorConfig(actor)
  const minDistance = actorConfigData.separationDistance
  const minDistanceSq = minDistance * minDistance
  let separationX = 0
  let separationZ = 0
  for (const other of actors.values()) {
    if (!other.alive || other === actor || other.team !== actor.team) continue
    const dx = actor.x - other.x
    const dz = actor.z - other.z
    const distanceSq = dx * dx + dz * dz
    if (distanceSq < 1e-8 || distanceSq >= minDistanceSq) continue
    const distance = Math.sqrt(distanceSq)
    const strength = 1 - distance / minDistance
    separationX += (dx / distance) * strength
    separationZ += (dz / distance) * strength
  }
  if (actor.kind === 'soldier' && player.alive && player.team === actor.team) {
    const dx = actor.x - player.x
    const dz = actor.z - player.z
    const distanceSq = dx * dx + dz * dz
    if (distanceSq > 1e-8 && distanceSq < minDistanceSq) {
      const distance = Math.sqrt(distanceSq)
      const strength = 1 - distance / minDistance
      separationX += (dx / distance) * strength
      separationZ += (dz / distance) * strength
    }
  }
  if (separationX * separationX + separationZ * separationZ < 1e-8) return direction
  return normalizeDirection(
    direction.x + separationX * actorConfigData.separationWeight,
    direction.z + separationZ * actorConfigData.separationWeight,
  )
}

function chooseMovementDirection(actor, desired) {
  const desiredDirection = normalizeDirection(desired.x, desired.z)
  if (desiredDirection.x === 0 && desiredDirection.z === 0) return desiredDirection
  const actorConfigData = actorConfig(actor)
  const baseAngle = Math.atan2(desiredDirection.z, desiredDirection.x)
  const probeAngle = actorConfigData.movementProbeAngle
  const unstuckDistance = actor.kind === 'zombie' ? 1.1 : 1.05
  const unstuckOffset = actor.unstuckTimer > 0
    ? actor.unstuckSign * unstuckDistance
    : 0
  const angles = [
    unstuckOffset,
    probeAngle + unstuckOffset,
    -probeAngle + unstuckOffset,
    probeAngle * 2 + unstuckOffset,
    -probeAngle * 2 + unstuckOffset,
    Math.PI * 0.78 + unstuckOffset,
    -Math.PI * 0.78 + unstuckOffset,
  ]
  let best = desiredDirection
  let bestScore = -Infinity
  for (const offset of angles) {
    const angle = baseAngle + offset
    const direction = { x: Math.cos(angle), z: Math.sin(angle) }
    const blocked = directionBlocked(actor, direction)
    let score = direction.x * desiredDirection.x + direction.z * desiredDirection.z
    score *= 5
    score += blocked ? -8 : 2
    if (actor.unstuckTimer > 0 && Math.sign(offset || 1) === actor.unstuckSign) score += 1.5
    if (score > bestScore) {
      bestScore = score
      best = direction
    }
  }
  return addSeparation(actor, best)
}

function moveWithDirection(actor, direction, speed) {
  const movement = chooseMovementDirection(actor, direction)
  actor.vx = movement.x * speed
  actor.vz = movement.z * speed
}

function moveToward(actor, target, speed) {
  const dx = target.x - actor.x
  const dz = target.z - actor.z
  if (dx * dx + dz * dz < 0.01) {
    actor.vx = 0
    actor.vz = 0
    return
  }
  moveWithDirection(actor, { x: dx, z: dz }, speed)
}

function updateStuck(actor, dt) {
  actor.stuckSampleTimer += dt
  if (actor.stuckSampleTimer < 0.28) return
  const moved = Math.hypot(actor.x - actor.lastX, actor.z - actor.lastZ)
  const speed = Math.hypot(actor.vx, actor.vz)
  const data = actorConfig(actor)
  if (speed > 1 && moved < data.stuckDistance) {
    actor.stuckTimer += actor.stuckSampleTimer
  } else {
    actor.stuckTimer = Math.max(0, actor.stuckTimer - actor.stuckSampleTimer * 1.5)
  }
  if (actor.stuckTimer > data.stuckTimeout) {
    actor.unstuckTimer = actor.kind === 'zombie' ? 1.1 : 1.05
    actor.unstuckSign *= -1
    actor.stuckTimer = 0
  }
  actor.lastX = actor.x
  actor.lastZ = actor.z
  actor.stuckSampleTimer = 0
}

function applyMovement(actor, dt) {
  actor.x += actor.vx * dt
  actor.z += actor.vz * dt
  const half = config.match.mapSize / 2 - 2
  actor.x = clamp(actor.x, -half, half)
  actor.z = clamp(actor.z, -half, half)
  actor.y = groundHeightAt(actor.x, actor.z)
  resolveObstacleCollision(actor, actor.radius)
  updateStuck(actor, dt)

  let targetX = actor.x - Math.sin(actor.yaw)
  let targetZ = actor.z - Math.cos(actor.yaw)
  const target = getTarget(actor.targetId)
  const targetPosition = actor.targetVisible && target
    ? target
    : { x: actor.lastSeenX, z: actor.lastSeenZ }
  const combatState =
    actor.stateName === 'engage' ||
    actor.stateName === 'seek_cover' ||
    actor.stateName === 'hold_cover' ||
    actor.stateName === 'flank'
  if (target && (combatState || actor.kind === 'zombie')) {
    targetX = targetPosition.x
    targetZ = targetPosition.z
  } else if (actor.stateName === 'alert') {
    targetX = actor.searchX
    targetZ = actor.searchZ
  } else if (
    Math.hypot(actor.vx, actor.vz) >
    (actor.kind === 'zombie' ? 0.1 : config.bot.stationarySpeedThreshold)
  ) {
    targetX = actor.x + actor.vx
    targetZ = actor.z + actor.vz
  }
  const desiredYaw = Math.atan2(-(targetX - actor.x), -(targetZ - actor.z))
  let difference = desiredYaw - actor.yaw
  while (difference > Math.PI) difference -= Math.PI * 2
  while (difference < -Math.PI) difference += Math.PI * 2
  const turnSpeed = actor.kind === 'zombie' ? 7 : config.bot.turnSpeed
  actor.yaw += difference * Math.min(1, dt * turnSpeed)
}

function setState(actor, stateName) {
  if (actor.stateName === stateName) return
  actor.stateName = stateName
  actor.stateTimer = 0
  if (stateName !== 'hold_cover') actor.isPeeking = false
}

function patrolPoint(actor) {
  if (modeId === 'zombie') {
    const radius = 8 + Math.random() * (config.modes.zombie.guardRadius - 8)
    const angle = Math.random() * Math.PI * 2
    return {
      x: fortress.x + Math.cos(angle) * radius,
      z: fortress.z + Math.sin(angle) * radius,
    }
  }
  const half = config.match.mapSize * config.bot.patrolAreaRatio
  return {
    x: (Math.random() - 0.5) * half * 2,
    z: (Math.random() - 0.5) * half * 2,
  }
}

function nearestStation(actor, stations) {
  let nearest = null
  let nearestDistance = Infinity
  for (const station of stations) {
    const distance = Math.hypot(station.x - actor.x, station.z - actor.z)
    if (distance < nearestDistance) {
      nearestDistance = distance
      nearest = station
    }
  }
  return nearest
}

function findResupply(actor) {
  if (actor.aiTime < actor.nextSupplyAt) return null
  const botConfig = config.bot
  if (actor.health <= botConfig.resupplyHealthThreshold) {
    const station = nearestStation(actor, medicalStations)
    if (station) return { station, kind: 'medical' }
  }
  const weapon = config.weapons[actor.weaponId]
  const grenade = config.grenades[actor.grenadeId]
  const item = config.items[actor.itemId]
  const totalAmmo = actor.magazine + actor.reserveAmmo
  const maxAmmo = weapon.magazineSize + weapon.reserveAmmo
  const needsEquipment =
    actor.grenadeCount < grenade.count || actor.itemUses < item.uses
  if (totalAmmo / maxAmmo <= botConfig.resupplyAmmoRatio || needsEquipment) {
    const station = nearestStation(actor, ammoStations)
    if (station) return { station, kind: 'ammo' }
  }
  return null
}

function findCover(actor, targetPosition, smokeClouds) {
  const botConfig = config.bot
  const targetOrigin = {
    x: targetPosition.x,
    y: targetPosition.y + botConfig.viewOriginHeight,
    z: targetPosition.z,
  }
  let best = null
  let bestScore = -Infinity
  for (const cover of coverPoints) {
    if (cover.type === 'fortress' && actor.y < 1.5) continue
    const distanceToCover = Math.hypot(cover.x - actor.x, cover.z - actor.z)
    if (distanceToCover > botConfig.coverSearchDistance) continue
    const awayX = cover.x - targetPosition.x
    const awayZ = cover.z - targetPosition.z
    const awayDistance = Math.hypot(awayX, awayZ)
    if (awayDistance < 1e-6) continue
    const awayXNormalized = awayX / awayDistance
    const awayZNormalized = awayZ / awayDistance
    const standDistance = Math.max(cover.r + actor.radius + botConfig.coverStandOff, 1.4)
    const standX = cover.x + awayXNormalized * standDistance
    const standZ = cover.z + awayZNormalized * standDistance
    const standY = groundHeightAt(standX, standZ)
    const standAim = {
      x: standX,
      y: standY + botConfig.targetHeight,
      z: standZ,
    }
    const protectedPosition = !hasLineOfSight(targetOrigin, standAim, smokeClouds)
    let peek = null
    let peekVisible = false
    const awayAngle = Math.atan2(awayZNormalized, awayXNormalized)
    const peekDistance = Math.max(cover.r + actor.radius + botConfig.coverPeekOffset, 1.6)
    for (const side of [-1, 1]) {
      const angle = awayAngle + side * 0.82
      const peekX = cover.x + Math.cos(angle) * peekDistance
      const peekZ = cover.z + Math.sin(angle) * peekDistance
      const peekY = groundHeightAt(peekX, peekZ)
      if (hasLineOfSight(targetOrigin, { x: peekX, y: peekY + botConfig.targetHeight, z: peekZ }, smokeClouds)) {
        peek = { x: peekX, z: peekZ }
        peekVisible = true
        break
      }
    }
    if (!protectedPosition && !peekVisible) continue
    const coverToEnemy = Math.hypot(targetPosition.x - cover.x, targetPosition.z - cover.z)
    let score = protectedPosition ? 34 : -18
    if (peekVisible) score += 18
    score += (Math.hypot(targetPosition.x - actor.x, targetPosition.z - actor.z) - coverToEnemy) * botConfig.coverEnemyWeight
    score += (botConfig.coverDistanceBias - distanceToCover) * botConfig.coverDistanceWeight
    if (cover.type === 'sandbag' || cover.type === 'barricade') score += 5
    if (actor.role === 'support') score += Math.min(8, coverToEnemy * 0.08)
    if (score > bestScore) {
      bestScore = score
      best = {
        x: standX,
        y: standY,
        z: standZ,
        peekX: peek ? peek.x : standX,
        peekZ: peek ? peek.z : standZ,
      }
    }
  }
  return best
}

function nearbyHostiles(actor, radius) {
  return hostileTargets(actor).filter(target => distance2D(actor, target) <= radius).length
}

function nearbyAllies(actor, radius) {
  let count = 0
  for (const other of actors.values()) {
    if (other.alive && other !== actor && other.team === actor.team && distance2D(actor, other) <= radius) count++
  }
  if (player.alive && player.team === actor.team && distance2D(actor, player) <= radius) count++
  return count
}

function isOutnumbered(actor) {
  const enemies = nearbyHostiles(actor, 18)
  const allies = nearbyAllies(actor, 18) + 1
  return enemies >= 2 && enemies > allies * config.bot.outnumberedRatio
}

function emitWorkerHealthEvent(actor, type, payload = {}) {
  events.push({
    type,
    actorId: actor.id,
    health: actor.health,
    itemUses: actor.itemUses,
    ...payload,
  })
}

function updateBotPerception(actor, dt, smokeClouds) {
  actor.perceptionTimer -= dt
  const current = getTarget(actor.targetId)
  if (actor.perceptionTimer > 0 && current?.alive) return
  actor.perceptionTimer = config.bot.perceptionInterval * (0.85 + Math.random() * 0.3)
  const observation = selectBotTarget(actor, smokeClouds)
  if (!observation) {
    actor.targetVisible = false
    actor.burstShotsRemaining = 0
    if (
      current &&
      (!current.alive || actor.aiTime - actor.lastSeenAt > config.bot.lostTargetTime)
    ) {
      actor.searchX = actor.lastSeenX
      actor.searchZ = actor.lastSeenZ
      setState(actor, 'alert')
      actor.targetId = null
    }
    return
  }

  if (actor.targetId !== observation.target.id) {
    actor.targetId = observation.target.id
    actor.reactionTimer = config.bot.reactionTime * (1.5 - actor.botSkill)
    actor.fireOpportunityTimer = actor.reactionTimer + 0.18 + Math.random() * 0.42
    actor.burstShotsRemaining = 0
    actor.cover = null
  }
  actor.targetVisible = observation.visible
  if (observation.visible) {
    actor.lastSeenX = observation.target.x
    actor.lastSeenY = targetGroundY(observation.target)
    actor.lastSeenZ = observation.target.z
    actor.lastSeenAt = actor.aiTime
    if (actor.reactionTimer <= 0 && actor.stateName !== 'hold_cover' && actor.stateName !== 'seek_cover') {
      setState(actor, 'engage')
    }
  } else {
    actor.lastSeenX = observation.x
    actor.lastSeenY = observation.y
    actor.lastSeenZ = observation.z
    actor.lastSeenAt = observation.seenAt
    if (actor.stateName === 'patrol' || actor.stateName === 'alert') {
      actor.searchX = actor.lastSeenX
      actor.searchZ = actor.lastSeenZ
      setState(actor, 'alert')
    }
  }
}

function updateBotFire(actor, dt) {
  const target = getTarget(actor.targetId)
  if (!target?.alive || !actor.targetVisible || actor.reactionTimer > 0 || actor.reloading) {
    actor.burstShotsRemaining = 0
    return
  }
  const weapon = config.weapons[actor.weaponId]
  const distance = Math.hypot(target.x - actor.x, target.z - actor.z)
  if (distance > weapon.effectiveRange * 1.3) {
    actor.burstShotsRemaining = 0
    actor.fireOpportunityTimer = Math.max(actor.fireOpportunityTimer, 0.25)
    return
  }
  if (actor.burstShotsRemaining > 0) {
    if (actor.weaponShotTimer > 0) return
    if (actor.magazine > 0) {
      actor.magazine--
      actor.burstShotsRemaining--
      actor.weaponShotTimer = weapon.fireDelay
      events.push({ type: 'fire', actorId: actor.id, targetId: target.id })
      if (actor.burstShotsRemaining <= 0) actor.fireOpportunityTimer = getFirePause(actor)
    } else {
      actor.burstShotsRemaining = 0
    }
    return
  }
  if (actor.fireOpportunityTimer > 0) return
  actor.burstShotsRemaining = weapon.automatic
    ? Math.max(2, Math.round(2 + actor.botSkill * 3))
    : 1
  if (actor.magazine > 0) {
    actor.magazine--
    actor.burstShotsRemaining--
    actor.weaponShotTimer = weapon.fireDelay
    events.push({ type: 'fire', actorId: actor.id, targetId: target.id })
    if (actor.burstShotsRemaining <= 0) actor.fireOpportunityTimer = getFirePause(actor)
  } else {
    actor.burstShotsRemaining = 0
    actor.fireOpportunityTimer = 0.2
  }
}

function getFirePause(actor) {
  if (modeId === 'zombie') return 0
  const botConfig = config.bot
  let roleOffset = 0
  if (actor.role === 'marksman') {
    roleOffset = 0.24
  } else if (actor.role === 'support') roleOffset = 0.1
  const weapon = config.weapons[actor.weaponId]
  return Math.max(
    weapon.fireDelay * 1.5,
    botConfig.engageFireBaseDelay +
    (1 - actor.botSkill) * botConfig.engageFireSkillDelay +
    roleOffset +
    Math.random() * 0.45,
  )
}

function tryThrowGrenade(actor, dt) {
  const target = getTarget(actor.targetId)
  if (actor.grenadeCount <= 0 || actor.grenadeCooldown > 0 || !target?.alive || !actor.targetVisible) return
  const grenade = config.grenades[actor.grenadeId]
  const distance = distance2D(actor, target)
  if (distance < config.grenade.aiMinDistance || distance > config.grenade.aiMaxDistance) return
  let clusteredTargets = 0
  for (const candidate of hostileTargets(actor)) {
    if (candidate.alive && Math.hypot(candidate.x - target.x, candidate.z - target.z) < grenade.radius * 0.65) {
      clusteredTargets++
    }
  }
  if (
    grenade.kind === 'smoke' &&
    actor.health > config.bot.lowHealthThreshold &&
    actor.suppression <= 0.45 &&
    actor.stateName !== 'seek_cover'
  ) {
    return
  }
  const chance = config.grenade.aiThrowChancePerSecond * (clusteredTargets > 1 && grenade.kind !== 'smoke' ? 2.2 : 1)
  if (Math.random() >= chance * dt) return
  const originY = actor.y + 1.3
  const targetY = targetGroundY(target) + config.bot.targetHeight
  const directionLength = Math.hypot(target.x - actor.x, targetY + 0.16 - originY, target.z - actor.z)
  if (directionLength < 1e-6) return
  actor.grenadeCount--
  events.push({
    type: 'throw-grenade',
    actorId: actor.id,
    direction: {
      x: (target.x - actor.x) / directionLength,
      y: (targetY + 0.16 - originY) / directionLength,
      z: (target.z - actor.z) / directionLength,
    },
  })
  actor.grenadeCooldown = config.grenade.aiCooldownMin + Math.random() * config.grenade.aiCooldownRange
}

function updateBotResupply(actor) {
  const station = actor.resupplyStation
  if (!station) {
    setState(actor, 'patrol')
    actor.resupplyKind = null
    return
  }
  moveToward(actor, station, config.bot.engageFarSpeed)
  if (Math.hypot(station.x - actor.x, station.z - actor.z) >= config.supply.aiArrivalDistance) return
  if (actor.resupplyKind === 'medical') {
    actor.health = actor.maxHealth
    emitWorkerHealthEvent(actor, 'resupply', { kind: 'medical' })
  } else {
    const weapon = config.weapons[actor.weaponId]
    const grenade = config.grenades[actor.grenadeId]
    const item = config.items[actor.itemId]
    actor.reserveAmmo = weapon.reserveAmmo
    actor.grenadeCount = grenade.count
    actor.itemUses = item.uses
    events.push({ type: 'resupply', actorId: actor.id, kind: 'ammo' })
  }
  actor.nextSupplyAt = actor.aiTime + config.supply.cooldown
  actor.resupplyStation = null
  actor.resupplyKind = null
  setState(actor, 'patrol')
  const point = patrolPoint(actor)
  actor.patrolX = point.x
  actor.patrolZ = point.z
}

function updateBotMovement(actor, dt, smokeClouds) {
  const botConfig = config.bot
  const target = getTarget(actor.targetId)
  let targetPosition = null
  if (target?.alive) {
    targetPosition = actor.targetVisible
      ? { x: target.x, y: targetGroundY(target), z: target.z }
      : { x: actor.lastSeenX, y: actor.lastSeenY, z: actor.lastSeenZ }
  }

  tryThrowGrenade(actor, dt)
  const needsCover = actor.health < botConfig.lowHealthThreshold || actor.suppression > 0.62 || isOutnumbered(actor)
  if (
    targetPosition &&
    actor.targetVisible &&
    needsCover &&
    (!actor.cover || actor.stateTimer > botConfig.coverRefreshInterval)
  ) {
    const cover = findCover(actor, targetPosition, smokeClouds)
    if (cover) {
      actor.cover = cover
      actor.coverPeekTimer = botConfig.coverPeekIntervalMin + Math.random() * botConfig.coverPeekIntervalRange
      actor.isPeeking = false
      setState(actor, 'seek_cover')
    }
  }

  if (actor.stateName === 'resupply') {
    updateBotResupply(actor)
    return
  }
  if (!actor.targetVisible && (actor.stateName === 'patrol' || actor.stateName === 'alert')) {
    const supply = findResupply(actor)
    if (supply) {
      actor.resupplyStation = supply.station
      actor.resupplyKind = supply.kind
      setState(actor, 'resupply')
      updateBotResupply(actor)
      return
    }
  }

  switch (actor.stateName) {
    case 'patrol':
      if (Math.hypot(actor.patrolX - actor.x, actor.patrolZ - actor.z) < botConfig.patrolArrivalDistance) {
        const point = patrolPoint(actor)
        actor.patrolX = point.x
        actor.patrolZ = point.z
      }
      moveToward(actor, { x: actor.patrolX, z: actor.patrolZ }, botConfig.patrolSpeed)
      break
    case 'alert':
      moveToward(actor, { x: actor.searchX, z: actor.searchZ }, botConfig.alertSpeed)
      if (Math.hypot(actor.searchX - actor.x, actor.searchZ - actor.z) < botConfig.alertArrivalDistance) {
        actor.vx = 0
        actor.vz = 0
        if (actor.stateTimer > 0.85) {
          setState(actor, 'patrol')
          const point = patrolPoint(actor)
          actor.patrolX = point.x
          actor.patrolZ = point.z
        }
      }
      break
    case 'seek_cover':
      if (!actor.cover) {
        setState(actor, 'engage')
        break
      }
      moveToward(actor, actor.cover, botConfig.engageFarSpeed)
      if (Math.hypot(actor.cover.x - actor.x, actor.cover.z - actor.z) < botConfig.seekCoverArrivalDistance) {
        actor.vx = 0
        actor.vz = 0
        actor.isPeeking = false
        actor.coverPeekTimer = botConfig.coverPeekIntervalMin + Math.random() * botConfig.coverPeekIntervalRange
        setState(actor, 'hold_cover')
      }
      break
    case 'hold_cover':
      if (!target?.alive || !actor.cover) {
        actor.cover = null
        setState(actor, 'engage')
        break
      }
      if (!actor.isPeeking) {
        actor.vx = 0
        actor.vz = 0
        actor.coverPeekTimer -= dt
        if (actor.coverPeekTimer <= 0) {
          actor.isPeeking = true
          actor.stateTimer = 0
        }
      } else {
        moveToward(actor, { x: actor.cover.peekX, z: actor.cover.peekZ }, botConfig.engageStrafeSpeed)
        if (
          Math.hypot(actor.cover.peekX - actor.x, actor.cover.peekZ - actor.z) < botConfig.seekCoverArrivalDistance &&
          actor.stateTimer > botConfig.coverPeekDuration
        ) {
          actor.isPeeking = false
          actor.coverPeekTimer = botConfig.coverPeekIntervalMin + Math.random() * botConfig.coverPeekIntervalRange
          setState(actor, 'hold_cover')
        }
      }
      break
    case 'flank': {
      if (!targetPosition || actor.stateTimer > botConfig.flankDuration) {
        setState(actor, 'engage')
        break
      }
      const dx = targetPosition.x - actor.x
      const dz = targetPosition.z - actor.z
      const length = Math.hypot(dx, dz) || 1
      const side = actor.flankDir
      moveWithDirection(
        actor,
        {
          x: (-dz / length) * side + (dx / length) * botConfig.flankForwardBias,
          z: (dx / length) * side + (dz / length) * botConfig.flankForwardBias,
        },
        botConfig.flankSpeed,
      )
      break
    }
    case 'engage':
      if (!target?.alive || !targetPosition) {
        setState(actor, 'patrol')
        break
      }
      if (!actor.targetVisible) {
        actor.searchX = targetPosition.x
        actor.searchZ = targetPosition.z
        setState(actor, 'alert')
        break
      }
      const weapon = config.weapons[actor.weaponId]
      const distance = distance2D(actor, targetPosition)
      const desiredRange = clamp(
        weapon.effectiveRange * botConfig.idealRangeMultiplier,
        12,
        botConfig.engageFarDistance - 2,
      )
      const closeRange = actor.role === 'assault' ? botConfig.engageCloseDistance * 0.65 : botConfig.engageCloseDistance
      if (distance > Math.min(botConfig.engageFarDistance, desiredRange + 10)) {
        moveToward(actor, targetPosition, botConfig.engageFarSpeed)
      } else if (distance < closeRange) {
        moveWithDirection(actor, { x: actor.x - targetPosition.x, z: actor.z - targetPosition.z }, botConfig.engageCloseSpeed)
      } else {
        const sideDirection = Math.sin(actor.stateTimer * botConfig.engageStrafeFrequency) > 0 ? 1 : -1
        let moveX = -(targetPosition.z - actor.z) * sideDirection
        let moveZ = (targetPosition.x - actor.x) * sideDirection
        const rangeError = distance - desiredRange
        if (rangeError > 3) {
          moveX += (targetPosition.x - actor.x) * 0.32
          moveZ += (targetPosition.z - actor.z) * 0.32
        } else if (rangeError < -3) {
          moveX -= (targetPosition.x - actor.x) * 0.32
          moveZ -= (targetPosition.z - actor.z) * 0.32
        }
        moveWithDirection(actor, { x: moveX, z: moveZ }, botConfig.engageStrafeSpeed)
      }
      if (
        actor.magazine / weapon.magazineSize <= botConfig.tacticalReloadThreshold &&
        actor.reserveAmmo > 0 &&
        actor.suppression < 0.25 &&
        !actor.reloading &&
        distance > botConfig.engageCloseDistance * 1.4
      ) {
        startReload(actor, false)
      }
      if (actor.stateTimer > 2 && Math.random() < botConfig.seekCoverFlankChance * dt * 0.22 && !needsCover) {
        actor.flankDir = Math.random() > 0.5 ? 1 : -1
        setState(actor, 'flank')
      }
      break
  }
}

function startReload(actor, empty = actor.magazine === 0) {
  if (actor.reloading) return
  actor.reloading = true
  actor.reloadTimer = 0
  const weapon = config.weapons[actor.weaponId]
  actor.reloadDuration = empty ? weapon.emptyReloadDuration : weapon.reloadDuration
}

function updateBot(actor, dt, smokeClouds) {
  const botConfig = config.bot
  actor.aiTime += dt
  actor.stateTimer += dt
  actor.fireOpportunityTimer -= dt
  actor.weaponShotTimer -= dt
  actor.grenadeCooldown = Math.max(0, actor.grenadeCooldown - dt)
  actor.unstuckTimer = Math.max(0, actor.unstuckTimer - dt)
  actor.suppression = Math.max(0, actor.suppression - dt * botConfig.suppressionRecovery)
  if (actor.reactionTimer > 0) actor.reactionTimer = Math.max(0, actor.reactionTimer - dt)

  if (actor.health < botConfig.lowHealthThreshold && actor.itemUses > 0 && config.items[actor.itemId].kind === 'heal') {
    actor.health = Math.min(actor.maxHealth, actor.health + config.items[actor.itemId].amount)
    actor.itemUses--
    emitWorkerHealthEvent(actor, 'use-item')
  }

  if (actor.magazine === 0 && actor.reserveAmmo === 0 && !actor.reloading) {
    if (actor.itemUses > 0 && config.items[actor.itemId].kind === 'ammo') {
      actor.reserveAmmo = config.weapons[actor.weaponId].reserveAmmo
      actor.itemUses--
      events.push({ type: 'use-item', actorId: actor.id, kind: 'ammo', itemUses: actor.itemUses })
    } else if (actor.stateName !== 'resupply') {
      const supply = findResupply(actor)
      if (supply) {
        actor.resupplyStation = supply.station
        actor.resupplyKind = supply.kind
      }
      setState(actor, 'resupply')
    }
  }

  if (actor.stateName !== 'resupply') updateBotPerception(actor, dt, smokeClouds)
  updateBotMovement(actor, dt, smokeClouds)
  updateBotFire(actor, dt)

  const weapon = config.weapons[actor.weaponId]
  if (actor.magazine === 0 && actor.reserveAmmo > 0 && !actor.reloading) startReload(actor, true)
  if (actor.reloading) {
    actor.reloadTimer += dt
    if (actor.reloadTimer > actor.reloadDuration) {
      const amount = Math.min(weapon.magazineSize - actor.magazine, actor.reserveAmmo)
      actor.magazine += amount
      actor.reserveAmmo -= amount
      actor.reloading = false
      actor.reloadTimer = 0
    }
  }
  applyMovement(actor, dt)
}

function updateZombiePerception(actor, dt) {
  const enemyConfig = config.modes.zombie.enemy
  actor.targetScanTimer -= dt
  if (actor.targetScanTimer > 0) return
  actor.targetScanTimer = enemyConfig.perceptionInterval * (0.85 + Math.random() * 0.3)
  const contact = selectZombieTarget(actor)
  if (contact) {
    actor.targetId = contact.target.id
    actor.targetVisible = contact.visible
    actor.lastSeenX = contact.x
    actor.lastSeenY = contact.y
    actor.lastSeenZ = contact.z
    actor.lastSeenAt = contact.seenAt
  } else {
    actor.targetVisible = false
    const target = getTarget(actor.targetId)
    if (target && actor.aiTime - actor.lastSeenAt > enemyConfig.targetMemory) actor.targetId = null
  }
  const target = getTarget(actor.targetId)
  if (target && !target.alive) {
    actor.targetId = null
    actor.targetVisible = false
  }
}

function updateZombie(actor, dt) {
  const enemyConfig = config.modes.zombie.enemy
  actor.aiTime += dt
  actor.attackTimer -= dt
  actor.unstuckTimer = Math.max(0, actor.unstuckTimer - dt)
  updateZombiePerception(actor, dt)
  const target = getTarget(actor.targetId)
  let targetPosition
  if (!target) {
    targetPosition = { x: fortress.x, y: 0, z: fortress.z }
  } else if (actor.targetVisible) {
    targetPosition = { x: target.x, y: targetGroundY(target), z: target.z }
  } else {
    targetPosition = { x: actor.lastSeenX, y: actor.lastSeenY, z: actor.lastSeenZ }
  }
  const targetDistance = Math.hypot(targetPosition.x - actor.x, targetPosition.z - actor.z)
  let canAttack = false
  if (target && actor.targetVisible && targetDistance <= enemyConfig.attackRange) {
    canAttack = hasLineOfSight(
      { x: actor.x, y: actor.y + 1.05, z: actor.z },
      { x: targetPosition.x, y: targetPosition.y + 1.05, z: targetPosition.z },
      [],
    )
  }
  if (canAttack || (!target && targetDistance <= fortress.attackRadius)) {
    actor.vx = 0
    actor.vz = 0
    if (actor.attackTimer <= 0) {
      if (target) {
        events.push({ type: 'zombie-attack', actorId: actor.id, targetId: target.id })
      } else {
        events.push({ type: 'fortress-attack', actorId: actor.id, damage: enemyConfig.attackDamage })
      }
      actor.attackTimer = enemyConfig.attackInterval
    }
  } else {
    moveToward(actor, targetPosition, enemyConfig.speed)
  }
  actor.stateName = target ? 'engage' : 'patrol'
  applyMovement(actor, dt)
}

function createActor(data) {
  const actor = {
    ...data,
    stateName: 'patrol',
    targetId: null,
    targetVisible: false,
    aiTime: 0,
    stateTimer: 0,
    perceptionTimer: Math.random() * (data.kind === 'zombie' ? config.modes.zombie.enemy.perceptionInterval : config.bot.perceptionInterval),
    targetScanTimer: Math.random() * config.modes.zombie.enemy.perceptionInterval,
    lastSeenX: data.x,
    lastSeenY: data.y,
    lastSeenZ: data.z,
    lastSeenAt: -Infinity,
    reactionTimer: 0,
    reloadTimer: 0,
    reloadDuration: 0,
    reloading: false,
    fireOpportunityTimer: 0.25 + Math.random() * 0.8,
    weaponShotTimer: 0,
    burstShotsRemaining: 0,
    grenadeCooldown: config.grenade.aiCooldownMin + Math.random() * config.grenade.aiCooldownRange,
    suppression: 0,
    unstuckTimer: 0,
    unstuckSign: Math.random() > 0.5 ? 1 : -1,
    stuckTimer: 0,
    stuckSampleTimer: 0,
    lastX: data.x,
    lastZ: data.z,
    cover: null,
    isPeeking: false,
    coverPeekTimer: 0,
    resupplyStation: null,
    resupplyKind: null,
    nextSupplyAt: 0,
    role: 'rifleman',
    botSkill: data.skill,
    patrolX: data.x,
    patrolZ: data.z,
    searchX: data.x,
    searchZ: data.z,
    flankDir: 1,
    vx: data.vx,
    vz: data.vz,
  }
  if (actor.kind === 'soldier') {
    const weapon = config.weapons[actor.weaponId]
    if (weapon.modelId === 'shotgun' || weapon.modelId === 'thompson') {
      actor.role = 'assault'
    } else if (weapon.modelId === 'bar') {
      actor.role = 'support'
    } else if (weapon.modelId === 'garand' && actor.botSkill > 0.42) {
      actor.role = 'marksman'
    } else {
      actor.role = 'rifleman'
    }
    const point = patrolPoint(actor)
    actor.patrolX = point.x
    actor.patrolZ = point.z
  }
  return actor
}

function snapshotActor(actor) {
  return {
    id: actor.id,
    x: actor.x,
    y: actor.y,
    z: actor.z,
    vx: actor.vx,
    vz: actor.vz,
    yaw: actor.yaw,
    alive: actor.alive,
    stateName: actor.stateName,
    targetId: actor.targetId,
    targetVisible: actor.targetVisible,
    reloading: actor.reloading,
    magazine: actor.magazine,
    reserveAmmo: actor.reserveAmmo,
    grenadeCount: actor.grenadeCount,
    itemUses: actor.itemUses,
  }
}

function processTick(message) {
  simulationTime = message.now / 1000
  player = message.player
  fortress = message.fortress
  events = []
  const smokeClouds = message.smokeClouds
  for (const actor of actors.values()) {
    if (!actor.alive) continue
    if (actor.kind === 'zombie') {
      updateZombie(actor, message.dt)
    } else {
      updateBot(actor, message.dt, smokeClouds)
    }
  }
  self.postMessage({
    type: 'snapshot',
    actors: [...actors.values()].map(snapshotActor),
    events,
  })
}

function applyDamage(message) {
  const actor = actors.get(message.id)
  if (!actor || !actor.alive) return
  actor.health -= message.amount
  actor.suppression = Math.min(1, actor.suppression + message.amount / actor.maxHealth)
  const attacker = getTarget(message.attackerId)
  if (attacker?.alive && attacker.team !== actor.team) {
    actor.targetId = attacker.id
    actor.targetVisible = true
    actor.lastSeenX = attacker.x
    actor.lastSeenY = targetGroundY(attacker)
    actor.lastSeenZ = attacker.z
    actor.lastSeenAt = actor.aiTime
    if (actor.kind === 'soldier') {
      actor.reactionTimer = config.bot.reactionTime * 0.28
      actor.fireOpportunityTimer = actor.reactionTimer + 0.18
      actor.burstShotsRemaining = 0
      setState(actor, 'engage')
    }
  }
  if (actor.health <= 0) {
    actor.health = 0
    actor.alive = false
    actor.targetId = null
    actor.targetVisible = false
    actor.vx = 0
    actor.vz = 0
  }
}

function applyRespawn(data) {
  actors.set(data.id, createActor(data))
}

self.onmessage = event => {
  const message = event.data
  if (message.type === 'init') {
    modeId = message.modeId
    config = message.config
    obstacles = message.obstacles
    coverPoints = message.coverPoints
    medicalStations = message.medicalStations
    ammoStations = message.ammoStations
    groundRegions = message.groundRegions
    fortress = message.fortress
    player = message.player
    actors.clear()
    for (const actor of message.actors) actors.set(actor.id, createActor(actor))
    return
  }
  if (message.type === 'add-actor') {
    actors.set(message.actor.id, createActor(message.actor))
    return
  }
  if (message.type === 'remove-actor') {
    actors.delete(message.id)
    return
  }
  if (message.type === 'respawn-actor') {
    applyRespawn(message.actor)
    return
  }
  if (message.type === 'damage') {
    applyDamage(message)
    return
  }
  if (message.type === 'death') {
    const actor = actors.get(message.id)
    if (actor) actor.alive = false
    return
  }
  if (message.type === 'tick') processTick(message)
}
