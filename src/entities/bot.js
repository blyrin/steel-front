import * as THREE from 'three'
import { createBoxHitbox, rayHitObstacle, resolveObstacleCollision } from '../combat/collision.js'

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
    const botConfig = this.config.bot
    this.team = team
    this.position = spawnPosition.clone()
    this.position.y = 0
    this.velocity = new THREE.Vector3()
    this.yaw = Math.random() * Math.PI * 2
    this.alive = true
    this.health = botConfig.maxHealth
    this.maxHealth = botConfig.maxHealth
    this.stateName = 'patrol'
    this.target = null
    this.lastSeenTarget = null
    this.lastSeenTime = 0
    this.stateTimer = Math.random() * 5
    this.reloadTimer = 0
    this.fireTimer = 0
    this.reloading = false
    this.lastFire = 0
    this.spreadBloom = 0
    this.randomizeLoadout()
    this.coverPos = null
    this.patrolTarget = this.getRandomPatrolPoint()
    this.reactionTimer = 0
    this.searchPos = null
    this.botSkill = botConfig.skillMin + Math.random() * botConfig.skillRange
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
    this._moveDirection = new THREE.Vector3()
    this._forwardDirection = new THREE.Vector3()
    this._coverTarget = new THREE.Vector3()
    this.targetVisible = false
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
    this.grenadeCooldown =
      this.config.grenade.aiCooldownMin +
      Math.random() * this.config.grenade.aiCooldownRange
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

    if (modelId === 'carbine') {
      this.rifleBarrel.position.z = -0.27
      this.rifleBarrel.scale.y = 0.72
      this.rifleBody.scale.z = 0.82
      this.rifleStock.position.z = 0.18
      this.rifleStock.scale.z = 0.76
      this.rifleMag.scale.set(0.78, 0.72, 0.72)
      this.rifleMag.visible = true
      this.rifleMuzzle.position.z = -0.54
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
    const half = this.config.match.mapSize * this.config.bot.patrolAreaRatio
    return new THREE.Vector3((Math.random() - 0.5) * half * 2, 0, (Math.random() - 0.5) * half * 2)
  }

  getHitboxes() {
    const rotation = this.yaw
    const cos = Math.cos(rotation)
    const sin = Math.sin(rotation)
    for (const hitbox of this.hitboxes) {
      hitbox.x = this.position.x
      hitbox.z = this.position.z
      hitbox.rot = rotation
      hitbox.cos = cos
      hitbox.sin = sin
    }
    return this.hitboxes
  }

  canSee(target) {
    if (!target?.alive) return false
    const dx = target.position.x - this.position.x
    const dz = target.position.z - this.position.z
    const distSq = dx * dx + dz * dz
    const maxDist = this.config.bot.viewDistance
    if (distSq > maxDist * maxDist) return false
    const distance = Math.sqrt(distSq)
    if (distance > 1e-6) {
      const inv = 1 / distance
      const dirX = dx * inv
      const dirZ = dz * inv
      const forwardX = -Math.sin(this.yaw)
      const forwardZ = -Math.cos(this.yaw)
      if (
        forwardX * dirX + forwardZ * dirZ < this.config.bot.viewForwardThreshold &&
        distance > this.config.bot.viewForwardMinDistance
      )
        return false
      const origin = this._seeOrigin
      const direction = this._seeDir
      origin.set(this.position.x, this.config.bot.viewOriginHeight, this.position.z)
      direction.set(dirX, 0, dirZ)
      for (const smoke of this.gameState.smokeClouds) {
        const toSmokeX = smoke.position.x - origin.x
        const toSmokeZ = smoke.position.z - origin.z
        const along = THREE.MathUtils.clamp(toSmokeX * dirX + toSmokeZ * dirZ, 0, distance)
        const closestX = origin.x + dirX * along
        const closestZ = origin.z + dirZ * along
        if (
          Math.hypot(
            smoke.position.x - closestX,
            smoke.position.y - origin.y,
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
    }
    return true
  }

  findNearestEnemy() {
    let nearest = null
    let minDistanceSq = Infinity
    for (const bot of this.gameState.bots) {
      if (bot.team === this.team || !bot.alive) continue
      const distanceSq = this.position.distanceToSquared(bot.position)
      if (distanceSq < minDistanceSq && this.canSee(bot)) {
        minDistanceSq = distanceSq
        nearest = bot
      }
    }
    const player = this.gameState.player
    if (player.alive && player.team !== this.team) {
      const distanceSq = this.position.distanceToSquared(player.position)
      if (distanceSq < minDistanceSq && this.canSee(player)) nearest = player
    }
    return nearest
  }

  findCover() {
    let best = null
    let bestScore = -Infinity
    for (const cover of this.gameState.coverPoints) {
      const distanceToCover = Math.hypot(cover.x - this.position.x, cover.z - this.position.z)
      if (distanceToCover > this.config.bot.coverSearchDistance || !this.target) continue
      const coverToEnemy = Math.hypot(
        this.target.position.x - cover.x,
        this.target.position.z - cover.z
      )
      const soldierToEnemy = this.position.distanceTo(this.target.position)
      const score =
        (soldierToEnemy - coverToEnemy) * this.config.bot.coverEnemyWeight +
        (this.config.bot.coverDistanceBias - distanceToCover) * this.config.bot.coverDistanceWeight
      if (score > bestScore) {
        bestScore = score
        best = cover
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

  findNearestAmmoStation() {
    let nearest = null
    let distance = Infinity
    for (const station of this.gameState.ammoStations) {
      const next = Math.hypot(
        station.position.x - this.position.x,
        station.position.z - this.position.z
      )
      if (next < distance) {
        distance = next
        nearest = station
      }
    }
    return nearest
  }

  updateResupply() {
    const station = this.findNearestAmmoStation()
    if (!station) {
      this.stateName = 'patrol'
      return
    }
    this.moveToward(station.position, this.config.bot.engageFarSpeed)
    if (
      Math.hypot(station.position.x - this.position.x, station.position.z - this.position.z) <
      this.config.supply.aiArrivalDistance
    ) {
      this.reserveAmmo = this.weaponData.reserveAmmo
      this.magazine = this.weaponData.magazineSize
      this.stateName = 'patrol'
      this.patrolTarget = this.getRandomPatrolPoint()
    }
  }

  tryThrowGrenade(dt) {
    if (this.grenadeCount <= 0 || this.grenadeCooldown > 0 || !this.target?.alive) return
    const distance = this.position.distanceTo(this.target.position)
    if (
      distance < this.config.grenade.aiMinDistance ||
      distance > this.config.grenade.aiMaxDistance ||
      Math.random() >= this.config.grenade.aiThrowChancePerSecond * dt
    )
      return
    if (this.grenadeData.kind === 'smoke' && this.health > this.config.bot.lowHealthThreshold)
      return
    const origin = this.position.clone().setY(1.3)
    const direction = new THREE.Vector3()
      .subVectors(this.target.position, origin)
      .setY(0.35)
      .normalize()
    this.grenadeCount--
    this.combat.throwGrenade(origin, direction, this.grenadeData, this.team, this)
    this.grenadeCooldown =
      this.config.grenade.aiCooldownMin +
      Math.random() * this.config.grenade.aiCooldownRange
  }

  update(dt) {
    if (!this.alive) {
      this.updateModelAnimation(dt)
      return
    }
    this.stateTimer += dt
    this.fireTimer += dt
    this.grenadeCooldown -= dt
    this.spreadBloom = Math.max(
      0,
      this.spreadBloom - dt * this.config.weapon.spreadBloomRecovery
    )
    if (this.health < this.config.bot.lowHealthThreshold) this.useItem()
    if (this.magazine === 0 && this.reserveAmmo === 0) {
      if (!this.useItem() && this.stateName !== 'resupply') this.stateName = 'resupply'
    }
    let enemy = null
    if (this.stateName !== 'resupply') enemy = this.findNearestEnemy()
    if (enemy) {
      if (this.target !== enemy) {
        this.target = enemy
        this.reactionTimer = this.config.bot.reactionTime * (1.5 - this.botSkill)
      }
      if (!this.lastSeenTarget) this.lastSeenTarget = new THREE.Vector3()
      this.lastSeenTarget.copy(enemy.position)
      this.lastSeenTime = this.stateTimer
      this.targetVisible = true
      if (this.stateName !== 'engage' && this.reactionTimer <= 0) this.stateName = 'engage'
    } else {
      this.targetVisible = false
      if (
        this.stateName === 'engage' &&
        this.stateTimer - this.lastSeenTime > this.config.bot.lostTargetTime
      ) {
        this.stateName = 'alert'
        this.searchPos = this.lastSeenTarget?.clone() || null
        this.stateTimer = 0
      }
    }
    if (this.reactionTimer > 0) this.reactionTimer -= dt
    switch (this.stateName) {
      case 'patrol':
        if (this.position.distanceTo(this.patrolTarget) < this.config.bot.patrolArrivalDistance)
          this.patrolTarget = this.getRandomPatrolPoint()
        this.moveToward(this.patrolTarget, this.config.bot.patrolSpeed)
        break
      case 'alert':
        if (this.searchPos) {
          this.moveToward(this.searchPos, this.config.bot.alertSpeed)
          if (this.position.distanceTo(this.searchPos) < this.config.bot.alertArrivalDistance) {
            this.searchPos = null
            this.stateName = 'patrol'
          }
        } else {
          this.stateName = 'patrol'
        }
        break
      case 'engage':
        this.updateEngage(dt)
        break
      case 'seek_cover':
        this.updateSeekCover()
        break
      case 'flank':
        this.updateFlank()
        break
      case 'resupply':
        this.updateResupply()
        break
    }

    if (this.magazine === 0 && this.reserveAmmo > 0 && !this.reloading) this.startReload()
    if (this.reloading) {
      this.reloadTimer += dt
      if (this.reloadTimer > this.weaponData.emptyReloadDuration) {
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
    const half = this.config.match.mapSize / 2 - 2
    this.position.x = Math.max(-half, Math.min(half, this.position.x))
    this.position.z = Math.max(-half, Math.min(half, this.position.z))
    this.handleCollisions()
    this.group.position.copy(this.position)
    let targetYaw = this.yaw
    if (
      this.target?.alive &&
      (this.stateName === 'engage' ||
        this.stateName === 'seek_cover' ||
        this.stateName === 'flank')
    ) {
      targetYaw = Math.atan2(
        -(this.target.position.x - this.position.x),
        -(this.target.position.z - this.position.z)
      )
    } else if (this.velocity.lengthSq() > this.config.bot.stationarySpeedThreshold ** 2) {
      targetYaw = Math.atan2(-this.velocity.x, -this.velocity.z)
    }
    let difference = targetYaw - this.yaw
    while (difference > Math.PI) difference -= Math.PI * 2
    while (difference < -Math.PI) difference += Math.PI * 2
    this.yaw += difference * Math.min(1, dt * this.config.bot.turnSpeed)
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
      this.group.position.y = 0.04 + (1 - eased) * 0.06
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
      this.rifleMag.visible = !this.reloading || this.reloadPose < 0.72
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
    if (modelId === 'carbine') {
      reloadLeftX = 0.35
      reloadRightX = 0.55
      reloadLeftZ = 0.5
      reloadRightZ = -0.2
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
    const targetPitch = this.target?.alive
      ? THREE.MathUtils.clamp(
          Math.atan2(
            this.config.bot.targetHeight - rifleHeight,
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
    if (modelId === 'carbine') {
      reloadRifleX = 0.25
      reloadRifleY = 0.35
      reloadRifleZ = -0.18
      reloadPitchOffset = -0.28
      reloadYawOffset = -0.22
      reloadRollOffset = -0.18
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

  updateEngage(dt) {
    if (!this.target?.alive) {
      this.target = null
      this.stateName = 'patrol'
      return
    }
    const distance = this.position.distanceTo(this.target.position)
    const deltaX = this.target.position.x - this.position.x
    const deltaZ = this.target.position.z - this.position.z
    this.tryThrowGrenade(dt)
    if (
      this.health < this.config.bot.lowHealthThreshold &&
      (!this.coverPos || this.stateTimer % this.config.bot.coverRefreshInterval < 0.1)
    ) {
      const cover = this.findCover()
      if (cover) {
        this.coverPos = cover
        this.stateName = 'seek_cover'
        return
      }
    }
    if (distance > this.config.bot.engageFarDistance)
      this.moveToward(this.target.position, this.config.bot.engageFarSpeed)
    else if (distance < this.config.bot.engageCloseDistance) {
      const away = this._moveDirection.subVectors(this.position, this.target.position).setY(0).normalize()
      this.velocity.x = away.x * this.config.bot.engageCloseSpeed
      this.velocity.z = away.z * this.config.bot.engageCloseSpeed
    } else {
      const side = this._moveDirection.set(-deltaZ, 0, deltaX).normalize()
      const sideDirection =
        Math.sin(this.stateTimer * this.config.bot.engageStrafeFrequency) > 0 ? 1 : -1
      this.velocity.x = side.x * this.config.bot.engageStrafeSpeed * sideDirection
      this.velocity.z = side.z * this.config.bot.engageStrafeSpeed * sideDirection
    }
    if (
      this.reactionTimer <= 0 &&
      this.targetVisible &&
      !this.reloading &&
      this.fireTimer >
        (this.config.bot.engageFireBaseDelay +
          (1 - this.botSkill) * this.config.bot.engageFireSkillDelay) *
          this.weaponData.aiCadenceMultiplier
    ) {
      this.fire()
      this.fireTimer = 0
    }
  }

  updateSeekCover() {
    if (!this.coverPos) {
      this.stateName = 'engage'
      return
    }
    const target = this._coverTarget.set(this.coverPos.x, 0, this.coverPos.z)
    if (this.position.distanceTo(target) < this.config.bot.seekCoverArrivalDistance) {
      this.stateName = 'engage'
      this.stateTimer = 0
      if (Math.random() < this.config.bot.seekCoverFlankChance && this.target) {
        this.stateName = 'flank'
        this.flankDir = Math.random() > 0.5 ? 1 : -1
        this.stateTimer = 0
      }
      return
    }
    this.moveToward(target, this.config.bot.engageFarSpeed)
    if (
      this.target &&
      this.targetVisible &&
      this.reactionTimer <= 0 &&
      !this.reloading &&
      this.fireTimer >
        this.config.bot.seekCoverFireInterval * this.weaponData.aiCadenceMultiplier
    ) {
      this.fire()
      this.fireTimer = 0
    }
  }

  updateFlank() {
    if (!this.target?.alive || this.stateTimer > this.config.bot.flankDuration) {
      this.stateName = 'engage'
      return
    }
    const deltaX = this.target.position.x - this.position.x
    const deltaZ = this.target.position.z - this.position.z
    const side = this._moveDirection.set(-deltaZ, 0, deltaX).normalize().multiplyScalar(this.flankDir)
    const forward = this._forwardDirection
      .set(deltaX, 0, deltaZ)
      .normalize()
      .multiplyScalar(this.config.bot.flankForwardBias)
    this.velocity.x = (side.x + forward.x) * this.config.bot.flankSpeed
    this.velocity.z = (side.z + forward.z) * this.config.bot.flankSpeed
    if (
      this.targetVisible &&
      this.reactionTimer <= 0 &&
      !this.reloading &&
      this.fireTimer >
        this.config.bot.flankFireInterval * this.weaponData.aiCadenceMultiplier
    ) {
      this.fire()
      this.fireTimer = 0
    }
  }

  moveToward(target, speed) {
    const deltaX = target.x - this.position.x
    const deltaZ = target.z - this.position.z
    const distance = Math.hypot(deltaX, deltaZ)
    if (distance < 0.1) {
      this.velocity.set(0, 0, 0)
      return
    }
    this.velocity.x = (deltaX / distance) * speed
    this.velocity.z = (deltaZ / distance) * speed
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
    if (this.magazine <= 0 || this.reloading || !this.target?.alive) return
    const now = performance.now()
    if (now - this.lastFire < this.fireDelay * 1000) return
    this.lastFire = now
    this.magazine--
    this.fireKick = Math.min(1, this.fireKick + 0.72)
    const targetHeight = this.config.bot.targetHeight
    const muzzle = new THREE.Vector3()
    this.rifleMuzzle.getWorldPosition(muzzle)
    muzzle.y = targetHeight
    const target = this.target.position.clone()
    target.y = targetHeight
    const direction = new THREE.Vector3().subVectors(target, muzzle).normalize()
    const spread = this.getSpread()
    this.spreadBloom = Math.min(
      this.config.weapon.spreadBloomMax,
      this.spreadBloom + this.weaponData.spreadBloomPerShot
    )
    direction.x += (Math.random() - 0.5) * spread * 2
    direction.y += (Math.random() - 0.5) * spread * 2
    direction.z += (Math.random() - 0.5) * spread * 2
    direction.normalize()
    this.combat.fireBullet(muzzle, direction, this.team, this, muzzle, this.weaponData)
    this.effects.spawnMuzzleFlash(muzzle, direction)
    this.audio.botShot(muzzle)
  }

  startReload() {
    this.reloading = true
    this.reloadTimer = 0
  }

  takeDamage(amount, attacker, isHeadshot = false, attackType = 'weapon') {
    if (!this.alive) return
    this.health -= amount
    if (this.stateName === 'patrol' && attacker) {
      this.target = attacker
      if (!this.lastSeenTarget) this.lastSeenTarget = new THREE.Vector3()
      this.lastSeenTarget.copy(attacker.position)
      this.lastSeenTime = this.stateTimer
      this.stateName = 'engage'
      this.reactionTimer = this.config.bot.reactionTime * 0.5
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
    this.group.position.y = 0.1
    const fallPosition = this.position.clone().setY(0.3)
    this.effects.spawnBlood(this.position.clone().setY(1.2))
    this.audio.pain(this.config.bot.deathPainChance, fallPosition)
    this.audio.bodyFall(fallPosition)
    this.scoring.recordElimination(this, attacker, isHeadshot, attackType)
    setTimeout(() => this.respawn(), this.config.match.respawnTime * 1000)
  }

  respawn() {
    if (
      this.gameState.alliesScore >= this.config.match.killTarget ||
      this.gameState.axisScore >= this.config.match.killTarget
    )
      return
    this.alive = true
    this.randomizeLoadout()
    this.health = this.maxHealth
    this.reloading = false
    this.stateName = 'patrol'
    this.target = null
    this.position.copy(this.getRandomSpawn(this.team))
    this.position.y = 0
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
    this.marker.position.y = 2.06
    this.marker.visible = true
    this.group.rotation.set(0, this.yaw, 0)
    this.group.position.copy(this.position)
    this.patrolTarget = this.getRandomPatrolPoint()
  }

  handleCollisions() {
    for (const obstacle of this.gameState.obstacles) {
      if (obstacle.type === 'ground' || obstacle.type === 'crater' || obstacle.type === 'wire') continue
      resolveObstacleCollision(this.position, this.radius, obstacle)
    }
  }
}
