import * as THREE from 'three'
import { createBoxHitbox } from '../combat/collision.js'

const BOT_GEOMETRY = {
  leg: new THREE.BoxGeometry(0.17, 0.72, 0.2),
  boot: new THREE.BoxGeometry(0.16, 0.14, 0.28),
  torso: new THREE.BoxGeometry(0.48, 0.68, 0.28),
  belt: new THREE.BoxGeometry(0.5, 0.07, 0.3),
  pack: new THREE.BoxGeometry(0.34, 0.38, 0.16),
  neck: new THREE.CylinderGeometry(0.07, 0.08, 0.1, 8),
  head: new THREE.BoxGeometry(0.24, 0.26, 0.24),
  allyHelmet: new THREE.SphereGeometry(0.175, 10, 7, 0, Math.PI * 2, 0, Math.PI * 0.55),
  axisHelmet: new THREE.SphereGeometry(0.17, 10, 7, 0, Math.PI * 2, 0, Math.PI * 0.58),
  allyBrim: new THREE.CylinderGeometry(0.2, 0.23, 0.03, 10),
  arm: new THREE.BoxGeometry(0.13, 0.58, 0.15),
  hand: new THREE.BoxGeometry(0.1, 0.1, 0.1),
  rifleBarrel: new THREE.CylinderGeometry(0.018, 0.022, 0.72, 8),
  rifleBody: new THREE.BoxGeometry(0.045, 0.05, 0.35),
  rifleStock: new THREE.BoxGeometry(0.055, 0.07, 0.28),
  rifleMag: new THREE.BoxGeometry(0.06, 0.18, 0.11),
  rifleGrip: new THREE.BoxGeometry(0.07, 0.18, 0.08),
}

export class Bot {
  constructor(team, spawnPosition, services) {
    Object.assign(this, services)
    this.mode = services.mode
    this.ai = services.ai
    this.id = this.ai.allocateActorId()
    const botConfig = this.config.bot
    this.team = team
    this.actorKind = 'soldier'
    this.position = spawnPosition.clone()
    this.position.y = this.gameState.groundHeightAt(this.position.x, this.position.z)
    this.velocity = new THREE.Vector3()
    this.yaw = Math.random() * Math.PI * 2
    this.alive = true
    this.health = botConfig.maxHealth
    this.maxHealth = botConfig.maxHealth
    this.stateName = 'patrol'
    this.target = null
    this.targetVisible = false
    this.reloading = false
    this.spreadBloom = 0
    this.botSkill = botConfig.skillMin + Math.random() * botConfig.skillRange
    this.randomizeLoadout()
    this.kills = 0
    this.deaths = 0
    this.radius = botConfig.radius
    this.hitboxes = [
      createBoxHitbox(
        botConfig.hitboxBodyWidth,
        botConfig.hitboxBodyDepth,
        0,
        botConfig.hitboxBodyMaxY
      ),
      createBoxHitbox(
        botConfig.hitboxHeadWidth,
        botConfig.hitboxHeadDepth,
        botConfig.hitboxHeadMinY,
        botConfig.hitboxHeadMaxY,
        true
      ),
    ]
    this.name = this.generateName()
    this._workerTurnDifference = 0
    this._aiX = this.position.x
    this._aiY = this.position.y
    this._aiZ = this.position.z
    this._aiVx = 0
    this._aiVz = 0
    this._aiYaw = this.yaw
    this._aiAt = performance.now()
    this.buildModel()
    this.scene.add(this.group)
  }

  advanceFromAi(dt) {
    if (!this.alive) return
    const match = this.config.match
    const elapsed = Math.min(match.maxAiFrameDelta, (performance.now() - this._aiAt) / 1000)
    const half = this.gameState.mapSize / 2 - 2
    const targetX = Math.max(-half, Math.min(half, this._aiX + this._aiVx * elapsed))
    const targetZ = Math.max(-half, Math.min(half, this._aiZ + this._aiVz * elapsed))
    const targetY = this.gameState.groundHeightAt(targetX, targetZ)
    const dx = targetX - this.position.x
    const dz = targetZ - this.position.z
    const distance = Math.hypot(dx, dz)
    if (distance > match.aiSnapDistance) {
      this.position.x = targetX
      this.position.z = targetZ
    } else {
      const blend = 1 - Math.exp(-match.aiFollowSpeed * dt)
      this.position.x += dx * blend
      this.position.z += dz * blend
    }
    this.position.y = this.gameState.groundHeightAt(this.position.x, this.position.z)
    if (Math.abs(targetY - this.position.y) > 0.8) this.position.y = targetY

    const velocityBlend = 1 - Math.exp(-12 * dt)
    this.velocity.x += (this._aiVx - this.velocity.x) * velocityBlend
    this.velocity.z += (this._aiVz - this.velocity.z) * velocityBlend

    let yawDifference = this._aiYaw - this.yaw
    while (yawDifference > Math.PI) yawDifference -= Math.PI * 2
    while (yawDifference < -Math.PI) yawDifference += Math.PI * 2
    const yawStep = yawDifference * (1 - Math.exp(-match.aiYawFollowSpeed * dt))
    this.yaw += yawStep
    this._workerTurnDifference += yawStep

    this.group.position.copy(this.position)
    this.group.rotation.y = this.yaw
  }

