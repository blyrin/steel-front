import * as THREE from 'three'
import { rayHitObstacle } from './collision.js'

export function createCombatSystem({ state, effects, audio, hud }) {
  function fireBullet(origin, direction, team, owner, muzzle) {
    let hit = false
    let hitPoint = origin.clone().add(direction.clone().multiplyScalar(200))
    let closestObstacle = 200
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
    let closestTarget = hit ? closestObstacle : 200
    for (const target of targets) {
      const targetPosition = target.position.clone()
      targetPosition.y = 1.2
      const toTarget = new THREE.Vector3().subVectors(targetPosition, origin)
      const projection = toTarget.dot(direction)
      if (projection < 0 || projection > closestTarget) continue
      const closest = origin.clone().add(direction.clone().multiplyScalar(projection))
      if (closest.distanceTo(targetPosition) < 0.5) {
        closestTarget = projection
        hitPoint = closest
        hitTarget = target
        hit = true
      }
    }

    const lineEnd = hit ? hitPoint : origin.clone().add(direction.clone().multiplyScalar(200))
    effects.addTracer(muzzle.clone().addScaledVector(direction, 0.1), lineEnd)
    if (hitTarget) {
      const headshot = hitPoint.y > 1.55
      if (owner === state.player) state.player._pendingHeadshot = headshot
      if (hitTarget === state.player) hitTarget.takeDamage(headshot ? 100 : 35, origin, owner)
      else hitTarget.takeDamage(headshot ? 100 : 35, owner)
      if (owner === state.player) {
        hud.showHitMarker()
        hud.addScreenShake(headshot ? 0.16 : 0.1)
      }
      effects.spawnBlood(hitPoint)
    } else if (hit) {
      effects.spawnSpark(hitPoint, direction)
      audio.ricochet(hitPoint)
      if (owner === state.player) hud.addScreenShake(0.04)
    }

    if (owner !== state.player && state.player.alive && !hitTarget) {
      const distance = origin.distanceTo(state.player.position)
      if (distance < 30) {
        const toPlayer = new THREE.Vector3().subVectors(state.player.position, origin).normalize()
        const alignment = toPlayer.dot(direction)
        if (alignment > 0.95 && alignment < 0.999) {
          audio.bulletWhiz(origin.clone().add(direction.clone().multiplyScalar(distance)))
        }
      }
    }
  }

  return { fireBullet }
}
