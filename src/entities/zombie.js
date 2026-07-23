import * as THREE from 'three'
import { createBoxHitbox } from '../combat/collision.js'

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

  applyAiState(data) {
    if (!this.alive) return
    this.position.set(data.x, data.y, data.z)
    this.velocity.set(data.vx, 0, data.vz)
    this.yaw = data.yaw
    this.group.position.copy(this.position)
    this.group.rotation.y = this.yaw
  }

  attackFromWorker(target) {
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