  randomizeLoadout() {
    const randomId = entries => entries[Math.floor(Math.random() * entries.length)]
    const weaponId = randomId(Object.keys(this.config.weapons))
    const grenadeId = randomId(Object.keys(this.config.grenades))
    const itemId = randomId(Object.keys(this.config.items))
    this.loadout = { weapon: weaponId, grenade: grenadeId, item: itemId }
    this.weaponData = this.config.weapons[weaponId]
    this.grenadeData = this.config.grenades[grenadeId]
    this.itemData = this.config.items[itemId]
    this.magazine = this.weaponData.magazineSize
    this.reserveAmmo = this.weaponData.reserveAmmo
    this.grenadeCount = this.grenadeData.count
    this.itemUses = this.itemData.uses || 0
    if (this.rifle) this.configureRifleModel()
  }

  generateName() {
    const allies = [
      'Miller',
      'Davis',
      'Johnson',
      'Thompson',
      'Carter',
      'Wright',
      'Bennett',
      'Hayes',
      'Cooper',
      'Reed',
      'Anderson',
      'Baker',
      'Brooks',
      'Campbell',
      'Clark',
      'Collins',
      'Edwards',
      'Evans',
      'Foster',
      'Garcia',
      'Gibson',
      'Grant',
      'Harris',
      'Hughes',
      'Jackson',
      'Kelly',
      'Lewis',
      'Mitchell',
      'Morgan',
      'Murphy',
      'Nelson',
      'Parker',
      'Patterson',
      'Perry',
      'Phillips',
      'Price',
      'Roberts',
      'Robinson',
      'Rogers',
      'Russell',
      'Sanders',
      'Scott',
      'Stewart',
      'Taylor',
      'Turner',
      'Walker',
      'Ward',
      'Watson',
      'White',
      'Wilson',
      'Young',
      'Adams',
      'Bailey',
      'Barnes',
      'Bell',
      'Butler',
      'Coleman',
      'Cox',
      'Diaz',
      'Flores',
      'Graham',
      'Gray',
      'Green',
      'Hall',
      'Henderson',
      'Hill',
      'Howard',
      'James',
      'Jenkins',
      'Jones',
      'King',
      'Lee',
      'Long',
      'Martin',
      'Moore',
      'Morris',
      'Peterson',
      'Powell',
      'Ramirez',
      'Richardson',
      'Rivera',
      'Ross',
      'Simmons',
      'Sullivan',
      'Torres',
      'Wood',
    ]
    const axis = [
      'Müller',
      'Schmidt',
      'Weber',
      'Fischer',
      'Becker',
      'Hoffmann',
      'Wagner',
      'Klein',
      'Schwarz',
      'Richter',
      'Bauer',
      'Berger',
      'Braun',
      'Engel',
      'Frank',
      'Friedrich',
      'Fuchs',
      'Graf',
      'Haas',
      'Hartmann',
      'Heinz',
      'Hermann',
      'Jung',
      'Kaiser',
      'Keller',
      'Koch',
      'König',
      'Krause',
      'Krüger',
      'Lang',
      'Lange',
      'Lehmann',
      'Lorenz',
      'Ludwig',
      'Maier',
      'Mayer',
      'Meier',
      'Neumann',
      'Otto',
      'Peters',
      'Pfeiffer',
      'Pohl',
      'Roth',
      'Sauer',
      'Schäfer',
      'Scholz',
      'Schreiber',
      'Schubert',
      'Schulz',
      'Schumacher',
      'Seidel',
      'Simon',
      'Sommer',
      'Stein',
      'Thomas',
      'Vogel',
      'Vogt',
      'Walter',
      'Werner',
      'Wolf',
      'Wolff',
      'Ziegler',
      'Zimmermann',
      'Albrecht',
      'Arnold',
      'Bachmann',
      'Dietrich',
      'Ebert',
      'Gärtner',
      'Hahn',
      'Hirsch',
      'Jäger',
      'Kraus',
      'Kuhn',
      'Lenz',
      'Lutz',
      'Marx',
      'Nagel',
      'Pfeil',
      'Reinhardt',
      'Schröder',
      'Stark',
      'Steinberg',
      'Voigt',
      'Weidner',
      'Winkler',
    ]
    const names = this.team === 'allies' ? allies : axis
    return names[Math.floor(Math.random() * names.length)]
  }

