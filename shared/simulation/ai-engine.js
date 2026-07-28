export function createAiEngine() {
  const actors = new Map()
  let config = null
  let modeId = null
  let mapSize = 0
  let obstacles = []
  let solidObstacles = []
  let coverPoints = []
  let medicalStations = []
  let ammoStations = []
  let groundRegions = []
  let fortress = null
  let players = []
  let simulationTime = 0
  let events = []
  let navigation = null
  let coverReservations = new Map()

  const MOVEMENT_DECISION_INTERVAL = 1 / 20
  const ZOMBIE_ATTACK_SCAN_INTERVAL = 1 / 20
  const GRENADE_DECISION_INTERVAL = 1 / 8
  const COVER_SEARCH_INTERVAL = 0.5

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

  function refreshSolidObstacles() {
    solidObstacles = obstacles.filter(
      obstacle =>
        obstacle.type !== 'ground' && obstacle.type !== 'crater' && obstacle.type !== 'wire'
    )
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
        testCandidate((-b - root) / (2 * a))
        testCandidate((-b + root) / (2 * a))
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

    const flatHit =
      obstacle.shape === 'box'
        ? rayBoxFlat(origin.x, origin.z, dirX, dirZ, obstacle, maxFlat)
        : rayCircleFlat(origin.x, origin.z, dirX, dirZ, obstacle.x, obstacle.z, radius, maxFlat)
    if (flatHit < 0) return -1
    const hitDistance = flatHit * invFlat
    if (hitDistance < 0 || hitDistance > maxDist) return -1
    const hitY = origin.y + direction.y * hitDistance
    return hitY >= obstacle.minY && hitY <= obstacle.maxY ? hitDistance : -1
  }

  function isSmokeObscured(origin, point, smokeClouds) {
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
      const along = clamp(toX * direction.x + toY * direction.y + toZ * direction.z, 0, distance)
      const closestX = origin.x + direction.x * along
      const closestY = origin.y + direction.y * along
      const closestZ = origin.z + direction.z * along
      if (Math.hypot(smoke.x - closestX, smoke.y - closestY, smoke.z - closestZ) < smoke.radius) {
        return true
      }
    }
    return false
  }

  function hasLineOfSight(origin, point) {
    const dx = point.x - origin.x
    const dy = point.y - origin.y
    const dz = point.z - origin.z
    const distance = Math.hypot(dx, dy, dz)
    if (distance < 1e-6) return true
    const direction = { x: dx / distance, y: dy / distance, z: dz / distance }
    for (const obstacle of solidObstacles) {
      if (rayHitObstacle(origin, direction, obstacle, distance) >= 0) return false
    }
    return true
  }

  function resolveObstacleCollision(actor, radius) {
    for (const obstacle of solidObstacles) {
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
          surfaceHeight =
            minY +
            ((obstacle.bottomRadius - distance) / (obstacle.bottomRadius - obstacle.topRadius)) *
              height
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

  function obstacleBlocksPoint(x, z, y, radius) {
    for (const obstacle of solidObstacles) {
      if (y >= obstacle.maxY && obstacle.shape !== 'frustum') continue

      if (obstacle.shape === 'frustum') {
        const dx = x - obstacle.x
        const dz = z - obstacle.z
        const distance = Math.hypot(dx, dz)
        if (distance >= obstacle.bottomRadius + radius) continue
        const height = obstacle.maxY - obstacle.minY
        if (height <= 1e-6) return true
        let surfaceHeight = obstacle.minY
        if (distance <= obstacle.topRadius) surfaceHeight = obstacle.maxY
        else if (distance <= obstacle.bottomRadius) {
          surfaceHeight =
            obstacle.minY +
            ((obstacle.bottomRadius - distance) / (obstacle.bottomRadius - obstacle.topRadius)) *
              height
        }
        if (y < surfaceHeight - 0.05) return true
        continue
      }

      if (obstacle.shape === 'circle') {
        const dx = x - obstacle.x
        const dz = z - obstacle.z
        if (dx * dx + dz * dz < (obstacle.r + radius) ** 2) return true
        continue
      }

      const dx = x - obstacle.x
      const dz = z - obstacle.z
      const localX = dx * obstacle.cos - dz * obstacle.sin
      const localZ = dx * obstacle.sin + dz * obstacle.cos
      const closestX = clamp(localX, -obstacle.hw, obstacle.hw)
      const closestZ = clamp(localZ, -obstacle.hd, obstacle.hd)
      const offsetX = localX - closestX
      const offsetZ = localZ - closestZ
      if (offsetX * offsetX + offsetZ * offsetZ < radius * radius) return true
    }
    return false
  }

  function navigationCellAt(x, z) {
    if (!navigation) return null
    const col = clamp(
      Math.floor((x - navigation.originX) / navigation.cellSize),
      0,
      navigation.columns - 1
    )
    const row = clamp(
      Math.floor((z - navigation.originZ) / navigation.cellSize),
      0,
      navigation.rows - 1
    )
    return { col, row, index: row * navigation.columns + col }
  }

  function navigationCellCenter(col, row) {
    return {
      x: navigation.originX + (col + 0.5) * navigation.cellSize,
      z: navigation.originZ + (row + 0.5) * navigation.cellSize,
    }
  }

  function findNearestWalkableCell(x, z, maxRadius = 5) {
    const base = navigationCellAt(x, z)
    if (!base) return null
    if (!navigation.blocked[base.index]) return base
    let best = null
    let bestDistance = Infinity
    for (let radius = 1; radius <= maxRadius; radius++) {
      for (let rowOffset = -radius; rowOffset <= radius; rowOffset++) {
        for (let colOffset = -radius; colOffset <= radius; colOffset++) {
          if (Math.abs(rowOffset) !== radius && Math.abs(colOffset) !== radius) continue
          const col = base.col + colOffset
          const row = base.row + rowOffset
          if (col < 0 || col >= navigation.columns || row < 0 || row >= navigation.rows) continue
          const index = row * navigation.columns + col
          if (navigation.blocked[index]) continue
          const center = navigationCellCenter(col, row)
          const distance = Math.hypot(center.x - x, center.z - z)
          if (distance < bestDistance) {
            bestDistance = distance
            best = { col, row, index }
          }
        }
      }
      if (best) return best
    }
    return null
  }

  function navigationSegmentBlocked(from, to, radius) {
    const distance = Math.hypot(to.x - from.x, to.z - from.z)
    if (distance < 1e-6) return false
    const steps = Math.ceil(distance / Math.max(0.8, navigation.cellSize * 0.35))
    for (let step = 1; step <= steps; step++) {
      const progress = step / steps
      const x = from.x + (to.x - from.x) * progress
      const z = from.z + (to.z - from.z) * progress
      if (obstacleBlocksPoint(x, z, groundHeightAt(x, z), radius)) return true
    }
    return false
  }

  function heapPush(heap, node) {
    heap.push(node)
    let i = heap.length - 1
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (heap[parent].f <= heap[i].f) break
      const temp = heap[parent]
      heap[parent] = heap[i]
      heap[i] = temp
      i = parent
    }
  }

  function heapPop(heap) {
    const top = heap[0]
    const last = heap.pop()
    if (heap.length === 0) return top
    heap[0] = last
    let i = 0
    for (;;) {
      let best = i
      const left = i * 2 + 1
      const right = left + 1
      if (left < heap.length && heap[left].f < heap[best].f) best = left
      if (right < heap.length && heap[right].f < heap[best].f) best = right
      if (best === i) break
      const temp = heap[best]
      heap[best] = heap[i]
      heap[i] = temp
      i = best
    }
    return top
  }

  function findNavigationPath(actor, target) {
    if (!navigation) return null
    const start = findNearestWalkableCell(actor.x, actor.z)
    const goal = findNearestWalkableCell(target.x, target.z)
    if (!start || !goal || start.index === goal.index) return []

    const neighbors = [
      [-1, -1, 1.414],
      [0, -1, 1],
      [1, -1, 1.414],
      [-1, 0, 1],
      [1, 0, 1],
      [-1, 1, 1.414],
      [0, 1, 1],
      [1, 1, 1.414],
    ]
    const open = []
    heapPush(open, { index: start.index, g: 0, f: 0 })
    const scores = new Map([[start.index, 0]])
    const parents = new Map()
    const closed = new Uint8Array(navigation.columns * navigation.rows)
    let expanded = 0

    while (open.length > 0 && expanded < config.bot.navigationMaxSearchNodes) {
      const currentEntry = heapPop(open)
      if (closed[currentEntry.index]) continue
      if (currentEntry.g > (scores.get(currentEntry.index) ?? Infinity) + 1e-6) continue
      closed[currentEntry.index] = 1
      expanded++
      if (currentEntry.index === goal.index) break

      const currentCol = currentEntry.index % navigation.columns
      const currentRow = Math.floor(currentEntry.index / navigation.columns)
      for (const [colOffset, rowOffset, cost] of neighbors) {
        const col = currentCol + colOffset
        const row = currentRow + rowOffset
        if (col < 0 || col >= navigation.columns || row < 0 || row >= navigation.rows) continue
        const index = row * navigation.columns + col
        if (navigation.blocked[index] || closed[index]) continue
        if (colOffset && rowOffset) {
          const sideA = currentRow * navigation.columns + currentCol + colOffset
          const sideB = (currentRow + rowOffset) * navigation.columns + currentCol
          if (navigation.blocked[sideA] || navigation.blocked[sideB]) continue
        }
        const nextScore = currentEntry.g + cost
        if (nextScore >= (scores.get(index) ?? Infinity)) continue
        scores.set(index, nextScore)
        parents.set(index, currentEntry.index)
        const distanceToGoal = Math.hypot(col - goal.col, row - goal.row)
        heapPush(open, { index, g: nextScore, f: nextScore + distanceToGoal })
      }
    }

    if (!parents.has(goal.index) && start.index !== goal.index) return null
    const cells = []
    let current = goal.index
    while (current !== start.index) {
      const col = current % navigation.columns
      const row = Math.floor(current / navigation.columns)
      cells.push(navigationCellCenter(col, row))
      current = parents.get(current)
      if (current == null) return null
    }
    cells.reverse()

    const path = []
    let anchor = { x: actor.x, z: actor.z }
    let nextIndex = 0
    while (nextIndex < cells.length) {
      let furthest = nextIndex
      for (let i = nextIndex; i < cells.length; i++) {
        if (navigationSegmentBlocked(anchor, cells[i], actor.radius)) break
        furthest = i
      }
      path.push(cells[furthest])
      anchor = cells[furthest]
      nextIndex = furthest + 1
    }
    return path
  }

  function buildNavigation() {
    const cellSize = config.bot.navigationCellSize
    const half = mapSize / 2 - 2
    const columns = Math.ceil((half * 2) / cellSize)
    const rows = columns
    const radius = Math.max(config.bot.radius, config.modes.zombie.enemy.radius) + 0.12
    const blocked = new Uint8Array(columns * rows)
    navigation = {
      cellSize,
      columns,
      rows,
      originX: -half,
      originZ: -half,
      blocked,
    }
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        const center = navigationCellCenter(col, row)
        blocked[row * columns + col] = obstacleBlocksPoint(
          center.x,
          center.z,
          groundHeightAt(center.x, center.z),
          radius
        )
          ? 1
          : 0
      }
    }
  }

  function getNavigationTarget(actor, target) {
    if (!navigation) return target
    const targetMoved =
      Math.hypot(target.x - actor.navigationTargetX, target.z - actor.navigationTargetZ) >
      navigation.cellSize * 1.2
    if (targetMoved || actor.navigationCheckTimer <= 0) {
      actor.navigationTargetX = target.x
      actor.navigationTargetZ = target.z
      actor.navigationCheckTimer = config.bot.navigationDirectCheckInterval
      actor.navigationDirectBlocked = navigationSegmentBlocked(
        { x: actor.x, z: actor.z },
        target,
        actor.radius
      )
    }
    if (!actor.navigationDirectBlocked) {
      actor.navigationPath = []
      actor.navigationPathIndex = 0
      return target
    }

    if (targetMoved || actor.navigationTimer <= 0) {
      actor.navigationPath = findNavigationPath(actor, target) ?? []
      actor.navigationPathIndex = 0
      actor.navigationTimer = config.bot.navigationRepathInterval
    }

    while (
      actor.navigationPathIndex < actor.navigationPath.length &&
      Math.hypot(
        actor.navigationPath[actor.navigationPathIndex].x - actor.x,
        actor.navigationPath[actor.navigationPathIndex].z - actor.z
      ) <= config.bot.navigationWaypointArrivalDistance
    ) {
      actor.navigationPathIndex++
    }
    return actor.navigationPath[actor.navigationPathIndex] ?? target
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
    return players.find(item => item.id === id) ?? actors.get(id) ?? null
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
    const aimPoint = targetPoint(target, botConfig.targetHeight)
    // 烟雾只降低可视距离，不再完全遮挡
    if (
      isSmokeObscured(origin, aimPoint, smokeClouds) &&
      distance > botConfig.viewDistance * config.grenades.smoke.viewFactor
    ) {
      return false
    }
    return hasLineOfSight(origin, aimPoint)
  }

  function targetScore(actor, target, distance) {
    const botConfig = config.bot
    const weapon = config.weapons[actor.weaponId]
    const idealRange = Math.max(8, weapon.effectiveRange * botConfig.idealRangeMultiplier)
    let score = (botConfig.viewDistance - distance) * 0.16
    score -= Math.abs(distance - idealRange) * 0.14
    if (target.targetId === actor.id) score += 28
    if (target.kind === 'player') score += 12
    if (target.kind === 'zombie' && fortress) {
      const fortressDistance = Math.hypot(target.x - fortress.x, target.z - fortress.z)
      score += Math.max(0, 40 - fortressDistance) * 0.42
    }
    if (target.health < target.maxHealth * 0.35) score += 8
    if (target.id === actor.targetId) score += 12
    return score
  }

  function selectBotTarget(actor, smokeClouds) {
    const botConfig = config.bot
    const viewDistance = botConfig.viewDistance
    const candidates = []
    for (const target of actors.values()) {
      if (!target.alive || target.team === actor.team) continue
      const distance = distance2D(actor, target)
      if (distance > viewDistance) continue
      candidates.push({ target, distance, score: targetScore(actor, target, distance) })
    }
    for (const candidate of players) {
      if (!candidate.alive || candidate.team === actor.team) continue
      const distance = distance2D(actor, candidate)
      if (distance <= viewDistance)
        candidates.push({ target: candidate, distance, score: targetScore(actor, candidate, distance) })
    }
    candidates.sort((a, b) => b.score - a.score)

    const limited = candidates.slice(0, botConfig.maxPerceptionTargets)
    const playerCandidate = candidates.find(candidate => candidate.target.kind === 'player')
    if (playerCandidate && !limited.includes(playerCandidate)) limited.push(playerCandidate)

    let best = null
    let bestScore = -Infinity
    for (const candidate of limited) {
      if (!botCanSee(actor, candidate.target, smokeClouds)) continue
      const score = candidate.score + 40
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

    for (const candidate of players) {
      const shot = candidate.lastShot
      if (!candidate.alive || candidate.team === actor.team || !shot) continue
      const age = (simulationTime * 1000 - shot.at) / 1000
      const distance = Math.hypot(shot.x - actor.x, shot.z - actor.z)
      if (age <= botConfig.playerShotMemory && distance <= botConfig.playerShotHearingDistance) {
        return {
          target: candidate,
          visible: false,
          x: shot.x,
          y: actor.y,
          z: shot.z,
          seenAt: actor.aiTime,
        }
      }
    }

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
    const searchRadius = enemyConfig.targetSearchRadius
    let nearest = null
    let nearestDistance = Infinity
    for (const target of actors.values()) {
      if (!target.alive || target.team === actor.team) continue
      const dx = target.x - actor.x
      const dz = target.z - actor.z
      const distanceSq = dx * dx + dz * dz
      if (distanceSq > searchRadiusSq) continue
      let score = Math.sqrt(distanceSq)
      if (target.kind === 'player') score -= 1.8
      if (score < nearestDistance) {
        nearest = target
        nearestDistance = score
      }
    }
    for (const candidate of players) {
      if (!candidate.alive || candidate.team === actor.team) continue
      const dx = candidate.x - actor.x
      const dz = candidate.z - actor.z
      const distanceSq = dx * dx + dz * dz
      if (distanceSq <= searchRadiusSq) {
        const score = Math.sqrt(distanceSq) - 1.8
        if (score < nearestDistance) {
          nearest = candidate
          nearestDistance = score
        }
      }
    }

    const current = getTarget(actor.targetId)
    if (current?.alive) {
      const currentDistance = distance2D(actor, current)
      if (
        currentDistance <= searchRadius &&
        (!nearest || currentDistance <= nearestDistance + enemyConfig.targetSwitchBias)
      ) {
        return {
          target: current,
          visible: true,
          x: current.x,
          y: targetGroundY(current),
          z: current.z,
          seenAt: actor.aiTime,
        }
      }
    }

    for (const candidate of players) {
      const shot = candidate.lastShot
      if (!candidate.alive || !shot) continue
      const age = (simulationTime * 1000 - shot.at) / 1000
      const distance = Math.hypot(shot.x - actor.x, shot.z - actor.z)
      if (
        age <= enemyConfig.playerShotMemory &&
        distance <= enemyConfig.playerShotHearingDistance
      ) {
        return {
          target: candidate,
          visible: false,
          x: shot.x,
          y: actor.y,
          z: shot.z,
          seenAt: actor.aiTime,
        }
      }
    }

    return nearest
      ? {
          target: nearest,
          visible: true,
          x: nearest.x,
          y: targetGroundY(nearest),
          z: nearest.z,
          seenAt: actor.aiTime,
        }
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
    const ray = { x: direction.x, y: 0, z: direction.z }
    for (const obstacle of solidObstacles) {
      if (obstacle.shape === 'frustum') continue
      if (rayHitObstacle(origin, ray, obstacle, lookAhead) >= 0) return true
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
    for (const candidate of players) {
      if (actor.kind !== 'soldier' || !candidate.alive || candidate.team !== actor.team) continue
      const dx = actor.x - candidate.x
      const dz = actor.z - candidate.z
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
      direction.z + separationZ * actorConfigData.separationWeight
    )
  }

  function chooseMovementDirection(actor, desired) {
    const desiredDirection = normalizeDirection(desired.x, desired.z)
    if (desiredDirection.x === 0 && desiredDirection.z === 0) {
      actor.movementDirection = desiredDirection
      return desiredDirection
    }
    if (actor.aiTime < actor.nextMovementDecisionAt) return actor.movementDirection

    let movement
    if (actor.unstuckTimer <= 0 && !directionBlocked(actor, desiredDirection)) {
      movement = addSeparation(actor, desiredDirection)
    } else {
      const actorConfigData = actorConfig(actor)
      const baseAngle = Math.atan2(desiredDirection.z, desiredDirection.x)
      const probeAngle = actorConfigData.movementProbeAngle
      const unstuckOffset = actor.unstuckTimer > 0 ? actor.unstuckSign * 1.05 : 0
      const angles =
        actor.unstuckTimer > 0
          ? [
              unstuckOffset,
              probeAngle + unstuckOffset,
              -probeAngle + unstuckOffset,
              Math.PI * 0.75 + unstuckOffset,
            ]
          : [probeAngle, -probeAngle, probeAngle * 2, -probeAngle * 2]
      let best = desiredDirection
      let bestScore = -Infinity
      for (const offset of angles) {
        const angle = baseAngle + offset
        const direction = { x: Math.cos(angle), z: Math.sin(angle) }
        const blocked = directionBlocked(actor, direction)
        let score = (direction.x * desiredDirection.x + direction.z * desiredDirection.z) * 5
        score += blocked ? -8 : 2
        if (score > bestScore) {
          bestScore = score
          best = direction
        }
      }
      movement = addSeparation(actor, best)
    }
    actor.movementDirection = movement
    actor.nextMovementDecisionAt = actor.aiTime + MOVEMENT_DECISION_INTERVAL
    return movement
  }

  function moveWithDirection(actor, direction, speed) {
    const movement = chooseMovementDirection(actor, direction)
    actor.vx = movement.x * speed
    actor.vz = movement.z * speed
  }

  function moveToward(actor, target, speed) {
    const navigationTarget = getNavigationTarget(actor, target)
    const dx = navigationTarget.x - actor.x
    const dz = navigationTarget.z - actor.z
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
      actor.unstuckTimer = 1.05
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
    const half = mapSize / 2 - 2
    actor.x = clamp(actor.x, -half, half)
    actor.z = clamp(actor.z, -half, half)
    actor.y = groundHeightAt(actor.x, actor.z)
    resolveObstacleCollision(actor, actor.radius)
    updateStuck(actor, dt)

    let targetX = actor.x - Math.sin(actor.yaw)
    let targetZ = actor.z - Math.cos(actor.yaw)
    const target = getTarget(actor.targetId)
    const targetPosition =
      actor.targetVisible && target ? target : { x: actor.lastSeenX, z: actor.lastSeenZ }
    const combatState =
      actor.stateName === 'engage' ||
      actor.stateName === 'seek_cover' ||
      actor.stateName === 'hold_cover'
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
    const half = mapSize * config.bot.patrolAreaRatio
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
    const needsEquipment = actor.grenadeCount < grenade.count || actor.itemUses < item.uses
    if (totalAmmo / maxAmmo <= botConfig.resupplyAmmoRatio || needsEquipment) {
      const station = nearestStation(actor, ammoStations)
      if (station) return { station, kind: 'ammo' }
    }
    return null
  }

  function findCover(actor, targetPosition) {
    const botConfig = config.bot
    const targetOrigin = {
      x: targetPosition.x,
      y: targetPosition.y + botConfig.viewOriginHeight,
      z: targetPosition.z,
    }
    const candidates = []
    for (const cover of coverPoints) {
      if (cover.type === 'fortress' && actor.y < 1.5) continue
      const owner = coverReservations.get(cover.id)
      if (owner && owner !== actor.id) continue
      const distanceToCover = Math.hypot(cover.x - actor.x, cover.z - actor.z)
      if (distanceToCover > botConfig.coverSearchDistance) continue
      candidates.push({ cover, distanceToCover })
    }
    candidates.sort((a, b) => a.distanceToCover - b.distanceToCover)

    let best = null
    let bestScore = -Infinity
    const actorToEnemy = Math.hypot(targetPosition.x - actor.x, targetPosition.z - actor.z)
    const limited = candidates.slice(0, botConfig.coverMaxCandidates)
    for (const candidate of limited) {
      const cover = candidate.cover
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
      const protectedPosition = !hasLineOfSight(targetOrigin, {
        x: standX,
        y: standY + botConfig.targetHeight,
        z: standZ,
      })
      if (!protectedPosition) continue

      const awayAngle = Math.atan2(awayZNormalized, awayXNormalized)
      const peekDistance = Math.max(cover.r + actor.radius + botConfig.coverPeekOffset, 1.6)
      const side = actor.x * awayZNormalized - actor.z * awayXNormalized >= 0 ? 1 : -1
      const peekAngle = awayAngle + side * 0.82
      const peekX = cover.x + Math.cos(peekAngle) * peekDistance
      const peekZ = cover.z + Math.sin(peekAngle) * peekDistance
      const coverToEnemy = Math.hypot(targetPosition.x - cover.x, targetPosition.z - cover.z)
      let score = 34 + (actorToEnemy - coverToEnemy) * botConfig.coverEnemyWeight
      score +=
        (botConfig.coverDistanceBias - candidate.distanceToCover) * botConfig.coverDistanceWeight
      if (cover.type === 'sandbag' || cover.type === 'barricade') score += 5
      if (score > bestScore) {
        bestScore = score
        best = {
          coverId: cover.id,
          x: standX,
          y: standY,
          z: standZ,
          peekX,
          peekZ,
        }
      }
    }
    return best
  }

  function nearbyHostiles(actor, radius) {
    const radiusSq = radius * radius
    let count = 0
    for (const candidate of actors.values()) {
      if (!candidate.alive || candidate.team === actor.team) continue
      const dx = candidate.x - actor.x
      const dz = candidate.z - actor.z
      if (dx * dx + dz * dz <= radiusSq) count++
    }
    for (const candidate of players) {
      if (!candidate.alive || candidate.team === actor.team) continue
      const dx = candidate.x - actor.x
      const dz = candidate.z - actor.z
      if (dx * dx + dz * dz <= radiusSq) count++
    }
    return count
  }

  function refreshPressure(actor, dt) {
    actor.pressureTimer -= dt
    if (actor.pressureTimer > 0) return actor.underPressure
    actor.pressureTimer = config.bot.pressureRefreshInterval
    const hostiles = nearbyHostiles(actor, config.bot.pressureRadius)
    actor.underPressure =
      hostiles >= config.bot.pressureHostileCount || (hostiles >= 1 && actor.suppression > 0.5)
    return actor.underPressure
  }

  function emitHealthEvent(actor, type, payload = {}) {
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
      if (
        actor.reactionTimer <= 0 &&
        actor.stateName !== 'hold_cover' &&
        actor.stateName !== 'seek_cover'
      ) {
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

  function getFirePause(actor) {
    if (modeId === 'zombie') return 0
    const botConfig = config.bot
    const weapon = config.weapons[actor.weaponId]
    const careful = clamp(weapon.effectiveRange / 100, 0.12, 0.4)
    const cadence = weapon.automatic ? weapon.fireDelay * 1.15 : weapon.fireDelay * 2.1
    return Math.max(
      cadence,
      botConfig.engageFireBaseDelay * (weapon.automatic ? 0.55 : 1) +
        (1 - actor.botSkill) * botConfig.engageFireSkillDelay +
        careful * 0.35 +
        Math.random() * 0.4
    )
  }

  function updateBotFire(actor) {
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
    const rangeRatio = distance / Math.max(1, weapon.effectiveRange)
    if (weapon.automatic) {
      const baseBurst = 2 + actor.botSkill * 3
      const rangeBurst = rangeRatio < 0.4 ? 1.4 : rangeRatio > 0.85 ? 0.7 : 1
      actor.burstShotsRemaining = Math.max(2, Math.round(baseBurst * rangeBurst))
    } else {
      actor.burstShotsRemaining = 1
    }
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

  function predictedTargetPoint(target, leadTime) {
    return {
      x: target.x + (target.vx || 0) * leadTime,
      y: targetGroundY(target) + config.bot.targetHeight,
      z: target.z + (target.vz || 0) * leadTime,
    }
  }

  function friendlyNearPoint(actor, point, radius) {
    if (Math.hypot(actor.x - point.x, actor.z - point.z) < radius) return true
    for (const ally of actors.values()) {
      if (!ally.alive || ally === actor || ally.team !== actor.team) continue
      if (Math.hypot(ally.x - point.x, ally.z - point.z) < radius) return true
    }
    for (const candidate of players)
      if (candidate.alive && candidate.team === actor.team && Math.hypot(candidate.x - point.x, candidate.z - point.z) < radius) return true
    return false
  }

  function solveThrowDirection(origin, target, grenade) {
    const dx = target.x - origin.x
    const dz = target.z - origin.z
    const horizontalDistance = Math.hypot(dx, dz)
    if (horizontalDistance < 1e-6) return null
    const speed = grenade.throwSpeed
    const gravity = config.grenade.gravity
    const liftVelocity = speed * config.grenade.throwLift
    const maxTime = Math.min(grenade.fuse * 0.9, 2.5)
    let best = null
    for (let time = 0.24; time <= maxTime; time += 0.04) {
      const horizontalSpeed = horizontalDistance / time
      const verticalVelocity = (target.y - origin.y + 0.5 * gravity * time * time) / time
      const directionY = (verticalVelocity - liftVelocity) / speed
      if (directionY <= -0.45 || directionY >= 0.88) continue
      const expectedHorizontalSpeed = speed * Math.sqrt(1 - directionY * directionY)
      const error = Math.abs(expectedHorizontalSpeed - horizontalSpeed)
      if (!best || error < best.error) best = { directionY, error }
    }
    if (!best) {
      const length = Math.hypot(dx, target.y - origin.y, dz)
      return {
        x: dx / length,
        y: (target.y - origin.y) / length,
        z: dz / length,
      }
    }
    const horizontalScale = Math.sqrt(1 - best.directionY * best.directionY)
    return {
      x: (dx / horizontalDistance) * horizontalScale,
      y: best.directionY,
      z: (dz / horizontalDistance) * horizontalScale,
    }
  }

  function tryThrowGrenade(actor, dt, smokeClouds, needsCover) {
    if (actor.grenadeCount <= 0 || actor.grenadeCooldown > 0 || actor.reloading) return
    const target = getTarget(actor.targetId)
    if (!target?.alive || !actor.targetVisible) return
    const grenade = config.grenades[actor.grenadeId]
    const distance = distance2D(actor, target)
    let targetPoint = null
    let throwChance = 0

    if (grenade.kind === 'smoke') {
      if (
        !needsCover &&
        actor.health > config.grenade.aiSmokeHealthThreshold &&
        actor.suppression < config.grenade.aiSmokeSuppressionThreshold
      )
        return
      if (
        distance < config.grenade.aiSmokeMinDistance ||
        distance > config.grenade.aiSmokeMaxDistance
      )
        return
      const predicted = predictedTargetPoint(target, config.grenade.aiPredictionTime)
      if (isSmokeObscured({ x: actor.x, y: actor.y + 1.3, z: actor.z }, predicted, smokeClouds))
        return
      const smokeDistance = clamp(distance * 0.48, 6, config.grenade.aiSmokeMaxDistance * 0.72)
      const dx = predicted.x - actor.x
      const dz = predicted.z - actor.z
      targetPoint = {
        x: actor.x + (dx / distance) * smokeDistance,
        y: actor.y + 0.45,
        z: actor.z + (dz / distance) * smokeDistance,
      }
      for (const smoke of smokeClouds) {
        if (smoke.expiresAt <= simulationTime * 1000) continue
        if (Math.hypot(smoke.x - targetPoint.x, smoke.z - targetPoint.z) < grenade.radius * 0.8) {
          return
        }
      }
      throwChance = config.grenade.aiSmokeChancePerSecond
    } else {
      if (distance < config.grenade.aiMinDistance || distance > config.grenade.aiMaxDistance) return
      const leadTime = clamp(distance / grenade.throwSpeed, 0.12, config.grenade.aiPredictionTime)
      targetPoint = predictedTargetPoint(target, leadTime)
      if (friendlyNearPoint(actor, targetPoint, config.grenade.aiFriendlyFireRadius)) return
      const closeEnough = distance <= config.grenade.aiFragSingleTargetMaxDistance
      const underFire = actor.suppression > config.grenade.aiThreatPressureThreshold
      if (!closeEnough && !underFire && nearbyHostiles(actor, grenade.radius * 1.5) < 2) return
      throwChance = config.grenade.aiThrowChancePerSecond * (closeEnough || underFire ? 1 : 0.55)
    }

    if (!targetPoint || Math.random() >= 1 - Math.exp(-throwChance * dt)) return
    const origin = { x: actor.x, y: actor.y + 1.3, z: actor.z }
    const direction = solveThrowDirection(origin, targetPoint, grenade)
    if (!direction) return
    actor.grenadeCount--
    events.push({ type: 'throw-grenade', actorId: actor.id, direction })
    actor.grenadeCooldown =
      config.grenade.aiCooldownMin + Math.random() * config.grenade.aiCooldownRange
  }

  function updateBotResupply(actor) {
    const station = actor.resupplyStation
    if (!station) {
      setState(actor, 'patrol')
      actor.resupplyKind = null
      return
    }
    moveToward(actor, station, config.bot.engageFarSpeed)
    if (Math.hypot(station.x - actor.x, station.z - actor.z) >= config.supply.aiArrivalDistance)
      return
    if (actor.resupplyKind === 'medical') {
      actor.health = actor.maxHealth
      emitHealthEvent(actor, 'resupply', { kind: 'medical' })
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

    const underPressure = refreshPressure(actor, dt)
    const inCoverState = actor.stateName === 'seek_cover' || actor.stateName === 'hold_cover'
    const enterCover =
      actor.health < botConfig.lowHealthThreshold ||
      actor.suppression > botConfig.coverEnterSuppression ||
      underPressure
    const stayCover =
      actor.health < botConfig.lowHealthThreshold + botConfig.coverExitHealthBias ||
      actor.suppression > botConfig.coverExitSuppression ||
      underPressure
    const needsCover = inCoverState ? stayCover : enterCover
    actor.grenadeDecisionTimer -= dt
    actor.grenadeDecisionElapsed += dt
    if (actor.grenadeDecisionTimer <= 0) {
      tryThrowGrenade(actor, actor.grenadeDecisionElapsed, smokeClouds, needsCover)
      actor.grenadeDecisionTimer = GRENADE_DECISION_INTERVAL
      actor.grenadeDecisionElapsed = 0
    }

    actor.coverSearchTimer -= dt
    if (
      targetPosition &&
      needsCover &&
      actor.coverSearchTimer <= 0 &&
      (!actor.cover || actor.stateTimer > botConfig.coverRefreshInterval)
    ) {
      actor.coverSearchTimer = COVER_SEARCH_INTERVAL
      const cover = findCover(actor, targetPosition)
      if (cover) {
        coverReservations.set(cover.coverId, actor.id)
        actor.cover = cover
        actor.coverPeekTimer =
          botConfig.coverPeekIntervalMin + Math.random() * botConfig.coverPeekIntervalRange
        actor.isPeeking = false
        setState(actor, 'seek_cover')
      }
    } else if (inCoverState && !needsCover && actor.stateTimer > 1.2) {
      actor.cover = null
      actor.isPeeking = false
      setState(actor, target?.alive && actor.targetVisible ? 'engage' : 'patrol')
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
        if (
          Math.hypot(actor.patrolX - actor.x, actor.patrolZ - actor.z) <
          botConfig.patrolArrivalDistance
        ) {
          const point = patrolPoint(actor)
          actor.patrolX = point.x
          actor.patrolZ = point.z
        }
        moveToward(actor, { x: actor.patrolX, z: actor.patrolZ }, botConfig.patrolSpeed)
        break
      case 'alert':
        moveToward(actor, { x: actor.searchX, z: actor.searchZ }, botConfig.alertSpeed)
        if (
          Math.hypot(actor.searchX - actor.x, actor.searchZ - actor.z) <
          botConfig.alertArrivalDistance
        ) {
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
        if (
          Math.hypot(actor.cover.x - actor.x, actor.cover.z - actor.z) <
          botConfig.seekCoverArrivalDistance
        ) {
          actor.vx = 0
          actor.vz = 0
          actor.isPeeking = false
          actor.coverPeekTimer =
            botConfig.coverPeekIntervalMin + Math.random() * botConfig.coverPeekIntervalRange
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
          moveToward(
            actor,
            { x: actor.cover.peekX, z: actor.cover.peekZ },
            botConfig.engageStrafeSpeed
          )
          if (
            Math.hypot(actor.cover.peekX - actor.x, actor.cover.peekZ - actor.z) <
              botConfig.seekCoverArrivalDistance &&
            actor.stateTimer > botConfig.coverPeekDuration
          ) {
            actor.isPeeking = false
            actor.coverPeekTimer =
              botConfig.coverPeekIntervalMin + Math.random() * botConfig.coverPeekIntervalRange
            setState(actor, 'hold_cover')
          }
        }
        break
      case 'engage': {
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
          botConfig.engageFarDistance - 2
        )
        const closeRange = clamp(
          weapon.effectiveRange * 0.22,
          botConfig.engageCloseDistance * 0.55,
          botConfig.engageCloseDistance
        )
        if (distance > Math.min(botConfig.engageFarDistance, desiredRange + 10)) {
          moveToward(actor, targetPosition, botConfig.engageFarSpeed)
        } else if (distance < closeRange) {
          moveWithDirection(
            actor,
            { x: actor.x - targetPosition.x, z: actor.z - targetPosition.z },
            botConfig.engageCloseSpeed
          )
        } else {
          const sideDirection =
            Math.sin(actor.stateTimer * botConfig.engageStrafeFrequency) > 0 ? 1 : -1
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
          distance > closeRange * 1.35
        ) {
          startReload(actor, false)
        }
        break
      }
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
    actor.navigationTimer = Math.max(0, actor.navigationTimer - dt)
    actor.navigationCheckTimer = Math.max(0, actor.navigationCheckTimer - dt)
    actor.unstuckTimer = Math.max(0, actor.unstuckTimer - dt)
    actor.suppression = Math.max(0, actor.suppression - dt * botConfig.suppressionRecovery)
    if (actor.reactionTimer > 0) actor.reactionTimer = Math.max(0, actor.reactionTimer - dt)

    if (
      actor.health < botConfig.lowHealthThreshold &&
      actor.itemUses > 0 &&
      config.items[actor.itemId].kind === 'heal'
    ) {
      actor.health = Math.min(actor.maxHealth, actor.health + config.items[actor.itemId].amount)
      actor.itemUses--
      emitHealthEvent(actor, 'use-item')
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
    updateBotFire(actor)

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
      if (target && actor.aiTime - actor.lastSeenAt > enemyConfig.targetMemory)
        actor.targetId = null
    }
    const target = getTarget(actor.targetId)
    if (target && !target.alive) {
      actor.targetId = null
      actor.targetVisible = false
    }
  }

  function findZombieAttackTarget(actor) {
    const enemyConfig = config.modes.zombie.enemy
    let nearest = null
    let nearestDistance = Infinity
    const consider = candidate => {
      const distance = distance2D(actor, candidate)
      if (distance > enemyConfig.attackRange || distance >= nearestDistance) return
      const visible = hasLineOfSight(
        { x: actor.x, y: actor.y + 1.05, z: actor.z },
        {
          x: candidate.x,
          y: targetGroundY(candidate) + 1.05,
          z: candidate.z,
        }
      )
      if (!visible) return
      nearest = candidate
      nearestDistance = distance
    }
    for (const candidate of actors.values()) {
      if (!candidate.alive || candidate.team === actor.team) continue
      consider(candidate)
    }
    for (const candidate of players)
      if (candidate.alive && candidate.team !== actor.team) consider(candidate)
    return nearest
  }

  function getZombieSiegePoint(actor) {
    const radius = Math.max(2, fortress.attackRadius - actor.radius * 1.8)
    return {
      x: fortress.x + Math.cos(actor.siegeAngle) * radius,
      y: groundHeightAt(
        fortress.x + Math.cos(actor.siegeAngle) * radius,
        fortress.z + Math.sin(actor.siegeAngle) * radius
      ),
      z: fortress.z + Math.sin(actor.siegeAngle) * radius,
    }
  }

  function refreshZombieAttackTarget(actor, dt) {
    actor.attackScanTimer -= dt
    const cached = getTarget(actor.attackTargetId)
    if (actor.attackScanTimer > 0 && cached?.alive) return cached
    actor.attackScanTimer = ZOMBIE_ATTACK_SCAN_INTERVAL
    const target = findZombieAttackTarget(actor)
    actor.attackTargetId = target?.id ?? null
    return target
  }

  function updateZombie(actor, dt) {
    const enemyConfig = config.modes.zombie.enemy
    actor.aiTime += dt
    actor.attackTimer -= dt
    actor.navigationTimer = Math.max(0, actor.navigationTimer - dt)
    actor.navigationCheckTimer = Math.max(0, actor.navigationCheckTimer - dt)
    actor.unstuckTimer = Math.max(0, actor.unstuckTimer - dt)
    updateZombiePerception(actor, dt)
    const immediateTarget = refreshZombieAttackTarget(actor, dt)
    if (immediateTarget) {
      actor.targetId = immediateTarget.id
      actor.targetVisible = true
      actor.lastSeenX = immediateTarget.x
      actor.lastSeenY = targetGroundY(immediateTarget)
      actor.lastSeenZ = immediateTarget.z
      actor.lastSeenAt = actor.aiTime
    }
    const target = immediateTarget || getTarget(actor.targetId)
    let targetPosition
    if (!target) {
      targetPosition = getZombieSiegePoint(actor)
    } else if (actor.targetVisible) {
      targetPosition = { x: target.x, y: targetGroundY(target), z: target.z }
    } else {
      targetPosition = { x: actor.lastSeenX, y: actor.lastSeenY, z: actor.lastSeenZ }
    }
    const targetDistance = Math.hypot(targetPosition.x - actor.x, targetPosition.z - actor.z)
    const fortressDistance = distance2D(actor, fortress)
    const canAttack = immediateTarget && targetDistance <= enemyConfig.attackRange
    if (canAttack || (!target && fortressDistance <= fortress.attackRadius)) {
      actor.vx = 0
      actor.vz = 0
      if (actor.attackTimer <= 0) {
        if (target) {
          events.push({ type: 'zombie-attack', actorId: actor.id, targetId: target.id })
        } else {
          events.push({
            type: 'fortress-attack',
            actorId: actor.id,
            damage: enemyConfig.attackDamage,
          })
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
      perceptionTimer:
        Math.random() *
        (data.kind === 'zombie'
          ? config.modes.zombie.enemy.perceptionInterval
          : config.bot.perceptionInterval),
      targetScanTimer: Math.random() * config.modes.zombie.enemy.perceptionInterval,
      attackScanTimer: Math.random() * ZOMBIE_ATTACK_SCAN_INTERVAL,
      attackTargetId: null,
      attackTimer: 0,
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
      grenadeCooldown:
        config.grenade.aiCooldownMin + Math.random() * config.grenade.aiCooldownRange,
      grenadeDecisionTimer: Math.random() * GRENADE_DECISION_INTERVAL,
      grenadeDecisionElapsed: 0,
      suppression: 0,
      navigationPath: [],
      navigationPathIndex: 0,
      navigationTargetX: data.x,
      navigationTargetZ: data.z,
      navigationTimer: 0,
      navigationCheckTimer: 0,
      navigationDirectBlocked: false,
      movementDirection: { x: 0, z: 0 },
      nextMovementDecisionAt: 0,
      unstuckTimer: 0,
      unstuckSign: Math.random() > 0.5 ? 1 : -1,
      stuckTimer: 0,
      stuckSampleTimer: 0,
      lastX: data.x,
      lastZ: data.z,
      cover: null,
      coverSearchTimer: 0,
      isPeeking: false,
      coverPeekTimer: 0,
      resupplyStation: null,
      resupplyKind: null,
      nextSupplyAt: 0,
      pressureTimer: Math.random() * config.bot.pressureRefreshInterval,
      underPressure: false,
      botSkill: data.skill,
      patrolX: data.x,
      patrolZ: data.z,
      searchX: data.x,
      searchZ: data.z,
      siegeAngle: Math.random() * Math.PI * 2,
      vx: data.vx,
      vz: data.vz,
    }
    if (actor.kind === 'soldier') {
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
    players = (message.players ?? [message.player]).filter(Boolean)
    fortress = message.fortress
    events = []
    const smokeClouds = message.smokeClouds
    coverReservations.clear()
    for (const actor of actors.values()) {
      const coverId = actor.cover?.coverId
      if (!actor.alive || coverId == null || coverReservations.has(coverId)) continue
      coverReservations.set(coverId, actor.id)
    }
    const snapshots = []
    for (const actor of actors.values()) {
      if (!actor.alive) continue
      if (actor.kind === 'zombie') {
        updateZombie(actor, message.dt)
      } else {
        updateBot(actor, message.dt, smokeClouds)
      }
      snapshots.push(snapshotActor(actor))
    }
    return {
      type: 'snapshot',
      actors: snapshots,
      events,
    }
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

  function init(message) {
    modeId = message.modeId
    config = message.config
    mapSize = message.mapSize
    obstacles = message.obstacles
    coverPoints = message.coverPoints
    medicalStations = message.medicalStations
    ammoStations = message.ammoStations
    groundRegions = message.groundRegions
    fortress = message.fortress
    players = (message.players ?? [message.player]).filter(Boolean)
    coverReservations = new Map()
    refreshSolidObstacles()
    buildNavigation()
    actors.clear()
    for (const actor of message.actors) actors.set(actor.id, createActor(actor))
  }

  function addActor(actor) {
    actors.set(actor.id, createActor(actor))
  }

  function removeActor(id) {
    actors.delete(id)
  }

  function respawnActor(actor) {
    applyRespawn(actor)
  }

  function damageActor(message) {
    applyDamage(message)
  }

  function killActor(id) {
    const actor = actors.get(id)
    if (actor) actor.alive = false
  }

  return {
    init,
    addActor,
    removeActor,
    respawnActor,
    damageActor,
    killActor,
    tick: processTick,
  }
}
