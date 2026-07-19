import * as THREE from 'three'
import { rayHitObstacle, resolveObstacleCollision } from '../combat/collision.js'

export class Bot {
  constructor(team, spawnPosition, services) {
    Object.assign(this, services)
    this.team = team
    this.position = spawnPosition.clone()
    this.position.y = 0
    this.velocity = new THREE.Vector3()
    this.yaw = Math.random() * Math.PI * 2
    this.alive = true
    this.health = 100
    this.maxHealth = 100
    this.stateName = 'patrol'
    this.target = null
    this.lastSeenTarget = null
    this.lastSeenTime = 0
    this.stateTimer = Math.random() * 5
    this.reloadTimer = 0
    this.fireTimer = 0
    this.magazine = 8
    this.reloading = false
    this.fireDelay = 0.15
    this.lastFire = 0
    this.baseSpread = 0.004
    this.spreadBloom = 0
    this.coverPos = null
    this.patrolTarget = this.getRandomPatrolPoint()
    this.reactionTimer = 0
    this.searchPos = null
    this.botSkill = 0.3 + Math.random() * 0.4
    this.kills = 0
    this.deaths = 0
    this.radius = 0.4
    this.name = this.generateName()
    this.buildModel()
    this.scene.add(this.group)
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
    const teamColor = isAlly ? 0x5ad040 : 0xff5a3a

    const legGeometry = new THREE.BoxGeometry(0.18, 0.8, 0.2)
    this.leftLeg = new THREE.Mesh(legGeometry, uniform)
    this.leftLeg.position.set(-0.12, 0.4, 0)
    this.leftLeg.castShadow = true
    this.group.add(this.leftLeg)
    this.rightLeg = new THREE.Mesh(legGeometry, uniform)
    this.rightLeg.position.set(0.12, 0.4, 0)
    this.rightLeg.castShadow = true
    this.group.add(this.rightLeg)

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.3), uniform)
    torso.position.set(0, 1.15, 0)
    torso.castShadow = true
    this.group.add(torso)
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.08, 0.32), this.matLib.metalDark)
    belt.position.set(0, 0.86, 0)
    this.group.add(belt)

    const patchLeft = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.04), accent)
    patchLeft.position.set(-0.28, 1.35, 0)
    this.group.add(patchLeft)
    const patchRight = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.04), accent)
    patchRight.position.set(0.28, 1.35, 0)
    this.group.add(patchRight)
    if (isAlly) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.32), accent)
      stripe.position.set(0, 1.28, 0)
      this.group.add(stripe)
    } else {
      const sash = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.55, 0.32), accent)
      sash.position.set(0.08, 1.18, 0)
      sash.rotation.z = 0.45
      this.group.add(sash)
    }

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.28, 0.25), this.matLib.skin)
    head.position.set(0, 1.65, 0)
    head.castShadow = true
    this.group.add(head)
    if (isAlly) {
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
        helmetMat
      )
      dome.position.set(0, 1.78, 0)
      dome.scale.set(1.05, 0.85, 1.1)
      dome.castShadow = true
      this.group.add(dome)
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.03, 12), helmetMat)
      brim.position.set(0, 1.72, 0)
      this.group.add(brim)
      const net = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 0.08), this.matLib.allyAccent)
      net.position.set(0, 1.9, 0)
      this.group.add(net)
    } else {
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(0.17, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.58),
        helmetMat
      )
      dome.position.set(0, 1.8, 0)
      dome.scale.set(1.05, 0.9, 1.15)
      dome.castShadow = true
      this.group.add(dome)
      const neck = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.16), helmetMat)
      neck.position.set(0, 1.72, 0.12)
      this.group.add(neck)
      for (const side of [-1, 1]) {
        const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.18), helmetMat)
        skirt.position.set(side * 0.16, 1.72, 0.02)
        this.group.add(skirt)
      }
    }

    const armGeometry = new THREE.BoxGeometry(0.14, 0.6, 0.16)
    this.leftArm = new THREE.Mesh(armGeometry, uniform)
    this.leftArm.position.set(-0.32, 1.15, 0)
    this.leftArm.castShadow = true
    this.group.add(this.leftArm)
    this.rightArm = new THREE.Mesh(armGeometry, uniform)
    this.rightArm.position.set(0.32, 1.15, 0)
    this.rightArm.castShadow = true
    this.group.add(this.rightArm)

    this.rifle = new THREE.Group()
    const rifleBarrel = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.8), this.matLib.metal)
    rifleBarrel.position.z = -0.3
    this.rifle.add(rifleBarrel)
    const rifleStock = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.3), this.matLib.wood)
    rifleStock.position.z = 0.2
    this.rifle.add(rifleStock)
    this.rifle.position.set(0.25, 1.15, -0.2)
    this.group.add(this.rifle)

    this.marker = new THREE.Group()
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 0.28, 6),
      new THREE.MeshBasicMaterial({ color: teamColor })
    )
    pole.position.y = 0.1
    this.marker.add(pole)
    if (isAlly) {
      const plate = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.22, 0.04),
        new THREE.MeshBasicMaterial({ color: teamColor })
      )
      plate.position.y = 0.32
      plate.rotation.z = Math.PI / 4
      this.marker.add(plate)
      const core = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.1, 0.05),
        new THREE.MeshBasicMaterial({ color: 0xd8f0c8 })
      )
      core.position.y = 0.32
      core.rotation.z = Math.PI / 4
      this.marker.add(core)
    } else {
      const triangle = new THREE.Mesh(
        new THREE.ConeGeometry(0.14, 0.22, 3),
        new THREE.MeshBasicMaterial({ color: teamColor })
      )
      triangle.position.y = 0.34
      triangle.rotation.y = Math.PI / 6
      this.marker.add(triangle)
      const core = new THREE.Mesh(
        new THREE.SphereGeometry(0.045, 6, 4),
        new THREE.MeshBasicMaterial({ color: 0xffe0c0 })
      )
      core.position.y = 0.3
      this.marker.add(core)
    }
    this.marker.position.set(0, 2, 0)
    this.group.add(this.marker)
    this.legPhase = 0
  }

  getRandomPatrolPoint() {
    const half = this.config.mapSize * 0.42
    return new THREE.Vector3((Math.random() - 0.5) * half * 2, 0, (Math.random() - 0.5) * half * 2)
  }

  canSee(target) {
    if (!target?.alive) return false
    const dx = target.position.x - this.position.x
    const dz = target.position.z - this.position.z
    const distSq = dx * dx + dz * dz
    const maxDist = this.config.maxBotViewDist
    if (distSq > maxDist * maxDist) return false
    const distance = Math.sqrt(distSq)
    if (distance > 1e-6) {
      const inv = 1 / distance
      const dirX = dx * inv
      const dirZ = dz * inv
      const forwardX = -Math.sin(this.yaw)
      const forwardZ = -Math.cos(this.yaw)
      if (forwardX * dirX + forwardZ * dirZ < 0.3 && distance > 5) return false
      // 复用临时向量，避免每帧分配
      const origin = this._seeOrigin || (this._seeOrigin = new THREE.Vector3())
      const direction = this._seeDir || (this._seeDir = new THREE.Vector3())
      origin.set(this.position.x, 1.6, this.position.z)
      direction.set(dirX, 0, dirZ)
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
    let minDistance = Infinity
    for (const bot of this.gameState.bots) {
      if (bot.team === this.team || !bot.alive) continue
      const distance = this.position.distanceTo(bot.position)
      if (distance < minDistance && this.canSee(bot)) {
        minDistance = distance
        nearest = bot
      }
    }
    const player = this.gameState.player
    if (player.alive && player.team !== this.team) {
      const distance = this.position.distanceTo(player.position)
      if (distance < minDistance && this.canSee(player)) nearest = player
    }
    return nearest
  }

  findCover() {
    let best = null
    let bestScore = -Infinity
    for (const cover of this.gameState.coverPoints) {
      const distanceToCover = Math.hypot(cover.x - this.position.x, cover.z - this.position.z)
      if (distanceToCover > 40 || !this.target) continue
      const coverToEnemy = Math.hypot(
        this.target.position.x - cover.x,
        this.target.position.z - cover.z
      )
      const soldierToEnemy = this.position.distanceTo(this.target.position)
      const score = (soldierToEnemy - coverToEnemy) * 0.5 + (12 - distanceToCover) * 0.3
      if (score > bestScore) {
        bestScore = score
        best = cover
      }
    }
    return best
  }

  update(dt) {
    if (!this.alive) return
    this.stateTimer += dt
    this.fireTimer += dt
    this.spreadBloom = Math.max(0, this.spreadBloom - dt * 0.035)
    const enemy = this.findNearestEnemy()
    if (enemy) {
      if (this.target !== enemy) {
        this.target = enemy
        this.reactionTimer = this.config.botReactionTime * (1.5 - this.botSkill)
      }
      this.lastSeenTarget = enemy.position.clone()
      this.lastSeenTime = this.stateTimer
      if (this.stateName !== 'engage' && this.reactionTimer <= 0) this.stateName = 'engage'
    } else if (this.stateName === 'engage' && this.stateTimer - this.lastSeenTime > 3) {
      this.stateName = 'alert'
      this.searchPos = this.lastSeenTarget?.clone() || null
      this.stateTimer = 0
    }
    if (this.reactionTimer > 0) this.reactionTimer -= dt
    if (this.stateName === 'patrol') {
      if (this.position.distanceTo(this.patrolTarget) < 2)
        this.patrolTarget = this.getRandomPatrolPoint()
      this.moveToward(this.patrolTarget, 2.5)
    } else if (this.stateName === 'alert') {
      if (this.searchPos) {
        this.moveToward(this.searchPos, 4)
        if (this.position.distanceTo(this.searchPos) < 3) {
          this.searchPos = null
          this.stateName = 'patrol'
        }
      } else {
        this.stateName = 'patrol'
      }
    } else if (this.stateName === 'engage') this.updateEngage(dt)
    else if (this.stateName === 'seek_cover') this.updateSeekCover()
    else if (this.stateName === 'flank') this.updateFlank()

    if (this.magazine === 0 && !this.reloading) this.startReload()
    if (this.reloading) {
      this.reloadTimer += dt
      if (this.reloadTimer > 2.5) {
        this.magazine = 8
        this.reloading = false
        this.reloadTimer = 0
      }
    }
    this.position.addScaledVector(this.velocity, dt)
    const half = this.config.mapSize / 2 - 2
    this.position.x = Math.max(-half, Math.min(half, this.position.x))
    this.position.z = Math.max(-half, Math.min(half, this.position.z))
    this.handleCollisions()
    this.group.position.copy(this.position)
    const cameraDeltaX = this.camera.position.x - this.position.x
    const cameraDeltaZ = this.camera.position.z - this.position.z
    this.marker.rotation.y = Math.atan2(cameraDeltaX, cameraDeltaZ) - this.yaw
    if (this.velocity.lengthSq() > 0.1) {
      this.legPhase += dt * 10
      const swing = Math.sin(this.legPhase) * 0.4
      this.leftLeg.rotation.x = swing
      this.rightLeg.rotation.x = -swing
      this.leftArm.rotation.x = -swing * 0.5
    } else {
      this.leftLeg.rotation.x *= 0.8
      this.rightLeg.rotation.x *= 0.8
      this.leftArm.rotation.x *= 0.8
    }
    let targetYaw = this.yaw
    if (this.target?.alive && this.stateName === 'engage') {
      targetYaw = Math.atan2(
        -(this.target.position.x - this.position.x),
        -(this.target.position.z - this.position.z)
      )
    } else if (this.velocity.lengthSq() > 0.1) {
      targetYaw = Math.atan2(-this.velocity.x, -this.velocity.z)
    }
    let difference = targetYaw - this.yaw
    while (difference > Math.PI) difference -= Math.PI * 2
    while (difference < -Math.PI) difference += Math.PI * 2
    this.yaw += difference * Math.min(1, dt * 6)
    this.group.rotation.y = this.yaw
  }

  updateEngage() {
    if (!this.target?.alive) {
      this.target = null
      this.stateName = 'patrol'
      return
    }
    const distance = this.position.distanceTo(this.target.position)
    const deltaX = this.target.position.x - this.position.x
    const deltaZ = this.target.position.z - this.position.z
    if (this.health < 40 && (!this.coverPos || this.stateTimer % 5 < 0.1)) {
      const cover = this.findCover()
      if (cover) {
        this.coverPos = cover
        this.stateName = 'seek_cover'
        return
      }
    }
    if (distance > 50) this.moveToward(this.target.position, 4.5)
    else if (distance < 14) {
      const away = new THREE.Vector3()
        .subVectors(this.position, this.target.position)
        .setY(0)
        .normalize()
      this.velocity.x = away.x * 4
      this.velocity.z = away.z * 4
    } else {
      const side = new THREE.Vector3(-deltaZ, 0, deltaX).normalize()
      const sideDirection = Math.sin(this.stateTimer * 0.8) > 0 ? 1 : -1
      this.velocity.x = side.x * 3 * sideDirection
      this.velocity.z = side.z * 3 * sideDirection
    }
    if (
      this.reactionTimer <= 0 &&
      this.canSee(this.target) &&
      !this.reloading &&
      this.fireTimer > 0.7 + (1 - this.botSkill) * 0.9
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
    const target = new THREE.Vector3(this.coverPos.x, 0, this.coverPos.z)
    if (this.position.distanceTo(target) < 1.5) {
      this.stateName = 'engage'
      this.stateTimer = 0
      if (Math.random() < 0.3 && this.target) {
        this.stateName = 'flank'
        this.flankDir = Math.random() > 0.5 ? 1 : -1
        this.stateTimer = 0
      }
      return
    }
    this.moveToward(target, 4.5)
    if (
      this.target &&
      this.canSee(this.target) &&
      this.reactionTimer <= 0 &&
      !this.reloading &&
      this.fireTimer > 1.0
    ) {
      this.fire()
      this.fireTimer = 0
    }
  }

  updateFlank() {
    if (!this.target?.alive || this.stateTimer > 6) {
      this.stateName = 'engage'
      return
    }
    const deltaX = this.target.position.x - this.position.x
    const deltaZ = this.target.position.z - this.position.z
    const side = new THREE.Vector3(-deltaZ, 0, deltaX).normalize().multiplyScalar(this.flankDir)
    const forward = new THREE.Vector3(deltaX, 0, deltaZ).normalize().multiplyScalar(-0.3)
    this.velocity.x = (side.x + forward.x) * 4
    this.velocity.z = (side.z + forward.z) * 4
    if (
      this.canSee(this.target) &&
      this.reactionTimer <= 0 &&
      !this.reloading &&
      this.fireTimer > 0.85
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
    let spread = this.baseSpread + (1 - this.botSkill) * 0.01
    const speed = Math.hypot(this.velocity.x, this.velocity.z)
    if (speed > 4) spread *= 2.6
    else if (speed > 0.4) spread *= 1.55
    if (this.reloading) spread *= 1.35
    spread += this.spreadBloom
    return Math.min(spread, 0.045)
  }

  fire() {
    if (this.magazine <= 0 || this.reloading || !this.target?.alive) return
    const now = performance.now()
    if (now - this.lastFire < this.fireDelay * 1000) return
    this.lastFire = now
    this.magazine--
    const muzzle = new THREE.Vector3()
    this.rifle.getWorldPosition(muzzle)
    muzzle.y = 1.4
    const target = this.target.position.clone()
    target.y = 1.4
    const direction = new THREE.Vector3().subVectors(target, muzzle).normalize()
    const spread = this.getSpread()
    this.spreadBloom = Math.min(0.02, this.spreadBloom + 0.0045)
    direction.x += (Math.random() - 0.5) * spread * 2
    direction.y += (Math.random() - 0.5) * spread * 2
    direction.z += (Math.random() - 0.5) * spread * 2
    direction.normalize()
    this.combat.fireBullet(muzzle, direction, this.team, this)
    this.effects.spawnMuzzleFlash(muzzle, direction)
    this.audio.botShot(muzzle)
  }

  startReload() {
    this.reloading = true
    this.reloadTimer = 0
  }

  takeDamage(amount, attacker) {
    if (!this.alive) return
    this.health -= amount
    if (this.stateName === 'patrol' && attacker) {
      this.target = attacker
      this.lastSeenTarget = attacker.position.clone()
      this.lastSeenTime = this.stateTimer
      this.stateName = 'engage'
      this.reactionTimer = this.config.botReactionTime * 0.5
    }
    const hitPosition = this.position.clone().setY(1.2)
    this.audio.hitFlesh(hitPosition)
    if (this.health <= 0) this.die(attacker)
    else this.audio.pain(0.25, hitPosition)
  }

  die(attacker) {
    this.alive = false
    this.stateName = 'dead'
    this.deaths++
    this.group.rotation.z = Math.PI / 2
    this.group.position.y = 0.3
    const fallPosition = this.position.clone().setY(0.3)
    this.effects.spawnBlood(this.position.clone().setY(1.2))
    this.audio.pain(0.4, fallPosition)
    this.audio.bodyFall(fallPosition)
    if (attacker) {
      if (attacker === this.gameState.player) {
        const headshot = !!this.gameState.player._pendingHeadshot
        this.gameState.player._pendingHeadshot = false
        this.gameState.player.kills++
        this.gameState.alliesScore++
        this.hud.addKillFeed('player', '你', this.name, this.team)
        this.hud.showKillNotify(this.name, headshot)
      } else if (attacker.team === 'allies') {
        this.gameState.alliesScore++
        this.hud.addKillFeed('ally', attacker.name, this.name, this.team)
      } else {
        this.gameState.axisScore++
        this.hud.addKillFeed('enemy', attacker.name, this.name, this.team)
      }
      attacker.kills++
    } else if (this.team === 'allies') this.gameState.axisScore++
    else this.gameState.alliesScore++
    this.hud.updateScores()
    this.checkVictory()
    setTimeout(() => this.respawn(), this.config.respawnTime * 1000)
  }

  respawn() {
    if (
      this.gameState.alliesScore >= this.config.killTarget ||
      this.gameState.axisScore >= this.config.killTarget
    )
      return
    this.alive = true
    this.health = this.maxHealth
    this.magazine = 8
    this.reloading = false
    this.stateName = 'patrol'
    this.target = null
    this.position.copy(this.getRandomSpawn(this.team))
    this.position.y = 0
    this.group.rotation.z = 0
    this.group.position.copy(this.position)
    this.patrolTarget = this.getRandomPatrolPoint()
  }

  handleCollisions() {
    for (const obstacle of this.gameState.obstacles) {
      if (['ground', 'crater', 'wire'].includes(obstacle.type)) continue
      resolveObstacleCollision(this.position, this.radius, obstacle)
    }
  }
}