  buildModel() {
    this.group = new THREE.Group()
    this.group.position.copy(this.position)
    const isAlly = this.team === 'allies'
    const uniform = isAlly ? this.matLib.allyUniform : this.matLib.axisUniform
    const helmetMat = isAlly ? this.matLib.helmetAlly : this.matLib.helmetAxis
    const bootMat = this.matLib.metalDark

    this.body = new THREE.Group()
    this.body.position.y = 0.78
    this.group.add(this.body)

    const legGeometry = BOT_GEOMETRY.leg
    const createLeg = side => {
      const leg = new THREE.Group()
      leg.position.set(side * 0.12, 0.78, 0)
      const legMesh = new THREE.Mesh(legGeometry, uniform)
      legMesh.position.y = -0.36
      legMesh.castShadow = true
      legMesh.receiveShadow = true
      leg.add(legMesh)
      const boot = new THREE.Mesh(BOT_GEOMETRY.boot, bootMat)
      boot.position.set(0, -0.7, -0.08)
      boot.castShadow = false
      leg.add(boot)
      this.group.add(leg)
      return leg
    }
    this.leftLeg = createLeg(-1)
    this.rightLeg = createLeg(1)

    const torso = new THREE.Mesh(BOT_GEOMETRY.torso, uniform)
    torso.position.set(0, 0.38, 0)
    torso.castShadow = true
    torso.receiveShadow = true
    this.body.add(torso)
    const belt = new THREE.Mesh(BOT_GEOMETRY.belt, bootMat)
    belt.position.set(0, 0.08, 0)
    this.body.add(belt)

    const pack = new THREE.Mesh(BOT_GEOMETRY.pack, uniform)
    pack.position.set(0, 0.44, 0.2)
    pack.castShadow = true
    this.body.add(pack)
    this.pack = pack

    this.head = new THREE.Group()
    this.head.position.set(0, 0.74, 0)
    this.body.add(this.head)
    const neck = new THREE.Mesh(BOT_GEOMETRY.neck, this.matLib.skin)
    neck.position.set(0, 0, 0)
    this.head.add(neck)
    const head = new THREE.Mesh(BOT_GEOMETRY.head, this.matLib.skin)
    head.position.set(0, 0.14, 0)
    head.castShadow = true
    this.head.add(head)
    if (isAlly) {
      const dome = new THREE.Mesh(
        BOT_GEOMETRY.allyHelmet,
        helmetMat
      )
      dome.position.set(0, 0.26, 0)
      dome.scale.set(1.08, 0.88, 1.12)
      dome.castShadow = true
      this.head.add(dome)
      const brim = new THREE.Mesh(BOT_GEOMETRY.allyBrim, helmetMat)
      brim.position.set(0, 0.2, 0)
      this.head.add(brim)
    } else {
      const dome = new THREE.Mesh(
        BOT_GEOMETRY.axisHelmet,
        helmetMat
      )
      dome.position.set(0, 0.28, 0)
      dome.scale.set(1.08, 0.92, 1.18)
      dome.castShadow = true
      this.head.add(dome)
    }

    const armGeometry = BOT_GEOMETRY.arm
    const createArm = side => {
      const arm = new THREE.Group()
      arm.position.set(side * 0.31, 0.62, 0)
      const sleeve = new THREE.Mesh(armGeometry, uniform)
      sleeve.position.set(0, -0.29, 0)
      sleeve.castShadow = false
      arm.add(sleeve)
      const hand = new THREE.Mesh(BOT_GEOMETRY.hand, this.matLib.skin)
      hand.position.set(0, -0.59, 0.02)
      arm.add(hand)
      this.body.add(arm)
      return arm
    }
    this.leftArm = createArm(-1)
    this.rightArm = createArm(1)

    this.rifle = new THREE.Group()
    this.rifleBarrel = new THREE.Mesh(
      BOT_GEOMETRY.rifleBarrel,
      this.matLib.metal
    )
    this.rifleBarrel.rotation.x = Math.PI / 2
    this.rifle.add(this.rifleBarrel)
    this.rifleBody = new THREE.Mesh(BOT_GEOMETRY.rifleBody, this.matLib.metalDark)
    this.rifle.add(this.rifleBody)
    this.rifleStock = new THREE.Mesh(BOT_GEOMETRY.rifleStock, this.matLib.wood)
    this.rifle.add(this.rifleStock)
    this.rifleMag = new THREE.Mesh(BOT_GEOMETRY.rifleMag, this.matLib.metalDark)
    this.rifle.add(this.rifleMag)
    this.rifleClip = new THREE.Mesh(BOT_GEOMETRY.rifleMag, this.matLib.brass)
    this.rifle.add(this.rifleClip)
    this.rifleGrip = new THREE.Mesh(BOT_GEOMETRY.rifleGrip, this.matLib.wood)
    this.rifle.add(this.rifleGrip)
    this.rifleMuzzle = new THREE.Object3D()
    this.rifle.add(this.rifleMuzzle)
    this.rifle.position.set(0.22, 0.46, -0.38)
    this.configureRifleModel()
    this.body.add(this.rifle)

    this.matLib.addOutline(this.group, 1.045)
    this.legPhase = Math.random() * Math.PI * 2
    this.animationTime = Math.random() * Math.PI * 2
    this.moveBlend = 0
    this.aimPose = 0
    this.reloadPose = 0
    this.fireKick = 0
    this.deathTime = -1
    this._rifleTarget = new THREE.Vector3()
  }

