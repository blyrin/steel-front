import * as THREE from 'three'
import {
  createBoxHitbox,
  rayHitObstacle,
  resolveObstacleCollision,
} from '../combat/collision.js'

const GEOMETRY = {
  leg: new THREE.BoxGeometry(0.2, 0.7, 0.22),
  boot: new THREE.BoxGeometry(0.18, 0.13, 0.3),
  torso: new THREE.BoxGeometry(0.5, 0.72, 0.3),
  shoulder: new THREE.BoxGeometry(0.58, 0.18, 0.34),
  arm: new THREE.BoxGeometry(0.14, 0.62, 0.16),
  hand: new THREE.BoxGeometry(0.11, 0.12, 0.11),
  neck: new THREE.CylinderGeometry(0.08, 0.09, 0.12, 8),
  head: new THREE.BoxGeometry(0.28, 0.3, 0.26),
  jaw: new THREE.BoxGeometry(0.24, 0.11, 0.2),
  mouth: new THREE.BoxGeometry(0.18, 0.07, 0.025),
  tooth: new THREE.BoxGeometry(0.035, 0.055, 0.025),
  eye: new THREE.SphereGeometry(0.035, 6, 4),
  pupil: new THREE.SphereGeometry(0.014, 5, 4),
  hair: new THREE.BoxGeometry(0.1, 0.12, 0.1),
  wound: new THREE.BoxGeometry(0.09, 0.12, 0.025),
  finger: new THREE.BoxGeometry(0.035, 0.16, 0.04),
}

const EYE_MATERIAL = new THREE.MeshBasicMaterial({ color: 0xffd447 })
const PUPIL_MATERIAL = new THREE.MeshBasicMaterial({ color: 0x16191a })
const MOUTH_MATERIAL = new THREE.MeshBasicMaterial({ color: 0x241719 })
const WOUND_MATERIAL = new THREE.MeshBasicMaterial({ color: 0x7b2630 })
const HAIR_MATERIAL = new THREE.MeshBasicMaterial({ color: 0x252b29 })

export class Zombie {
  constructor(spawnPosition, services) {
    Object.assign(this, services)
    this.mode = services.mode
    this.enemyConfig = services.enemyConfig
    this.team = 'axis'
    this.actorKind = 'zombie'
    this.name = '丧尸'
    this.position = spawnPosition.clone()
    this.position.y = this.gameState.groundHeightAt(this.position.x, this.position.z)
    this.velocity = new THREE.Vector3()
    this.yaw = Math.random() * Math.PI * 2
    this.alive = true
    this.health = this.enemyConfig.maxHealth
    this.maxHealth = this.enemyConfig.maxHealth
    this.radius = this.enemyConfig.radius
    this.target = null
    this.targetVisible = false
    this.aiTime = 0
    this.targetScanTimer = Math.random() * this.enemyConfig.perceptionInterval
    this.lastTargetSeenAt = -Infinity
    this.lastKnownTarget = new THREE.Vector3()
    this.attackTimer = Math.random() * this.enemyConfig.attackInterval
    this.stuckTimer = 0
    this.stuckSampleTimer = 0
    this.unstuckTimer = 0
    this.unstuckSign = Math.random() > 0.5 ? 1 : -1
    this.lastPosition = this.position.clone()
    this.kills = 0
    this.deaths = 0
    this.deathTime = -1
    this.animationTime = Math.random() * Math.PI * 2
    this.legPhase = Math.random() * Math.PI * 2
    this.moveBlend = 0
    this._seeOrigin = new THREE.Vector3()
    this._seeDir = new THREE.Vector3()
    this._seeTarget = new THREE.Vector3()
    this._desiredDirection = new THREE.Vector3()
    this._movementProbe = new THREE.Vector3()
    this._movementBest = new THREE.Vector3()
    this._separation = new THREE.Vector3()
    this.hitboxes = [
      createBoxHitbox(0.8, 0.58, 0, 1.5),
      createBoxHitbox(0.5, 0.5, 1.48, 1.95, true),
    ]
    this.buildModel()
    this.scene.add(this.group)
  }

