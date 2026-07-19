function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value
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
  const lx = dx * cos + dz * sin
  const lz = -dx * sin + dz * cos
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
  position.x = obstacle.x + nlx * cos - nlz * sin
  position.z = obstacle.z + nlx * sin + nlz * cos
}

export function resolveObstacleCollision(position, radius, obstacle) {
  if (obstacle.shape === 'box') resolveBox(position, radius, obstacle)
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
  const lx = cx * cos + cz * sin
  const lz = -cx * sin + cz * cos
  const ldx = dx * cos + dz * sin
  const ldz = -dx * sin + dz * cos
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

export function rayHitObstacle(origin, direction, obstacle, maxDist) {
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
  const height = obstacle.h ?? 3
  if (hitY < 0 || hitY > height) return null
  return t
}

