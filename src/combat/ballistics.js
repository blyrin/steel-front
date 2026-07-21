import * as THREE from 'three'
import { rayHitObstacle } from './collision.js'

export function createCombatSystem({ state, effects, audio, hud, config }) {
  const combatConfig = config.combat

  function fireBullet(origin, direction, team, owner, muzzle) {
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

    const targets = state.bots.filter(bot => bot.alive && bot.team !== team)
    if (state.player.alive && state.player.team !== team) targets.push(state.player)
    let hitTarget = null
    let headshot = false
    let closestTarget = hit ? closestObstacle : combatConfig.bulletRange
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

    const lineEnd =
      hit ? hitPoint : origin.clone().add(direction.clone().multiplyScalar(combatConfig.bulletRange))
    effects.addTracer(
      muzzle.clone().addScaledVector(direction, combatConfig.tracerOriginOffset),
      lineEnd
    )
    if (hitTarget) {
      const damage = headshot ? combatConfig.headDamage : combatConfig.bodyDamage
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

  return { fireBullet }
}
