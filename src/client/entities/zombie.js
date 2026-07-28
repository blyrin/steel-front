import * as THREE from 'three'
import { createBoxHitbox } from '#simulation'
import { createMergedMesh } from './merge-parts.js'

const ANIM_MID_DIST_SQ = 28 * 28
const ANIM_FAR_DIST_SQ = 48 * 48

const GEOMETRY = {
  leg: new THREE.BoxGeometry(0.2, 0.7, 0.22),
  boot: new THREE.BoxGeometry(0.18, 0.13, 0.3),
  torso: new THREE.BoxGeometry(0.5, 0.72, 0.3),
  shoulder: new THREE.BoxGeometry(0.58, 0.18, 0.34),
  collar: new THREE.BoxGeometry(0.32, 0.12, 0.34),
  belt: new THREE.BoxGeometry(0.53, 0.09, 0.33),
  buckle: new THREE.BoxGeometry(0.09, 0.1, 0.035),
  arm: new THREE.BoxGeometry(0.14, 0.62, 0.16),
  hand: new THREE.BoxGeometry(0.11, 0.12, 0.11),
  neck: new THREE.CylinderGeometry(0.08, 0.09, 0.12, 8),
  head: new THREE.BoxGeometry(0.28, 0.3, 0.26),
  jaw: new THREE.BoxGeometry(0.24, 0.11, 0.2),
  mouth: new THREE.BoxGeometry(0.18, 0.07, 0.025),
  eye: new THREE.SphereGeometry(0.035, 6, 4),
  wound: new THREE.BoxGeometry(0.09, 0.12, 0.025),
}

const EYE_MATERIAL = new THREE.MeshBasicMaterial({ color: 0xffd447 })

export class Zombie {
  constructor(spawnPosition, services) {
    Object.assign(this, services)
    this.ai = services.ai
    this.id = this.ai.allocateActorId()
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
    this.kills = 0
    this.deaths = 0
    this.deathTime = -1
    this.animationTime = Math.random() * Math.PI * 2
    this.legPhase = Math.random() * Math.PI * 2
    this.moveBlend = 0
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
      leg.add(
        createMergedMesh(
          [
            { geometry: GEOMETRY.leg, position: [0, -0.36, 0] },
            { geometry: GEOMETRY.boot, position: [0, -0.7, -0.08] },
          ],
          this.matLib.axisUniform,
        ),
      )
      this.group.add(leg)
      return leg
    }
    this.leftLeg = createLeg(-1)
    this.rightLeg = createLeg(1)

    const bodyMesh = createMergedMesh(
      [
        { geometry: GEOMETRY.torso, position: [0, 0.38, 0] },
        { geometry: GEOMETRY.shoulder, position: [0, 0.68, 0] },
        { geometry: GEOMETRY.collar, position: [0, 0.75, -0.015] },
        { geometry: GEOMETRY.belt, position: [0, 0.17, -0.015] },
        { geometry: GEOMETRY.buckle, position: [0, 0.17, -0.19] },
        {
          geometry: GEOMETRY.wound,
          position: [-0.16, 0.44, -0.165],
          rotation: [0, 0, 0.8],
        },
        {
          geometry: GEOMETRY.wound,
          position: [0.12, 0.28, -0.165],
          rotation: [0, 0, -0.6],
        },
      ],
      this.matLib.rust,
    )
    bodyMesh.castShadow = true
    bodyMesh.receiveShadow = true
    this.body.add(bodyMesh)

    this.head = new THREE.Group()
    this.head.position.set(0, 0.75, 0)
    this.body.add(this.head)
    this.head.add(
      createMergedMesh(
        [
          { geometry: GEOMETRY.neck },
          { geometry: GEOMETRY.head, position: [0, 0.15, 0] },
          { geometry: GEOMETRY.jaw, position: [0, 0.02, -0.105] },
          { geometry: GEOMETRY.mouth, position: [0, 0.075, -0.215] },
        ],
        this.matLib.skin,
      ),
    )
    this.head.add(
      createMergedMesh(
        [
          { geometry: GEOMETRY.eye, position: [-0.08, 0.19, -0.13] },
          { geometry: GEOMETRY.eye, position: [0.08, 0.19, -0.13] },
        ],
        EYE_MATERIAL,
      ),
    )