  configureRifleModel() {
    const { modelId, modelScale } = this.weaponData
    this.rifle.scale.set(...modelScale)
    this.rifleBarrel.position.set(0, 0.02, -0.35)
    this.rifleBarrel.scale.set(1, 1, 1)
    this.rifleBody.position.set(0, 0.01, -0.05)
    this.rifleBody.scale.set(1, 1, 1)
    this.rifleStock.position.set(0, -0.01, 0.22)
    this.rifleStock.scale.set(1, 1, 1)
    this.rifleMag.position.set(0, -0.1, -0.04)
    this.rifleMag.scale.set(1, 1, 1)
    this.rifleMag.visible = false
    this.rifleClip.position.set(0, 0.065, -0.06)
    this.rifleClip.scale.set(0.8, 0.16, 0.72)
    this.rifleClip.visible = false
    this.rifleGrip.position.set(0, -0.11, -0.2)
    this.rifleGrip.rotation.x = -0.2
    this.rifleGrip.visible = false
    this.rifleMuzzle.position.set(0, 0.02, -0.72)

    if (modelId === 'shotgun') {
      this.rifleBarrel.position.z = -0.35
      this.rifleBarrel.scale.set(1.45, 0.85, 1.45)
      this.rifleBody.position.z = -0.06
      this.rifleBody.scale.set(1.2, 1.1, 0.9)
      this.rifleStock.position.z = 0.2
      this.rifleStock.scale.z = 0.82
      this.rifleMag.visible = false
      this.rifleMuzzle.position.z = -0.68
    } else if (modelId === 'thompson') {
      this.rifleBarrel.position.z = -0.2
      this.rifleBarrel.scale.set(1.3, 0.48, 1.3)
      this.rifleBody.position.z = -0.02
      this.rifleBody.scale.set(1.5, 1.45, 0.8)
      this.rifleStock.position.z = 0.16
      this.rifleStock.scale.z = 0.62
      this.rifleMag.position.set(0, -0.13, -0.035)
      this.rifleMag.scale.set(1, 1.3, 0.78)
      this.rifleMag.visible = true
      this.rifleGrip.visible = true
      this.rifleMuzzle.position.z = -0.42
    } else if (modelId === 'bar') {
      this.rifleBarrel.position.z = -0.44
      this.rifleBarrel.scale.set(1.35, 1.25, 1.35)
      this.rifleBody.position.z = -0.08
      this.rifleBody.scale.set(1.3, 1.25, 1.35)
      this.rifleStock.position.z = 0.25
      this.rifleStock.scale.z = 1.15
      this.rifleMag.position.set(0, -0.12, -0.08)
      this.rifleMag.scale.set(1.15, 1.15, 1.05)
      this.rifleMag.visible = true
      this.rifleMuzzle.position.z = -0.9
    }
  }

  getHitboxes() {
    const rotation = this.yaw
    const cos = Math.cos(rotation)
    const sin = Math.sin(rotation)
    const botConfig = this.config.bot
    for (const hitbox of this.hitboxes) {
      hitbox.x = this.position.x
      hitbox.z = this.position.z
      hitbox.rot = rotation
      hitbox.cos = cos
      hitbox.sin = sin
      if (hitbox.headshot) {
        hitbox.minY = this.position.y + botConfig.hitboxHeadMinY
        hitbox.maxY = this.position.y + botConfig.hitboxHeadMaxY
      } else {
        hitbox.minY = this.position.y
        hitbox.maxY = this.position.y + botConfig.hitboxBodyMaxY
      }
    }
    return this.hitboxes
  }

