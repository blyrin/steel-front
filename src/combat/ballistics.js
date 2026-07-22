import * as THREE from 'three'
import { rayHitObstacle } from './collision.js'

export function createCombatSystem({ state, effects, audio, hud, config, getMode }) {
  const combatConfig = config.combat

  function getEnemyTargets(team) {
    return getMode().getHostileActors(team)
  }

  function fireBullet(origin, direction, team, owner, muzzle, attack) {
    let hit = false
    let hitPoint = origin.clone().add(direction.clone().multiplyScalar(combatConfig.bulletRange))
    let closestObstacle = combatConfig.bulletRange
    for (const obstacle of state.obstacles) {
      if (obstacle.type === 'ground' || obstacle.type === 'crater') continue
      const t = rayHitObstacle(origin, direction, obstacle, closestObstacle)
      if (t == null) continue
      closestObstacle = t
      hitPoint = origin.clone().add(direction.clone().multiplyScalar(t))
      hit = true
    }

    const targets = getEnemyTargets(team)
    let hitTarget = null
    let headshot = false
    let closestTarget = closestObstacle
    for (const target of targets) {
      for (const hitbox of target.getHitboxes()) {
        const t = rayHitObstacle(origin, direction, hitbox, closestTarget)
        if (t == null) continue
        closestTarget = t
        hitPoint = origin.clone().add(direction.clone().multiplyScalar(t))
        hitTarget = target
        headshot = hitbox.headshot
        hit = true
      }
    }

    effects.addTracer(
      muzzle.clone().addScaledVector(direction, combatConfig.tracerOriginOffset),
      hitPoint
    )
    if (hitTarget) {
      const falloffProgress = THREE.MathUtils.clamp(
        (closestTarget - attack.effectiveRange) /
          (combatConfig.bulletRange - attack.effectiveRange),
        0,
        1
      )
      const damageMultiplier = THREE.MathUtils.lerp(
        1,
        attack.minDamageMultiplier,
        falloffProgress
      )
      const damage =
        (headshot ? attack.headDamage : attack.bodyDamage) * damageMultiplier
      if (hitTarget === state.player) hitTarget.takeDamage(damage, origin, owner)
      else hitTarget.takeDamage(damage, owner, headshot)
      if (owner === state.player) {
        hud.showHitMarker()
        hud.addScreenShake(headshot ? combatConfig.headshotHitShake : combatConfig.bodyHitShake)
      }
      effects.spawnBlood(hitPoint)
    } else if (hit) {
      effects.spawnSpark(hitPoint, direction)
      audio.ricochet(hitPoint)
      if (owner === state.player) hud.addScreenShake(combatConfig.obstacleHitShake)
    }

    if (owner !== state.player && state.player.alive && !hitTarget) {
      const distance = origin.distanceTo(state.player.position)
      if (distance < combatConfig.bulletWhizDistance) {
        const toPlayer = new THREE.Vector3().subVectors(state.player.position, origin).normalize()
        const alignment = toPlayer.dot(direction)
        if (
          alignment > combatConfig.bulletWhizAlignmentMin &&
          alignment < combatConfig.bulletWhizAlignmentMax
        ) {
          audio.bulletWhiz(origin.clone().add(direction.clone().multiplyScalar(distance)))
        }
      }
    }
  }

  function explodeGrenade(position, grenade, team, owner) {
    if (grenade.kind === 'smoke') {
      state.smokeClouds.push({
        position: position.clone(),
        radius: grenade.radius,
        expiresAt: performance.now() + grenade.duration * 1000,
      })
      effects.spawnSmokeCloud(position, grenade.radius, grenade.duration)
      return
    }

    effects.spawnExplosion(position, grenade.radius)
    audio.grenadeExplosion(position)
    const targets = getEnemyTargets(team)
    let ownerHitTarget = false
    for (const target of targets) {
      const targetY =
        target === state.player ? target.position.y - 0.7 : target.position.y + 1
      const distance = Math.hypot(
        target.position.x - position.x,
        targetY - position.y,
        target.position.z - position.z
      )
      if (distance >= grenade.radius) continue
      const damage = grenade.damage * (1 - (distance / grenade.radius) * 0.78)
      if (target === state.player) target.takeDamage(damage, position, owner, 'grenade')
      else target.takeDamage(damage, owner, false, 'grenade')
      effects.spawnBlood(target.position.clone().setY(1.1))
      if (owner === state.player) ownerHitTarget = true
    }
    if (ownerHitTarget) hud.showHitMarker()
  }

  function throwGrenade(origin, direction, grenade, team, owner) {
    const velocity = direction.clone().normalize().multiplyScalar(grenade.throwSpeed)
    velocity.y += grenade.throwSpeed * 0.32
    effects.spawnThrownGrenade(
      origin,
      velocity,
      grenade,
      position => explodeGrenade(position, grenade, team, owner)
    )
  }

  function update() {
    const now = performance.now()
    for (let i = state.smokeClouds.length - 1; i >= 0; i--) {
      if (state.smokeClouds[i].expiresAt <= now) state.smokeClouds.splice(i, 1)
    }
  }

  return { fireBullet, throwGrenade, update }
}
