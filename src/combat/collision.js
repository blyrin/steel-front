export function createCircleHitbox(radius, minY, maxY, headshot = false) {
  return {
    shape: 'circle',
    x: 0,
    z: 0,
    r: radius,
    minY,
    maxY,
    headshot,
  }
}

export function createBoxHitbox(width, depth, minY, maxY, headshot = false) {
  return {
    shape: 'box',
    x: 0,
    z: 0,
    w: width,
    d: depth,
    hw: width * 0.5,
    hd: depth * 0.5,
    r: Math.sqrt(width * width + depth * depth) * 0.5,
    minY,
    maxY,
    headshot,
    rot: 0,
    cos: 1,
    sin: 0,
  }
}

function clamp(value, min, max) {
  if (value < min) return min
  if (value > max) return max
  return value
}

function resolveCircle(position, radius, obstacle) {
  const dx = position.x - obstacle.x
  const dz = position.z - obstacle.z
  const distSq = dx * dx + dz * dz
  const minDist = (obstacle.r || 1) + radius
  if (distSq >= minDist * minDist || distSq < 1e-12) return
  const dist = Math.sqrt(distSq)
  const push = (minDist - dist) / dist
  position.x += dx * push
  position.z += dz * push
}

function resolveBox(position, radius, obstacle) {
  const dx = position.x - obstacle.x
  const dz = position.z - obstacle.z
  const bound = (obstacle.r || 0) + radius
  if (dx * dx + dz * dz >= bound * bound) return

  const cos = obstacle.cos
  const sin = obstacle.sin
  // world -> local
  const lx = dx * cos - dz * sin
  const lz = dx * sin + dz * cos
  const halfW = obstacle.hw
  const halfD = obstacle.hd
  const closestX = clamp(lx, -halfW, halfW)
  const closestZ = clamp(lz, -halfD, halfD)
  let ox = lx - closestX
  let oz = lz - closestZ
  const distSq = ox * ox + oz * oz

  let nlx = lx
  let nlz = lz
  if (distSq < 1e-12) {
    const penX = halfW - Math.abs(lx) + radius
    const penZ = halfD - Math.abs(lz) + radius
    if (penX < penZ) nlx = lx >= 0 ? halfW + radius : -halfW - radius
    else nlz = lz >= 0 ? halfD + radius : -halfD - radius
  } else if (distSq < radius * radius) {
    const dist = Math.sqrt(distSq)
    const push = (radius - dist) / dist
    nlx = lx + ox * push
    nlz = lz + oz * push
  } else {
    return
  }

  // local -> world
  position.x = obstacle.x + nlx * cos + nlz * sin
  position.z = obstacle.z - nlx * sin + nlz * cos
}

function resolveFrustum(position, radius, obstacle, bottomY) {
  const minY = obstacle.minY ?? 0
  const maxY = obstacle.maxY ?? obstacle.h ?? 0
  const height = maxY - minY
  if (height <= 1e-6 || bottomY >= maxY) return

  const dx = position.x - obstacle.x
  const dz = position.z - obstacle.z
  const distance = Math.hypot(dx, dz)
  if (distance >= obstacle.bottomRadius + radius) return

  let surfaceHeight = minY
  if (distance <= obstacle.topRadius) surfaceHeight = maxY
  else if (distance <= obstacle.bottomRadius) {
    surfaceHeight =
      minY + ((obstacle.bottomRadius - distance) /
        (obstacle.bottomRadius - obstacle.topRadius)) * height
  }
  if (bottomY >= surfaceHeight - 0.05) return

  const section = clamp((bottomY - minY) / height, 0, 1)
  const sectionRadius =
    obstacle.bottomRadius + (obstacle.topRadius - obstacle.bottomRadius) * section
  const minDistance = sectionRadius + radius
  if (distance >= minDistance) return
  if (distance < 1e-6) {
    position.x = obstacle.x + minDistance
    position.z = obstacle.z
    return
  }
  const push = (minDistance - distance) / distance
  position.x += dx * push
  position.z += dz * push
}

export function resolveObstacleCollision(position, radius, obstacle, bottomY = 0) {
  // 角色脚底高于障碍物顶部时，允许从上方越过
  if (bottomY >= obstacle.maxY && obstacle.shape !== 'frustum') return
  if (obstacle.shape === 'box') resolveBox(position, radius, obstacle)
  else if (obstacle.shape === 'frustum') resolveFrustum(position, radius, obstacle, bottomY)
  else resolveCircle(position, radius, obstacle)
}