  applyAiState(data, resolveTarget) {
    if (!this.alive) return
    this._aiX = data.x
    this._aiY = data.y
    this._aiZ = data.z
    this._aiVx = data.vx
    this._aiVz = data.vz
    this._aiYaw = data.yaw
    this._aiAt = performance.now()
    this.stateName = data.stateName
    this.target = resolveTarget(data.targetId)
    this.targetVisible = data.targetVisible
    this.reloading = data.reloading
    this.magazine = data.magazine
    this.reserveAmmo = data.reserveAmmo
    this.grenadeCount = data.grenadeCount
    this.itemUses = data.itemUses
    const snapDistance = this.config.match.aiSnapDistance
    const dx = data.x - this.position.x
    const dz = data.z - this.position.z
    if (dx * dx + dz * dz > snapDistance * snapDistance) {
      this.position.set(data.x, data.y, data.z)
      this.velocity.set(data.vx, 0, data.vz)
      this.yaw = data.yaw
      this.group.position.copy(this.position)
      this.group.rotation.y = this.yaw
    }
  }

  applyWorkerItem(health, itemUses) {
    this.health = health
    this.itemUses = itemUses
  }

  applyWorkerResupply(kind) {
    if (kind === 'medical') this.health = this.maxHealth
    else {
      this.reserveAmmo = this.weaponData.reserveAmmo
      this.grenadeCount = this.grenadeData.count
      this.itemUses = this.itemData.uses
    }
  }

  fireFromWorker(targetId) {
    this.target = this.ai.resolveTarget(targetId)
    this.targetVisible = true
    return this.fire()
  }

  throwGrenadeFromWorker(direction) {
    if (!this.alive) return
    const origin = this.position.clone().setY(this.position.y + 1.3)
    this.combat.throwGrenade(
      origin,
      new THREE.Vector3(direction.x, direction.y, direction.z),
      this.grenadeData,
      this.team,
      this
    )
  }

  update(dt) {
    this.advanceFromAi(dt)
    this.spreadBloom = Math.max(
      0,
      this.spreadBloom - dt * this.config.weapon.spreadBloomRecovery
    )
    const turnDifference = this._workerTurnDifference
    this._workerTurnDifference = 0
    this.updateModelAnimation(dt, turnDifference)
  }

