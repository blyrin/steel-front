import * as THREE from 'three'
import { createBoxHitbox, rayHitObstacle, resolveObstacleCollision } from '../combat/collision.js'
import { attachFlashlight } from './flashlight.js'

const BOT_GEOMETRY = {
  leg: new THREE.BoxGeometry(0.17, 0.72, 0.2),
  boot: new THREE.BoxGeometry(0.16, 0.14, 0.28),
  torso: new THREE.BoxGeometry(0.48, 0.68, 0.28),
  chest: new THREE.BoxGeometry(0.46, 0.28, 0.3),
  belt: new THREE.BoxGeometry(0.5, 0.07, 0.3),
  pouch: new THREE.BoxGeometry(0.1, 0.12, 0.08),
  pack: new THREE.BoxGeometry(0.34, 0.38, 0.16),
  patch: new THREE.BoxGeometry(0.1, 0.16, 0.04),
  stripe: new THREE.BoxGeometry(0.26, 0.07, 0.3),
  sash: new THREE.BoxGeometry(0.1, 0.52, 0.3),
  neck: new THREE.CylinderGeometry(0.07, 0.08, 0.1, 8),
  head: new THREE.BoxGeometry(0.24, 0.26, 0.24),
  allyHelmet: new THREE.SphereGeometry(0.175, 10, 7, 0, Math.PI * 2, 0, Math.PI * 0.55),
  axisHelmet: new THREE.SphereGeometry(0.17, 10, 7, 0, Math.PI * 2, 0, Math.PI * 0.58),
  allyBrim: new THREE.CylinderGeometry(0.2, 0.23, 0.03, 10),
  allyNet: new THREE.BoxGeometry(0.08, 0.04, 0.08),
  axisRear: new THREE.BoxGeometry(0.28, 0.08, 0.16),
  axisSkirt: new THREE.BoxGeometry(0.06, 0.12, 0.18),
  arm: new THREE.BoxGeometry(0.13, 0.58, 0.15),
  hand: new THREE.BoxGeometry(0.1, 0.1, 0.1),
  rifleBarrel: new THREE.CylinderGeometry(0.018, 0.022, 0.72, 8),
  rifleBody: new THREE.BoxGeometry(0.045, 0.05, 0.35),
  rifleStock: new THREE.BoxGeometry(0.055, 0.07, 0.28),
  rifleMag: new THREE.BoxGeometry(0.06, 0.18, 0.11),
  rifleGrip: new THREE.BoxGeometry(0.07, 0.18, 0.08),
  markerPole: new THREE.CylinderGeometry(0.02, 0.02, 0.28, 6),
  markerPlate: new THREE.BoxGeometry(0.22, 0.22, 0.04),
  markerCore: new THREE.BoxGeometry(0.1, 0.1, 0.05),
  markerTriangle: new THREE.ConeGeometry(0.14, 0.22, 3),
  markerDot: new THREE.SphereGeometry(0.045, 6, 4),
}

const BOT_MARKER_MATERIALS = {
  allies: new THREE.MeshBasicMaterial({ color: 0x00c7e6 }),
  axis: new THREE.MeshBasicMaterial({ color: 0xff3f5f }),
  alliesCore: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  axisCore: new THREE.MeshBasicMaterial({ color: 0xffe056 }),
}

export class Bot {
  constructor(team, spawnPosition, services) {
    Object.assign(this, services)
    this.mode = services.mode
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
    this.stateTimer = 0
    this.aiTime = 0
    this.perceptionTimer = Math.random() * botConfig.perceptionInterval
    this.target = null
    this.targetVisible = false
    this.lastSeenTarget = new THREE.Vector3()
    this.lastSeenTime = -Infinity
    this.reloadTimer = 0
    this.fireOpportunityTimer = 0.25 + Math.random() * 0.8
    this.weaponShotTimer = 0
    this.burstShotsRemaining = 0
    this.reloading = false
    this.lastFire = 0
    this.spreadBloom = 0
    this.botSkill = botConfig.skillMin + Math.random() * botConfig.skillRange
    this.randomizeLoadout()
    this.coverPos = null
    this.coverPeekPos = null
    this.coverPeekTimer = 0
    this.isPeeking = false
    this.patrolTarget = this.getRandomPatrolPoint()
    this.reactionTimer = 0
    this.searchPos = null
    this.resupplyStation = null
    this.resupplyKind = null
    this.suppression = 0
    this.stuckTimer = 0
    this.stuckSampleTimer = 0
    this.unstuckTimer = 0
    this.unstuckSign = Math.random() > 0.5 ? 1 : -1
    this.lastPosition = this.position.clone()
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
    this._seeOrigin = new THREE.Vector3()
    this._seeDir = new THREE.Vector3()
    this._seeTarget = new THREE.Vector3()
    this._targetPosition = new THREE.Vector3()
    this._desiredDirection = new THREE.Vector3()
    this._movementProbe = new THREE.Vector3()
    this._movementBest = new THREE.Vector3()
    this._separation = new THREE.Vector3()
    this._forwardDirection = new THREE.Vector3()
    this.name = this.generateName()
    this.buildModel()
    this.scene.add(this.group)
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
    this.fireDelay = this.weaponData.fireDelay
    this.baseSpread = this.weaponData.botBaseSpread
    this.grenadeCount = this.grenadeData.count
    this.itemUses = this.itemData.uses || 0
    this.nextSupplyAt = 0
    this.grenadeCooldown =
      this.config.grenade.aiCooldownMin +
      Math.random() * this.config.grenade.aiCooldownRange
    this.role = this.selectRole()
    if (this.rifle) this.configureRifleModel()
  }

  selectRole() {
    if (this.weaponData.modelId === 'shotgun') return 'assault'
    if (this.weaponData.modelId === 'thompson') return 'assault'
    if (this.weaponData.modelId === 'bar') return 'support'
    if (this.weaponData.modelId === 'garand' && this.botSkill > 0.42) return 'marksman'
    return 'rifleman'
  }