function rayCircleFlat(ox, oz, dx, dz, cx, cz, radius, maxDist) {
  const fx = ox - cx
  const fz = oz - cz
  const b = fx * dx + fz * dz
  const c = fx * fx + fz * fz - radius * radius
  if (c > 0 && b > 0) return -1
  const disc = b * b - c
  if (disc < 0) return -1
  const t = -b - Math.sqrt(disc)
  if (t < 0) {
    const t1 = -b + Math.sqrt(disc)
    return t1 >= 0 && t1 <= maxDist ? t1 : -1
  }
  return t <= maxDist ? t : -1
}

function rayBoxFlat(ox, oz, dx, dz, obstacle, maxDist) {
  const cx = ox - obstacle.x
  const cz = oz - obstacle.z
  const cos = obstacle.cos
  const sin = obstacle.sin
  const lx = cx * cos - cz * sin
  const lz = cx * sin + cz * cos
  const ldx = dx * cos - dz * sin
  const ldz = dx * sin + dz * cos
  const halfW = obstacle.hw
  const halfD = obstacle.hd

  let tMin = 0
  let tMax = maxDist

  if (Math.abs(ldx) < 1e-8) {
    if (lx < -halfW || lx > halfW) return -1
  } else {
    let t1 = (-halfW - lx) / ldx
    let t2 = (halfW - lx) / ldx
    if (t1 > t2) {
      const tmp = t1
      t1 = t2
      t2 = tmp
    }
    if (t1 > tMin) tMin = t1
    if (t2 < tMax) tMax = t2
    if (tMin > tMax) return -1
  }

  if (Math.abs(ldz) < 1e-8) {
    if (lz < -halfD || lz > halfD) return -1
  } else {
    let t1 = (-halfD - lz) / ldz
    let t2 = (halfD - lz) / ldz
    if (t1 > t2) {
      const tmp = t1
      t1 = t2
      t2 = tmp
    }
    if (t1 > tMin) tMin = t1
    if (t2 < tMax) tMax = t2
    if (tMin > tMax) return -1
  }

  return tMin <= maxDist ? tMin : -1
}

function rayFrustum(origin, direction, obstacle, maxDist) {
  const minY = obstacle.minY ?? 0
  const maxY = obstacle.maxY ?? obstacle.h ?? 0
  const height = maxY - minY
  const bottomRadius = obstacle.bottomRadius
  const topRadius = obstacle.topRadius
  if (height <= 1e-6 || bottomRadius <= 0 || topRadius < 0) return -1
  if (direction.lengthSq() < 1e-12) return -1

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
  ) return 0

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

export function rayHitObstacle(origin, direction, obstacle, maxDist) {
  if (obstacle.shape === 'frustum') {
    const t = rayFrustum(origin, direction, obstacle, maxDist)
    return t >= 0 ? t : null
  }

  const flatLenSq = direction.x * direction.x + direction.z * direction.z
  if (flatLenSq < 1e-12) return null
  const flatLen = Math.sqrt(flatLenSq)
  const invFlat = 1 / flatLen
  const dirX = direction.x * invFlat
  const dirZ = direction.z * invFlat
  const maxFlat = maxDist * flatLen

  // 粗检测：到障碍圆心的最近距离
  const toX = obstacle.x - origin.x
  const toZ = obstacle.z - origin.z
  const proj = toX * dirX + toZ * dirZ
  if (proj < -(obstacle.r || 0) || proj > maxFlat + (obstacle.r || 0)) return null
  const closestX = origin.x + dirX * clamp(proj, 0, maxFlat)
  const closestZ = origin.z + dirZ * clamp(proj, 0, maxFlat)
  const cdx = closestX - obstacle.x
  const cdz = closestZ - obstacle.z
  const r = obstacle.r || 1
  if (cdx * cdx + cdz * cdz > r * r) return null

  let tFlat
  if (obstacle.shape === 'box') {
    tFlat = rayBoxFlat(origin.x, origin.z, dirX, dirZ, obstacle, maxFlat)
  } else {
    tFlat = rayCircleFlat(origin.x, origin.z, dirX, dirZ, obstacle.x, obstacle.z, r, maxFlat)
  }
  if (tFlat < 0) return null

  const t = tFlat * invFlat
  if (t < 0 || t > maxDist) return null
  const hitY = origin.y + direction.y * t
  const minY = obstacle.minY ?? 0
  const maxY = obstacle.maxY ?? obstacle.h ?? 3
  if (hitY < minY || hitY > maxY) return null
  return t
}