  updateModelAnimation(dt, turnDifference = 0) {
    this.animationTime += dt
    if (!this.alive) {
      this.deathTime = Math.max(0, this.deathTime) + dt
      const progress = Math.min(1, this.deathTime / 0.55)
      const eased = 1 - Math.pow(1 - progress, 3)
      this.group.rotation.z = (Math.PI / 2) * eased
      this.group.position.y = this.position.y + 0.04 + (1 - eased) * 0.06
      return
    }

    const speed = Math.hypot(this.velocity.x, this.velocity.z)
    const moveBlendTarget = THREE.MathUtils.clamp(speed / 1.5, 0, 1)
    this.moveBlend +=
      (moveBlendTarget - this.moveBlend) * (1 - Math.exp(-10 * dt))
    if (this.moveBlend > 0.01)
      this.legPhase += dt * (7.5 + Math.min(speed, 6) * 0.65)

    const forwardX = -Math.sin(this.yaw)
    const forwardZ = -Math.cos(this.yaw)
    const rightX = Math.cos(this.yaw)
    const rightZ = -Math.sin(this.yaw)
    const forwardSpeed = this.velocity.x * forwardX + this.velocity.z * forwardZ
    const sideSpeed = this.velocity.x * rightX + this.velocity.z * rightZ
    const forwardSign = forwardSpeed < -0.15 ? -1 : 1
    const stride = Math.sin(this.legPhase) * 0.52 * this.moveBlend * forwardSign
    const sideStride =
      Math.cos(this.legPhase) *
      THREE.MathUtils.clamp(Math.abs(sideSpeed) / Math.max(speed, 0.01), 0, 1) *
      0.1 *
      this.moveBlend
    const legEase = 1 - Math.exp(-16 * dt)
    const leftStep = stride + sideStride
    const rightStep = -stride + sideStride
    const legSpread =
      THREE.MathUtils.clamp(sideSpeed / 5, -1, 1) * 0.06 * this.moveBlend
    this.leftLeg.rotation.x += (leftStep - this.leftLeg.rotation.x) * legEase
    this.rightLeg.rotation.x += (rightStep - this.rightLeg.rotation.x) * legEase
    this.leftLeg.rotation.z += (legSpread - this.leftLeg.rotation.z) * legEase
    this.rightLeg.rotation.z += (legSpread - this.rightLeg.rotation.z) * legEase

    const combatState =
      this.stateName === 'engage' ||
      this.stateName === 'seek_cover' ||
      this.stateName === 'hold_cover' ||
      this.stateName === 'flank'
    let aimTarget = 0
    if (combatState) aimTarget = this.targetVisible ? 1 : 0.58
    this.aimPose += (aimTarget - this.aimPose) * (1 - Math.exp(-7 * dt))
    const reloadTarget = this.reloading ? 1 : 0
    this.reloadPose += (reloadTarget - this.reloadPose) * (1 - Math.exp(-9 * dt))
    const modelId = this.weaponData.modelId
    if (modelId === 'garand') {
      this.rifleClip.visible = this.reloading && this.reloadPose > 0.12
      this.rifleClip.position.y = 0.12 - this.reloadPose * 0.055
    } else {
      this.rifleClip.visible = false
      this.rifleMag.visible =
        modelId !== 'shotgun' && (!this.reloading || this.reloadPose < 0.72)
      this.rifleMag.position.y =
        (modelId === 'thompson' ? -0.13 : -0.1) - this.reloadPose * 0.16
    }
    this.fireKick *= Math.exp(-14 * dt)
    const recoil = this.fireKick * this.fireKick
    const holdPose = this.aimPose * (1 - this.reloadPose * 0.9)

    const breathing = Math.sin(this.animationTime * 1.65) * 0.008
    const stepLift = (1 - Math.cos(this.legPhase * 2)) * 0.005 * this.moveBlend
    const bodyYTarget = 0.78 + breathing + stepLift
    const bodyPitchTarget = THREE.MathUtils.clamp(
      -forwardSpeed * 0.004 - holdPose * 0.008 + recoil * 0.012,
      -0.04,
      0.025
    )
    const bodyRollTarget =
      THREE.MathUtils.clamp(-sideSpeed * 0.004, -0.035, 0.035) +
      Math.sin(this.animationTime * 0.9) * 0.003
    const bodyEase = 1 - Math.exp(-8 * dt)
    this.body.position.y += (bodyYTarget - this.body.position.y) * bodyEase
    this.body.rotation.x += (bodyPitchTarget - this.body.rotation.x) * bodyEase
    this.body.rotation.z += (bodyRollTarget - this.body.rotation.z) * bodyEase
    this.pack.rotation.x += (-bodyPitchTarget * 0.35 - this.pack.rotation.x) * bodyEase

    const carryLeftX = -stride * 0.22 * (1 - holdPose)
    const carryRightX = 1.05 + stride * 0.08 * (1 - holdPose)
    const leftArmX = THREE.MathUtils.lerp(carryLeftX, 1.15, this.aimPose)
    const rightArmX = THREE.MathUtils.lerp(carryRightX, 1.15, this.aimPose)
    const leftArmZ = THREE.MathUtils.lerp(0, 0.5, this.aimPose)
    const rightArmZ = -0.16
    let reloadLeftX = 0.2
    let reloadRightX = 0.38
    let reloadLeftZ = 0.78
    let reloadRightZ = -0.42
    if (modelId === 'shotgun') {
      reloadLeftX = 0.25
      reloadRightX = 0.62
      reloadLeftZ = 0.72
      reloadRightZ = -0.35
    } else if (modelId === 'thompson') {
      reloadLeftX = 0.05
      reloadRightX = 0.65
      reloadLeftZ = 1
      reloadRightZ = -0.55
    } else if (modelId === 'bar') {
      reloadLeftX = -0.1
      reloadRightX = 0.3
      reloadLeftZ = 0.9
      reloadRightZ = -0.2
    }
    const armEase = 1 - Math.exp(-11 * dt)
    this.leftArm.rotation.x +=
      (THREE.MathUtils.lerp(leftArmX, reloadLeftX, this.reloadPose) -
        this.leftArm.rotation.x) *
      armEase
    this.rightArm.rotation.x +=
      (THREE.MathUtils.lerp(rightArmX, reloadRightX, this.reloadPose) -
        this.rightArm.rotation.x) *
      armEase
    this.leftArm.rotation.y +=
      (THREE.MathUtils.lerp(0.04, 0, this.aimPose) - this.leftArm.rotation.y) *
      armEase
    this.rightArm.rotation.y +=
      (THREE.MathUtils.lerp(-0.04, 0, this.aimPose) - this.rightArm.rotation.y) *
      armEase
    this.leftArm.rotation.z +=
      (THREE.MathUtils.lerp(leftArmZ, reloadLeftZ, this.reloadPose) -
        this.leftArm.rotation.z) *
      armEase
    this.rightArm.rotation.z +=
      (THREE.MathUtils.lerp(rightArmZ, reloadRightZ, this.reloadPose) -
        this.rightArm.rotation.z) *
      armEase

    const horizontalTargetDistance = this.target
      ? Math.max(
          0.1,
          Math.hypot(
            this.target.position.x - this.position.x,
            this.target.position.z - this.position.z
          )
        )
      : 20
    const rifleHeight = this.position.y + this.body.position.y + 0.46
    const targetGroundHeight = this.target
      ? this.target.position.y - (this.target.currentHeight ?? 0)
      : 0
    const targetPitch = this.target?.alive
      ? THREE.MathUtils.clamp(
          Math.atan2(
            targetGroundHeight + this.config.bot.targetHeight - rifleHeight,
            horizontalTargetDistance
          ),
          -0.18,
          0.18
        )
      : 0.02
    const carryRifleX = 0.22
    const carryRifleY = 0.46
    const carryRifleZ = -0.38
    const aimRifleX = 0.17
    const aimRifleY = 0.48
    const aimRifleZ = -0.4
    let reloadRifleX = 0.3
    let reloadRifleY = 0.3
    let reloadRifleZ = -0.22
    let reloadPitchOffset = -0.48
    let reloadYawOffset = 0
    let reloadRollOffset = 0.28
    if (modelId === 'shotgun') {
      reloadRifleX = 0.2
      reloadRifleY = 0.32
      reloadRifleZ = -0.16
      reloadPitchOffset = -0.34
      reloadYawOffset = -0.16
      reloadRollOffset = -0.24
    } else if (modelId === 'thompson') {
      reloadRifleX = 0.07
      reloadRifleY = 0.23
      reloadRifleZ = -0.12
      reloadPitchOffset = -0.6
      reloadYawOffset = -0.25
      reloadRollOffset = -0.55
    } else if (modelId === 'bar') {
      reloadRifleX = 0.2
      reloadRifleY = 0.16
      reloadRifleZ = -0.08
      reloadPitchOffset = -0.75
      reloadYawOffset = -0.18
      reloadRollOffset = -0.42
    }
    this._rifleTarget.set(
      THREE.MathUtils.lerp(
        THREE.MathUtils.lerp(carryRifleX, aimRifleX, this.aimPose),
        reloadRifleX,
        this.reloadPose
      ),
      THREE.MathUtils.lerp(
        THREE.MathUtils.lerp(carryRifleY, aimRifleY, this.aimPose),
        reloadRifleY,
        this.reloadPose
      ),
      THREE.MathUtils.lerp(
        THREE.MathUtils.lerp(carryRifleZ, aimRifleZ, this.aimPose),
        reloadRifleZ,
        this.reloadPose
      )
    )
    const rifleEase = 1 - Math.exp(-13 * dt)
    this.rifle.position.lerp(this._rifleTarget, rifleEase)
    this.rifle.position.z += recoil * 0.035
    const riflePitchTarget =
      THREE.MathUtils.lerp(-0.18, targetPitch + 0.02, this.aimPose) +
      this.reloadPose * reloadPitchOffset +
      recoil * 0.06
    const rifleYawTarget =
      THREE.MathUtils.lerp(0.08, 0.015, this.aimPose) +
      this.reloadPose * reloadYawOffset +
      recoil * 0.012
    const rifleRollTarget =
      THREE.MathUtils.lerp(0.06, 0.015, this.aimPose) +
      this.reloadPose * reloadRollOffset
    this.rifle.rotation.x += (riflePitchTarget - this.rifle.rotation.x) * rifleEase
    this.rifle.rotation.y += (rifleYawTarget - this.rifle.rotation.y) * rifleEase
    this.rifle.rotation.z += (rifleRollTarget - this.rifle.rotation.z) * rifleEase

    const headEase = 1 - Math.exp(-9 * dt)
    const headPitchTarget = targetPitch * this.aimPose * 0.3 - bodyPitchTarget * 0.35
    const headYawTarget = THREE.MathUtils.clamp(turnDifference * 0.32, -0.22, 0.22)
    const headRollTarget = -bodyRollTarget * 0.45
    this.head.rotation.x += (headPitchTarget - this.head.rotation.x) * headEase
    this.head.rotation.y += (headYawTarget - this.head.rotation.y) * headEase
    this.head.rotation.z += (headRollTarget - this.head.rotation.z) * headEase

  }