    const createArm = side => {
      const arm = new THREE.Group()
      arm.position.set(side * 0.32, 0.65, 0)
      arm.add(
        createMergedMesh(
          [
            { geometry: GEOMETRY.arm, position: [0, -0.3, 0] },
            { geometry: GEOMETRY.hand, position: [0, -0.62, -0.02] },
          ],
          this.matLib.rust,
        ),
      )
      this.body.add(arm)
      return arm
    }
    this.leftArm = createArm(-1)
    this.rightArm = createArm(1)

    this._animSkip = 0
    this._animCulled = false
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

  applySimulationState(data) {
    if (!this.alive) return
    this.position.set(data.x, data.y, data.z)
    this.velocity.set(data.vx, 0, data.vz)
    this.yaw = data.yaw
    this.group.position.copy(this.position)
    this.group.rotation.y = this.yaw
  }

  attackFromSimulation(target) {
    if (!this.alive || !target?.alive) return
    this.attackTarget(target)
  }

  update(dt) {
    this.updateModelAnimation(dt)
  }

  attackTarget(target) {
    if (target === this.gameState.player)
      target.takeDamage(this.enemyConfig.attackDamage, this.position, this, 'melee')
    else target.takeDamage(this.enemyConfig.attackDamage, this, false, 'melee')
    const targetGroundHeight = target.position.y - (target.currentHeight ?? 0)
    const hitPosition = target.position.clone().setY(targetGroundHeight + 1.1)
    this.effects.spawnBlood(hitPosition)
    this.audio.zombieAttack(this.position, hitPosition)
  }

  takeDamage(amount, attacker, isHeadshot = false, attackType = 'weapon') {
    if (!this.alive) return
    this.health -= amount
    this.ai.reportDamage(this, amount, attacker, attackType)
    const hitPosition = this.position.clone().setY(this.position.y + 1.2)
    this.audio.zombieHit(hitPosition)
    if (this.health <= 0) this.die(attacker, isHeadshot, attackType)
  }

  die(attacker, isHeadshot, attackType = 'weapon') {
    if (!this.alive) return
    this.alive = false
    this.deathTime = 0
    this.velocity.set(0, 0, 0)
    this.effects.spawnBlood(this.position.clone().setY(this.position.y + 1.2))
    this.audio.zombieDeath(this.position.clone().setY(this.position.y + 0.3))
    this.ai.reportDeath(this)
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

    const cam = this.camera.position
    const distSq =
      (this.position.x - cam.x) ** 2 +
      (this.position.y - cam.y) ** 2 +
      (this.position.z - cam.z) ** 2
    if (distSq > ANIM_FAR_DIST_SQ) {
      if (!this._animCulled) {
        this._animCulled = true
        this.leftLeg.rotation.set(0, 0, 0)
        this.rightLeg.rotation.set(0, 0, 0)
        this.leftArm.rotation.set(1.08, 0, -0.12)
        this.rightArm.rotation.set(1.08, 0, 0.12)
        this.body.position.y = 0.78
        this.body.rotation.z = 0
      }
      return
    }
    this._animCulled = false
    if (distSq > ANIM_MID_DIST_SQ) {
      this._animSkip ^= 1
      if (this._animSkip) return
      dt *= 2
    }

    const speed = Math.hypot(this.velocity.x, this.velocity.z)
    const blend = THREE.MathUtils.clamp(speed / this.enemyConfig.speed, 0, 1)
    this.moveBlend += (blend - this.moveBlend) * (1 - Math.exp(-9 * dt))
    const previousLegSin = Math.sin(this.legPhase)
    if (this.moveBlend > 0.01) {
      this.legPhase += dt * 8
      const currentLegSin = Math.sin(this.legPhase)
      if (
        this.moveBlend > 0.12 &&
        ((previousLegSin <= 0 && currentLegSin > 0) ||
          (previousLegSin >= 0 && currentLegSin < 0))
      )
        this.audio.zombieStep(this.position)
    }
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

  destroy() {
    this.scene.remove(this.group)
  }
}