  setState(stateName) {
    if (this.stateName === stateName) return
    this.stateName = stateName
    this.stateTimer = 0
    if (stateName !== 'hold_cover') this.isPeeking = false
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
    const accent = isAlly ? this.matLib.allyAccent : this.matLib.axisAccent
    const markerMat = isAlly ? BOT_MARKER_MATERIALS.allies : BOT_MARKER_MATERIALS.axis
    const markerCoreMat = isAlly ? BOT_MARKER_MATERIALS.alliesCore : BOT_MARKER_MATERIALS.axisCore
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
    const chest = new THREE.Mesh(BOT_GEOMETRY.chest, uniform)
    chest.position.set(0, 0.57, 0.02)
    chest.castShadow = false
    this.body.add(chest)
    const belt = new THREE.Mesh(BOT_GEOMETRY.belt, bootMat)
    belt.position.set(0, 0.08, 0)
    this.body.add(belt)
    for (const side of [-1, 1]) {
      const pouch = new THREE.Mesh(BOT_GEOMETRY.pouch, this.matLib.wood)
      pouch.position.set(side * 0.16, 0.08, 0.16)
      this.body.add(pouch)
    }

    const pack = new THREE.Mesh(BOT_GEOMETRY.pack, uniform)
    pack.position.set(0, 0.44, 0.2)
    pack.castShadow = true
    this.body.add(pack)
    this.pack = pack

    const patchLeft = new THREE.Mesh(BOT_GEOMETRY.patch, accent)
    patchLeft.position.set(-0.26, 0.56, 0)
    this.body.add(patchLeft)
    const patchRight = new THREE.Mesh(BOT_GEOMETRY.patch, accent)
    patchRight.position.set(0.26, 0.56, 0)
    this.body.add(patchRight)
    if (isAlly) {
      const stripe = new THREE.Mesh(BOT_GEOMETRY.stripe, accent)
      stripe.position.set(0, 0.5, 0)
      this.body.add(stripe)
    } else {
      const sash = new THREE.Mesh(BOT_GEOMETRY.sash, accent)
      sash.position.set(0.08, 0.4, 0)
      sash.rotation.z = 0.45
      this.body.add(sash)
    }

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
      const net = new THREE.Mesh(BOT_GEOMETRY.allyNet, this.matLib.allyAccent)
      net.position.set(0, 0.38, 0)
      this.head.add(net)
    } else {
      const dome = new THREE.Mesh(
        BOT_GEOMETRY.axisHelmet,
        helmetMat
      )
      dome.position.set(0, 0.28, 0)
      dome.scale.set(1.08, 0.92, 1.18)
      dome.castShadow = true
      this.head.add(dome)
      const rear = new THREE.Mesh(BOT_GEOMETRY.axisRear, helmetMat)
      rear.position.set(0, 0.2, 0.12)
      this.head.add(rear)
      for (const side of [-1, 1]) {
        const skirt = new THREE.Mesh(BOT_GEOMETRY.axisSkirt, helmetMat)
        skirt.position.set(side * 0.16, 0.2, 0.02)
        this.head.add(skirt)
      }
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

    this.marker = new THREE.Group()
    const pole = new THREE.Mesh(
      BOT_GEOMETRY.markerPole,
      markerMat
    )
    pole.position.y = 0.1
    this.marker.add(pole)
    if (isAlly) {
      const plate = new THREE.Mesh(
        BOT_GEOMETRY.markerPlate,
        markerMat
      )
      plate.position.y = 0.32
      plate.rotation.z = Math.PI / 4
      this.marker.add(plate)
      const core = new THREE.Mesh(
        BOT_GEOMETRY.markerCore,
        markerCoreMat
      )
      core.position.y = 0.32
      core.rotation.z = Math.PI / 4
      this.marker.add(core)
    } else {
      const triangle = new THREE.Mesh(
        BOT_GEOMETRY.markerTriangle,
        markerMat
      )
      triangle.position.y = 0.34
      triangle.rotation.y = Math.PI / 6
      this.marker.add(triangle)
      const core = new THREE.Mesh(
        BOT_GEOMETRY.markerDot,
        markerCoreMat
      )
      core.position.y = 0.3
      this.marker.add(core)
    }
    this.marker.position.set(0, 2.06, 0)
    this.marker.scale.setScalar(1.15)
    this.group.add(this.marker)
    if (this.mode?.id === 'zombie') {
      attachFlashlight(
        this.group,
        new THREE.Vector3(0.18, 1.18, -0.38),
        new THREE.Vector3(0.18, 1.12, -18)
      )
    }
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

  getRandomPatrolPoint() {
    return this.mode.getPatrolPoint(this)
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

  getGroundHeight(actor) {
    return actor.position.y - (actor.currentHeight ?? 0)
  }

  hasLineOfSight(origin, point) {
    const direction = this._seeDir.subVectors(point, origin)
    const distance = direction.length()
    if (distance < 1e-6) return true
    direction.multiplyScalar(1 / distance)
    for (const smoke of this.gameState.smokeClouds) {
      const toSmokeX = smoke.position.x - origin.x
      const toSmokeY = smoke.position.y - origin.y
      const toSmokeZ = smoke.position.z - origin.z
      const along = THREE.MathUtils.clamp(
        toSmokeX * direction.x + toSmokeY * direction.y + toSmokeZ * direction.z,
        0,
        distance
      )
      const closestX = origin.x + direction.x * along
      const closestY = origin.y + direction.y * along
      const closestZ = origin.z + direction.z * along
      if (
        Math.hypot(
          smoke.position.x - closestX,
          smoke.position.y - closestY,
          smoke.position.z - closestZ
        ) < smoke.radius
      )
        return false
    }
    for (const obstacle of this.gameState.obstacles) {
      if (obstacle.type === 'ground' || obstacle.type === 'crater' || obstacle.type === 'wire')
        continue
      if (rayHitObstacle(origin, direction, obstacle, distance) != null) return false
    }
    return true
  }

  canSee(target) {
    if (!target?.alive) return false
    const dx = target.position.x - this.position.x
    const dz = target.position.z - this.position.z
    const distance = Math.hypot(dx, dz)
    if (distance > this.config.bot.viewDistance) return false
    if (distance > 1e-6) {
      const inv = 1 / distance
      const dirX = dx * inv
      const dirZ = dz * inv
      const forwardX = -Math.sin(this.yaw)
      const forwardZ = -Math.cos(this.yaw)
      const isPlayer = target === this.gameState.player
      const forwardThreshold = isPlayer
        ? -0.18
        : this.config.bot.viewForwardThreshold
      const forwardMinDistance = isPlayer
        ? Math.max(this.config.bot.viewForwardMinDistance, 16)
        : this.config.bot.viewForwardMinDistance
      if (
        forwardX * dirX + forwardZ * dirZ < forwardThreshold &&
        distance > forwardMinDistance
      )
        return false
    }
    const origin = this._seeOrigin.set(
      this.position.x,
      this.position.y + this.config.bot.viewOriginHeight,
      this.position.z
    )
    const targetGroundY = this.getGroundHeight(target)
    const point = this._seeTarget.set(
      target.position.x,
      targetGroundY + this.config.bot.targetHeight,
      target.position.z
    )
    return this.hasLineOfSight(origin, point)
  }

  getKnownTargetPosition(target = this.target) {
    if (!target?.alive) return null
    const source = this.targetVisible ? target.position : this.lastSeenTarget
    this._targetPosition.set(
      source.x,
      source.y - (target.currentHeight ?? 0),
      source.z
    )
    return this._targetPosition
  }

  getTargetScore(target, distance, visible) {
    const botConfig = this.config.bot
    const idealRange = Math.max(8, this.weaponData.effectiveRange * botConfig.idealRangeMultiplier)
    let score = (botConfig.viewDistance - distance) * 0.16
    score -= Math.abs(distance - idealRange) * 0.12
    if (visible) score += 40
    if (target.target === this) score += 24
    if (target.target?.team === this.team) score += 9
    if (target === this.gameState.player) score += 12
    if (target.actorKind === 'zombie') {
      const fortress = this.mode.getFortress?.()
      if (fortress) {
        const fortressDistance = Math.hypot(
          target.position.x - fortress.position.x,
          target.position.z - fortress.position.z
        )
        score += Math.max(0, 40 - fortressDistance) * 0.42
      }
    }
    if (target.health < target.maxHealth * 0.35) score += 3
    return score
  }

  selectTarget() {
    const botConfig = this.config.bot
    const candidates = []
    for (const actor of this.mode.getHostileActors(this.team)) {
      if (!actor.alive) continue
      const distance = Math.hypot(
        actor.position.x - this.position.x,
        actor.position.z - this.position.z
      )
      if (distance > botConfig.viewDistance) continue
      let score = this.getTargetScore(actor, distance, false)
      if (actor === this.target) score += 12
      candidates.push({ actor, distance, score })
    }
    candidates.sort((a, b) => b.score - a.score)

    let best = null
    let bestScore = -Infinity
    const limit = Math.min(candidates.length, botConfig.maxPerceptionTargets)
    const perceptionCandidates = candidates.slice(0, limit)
    const playerCandidate = candidates.find(
      candidate => candidate.actor === this.gameState.player
    )
    if (playerCandidate && !perceptionCandidates.includes(playerCandidate))
      perceptionCandidates.push(playerCandidate)
    for (const candidate of perceptionCandidates) {
      if (!this.canSee(candidate.actor)) continue
      const score = this.getTargetScore(candidate.actor, candidate.distance, true)
      if (score > bestScore) {
        bestScore = score
        best = candidate.actor
      }
    }
    if (best) return { target: best, visible: true, position: best.position, seenAt: this.aiTime }

    const player = this.gameState.player
    const playerShot = this.gameState.lastPlayerShot
    if (player?.alive && player.team !== this.team && playerShot) {
      const age = (performance.now() - playerShot.at) / 1000
      const distance = Math.hypot(
        playerShot.x - this.position.x,
        playerShot.z - this.position.z
      )
      if (
        age <= botConfig.playerShotMemory &&
        distance <= botConfig.playerShotHearingDistance
      )
        return {
          target: player,
          visible: false,
          position: playerShot,
          seenAt: this.aiTime,
        }
    }

    let shared = null
    let sharedScore = -Infinity
    for (const ally of this.gameState.actors) {
      if (
        ally === this ||
        !ally.alive ||
        ally.team !== this.team ||
        !ally.target?.alive ||
        ally.target.team === this.team ||
        !ally.lastSeenTarget
      )
        continue
      const allyDistance = Math.hypot(
        ally.position.x - this.position.x,
        ally.position.z - this.position.z
      )
      if (allyDistance > botConfig.communicationRadius) continue
      const age = this.aiTime - ally.lastSeenTime
      if (age > botConfig.sharedContactMemory) continue
      const target = ally.target
      const targetDistance = Math.hypot(
        target.position.x - this.position.x,
        target.position.z - this.position.z
      )
      const score = this.getTargetScore(target, targetDistance, false) - age * 5
      if (score > sharedScore) {
        sharedScore = score
        shared = {
          target,
          visible: false,
          position: ally.lastSeenTarget,
          seenAt: ally.lastSeenTime,
        }
      }
    }
    if (shared) return shared

    if (this.target?.alive && this.aiTime - this.lastSeenTime <= botConfig.lostTargetTime) {
      return {
        target: this.target,
        visible: false,
        position: this.lastSeenTarget,
        seenAt: this.lastSeenTime,
      }
    }
    return null
  }

  updatePerception(dt) {
    const botConfig = this.config.bot
    this.perceptionTimer -= dt
    if (this.perceptionTimer > 0) return
    this.perceptionTimer = botConfig.perceptionInterval * (0.85 + Math.random() * 0.3)
    const observation = this.selectTarget()
    if (!observation) {
      this.targetVisible = false
      this.burstShotsRemaining = 0
      if (this.target && (!this.target.alive || this.aiTime - this.lastSeenTime > botConfig.lostTargetTime)) {
        this.searchPos = this.lastSeenTarget.clone()
        this.target = null
        if (this.stateName !== 'resupply') this.setState('alert')
      }
      return
    }

    if (this.target !== observation.target) {
      this.target = observation.target
      this.reactionTimer = botConfig.reactionTime * (1.5 - this.botSkill)
      this.fireOpportunityTimer = this.reactionTimer + 0.18 + Math.random() * 0.42
      this.burstShotsRemaining = 0
      this.coverPos = null
      this.coverPeekPos = null
    }
    this.targetVisible = observation.visible
    if (observation.visible) {
      this.lastSeenTarget.copy(observation.target.position)
      this.lastSeenTime = this.aiTime
      if (this.reactionTimer <= 0 && this.stateName !== 'hold_cover' && this.stateName !== 'seek_cover')
        this.setState('engage')
    } else {
      this.lastSeenTarget.copy(observation.position)
      this.lastSeenTime = observation.seenAt
      if (this.stateName === 'patrol' || this.stateName === 'alert') {
        this.searchPos = this.lastSeenTarget.clone()
        this.setState('alert')
      }
    }
  }

  findCover() {
    const targetPosition = this.getKnownTargetPosition()
    if (!targetPosition) return null
    const botConfig = this.config.bot
    const targetOrigin = this._seeOrigin.set(
      targetPosition.x,
      targetPosition.y + botConfig.viewOriginHeight,
      targetPosition.z
    )
    let best = null
    let bestScore = -Infinity
    for (const cover of this.gameState.coverPoints) {
      if (cover.type === 'fortress' && this.position.y < 1.5) continue
      const distanceToCover = Math.hypot(cover.x - this.position.x, cover.z - this.position.z)
      if (distanceToCover > botConfig.coverSearchDistance) continue
      const awayX = cover.x - targetPosition.x
      const awayZ = cover.z - targetPosition.z
      const awayDistance = Math.hypot(awayX, awayZ)
      if (awayDistance < 1e-6) continue
      const awayXNormalized = awayX / awayDistance
      const awayZNormalized = awayZ / awayDistance
      const standDistance = Math.max(
        (cover.r || 1) + this.radius + botConfig.coverStandOff,
        1.4
      )
      const standX = cover.x + awayXNormalized * standDistance
      const standZ = cover.z + awayZNormalized * standDistance
      const standY = this.gameState.groundHeightAt(standX, standZ)
      const standPosition = new THREE.Vector3(standX, standY, standZ)
      const standAim = new THREE.Vector3(
        standX,
        standY + botConfig.targetHeight,
        standZ
      )
      const isProtected = !this.hasLineOfSight(targetOrigin, standAim)
      let peekPosition = null
      let peekVisible = false
      const awayAngle = Math.atan2(awayZNormalized, awayXNormalized)
      const peekDistance = Math.max(
        (cover.r || 1) + this.radius + botConfig.coverPeekOffset,
        1.6
      )
      for (const side of [-1, 1]) {
        const angle = awayAngle + side * 0.82
        const peekX = cover.x + Math.cos(angle) * peekDistance
        const peekZ = cover.z + Math.sin(angle) * peekDistance
        const peekY = this.gameState.groundHeightAt(peekX, peekZ)
        const candidate = new THREE.Vector3(
          peekX,
          peekY + botConfig.targetHeight,
          peekZ
        )
        if (this.hasLineOfSight(targetOrigin, candidate)) {
          peekPosition = new THREE.Vector3(peekX, peekY, peekZ)
          peekVisible = true
          break
        }
      }
      if (!isProtected && !peekVisible) continue
      const coverToEnemy = Math.hypot(
        targetPosition.x - cover.x,
        targetPosition.z - cover.z
      )
      let score = isProtected ? 34 : -18
      if (peekVisible) score += 18
      score +=
        (this.position.distanceTo(targetPosition) - coverToEnemy) * botConfig.coverEnemyWeight
      score +=
        (botConfig.coverDistanceBias - distanceToCover) * botConfig.coverDistanceWeight
      if (cover.type === 'sandbag' || cover.type === 'barricade') score += 5
      if (this.role === 'support') score += Math.min(8, coverToEnemy * 0.08)
      if (score > bestScore) {
        bestScore = score
        best = {
          position: standPosition,
          peekPosition: peekPosition || standPosition.clone(),
        }
      }
    }
    return best
  }

  useItem() {
    if (this.itemUses <= 0) return false
    if (this.itemData.kind === 'heal') {
      if (this.health >= this.maxHealth) return false
      this.health = Math.min(this.maxHealth, this.health + this.itemData.amount)
    } else {
      if (this.reserveAmmo >= this.weaponData.reserveAmmo) return false
      this.reserveAmmo = this.weaponData.reserveAmmo
    }
    this.itemUses--
    return true
  }

  findNearestStation(stations) {
    let nearest = null
    let nearestDistance = Infinity
    for (const station of stations) {
      const stationDistance = Math.hypot(
        station.position.x - this.position.x,
        station.position.z - this.position.z
      )
      if (stationDistance < nearestDistance) {
        nearestDistance = stationDistance
        nearest = station
      }
    }
    return nearest
  }

  findNearestAmmoStation() {
    return this.findNearestStation(this.gameState.ammoStations)
  }

  findResupplyTarget() {
    if (performance.now() < this.nextSupplyAt) return null
    const botConfig = this.config.bot
    if (this.health <= botConfig.resupplyHealthThreshold) {
      const station = this.findNearestStation(this.gameState.medicalStations)
      if (station) return { station, kind: 'medical' }
    }
    const totalAmmo = this.magazine + this.reserveAmmo
    const maxAmmo = this.weaponData.magazineSize + this.weaponData.reserveAmmo
    if (totalAmmo / maxAmmo <= botConfig.resupplyAmmoRatio) {
      const station = this.findNearestAmmoStation()
      if (station) return { station, kind: 'ammo' }
    }
    return null
  }

  updateResupply() {
    const station = this.resupplyStation
    if (!station) {
      this.setState('patrol')
      this.resupplyKind = null
      return
    }
    this.moveToward(station.position, this.config.bot.engageFarSpeed)
    if (
      Math.hypot(station.position.x - this.position.x, station.position.z - this.position.z) <
      this.config.supply.aiArrivalDistance
    ) {
      if (this.resupplyKind === 'medical') {
        this.health = this.maxHealth
      } else {
        this.reserveAmmo = this.weaponData.reserveAmmo
      }
      this.nextSupplyAt = performance.now() + this.config.supply.cooldown * 1000
      this.resupplyStation = null
      this.resupplyKind = null
      this.setState('patrol')
      this.patrolTarget = this.getRandomPatrolPoint()
    }
  }

  tryThrowGrenade(dt) {
    if (
      this.grenadeCount <= 0 ||
      this.grenadeCooldown > 0 ||
      !this.target?.alive ||
      !this.targetVisible
    )
      return
    const distance = Math.hypot(
      this.target.position.x - this.position.x,
      this.target.position.z - this.position.z
    )
    if (
      distance < this.config.grenade.aiMinDistance ||
      distance > this.config.grenade.aiMaxDistance
    )
      return
    const hostileActors = this.mode.getHostileActors(this.team)
    let clusteredTargets = 0
    for (const actor of hostileActors) {
      if (
        actor.alive &&
        Math.hypot(
          actor.position.x - this.target.position.x,
          actor.position.z - this.target.position.z
        ) < this.grenadeData.radius * 0.65
      )
        clusteredTargets++
    }
    const isSmoke = this.grenadeData.kind === 'smoke'
    if (
      isSmoke &&
      this.health > this.config.bot.lowHealthThreshold &&
      this.suppression <= 0.45 &&
      this.stateName !== 'seek_cover'
    )
      return
    const throwChance =
      this.config.grenade.aiThrowChancePerSecond *
      (clusteredTargets > 1 && !isSmoke ? 2.2 : 1)
    if (Math.random() >= throwChance * dt) return
    const origin = this.position.clone().setY(this.position.y + 1.3)
    const direction = new THREE.Vector3().subVectors(this.target.position, origin)
    direction.y = Math.max(0.12, direction.y + 0.16)
    direction.normalize()
    this.grenadeCount--
    this.combat.throwGrenade(origin, direction, this.grenadeData, this.team, this)
    this.grenadeCooldown =
      this.config.grenade.aiCooldownMin +
      Math.random() * this.config.grenade.aiCooldownRange
  }

  countNearbyHostiles(radius) {
    let count = 0
    const radiusSq = radius * radius
    for (const actor of this.mode.getHostileActors(this.team)) {
      const dx = actor.position.x - this.position.x
      const dz = actor.position.z - this.position.z
      if (actor.alive && dx * dx + dz * dz <= radiusSq) count++
    }
    return count
  }

  countNearbyAllies(radius) {
    let count = 0
    const radiusSq = radius * radius
    for (const actor of this.gameState.actors) {
      if (!actor.alive || actor === this || actor.team !== this.team) continue
      const dx = actor.position.x - this.position.x
      const dz = actor.position.z - this.position.z
      if (dx * dx + dz * dz <= radiusSq) count++
    }
    const player = this.gameState.player
    if (player?.alive && player.team === this.team) {
      const dx = player.position.x - this.position.x
      const dz = player.position.z - this.position.z
      if (dx * dx + dz * dz <= radiusSq) count++
    }
    return count
  }

  isOutnumbered() {
    const enemies = this.countNearbyHostiles(18)
    const allies = this.countNearbyAllies(18) + 1
    return enemies >= 2 && enemies > allies * this.config.bot.outnumberedRatio
  }

  updateAlert() {
    if (!this.searchPos) {
      this.setState('patrol')
      return
    }
    this.moveToward(this.searchPos, this.config.bot.alertSpeed)
    if (
      Math.hypot(this.searchPos.x - this.position.x, this.searchPos.z - this.position.z) <
      this.config.bot.alertArrivalDistance
    ) {
      this.velocity.set(0, 0, 0)
      if (this.stateTimer > 0.85) {
        this.searchPos = null
        this.setState('patrol')
        this.patrolTarget = this.getRandomPatrolPoint()
      }
    }
  }

  isDirectionBlocked(direction) {
    const origin = this._seeOrigin.set(
      this.position.x,
      this.position.y + 0.72,
      this.position.z
    )
    const lookAhead = this.config.bot.movementLookAhead
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
    const probeAngle = this.config.bot.movementProbeAngle
    const unstuckOffset = this.unstuckTimer > 0 ? this.unstuckSign * 1.05 : 0
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
    const minDistance = this.config.bot.separationDistance
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
    const player = this.gameState.player
    if (player?.alive && player.team === this.team) {
      const dx = this.position.x - player.position.x
      const dz = this.position.z - player.position.z
      const distanceSq = dx * dx + dz * dz
      if (distanceSq > 1e-8 && distanceSq < minDistanceSq) {
        const distance = Math.sqrt(distanceSq)
        const strength = 1 - distance / minDistance
        this._separation.x += (dx / distance) * strength
        this._separation.z += (dz / distance) * strength
      }
    }
    if (this._separation.lengthSq() > 1e-8) {
      direction.addScaledVector(this._separation, this.config.bot.separationWeight)
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
    this.velocity.x = movement.x * speed
    this.velocity.z = movement.z * speed
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
      moved < this.config.bot.stuckDistance
    )
      this.stuckTimer += this.stuckSampleTimer
    else this.stuckTimer = Math.max(0, this.stuckTimer - this.stuckSampleTimer * 1.5)
    if (this.stuckTimer > this.config.bot.stuckTimeout) {
      this.unstuckTimer = 1.05
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
    const botConfig = this.config.bot
    this.aiTime += dt
    this.stateTimer += dt
    this.fireOpportunityTimer -= dt
    this.weaponShotTimer -= dt
    this.grenadeCooldown = Math.max(0, this.grenadeCooldown - dt)
    this.unstuckTimer = Math.max(0, this.unstuckTimer - dt)
    this.suppression = Math.max(0, this.suppression - dt * botConfig.suppressionRecovery)
    this.spreadBloom = Math.max(
      0,
      this.spreadBloom - dt * this.config.weapon.spreadBloomRecovery
    )
    if (this.reactionTimer > 0) this.reactionTimer = Math.max(0, this.reactionTimer - dt)
    if (this.health < botConfig.lowHealthThreshold) this.useItem()

    if (this.magazine === 0 && this.reserveAmmo === 0 && !this.reloading) {
      if (!this.useItem() && this.stateName !== 'resupply') {
        const supply = this.findResupplyTarget()
        if (supply) {
          this.resupplyStation = supply.station
          this.resupplyKind = supply.kind
        }
        this.setState('resupply')
      }
    }
    if (this.stateName !== 'resupply') this.updatePerception(dt)
    if (
      this.stateName !== 'resupply' &&
      !this.targetVisible &&
      (this.stateName === 'patrol' || this.stateName === 'alert')
    ) {
      const supply = this.findResupplyTarget()
      if (supply) {
        this.resupplyStation = supply.station
        this.resupplyKind = supply.kind
        this.setState('resupply')
      }
    }

    switch (this.stateName) {
      case 'patrol':
        if (
          Math.hypot(
            this.position.x - this.patrolTarget.x,
            this.position.z - this.patrolTarget.z
          ) < botConfig.patrolArrivalDistance
        )
          this.patrolTarget = this.getRandomPatrolPoint()
        this.moveToward(this.patrolTarget, botConfig.patrolSpeed)
        break
      case 'alert':
        this.updateAlert()
        break
      case 'engage':
        this.updateEngage(dt)
        break
      case 'seek_cover':
        this.updateSeekCover()
        break
      case 'hold_cover':
        this.updateHoldCover(dt)
        break
      case 'flank':
        this.updateFlank()
        break
      case 'resupply':
        this.updateResupply()
        break
      default:
        this.velocity.set(0, 0, 0)
        break
    }

    if (this.magazine === 0 && this.reserveAmmo > 0 && !this.reloading)
      this.startReload(true)
    if (this.reloading) {
      this.reloadTimer += dt
      if (this.reloadTimer > this.reloadDuration) {
        const amount = Math.min(
          this.weaponData.magazineSize - this.magazine,
          this.reserveAmmo
        )
        this.magazine += amount
        this.reserveAmmo -= amount
        this.reloading = false
        this.reloadTimer = 0
      }
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
    const facingTarget =
      this.target?.alive &&
      (this.stateName === 'engage' ||
        this.stateName === 'seek_cover' ||
        this.stateName === 'hold_cover' ||
        this.stateName === 'flank')
    if (facingTarget) {
      const target = this.targetVisible ? this.target.position : this.lastSeenTarget
      targetYaw = Math.atan2(
        -(target.x - this.position.x),
        -(target.z - this.position.z)
      )
    } else if (this.stateName === 'alert' && this.searchPos) {
      targetYaw = Math.atan2(
        -(this.searchPos.x - this.position.x),
        -(this.searchPos.z - this.position.z)
      )
    } else if (this.velocity.lengthSq() > botConfig.stationarySpeedThreshold ** 2) {
      targetYaw = Math.atan2(-this.velocity.x, -this.velocity.z)
    }
    let difference = targetYaw - this.yaw
    while (difference > Math.PI) difference -= Math.PI * 2
    while (difference < -Math.PI) difference += Math.PI * 2
    this.yaw += difference * Math.min(1, dt * botConfig.turnSpeed)
    this.group.rotation.y = this.yaw
    const cameraDeltaX = this.camera.position.x - this.position.x
    const cameraDeltaZ = this.camera.position.z - this.position.z
    this.marker.rotation.y = Math.atan2(cameraDeltaX, cameraDeltaZ) - this.yaw
    this.updateModelAnimation(dt, difference)
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

    const markerY = 2.06 + Math.sin(this.animationTime * 2.1) * 0.025
    this.marker.position.y += (markerY - this.marker.position.y) * (1 - Math.exp(-8 * dt))
  }

  getFirePause() {
    let roleOffset = 0
    if (this.role === 'marksman') roleOffset = 0.24
    else if (this.role === 'support') roleOffset = 0.1
    return Math.max(
      this.fireDelay * 1.5,
      this.config.bot.engageFireBaseDelay +
        (1 - this.botSkill) * this.config.bot.engageFireSkillDelay +
        roleOffset +
        Math.random() * 0.45
    )
  }

  updateFireOpportunity() {
    if (
      !this.target?.alive ||
      !this.targetVisible ||
      this.reactionTimer > 0 ||
      this.reloading
    ) {
      this.burstShotsRemaining = 0
      return
    }
    const targetPosition = this.getKnownTargetPosition()
    const distance = targetPosition
      ? Math.hypot(
          targetPosition.x - this.position.x,
          targetPosition.z - this.position.z
        )
      : Infinity
    if (distance > this.weaponData.effectiveRange * 1.3) {
      this.burstShotsRemaining = 0
      this.fireOpportunityTimer = Math.max(this.fireOpportunityTimer, 0.25)
      return
    }
    if (this.burstShotsRemaining > 0) {
      if (this.weaponShotTimer > 0) return
      if (this.fire()) {
        this.burstShotsRemaining--
        this.weaponShotTimer = this.fireDelay
        if (this.burstShotsRemaining <= 0)
          this.fireOpportunityTimer = this.getFirePause()
      } else {
        this.burstShotsRemaining = 0
      }
      return
    }
    if (this.fireOpportunityTimer > 0) return
    this.burstShotsRemaining = this.weaponData.automatic
      ? Math.max(2, Math.round(2 + this.botSkill * 3))
      : 1
    if (this.fire()) {
      this.burstShotsRemaining--
      this.weaponShotTimer = this.fireDelay
      if (this.burstShotsRemaining <= 0)
        this.fireOpportunityTimer = this.getFirePause()
    } else {
      this.burstShotsRemaining = 0
      this.fireOpportunityTimer = 0.2
    }
  }

  updateEngage(dt) {
    if (!this.target?.alive) {
      this.target = null
      this.setState('patrol')
      return
    }
    const targetPosition = this.getKnownTargetPosition()
    if (!targetPosition) {
      this.setState('patrol')
      return
    }
    const botConfig = this.config.bot
    const distance = Math.hypot(
      targetPosition.x - this.position.x,
      targetPosition.z - this.position.z
    )
    this.tryThrowGrenade(dt)
    const needsCover =
      this.health < botConfig.lowHealthThreshold ||
      this.suppression > 0.62 ||
      this.isOutnumbered()
    if (
      needsCover &&
      (!this.coverPos || this.stateTimer > botConfig.coverRefreshInterval)
    ) {
      const cover = this.findCover()
      if (cover) {
        this.coverPos = cover.position
        this.coverPeekPos = cover.peekPosition
        this.coverPeekTimer =
          botConfig.coverPeekIntervalMin +
          Math.random() * botConfig.coverPeekIntervalRange
        this.isPeeking = false
        this.setState('seek_cover')
        return
      }
    }
    if (!this.targetVisible) {
      this.searchPos = targetPosition.clone()
      this.setState('alert')
      return
    }

    const desiredRange = THREE.MathUtils.clamp(
      this.weaponData.effectiveRange * botConfig.idealRangeMultiplier,
      12,
      botConfig.engageFarDistance - 2
    )
    const closeRange =
      this.role === 'assault' ? botConfig.engageCloseDistance * 0.65 : botConfig.engageCloseDistance
    if (distance > Math.min(botConfig.engageFarDistance, desiredRange + 10)) {
      this.moveToward(targetPosition, botConfig.engageFarSpeed)
    } else if (distance < closeRange) {
      const away = this._desiredDirection
        .set(this.position.x - targetPosition.x, 0, this.position.z - targetPosition.z)
      if (away.lengthSq() < 1e-8) away.set(Math.cos(this.yaw), 0, Math.sin(this.yaw))
      this.moveWithDirection(away, botConfig.engageCloseSpeed)
    } else {
      const deltaX = targetPosition.x - this.position.x
      const deltaZ = targetPosition.z - this.position.z
      const sideDirection =
        Math.sin(this.stateTimer * botConfig.engageStrafeFrequency) > 0 ? 1 : -1
      const direction = this._desiredDirection.set(
        -deltaZ * sideDirection,
        0,
        deltaX * sideDirection
      )
      const rangeError = distance - desiredRange
      if (rangeError > 3) {
        direction.x += deltaX * 0.32
        direction.z += deltaZ * 0.32
      } else if (rangeError < -3) {
        direction.x -= deltaX * 0.32
        direction.z -= deltaZ * 0.32
      }
      this.moveWithDirection(direction, botConfig.engageStrafeSpeed)
    }
    if (
      botConfig.tacticalReloadThreshold > 0 &&
      this.magazine / this.weaponData.magazineSize <= botConfig.tacticalReloadThreshold &&
      this.reserveAmmo > 0 &&
      this.suppression < 0.25 &&
      !this.reloading &&
      distance > botConfig.engageCloseDistance * 1.4
    )
      this.startReload(false)
    this.updateFireOpportunity()
    if (
      this.stateTimer > 2 &&
      Math.random() < botConfig.seekCoverFlankChance * dt * 0.22 &&
      !needsCover
    ) {
      this.flankDir = Math.random() > 0.5 ? 1 : -1
      this.setState('flank')
    }
  }

  updateSeekCover() {
    if (!this.coverPos) {
      this.setState('engage')
      return
    }
    this.moveToward(this.coverPos, this.config.bot.engageFarSpeed)
    this.updateFireOpportunity()
    if (
      Math.hypot(
        this.coverPos.x - this.position.x,
        this.coverPos.z - this.position.z
      ) < this.config.bot.seekCoverArrivalDistance
    ) {
      this.velocity.set(0, 0, 0)
      this.isPeeking = false
      this.coverPeekTimer =
        this.config.bot.coverPeekIntervalMin +
        Math.random() * this.config.bot.coverPeekIntervalRange
      this.setState('hold_cover')
    }
  }

  updateHoldCover(dt) {
    if (!this.target?.alive || !this.coverPos) {
      this.coverPos = null
      this.coverPeekPos = null
      this.setState('engage')
      return
    }
    if (!this.isPeeking) {
      this.velocity.set(0, 0, 0)
      this.updateFireOpportunity()
      this.coverPeekTimer -= dt
      if (this.coverPeekTimer <= 0) {
        this.isPeeking = true
        this.stateTimer = 0
      }
      return
    }

    this.moveToward(this.coverPeekPos || this.coverPos, this.config.bot.engageStrafeSpeed)
    if (
      this.coverPeekPos &&
      Math.hypot(
        this.coverPeekPos.x - this.position.x,
        this.coverPeekPos.z - this.position.z
      ) < this.config.bot.seekCoverArrivalDistance
    ) {
      this.velocity.set(0, 0, 0)
      this.updateFireOpportunity()
      if (this.stateTimer > this.config.bot.coverPeekDuration) {
        this.isPeeking = false
        this.coverPeekTimer =
          this.config.bot.coverPeekIntervalMin +
          Math.random() * this.config.bot.coverPeekIntervalRange
        this.stateTimer = 0
      }
    }
  }

  updateFlank() {
    if (!this.target?.alive || this.stateTimer > this.config.bot.flankDuration) {
      this.setState('engage')
      return
    }
    const targetPosition = this.getKnownTargetPosition()
    if (!targetPosition) {
      this.setState('patrol')
      return
    }
    const deltaX = targetPosition.x - this.position.x
    const deltaZ = targetPosition.z - this.position.z
    const side = this._desiredDirection
      .set(-deltaZ, 0, deltaX)
      .normalize()
      .multiplyScalar(this.flankDir || 1)
    const forward = this._forwardDirection
      .set(deltaX, 0, deltaZ)
      .normalize()
      .multiplyScalar(this.config.bot.flankForwardBias)
    side.add(forward)
    this.moveWithDirection(side, this.config.bot.flankSpeed)
    this.updateFireOpportunity()
  }

  moveToward(target, speed) {
    const deltaX = target.x - this.position.x
    const deltaZ = target.z - this.position.z
    if (deltaX * deltaX + deltaZ * deltaZ < 0.01) {
      this.velocity.set(0, 0, 0)
      return
    }
    this._desiredDirection.set(deltaX, 0, deltaZ)
    this.moveWithDirection(this._desiredDirection, speed)
  }

  getSpread() {
    const weaponConfig = this.config.weapon
    let spread = this.baseSpread + (1 - this.botSkill) * weaponConfig.botSkillSpread
    const speed = Math.hypot(this.velocity.x, this.velocity.z)
    if (speed > weaponConfig.botMovingFastThreshold)
      spread *= weaponConfig.botMovingFastMultiplier
    else if (speed > weaponConfig.botMovingSlowThreshold)
      spread *= weaponConfig.botMovingSlowMultiplier
    if (this.reloading) spread *= weaponConfig.reloadingSpreadMultiplier
    spread += this.spreadBloom
    return Math.min(spread, weaponConfig.maxSpread)
  }

  fire() {
    if (this.magazine <= 0 || this.reloading || !this.target?.alive) return false
    const now = performance.now()
    if (now - this.lastFire < this.fireDelay * 1000) return false
    this.lastFire = now
    this.magazine--
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
    this.spreadBloom = Math.min(
      this.config.weapon.spreadBloomMax,
      this.spreadBloom + this.weaponData.spreadBloomPerShot
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

  startReload(empty = this.magazine === 0) {
    this.reloading = true
    this.reloadTimer = 0
    this.reloadDuration = empty
      ? this.weaponData.emptyReloadDuration
      : this.weaponData.reloadDuration
  }

  takeDamage(amount, attacker, isHeadshot = false, attackType = 'weapon') {
    if (!this.alive) return
    this.health -= amount
    this.suppression = Math.min(1, this.suppression + amount / this.maxHealth)
    if (attacker?.alive && attacker.team !== this.team) {
      const targetChanged = this.target !== attacker
      this.target = attacker
      this.lastSeenTarget.copy(attacker.position)
      this.lastSeenTime = this.aiTime
      this.targetVisible = this.canSee(attacker)
      this.searchPos = this.targetVisible ? null : this.lastSeenTarget.clone()
      this.reactionTimer = this.config.bot.reactionTime * (targetChanged ? 0.5 : 0.28)
      this.fireOpportunityTimer = this.reactionTimer + 0.18
      this.burstShotsRemaining = 0
      if (this.stateName !== 'resupply')
        this.setState(this.targetVisible ? 'engage' : 'alert')
    }
    const hitPosition = this.position.clone().setY(1.2)
    this.audio.hitFlesh(hitPosition)
    if (this.health <= 0) this.die(attacker, isHeadshot, attackType)
    else this.audio.pain(this.config.bot.painChance, hitPosition)
  }

  die(attacker, isHeadshot, attackType = 'weapon') {
    this.alive = false
    this.stateName = 'dead'
    this.deathTime = 0
    this.group.rotation.z = 0
    this.marker.visible = false
    this.group.position.y = this.position.y + 0.1
    const fallPosition = this.position.clone().setY(this.position.y + 0.3)
    this.effects.spawnBlood(this.position.clone().setY(this.position.y + 1.2))
    this.audio.pain(this.config.bot.deathPainChance, fallPosition)
    this.audio.bodyFall(fallPosition)
    this.scoring.recordElimination(this, attacker, isHeadshot, attackType)
    setTimeout(() => this.respawn(), this.mode.getBotRespawnDelay(this) * 1000)
  }

  respawn() {
    if (!this.mode.canRespawn(this)) return
    this.alive = true
    this.randomizeLoadout()
    this.health = this.maxHealth
    this.reloading = false
    this.reloadTimer = 0
    this.fireOpportunityTimer = 0.25 + Math.random() * 0.8
    this.weaponShotTimer = 0
    this.burstShotsRemaining = 0
    this.suppression = 0
    this.stateName = 'patrol'
    this.stateTimer = 0
    this.aiTime = 0
    this.perceptionTimer = Math.random() * this.config.bot.perceptionInterval
    this.target = null
    this.targetVisible = false
    this.lastSeenTime = -Infinity
    this.coverPos = null
    this.coverPeekPos = null
    this.coverPeekTimer = 0
    this.isPeeking = false
    this.resupplyStation = null
    this.resupplyKind = null
    this.stuckTimer = 0
    this.stuckSampleTimer = 0
    this.unstuckTimer = 0
    this.position.copy(this.getRandomSpawn(this.team))
    this.position.y = this.gameState.groundHeightAt(this.position.x, this.position.z)
    this.velocity.set(0, 0, 0)
    this.yaw = Math.random() * Math.PI * 2
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
    this.lastFire = 0
    this.lastPosition.copy(this.position)
    this.marker.position.y = 2.06
    this.marker.visible = true
    this.group.rotation.set(0, this.yaw, 0)
    this.group.position.copy(this.position)
    this.patrolTarget = this.getRandomPatrolPoint()
  }

  handleCollisions() {
    for (const obstacle of this.gameState.obstacles) {
      if (obstacle.type === 'ground' || obstacle.type === 'crater' || obstacle.type === 'wire') continue
      resolveObstacleCollision(this.position, this.radius, obstacle, this.position.y)
    }
  }
}