  getSpread() {
    const weaponConfig = this.config.weapon
    let spread = this.weaponData.baseSpread
    const speed = Math.hypot(this.velocity.x, this.velocity.z)
    if (this.targetVisible) spread *= weaponConfig.aimingSpreadMultiplier
    if (speed > weaponConfig.playerMovingThreshold) {
      spread *= weaponConfig.movingSpreadMultiplier
    }
    if (this.reloading) spread *= weaponConfig.reloadingSpreadMultiplier
    spread += this.spreadBloom
    return Math.min(spread, weaponConfig.maxSpread)
  }

  fire() {
    if (this.reloading || !this.target?.alive) return false
    this.fireKick = Math.min(
      1,
      this.fireKick + (this.weaponData.modelId === 'shotgun' ? 1 : 0.72)
    )
    const targetHeight = this.config.bot.targetHeight
    const muzzle = new THREE.Vector3()
    this.rifleMuzzle.getWorldPosition(muzzle)
    const target = this.target.position.clone()
    const targetGroundHeight = this.target.position.y - (this.target.currentHeight ?? 0)
    target.y = targetGroundHeight + targetHeight
    if (this.target.velocity) {
      const distance = Math.hypot(
        target.x - muzzle.x,
        target.z - muzzle.z
      )
      const leadTime = THREE.MathUtils.clamp(
        (distance / 90) * (0.16 + this.botSkill * 0.22),
        0,
        0.28
      )
      target.x += this.target.velocity.x * leadTime
      target.z += this.target.velocity.z * leadTime
    }
    const aimDirection = new THREE.Vector3().subVectors(target, muzzle).normalize()
    const spread = this.getSpread()
    const spreadBloomPerShot = this.targetVisible
      ? this.weaponData.aimedSpreadBloomPerShot
      : this.weaponData.spreadBloomPerShot
    this.spreadBloom = Math.min(
      this.config.weapon.spreadBloomMax,
      this.spreadBloom + spreadBloomPerShot
    )
    const pelletCount = this.weaponData.pellets ?? 1
    for (let pellet = 0; pellet < pelletCount; pellet++) {
      const direction = aimDirection.clone()
      direction.x += (Math.random() - 0.5) * spread * 2
      direction.y += (Math.random() - 0.5) * spread * 2
      direction.z += (Math.random() - 0.5) * spread * 2
      direction.normalize()
      this.combat.fireBullet(muzzle, direction, this.team, this, muzzle, this.weaponData)
    }
    this.effects.spawnMuzzleFlash(muzzle, aimDirection)
    this.audio.botShot(muzzle, this.weaponData.modelId)
    return true
  }