  buildModel() {
    this.group = new THREE.Group()
    this.group.position.copy(this.position)
    this.group.rotation.y = this.yaw

    this.body = new THREE.Group()
    this.body.position.y = 0.78
    this.group.add(this.body)

    const createLeg = side => {
      const leg = new THREE.Group()
      leg.position.set(side * 0.13, 0.78, 0)
      const legMesh = new THREE.Mesh(GEOMETRY.leg, this.matLib.axisUniform)
      legMesh.position.y = -0.36
      legMesh.castShadow = true
      leg.add(legMesh)
      const boot = new THREE.Mesh(GEOMETRY.boot, this.matLib.metalDark)
      boot.position.set(0, -0.7, -0.08)
      leg.add(boot)
      this.group.add(leg)
      return leg
    }
    this.leftLeg = createLeg(-1)
    this.rightLeg = createLeg(1)

    const torso = new THREE.Mesh(GEOMETRY.torso, this.matLib.rust)
    torso.position.y = 0.38
    torso.castShadow = true
    torso.receiveShadow = true
    this.body.add(torso)
    const shoulder = new THREE.Mesh(GEOMETRY.shoulder, this.matLib.rust)
    shoulder.position.y = 0.68
    this.body.add(shoulder)
    const collar = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.12, 0.34),
      this.matLib.axisUniform
    )
    collar.position.set(0, 0.75, -0.015)
    this.body.add(collar)
    const belt = new THREE.Mesh(
      new THREE.BoxGeometry(0.53, 0.09, 0.33),
      this.matLib.metalDark
    )
    belt.position.set(0, 0.17, -0.015)
    this.body.add(belt)
    const buckle = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.1, 0.035),
      this.matLib.brass
    )
    buckle.position.set(0, 0.17, -0.19)
    this.body.add(buckle)
    for (const wound of [
      { x: -0.16, y: 0.44, sx: 0.8 },
      { x: 0.12, y: 0.28, sx: -0.6 },
      { x: 0.02, y: 0.57, sx: 0.35 },
    ]) {
      const patch = new THREE.Mesh(GEOMETRY.wound, WOUND_MATERIAL)
      patch.position.set(wound.x, wound.y, -0.165)
      patch.rotation.z = wound.sx
      this.body.add(patch)
    }

    this.head = new THREE.Group()
    this.head.position.set(0, 0.75, 0)
    this.body.add(this.head)
    const neck = new THREE.Mesh(GEOMETRY.neck, this.matLib.skin)
    this.head.add(neck)
    const head = new THREE.Mesh(GEOMETRY.head, this.matLib.skin)
    head.position.y = 0.15
    head.castShadow = true
    this.head.add(head)
    const jaw = new THREE.Mesh(GEOMETRY.jaw, this.matLib.skin)
    jaw.position.set(0, 0.02, -0.105)
    this.head.add(jaw)
    const mouth = new THREE.Mesh(GEOMETRY.mouth, MOUTH_MATERIAL)
    mouth.position.set(0, 0.075, -0.215)
    this.head.add(mouth)
    for (const toothX of [-0.06, 0, 0.06]) {
      const tooth = new THREE.Mesh(GEOMETRY.tooth, this.matLib.skin)
      tooth.position.set(toothX, 0.11, -0.23)
      this.head.add(tooth)
    }
    for (const hairX of [-0.1, 0, 0.1]) {
      const hair = new THREE.Mesh(GEOMETRY.hair, HAIR_MATERIAL)
      hair.position.set(hairX, 0.36, 0.01 + Math.abs(hairX) * 0.25)
      hair.rotation.z = hairX * 1.5
      this.head.add(hair)
    }
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(GEOMETRY.eye, EYE_MATERIAL)
      eye.position.set(side * 0.08, 0.19, -0.13)
      this.head.add(eye)
      const pupil = new THREE.Mesh(GEOMETRY.pupil, PUPIL_MATERIAL)
      pupil.position.set(side * 0.08, 0.19, -0.163)
      this.head.add(pupil)
    }

    const createArm = side => {
      const arm = new THREE.Group()
      arm.position.set(side * 0.32, 0.65, 0)
      const sleeve = new THREE.Mesh(GEOMETRY.arm, this.matLib.rust)
      sleeve.position.y = -0.3
      arm.add(sleeve)
      const hand = new THREE.Mesh(GEOMETRY.hand, this.matLib.skin)
      hand.position.set(0, -0.62, -0.02)
      arm.add(hand)
      for (let fingerIndex = 0; fingerIndex < 3; fingerIndex++) {
        const finger = new THREE.Mesh(GEOMETRY.finger, this.matLib.skin)
        finger.position.set((fingerIndex - 1) * 0.045, -0.7, -0.1)
        finger.rotation.z = (fingerIndex - 1) * 0.12
        arm.add(finger)
      }
      this.body.add(arm)
      return arm
    }
    this.leftArm = createArm(-1)
    this.rightArm = createArm(1)

    this.matLib.addOutline(this.group, 1.04)
  }

  getHitboxes() {
    const cos = Math.cos(this.yaw)
    const sin = Math.sin(this.yaw)
    for (const hitbox of this.hitboxes) {
      hitbox.x = this.position.x
      hitbox.z = this.position.z
      hitbox.minY = this.position.y + (hitbox.headshot ? 1.48 : 0)
      hitbox.maxY = this.position.y + (hitbox.headshot ? 1.95 : 1.5)
      hitbox.rot = this.yaw
      hitbox.cos = cos
      hitbox.sin = sin
    }
    return this.hitboxes
  }

  selectTarget() {
    const searchRadiusSq = this.enemyConfig.targetSearchRadius ** 2
    let nearest = null
    let nearestDistance = Infinity
    for (const actor of this.mode.getHostileActors(this.team)) {
      if (!actor.alive) continue
      const distanceSq = this.position.distanceToSquared(actor.position)
      if (distanceSq > searchRadiusSq) continue
      const distance = Math.sqrt(distanceSq)
      let score = distance
      if (actor === this.gameState.player) score -= 1.8
      if (actor.health < actor.maxHealth * 0.35) score -= 0.8
      if (score < nearestDistance) {
        nearest = actor
        nearestDistance = distance
      }
    }

    if (this.target?.alive) {
      const currentDistanceSq = this.position.distanceToSquared(this.target.position)
      if (
        currentDistanceSq <= searchRadiusSq &&
        (!nearest ||
          Math.sqrt(currentDistanceSq) <=
            nearestDistance + this.enemyConfig.targetSwitchBias)
      )
        return { target: this.target, heard: false }
    }

    const player = this.gameState.player
    const playerShot = this.gameState.lastPlayerShot
    if (player?.alive && player.team !== this.team && playerShot) {
      const age = (performance.now() - playerShot.at) / 1000
      const distance = Math.hypot(
        playerShot.x - this.position.x,
        playerShot.z - this.position.z
      )
      if (
        age <= this.enemyConfig.playerShotMemory &&
        distance <= this.enemyConfig.playerShotHearingDistance &&
        (!nearest || distance < nearestDistance)
      )
        return { target: player, heard: true, position: playerShot }
    }
    return nearest
      ? { target: nearest, heard: false, position: nearest.position }
      : null
  }

  canReachTarget(target) {
    const origin = this._seeOrigin.set(
      this.position.x,
      this.position.y + 1.05,
      this.position.z
    )
    const targetGroundY = target.position.y - (target.currentHeight ?? 0)
    const point = this._seeTarget.set(
      target.position.x,
      targetGroundY + 1.05,
      target.position.z
    )
    const direction = this._seeDir.subVectors(point, origin)
    const distance = direction.length()
    if (distance < 1e-6) return true
    direction.multiplyScalar(1 / distance)
    for (const obstacle of this.gameState.obstacles) {
      if (obstacle.type === 'ground' || obstacle.type === 'crater' || obstacle.type === 'wire')
        continue
      if (rayHitObstacle(origin, direction, obstacle, distance) != null) return false
    }
    return true
  }

  isDirectionBlocked(direction) {
    const origin = this._seeOrigin.set(
      this.position.x,
      this.position.y + 0.65,
      this.position.z
    )
    const lookAhead = this.enemyConfig.movementLookAhead
    for (const obstacle of this.gameState.obstacles) {
      if (
        obstacle.type === 'ground' ||
        obstacle.type === 'crater' ||
        obstacle.type === 'wire' ||
        obstacle.shape === 'frustum'
      )
        continue
      const hit = rayHitObstacle(origin, direction, obstacle, lookAhead)
      if (hit != null && hit < lookAhead * 0.92) return true
    }
    return false
  }

  chooseMovementDirection(direction) {
    const desired = this._desiredDirection.copy(direction).setY(0)
    if (desired.lengthSq() < 1e-8) return this._movementBest.set(0, 0, 0)
    desired.normalize()
    const baseAngle = Math.atan2(desired.z, desired.x)
    const probeAngle = this.enemyConfig.movementProbeAngle
    const unstuckOffset = this.unstuckTimer > 0 ? this.unstuckSign * 1.1 : 0
    const angles = [
      unstuckOffset,
      probeAngle + unstuckOffset,
      -probeAngle + unstuckOffset,
      probeAngle * 2 + unstuckOffset,
      -probeAngle * 2 + unstuckOffset,
      Math.PI * 0.78 + unstuckOffset,
      -Math.PI * 0.78 + unstuckOffset,
    ]
    let bestScore = -Infinity
    for (const offset of angles) {
      const angle = baseAngle + offset
      this._movementProbe.set(Math.cos(angle), 0, Math.sin(angle))
      const blocked = this.isDirectionBlocked(this._movementProbe)
      let score = this._movementProbe.dot(desired) * 5
      if (blocked) score -= 8
      else score += 2
      if (this.unstuckTimer > 0 && Math.sign(offset || 1) === this.unstuckSign)
        score += 1.5
      if (score > bestScore) {
        bestScore = score
        this._movementBest.copy(this._movementProbe)
      }
    }
    return this._movementBest
  }

  addSeparation(direction) {
    this._separation.set(0, 0, 0)
    const minDistance = this.enemyConfig.separationDistance
    const minDistanceSq = minDistance * minDistance
    for (const actor of this.gameState.actors) {
      if (!actor.alive || actor === this || actor.team !== this.team) continue
      const dx = this.position.x - actor.position.x
      const dz = this.position.z - actor.position.z
      const distanceSq = dx * dx + dz * dz
      if (distanceSq < 1e-8 || distanceSq >= minDistanceSq) continue
      const distance = Math.sqrt(distanceSq)
      const strength = 1 - distance / minDistance
      this._separation.x += (dx / distance) * strength
      this._separation.z += (dz / distance) * strength
    }
    if (this._separation.lengthSq() > 1e-8) {
      direction.addScaledVector(this._separation, this.enemyConfig.separationWeight)
      direction.normalize()
    }
  }

  moveWithDirection(direction, speed) {
    const movement = this.chooseMovementDirection(direction)
    if (movement.lengthSq() < 1e-8) {
      this.velocity.set(0, 0, 0)
      return
    }
    this.addSeparation(movement)
    this.velocity.set(movement.x * speed, 0, movement.z * speed)
  }

  moveToward(target, speed) {
    const dx = target.x - this.position.x
    const dz = target.z - this.position.z
    if (dx * dx + dz * dz < 0.01) {
      this.velocity.set(0, 0, 0)
      return
    }
    this._desiredDirection.set(dx, 0, dz)
    this.moveWithDirection(this._desiredDirection, speed)
  }

  updateStuck(dt) {
    this.stuckSampleTimer += dt
    if (this.stuckSampleTimer < 0.28) return
    const moved = Math.hypot(
      this.position.x - this.lastPosition.x,
      this.position.z - this.lastPosition.z
    )
    if (
      Math.hypot(this.velocity.x, this.velocity.z) > 1 &&
      moved < this.enemyConfig.stuckDistance
    )
      this.stuckTimer += this.stuckSampleTimer
    else this.stuckTimer = Math.max(0, this.stuckTimer - this.stuckSampleTimer * 1.5)
    if (this.stuckTimer > this.enemyConfig.stuckTimeout) {
      this.unstuckTimer = 1.1
      this.unstuckSign *= -1
      this.stuckTimer = 0
    }
    this.lastPosition.copy(this.position)
    this.stuckSampleTimer = 0
  }

  update(dt) {
    if (!this.alive) {
      this.updateModelAnimation(dt)
      return
    }

    this.aiTime += dt
    this.attackTimer -= dt
    this.unstuckTimer = Math.max(0, this.unstuckTimer - dt)
    this.targetScanTimer -= dt
    if (this.targetScanTimer <= 0) {
      this.targetScanTimer =
        this.enemyConfig.perceptionInterval * (0.85 + Math.random() * 0.3)
      const contact = this.selectTarget()
      if (contact) {
        this.target = contact.target
        this.targetVisible = !contact.heard
        this.lastKnownTarget.copy(contact.position || contact.target.position)
        this.lastTargetSeenAt = this.aiTime
      } else {
        this.targetVisible = false
        if (
          this.target &&
          this.aiTime - this.lastTargetSeenAt > this.enemyConfig.targetMemory
        )
          this.target = null
      }
    }
    if (this.target && !this.target.alive) {
      this.target = null
      this.targetVisible = false
    }

    const fortress = this.mode.getFortress()
    const target = this.target
    let targetPosition = fortress.position
    if (target) {
      targetPosition = this.targetVisible ? target.position : this.lastKnownTarget
    }
    const targetDistance = Math.hypot(
      targetPosition.x - this.position.x,
      targetPosition.z - this.position.z
    )
    const canAttackTarget =
      target &&
      this.targetVisible &&
      targetDistance <= this.enemyConfig.attackRange &&
      this.canReachTarget(target)

    if (canAttackTarget || (!target && targetDistance <= fortress.attackRadius)) {
      this.velocity.set(0, 0, 0)
      if (this.attackTimer <= 0) {
        if (target) this.attackTarget(target)
        else this.mode.damageFortress(this.enemyConfig.attackDamage)
        this.attackTimer = this.enemyConfig.attackInterval
      }
    } else {
      this.moveToward(targetPosition, this.enemyConfig.speed)
    }

    this.position.addScaledVector(this.velocity, dt)
    this.position.y = this.gameState.groundHeightAt(this.position.x, this.position.z)
    const half = this.config.match.mapSize / 2 - 2
    this.position.x = Math.max(-half, Math.min(half, this.position.x))
    this.position.z = Math.max(-half, Math.min(half, this.position.z))
    this.handleCollisions()
    this.updateStuck(dt)
    this.group.position.copy(this.position)

    let targetYaw = this.yaw
    if (target) {
      targetYaw = Math.atan2(
        -(targetPosition.x - this.position.x),
        -(targetPosition.z - this.position.z)
      )
    } else if (this.velocity.lengthSq() > 0.01) {
      targetYaw = Math.atan2(-this.velocity.x, -this.velocity.z)
    }
    let difference = targetYaw - this.yaw
    while (difference > Math.PI) difference -= Math.PI * 2
    while (difference < -Math.PI) difference += Math.PI * 2
    this.yaw += difference * Math.min(1, dt * 7)
    this.group.rotation.y = this.yaw
    this.updateModelAnimation(dt)
  }

  attackTarget(target) {
    if (target === this.gameState.player)
      target.takeDamage(this.enemyConfig.attackDamage, this.position, this, 'melee')
    else target.takeDamage(this.enemyConfig.attackDamage, this, false, 'melee')
    const targetGroundHeight = target.position.y - (target.currentHeight ?? 0)
    const hitPosition = target.position.clone().setY(targetGroundHeight + 1.1)
    this.effects.spawnBlood(hitPosition)
    this.audio.stabHitFlesh(hitPosition)
  }

  takeDamage(amount, attacker, isHeadshot = false, attackType = 'weapon') {
    if (!this.alive) return
    this.health -= amount
    if (attacker?.alive && attacker.team !== this.team) {
      this.target = attacker
      this.targetVisible = true
      this.lastKnownTarget.copy(attacker.position)
      this.lastTargetSeenAt = this.aiTime
      this.targetScanTimer = this.enemyConfig.perceptionInterval
    }
    const hitPosition = this.position.clone().setY(this.position.y + 1.2)
    this.audio.hitFlesh(hitPosition)
    if (this.health <= 0) this.die(attacker, isHeadshot, attackType)
    else this.audio.pain(this.config.bot.painChance, hitPosition)
  }

  die(attacker, isHeadshot, attackType = 'weapon') {
    if (!this.alive) return
    this.alive = false
    this.deathTime = 0
    this.target = null
    this.targetVisible = false
    this.velocity.set(0, 0, 0)
    this.effects.spawnBlood(this.position.clone().setY(this.position.y + 1.2))
    this.audio.pain(this.config.bot.deathPainChance, this.position.clone().setY(this.position.y + 0.3))
    this.audio.bodyFall(this.position.clone().setY(this.position.y + 0.3))
    this.scoring.recordElimination(this, attacker, isHeadshot, attackType)
  }

  updateModelAnimation(dt) {
    this.animationTime += dt
    if (!this.alive) {
      this.deathTime += dt
      const progress = Math.min(1, this.deathTime / 0.62)
      this.group.rotation.z = (Math.PI / 2) * (1 - Math.pow(1 - progress, 3))
      this.group.position.y = this.position.y + 0.04 + (1 - progress) * 0.05
      return
    }
    const speed = Math.hypot(this.velocity.x, this.velocity.z)
    const blend = THREE.MathUtils.clamp(speed / this.enemyConfig.speed, 0, 1)
    this.moveBlend += (blend - this.moveBlend) * (1 - Math.exp(-9 * dt))
    if (this.moveBlend > 0.01) this.legPhase += dt * 8
    const stride = Math.sin(this.legPhase) * 0.55 * this.moveBlend
    const armReach = this.moveBlend * 0.35
    const ease = 1 - Math.exp(-12 * dt)
    this.leftLeg.rotation.x += (stride - this.leftLeg.rotation.x) * ease
    this.rightLeg.rotation.x += (-stride - this.rightLeg.rotation.x) * ease
    this.leftArm.rotation.x += (1.08 + armReach - this.leftArm.rotation.x) * ease
    this.rightArm.rotation.x += (1.08 - armReach - this.rightArm.rotation.x) * ease
    this.leftArm.rotation.z += (-0.12 - this.leftArm.rotation.z) * ease
    this.rightArm.rotation.z += (0.12 - this.rightArm.rotation.z) * ease
    this.body.position.y += (0.78 + Math.sin(this.animationTime * 2.1) * 0.012 - this.body.position.y) * ease
    this.body.rotation.z +=
      (THREE.MathUtils.clamp(this.velocity.x * -0.006, -0.04, 0.04) - this.body.rotation.z) * ease
  }

  handleCollisions() {
    for (const obstacle of this.gameState.obstacles) {
      if (obstacle.type === 'ground' || obstacle.type === 'crater' || obstacle.type === 'wire') continue
      resolveObstacleCollision(this.position, this.radius, obstacle, this.position.y)
    }
  }

  destroy() {
    this.scene.remove(this.group)
  }
}