  takeDamage(amount, attacker, isHeadshot = false, attackType = 'weapon') {
    if (!this.alive) return
    this.health -= amount
    this.ai.reportDamage(this, amount, attacker, attackType)
    const hitPosition = this.position.clone().setY(1.2)
    this.audio.hitFlesh(hitPosition)
    if (this.health <= 0) this.die(attacker, isHeadshot, attackType)
    else this.audio.pain(this.config.bot.painChance, hitPosition)
  }

  die(attacker, isHeadshot, attackType = 'weapon') {
    this.alive = false
    this.stateName = 'dead'
    this.deathTime = 0
    this.velocity.set(0, 0, 0)
    this._aiVx = 0
    this._aiVz = 0
    this._aiX = this.position.x
    this._aiY = this.position.y
    this._aiZ = this.position.z
    this._aiYaw = this.yaw
    this.group.rotation.z = 0
    this.group.position.y = this.position.y + 0.1
    const fallPosition = this.position.clone().setY(this.position.y + 0.3)
    this.effects.spawnBlood(this.position.clone().setY(this.position.y + 1.2))
    this.audio.pain(this.config.bot.deathPainChance, fallPosition)
    this.audio.bodyFall(fallPosition)
    this.ai.reportDeath(this)
    this.scoring.recordElimination(this, attacker, isHeadshot, attackType)
    setTimeout(() => this.respawn(), this.mode.getBotRespawnDelay(this) * 1000)
  }

  respawn() {
    if (!this.mode.canRespawn(this)) return
    this.alive = true
    this.randomizeLoadout()
    this.health = this.maxHealth
    this.reloading = false
    this.stateName = 'patrol'
    this.target = null
    this.targetVisible = false
    this.spreadBloom = 0
    this.position.copy(this.getRandomSpawn(this.team))
    this.position.y = this.gameState.groundHeightAt(this.position.x, this.position.z)
    this.velocity.set(0, 0, 0)
    this._aiX = this.position.x
    this._aiY = this.position.y
    this._aiZ = this.position.z
    this._aiVx = 0
    this._aiVz = 0
    this.yaw = Math.random() * Math.PI * 2
    this._aiYaw = this.yaw
    this._aiAt = performance.now()
    this.deathTime = -1
    this.moveBlend = 0
    this.aimPose = 0
    this.reloadPose = 0
    this.fireKick = 0
    this.body.position.y = 0.78
    this.body.rotation.set(0, 0, 0)
    this.head.rotation.set(0, 0, 0)
    this.leftLeg.rotation.set(0, 0, 0)
    this.rightLeg.rotation.set(0, 0, 0)
    this.leftArm.rotation.set(0, 0, 0)
    this.rightArm.rotation.set(0, 0, 0)
    this.rifle.position.set(0.22, 0.46, -0.38)
    this.rifle.rotation.set(0, 0, 0)
    this._workerTurnDifference = 0
    this.group.rotation.set(0, this.yaw, 0)
    this.group.position.copy(this.position)
    this.ai.respawnActor(this)
  }

}
