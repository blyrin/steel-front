import * as THREE from 'three'
import { createCircleHitbox, rayHitObstacle, resolveObstacleCollision } from '../combat/collision.js'
import { WeaponView } from './weapon-view.js'
import { attachFlashlight } from './flashlight.js'

export class Player {
  constructor({
    camera,
    sun,
    matLib,
    audio,
    state,
    deploy,
    input,
    config,
    hud,
    effects,
    combat,
    scoring,
    deployment,
    mode,
  }) {
    const playerConfig = config.player
    const weaponConfig = config.weapon
    this.camera = camera
    this.sun = sun
    this.audio = audio
    this.state = state
    this.deploy = deploy
    this.input = input
    this.config = config
    this.hud = hud
    this.effects = effects
    this.combat = combat
    this.scoring = scoring
    this.deployment = deployment
    this.mode = mode
    this.team = 'allies'
    this.maxHealth = playerConfig.maxHealth
    this.health = playerConfig.maxHealth
    this.position = new THREE.Vector3(0, playerConfig.standHeight, 100)
    this.velocity = new THREE.Vector3()
    this.yaw = 0
    this.pitch = 0
    this.onGround = true
    this.crouching = false
    this.sprinting = false
    this.aiming = false
    this.viewRecoilPitch = 0
    this.viewRecoilYaw = 0
    this.viewRecoilRoll = 0
    this.shakeTrauma = 0
    this.shakeTime = 0
    this.lookSwayPitch = 0
    this.lookSwayYaw = 0
    this.lookSwayRoll = 0
    this.moveLean = 0
    this.baseFov = playerConfig.baseFov
    this.currentFov = playerConfig.baseFov
    this.loadout = { ...state.settings.loadout }
    this.weapon = new WeaponView({
      camera,
      matLib,
      audio,
      config: weaponConfig,
      reloadDuration: weaponConfig.reloadDuration,
      emptyReloadDuration: weaponConfig.emptyReloadDuration,
    })
    this.weaponData = null
    this.ammo = 0
    this.reserveAmmo = 0
    this.magSize = 0
    this.fireDelay = 0
    this.lastFire = 0
    this.reloading = false
    this.grenadeCount = 0
    this.itemUses = 0
    this.lastGrenade = 0
    this.nextSupplyAt = 0
    this.applyLoadout(this.loadout, false)
    this.lastMelee = 0
    this.meleeDelay = weaponConfig.meleeDelay
    this.meleeRange = weaponConfig.meleeRange
    this.meleeDamage = weaponConfig.meleeDamage
    this.spreadBloom = 0
    this.currentSpread = this.baseSpread
    this.kills = 0
    this.deaths = 0
    this.headshots = 0
    this.meleeKills = 0
    this.grenadeKills = 0
    this.bestKillStreak = 0
    this.alive = true
    this.killStreak = 0
    this.lastKillAt = 0
    this.radius = playerConfig.radius
    this.standHeight = playerConfig.standHeight
    this.hitboxes = [
      createCircleHitbox(
        this.radius,
        0,
        this.standHeight - playerConfig.bodyHitboxHeightOffset
      ),
      createCircleHitbox(
        this.radius * playerConfig.headHitboxRadiusMultiplier,
        this.standHeight - playerConfig.headHitboxHeightOffset,
        this.standHeight,
        true
      ),
    ]
    this.crouchHeight = playerConfig.crouchHeight
    this.currentHeight = this.standHeight
    this._moveDirection = new THREE.Vector3()
    this._moveRotation = new THREE.Euler()
    this._moveAxis = { x: 0, z: 0 }
    camera.position.copy(this.position)
    camera.rotation.order = 'YXZ'
    if (this.mode?.id === 'zombie') {
      attachFlashlight(
        camera,
        new THREE.Vector3(0.12, -0.1, -0.28),
        new THREE.Vector3(0.12, -0.08, -18)
      )
    }
  }

  applyLoadout(loadout, preserveHealth = true) {
    this.loadout = { ...loadout }
    this.weaponData = this.config.weapons[this.loadout.weapon]
    this.weapon.configure(this.weaponData)
    this.magSize = this.weaponData.magazineSize
    this.fireDelay = this.weaponData.fireDelay
    this.baseSpread = this.weaponData.baseSpread
    this.maxHealth = this.config.player.maxHealth
    this.health = preserveHealth ? Math.min(this.health, this.maxHealth) : this.maxHealth
    this.grenadeData = this.config.grenades[this.loadout.grenade]
    this.itemData = this.config.items[this.loadout.item]
    this.grenadeCount = this.grenadeData.count
    this.itemUses = this.itemData.uses || 0
    this.nextSupplyAt = 0
    this.ammo = this.magSize
    this.reserveAmmo = this.weaponData.reserveAmmo
    this.reloading = false
    this.weapon.resetActions()
  }

  getHitboxes() {
    const playerConfig = this.config.player
    const height = this.currentHeight
    const groundHeight = this.position.y - height
    this.hitboxes[0].minY = groundHeight
    this.hitboxes[0].maxY = groundHeight + height - playerConfig.bodyHitboxHeightOffset
    this.hitboxes[1].minY = groundHeight + height - playerConfig.headHitboxHeightOffset
    this.hitboxes[1].maxY = groundHeight + height
    for (const hitbox of this.hitboxes) {
      hitbox.x = this.position.x
      hitbox.z = this.position.z
    }
    return this.hitboxes
  }

  addShake(amount) {
    this.shakeTrauma = Math.min(this.config.player.shakeTraumaMax, this.shakeTrauma + amount)
  }

  takeDamage(amount, fromPos, attacker, attackType = 'weapon') {
    const playerConfig = this.config.player
    if (!this.alive) return
    this.health -= amount
    this.audio.hitFlesh()
    this.hud.showDamageVignette()
    this.viewRecoilPitch +=
      playerConfig.damageRecoilPitchBase + amount * playerConfig.damageRecoilPitchScale
    this.viewRecoilYaw += (Math.random() - 0.5) * playerConfig.damageRecoilYaw
    this.viewRecoilRoll += (Math.random() - 0.5) * playerConfig.damageRecoilRoll
    if (fromPos) {
      const direction = new THREE.Vector3().subVectors(fromPos, this.position).setY(0).normalize()
      this.hud.showDirDamage(Math.atan2(direction.x, -direction.z) + this.yaw)
    }
    if (this.health <= 0) this.die(attacker, attackType)
  }

  die(attacker, attackType = 'weapon') {
    const playerConfig = this.config.player
    if (!this.alive) return
    this.alive = false
    this.killStreak = 0
    this.crouching = false
    this.sprinting = false
    this.aiming = false
    this.reloading = false
    this.weapon.resetActions()
    this.input.reset()
    this.input.updateTouchUi?.()
    this.weapon.setVisible(false)
    this.audio.pain(playerConfig.deathPainChance)
    this.audio.bodyFall()
    this.addShake(playerConfig.deathShake)
    this.deploy.phase = 'death'
    this.deploy.deathTimer = playerConfig.deathTimer
    this.hud.showDeathScreen(attacker)
    this.deathCamStart = this.camera.position.clone()
    this.deathCamTime = 0
    this.scoring.recordElimination(this, attacker, false, attackType)
  }

  getSpread() {
    const weaponConfig = this.config.weapon
    let spread = this.baseSpread
    const moving =
      Math.hypot(this.velocity.x, this.velocity.z) > this.config.weapon.playerMovingThreshold
    if (this.aiming) spread *= weaponConfig.aimingSpreadMultiplier
    else if (this.crouching) spread *= weaponConfig.crouchingSpreadMultiplier
    if (this.sprinting && moving) spread *= weaponConfig.sprintingSpreadMultiplier
    else if (moving) spread *= weaponConfig.movingSpreadMultiplier
    if (!this.onGround) spread *= weaponConfig.airborneSpreadMultiplier
    if (this.reloading) spread *= weaponConfig.reloadingSpreadMultiplier
    spread += this.spreadBloom
    return Math.min(spread, weaponConfig.maxSpread)
  }

  fire() {
    const weaponConfig = this.config.weapon
    if (!this.alive || this.reloading || this.weapon.meleeTime >= 0 || this.ammo <= 0) return
    const now = performance.now()
    if (now - this.lastFire < this.fireDelay * 1000) return
    this.lastFire = now
    this.state.lastPlayerShot = {
      x: this.position.x,
      z: this.position.z,
      at: now,
    }
    this.ammo--
    if (this.weaponData.modelId === 'shotgun') this.audio.shotgunShot()
    else if (this.weaponData.modelId === 'thompson') this.audio.thompsonShot()
    else if (this.weaponData.modelId === 'bar') this.audio.barShot()
    else this.audio.garandShot()
    const aiming = this.aiming
    const recoilMultiplier = this.weaponData.recoilMultiplier
    const recoilImpulse = {
      pitch:
        ((aiming ? weaponConfig.aimingRecoilPitch : weaponConfig.hipRecoilPitch) +
          Math.random() * weaponConfig.recoilPitchRandom) *
        recoilMultiplier,
      yaw:
        (Math.random() - 0.5) *
        (aiming ? weaponConfig.aimingRecoilYaw : weaponConfig.hipRecoilYaw) *
        recoilMultiplier,
      roll:
        (Math.random() - 0.5) *
        (aiming ? weaponConfig.aimingRecoilRoll : weaponConfig.hipRecoilRoll) *
        recoilMultiplier,
    }
    this.viewRecoilPitch += recoilImpulse.pitch
    this.viewRecoilYaw += recoilImpulse.yaw
    this.viewRecoilRoll += recoilImpulse.roll
    this.weapon.triggerFire(aiming, this.ammo === 0, recoilImpulse)
    this.addShake(
      (aiming ? weaponConfig.aimingFireShake : weaponConfig.hipFireShake) * recoilMultiplier
    )
    const spread = this.getSpread()
    this.spreadBloom = Math.min(
      weaponConfig.spreadBloomMax,
      this.spreadBloom +
        (aiming
          ? this.weaponData.aimedSpreadBloomPerShot
          : this.weaponData.spreadBloomPerShot)
    )
    const aimDirection = new THREE.Vector3()
    this.camera.getWorldDirection(aimDirection)
    const muzzle = this.weapon.muzzlePos.getWorldPosition(new THREE.Vector3())
    const pelletCount = this.weaponData.pellets ?? 1
    for (let pellet = 0; pellet < pelletCount; pellet++) {
      const direction = aimDirection.clone()
      direction.x += (Math.random() - 0.5) * spread * 2
      direction.y += (Math.random() - 0.5) * spread * 2
      direction.z += (Math.random() - 0.5) * spread * 2
      direction.normalize()
      this.combat.fireBullet(
        this.camera.position.clone(),
        direction,
        'allies',
        this,
        muzzle,
        this.weaponData
      )
    }
    const eject = this.weapon.group.localToWorld(new THREE.Vector3(0.06, 0.02, -0.08))
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion)
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion)
    this.effects.spawnShell(eject, right, up)
    this.effects.spawnMuzzleFlash(muzzle, aimDirection, true)
    this.effects.spawnSmokePuff(muzzle)
    if (this.ammo === 0) {
      setTimeout(() => {
        if (this.alive && this.ammo === 0) this.reload()
      }, weaponConfig.emptyReloadDelay * 1000)
    }
    this.hud.updateAmmo()
    this.hud.updateCrosshair()
  }

  reload() {
    if (!this.alive || this.reloading || this.weapon.isBusy()) return
    if (this.ammo >= this.magSize || this.reserveAmmo <= 0) return
    this.reloading = true
    this.weapon.triggerReload(this.ammo === 0)
    setTimeout(
      () => {
        if (!this.alive || !this.reloading) return
        const need = this.magSize - this.ammo
        const amount = Math.min(need, this.reserveAmmo)
        this.ammo += amount
        this.reserveAmmo -= amount
        this.reloading = false
        this.hud.updateAmmo()
      },
      Math.round(this.weapon.getReloadDuration() * 1000)
    )
  }

  throwGrenade() {
    const now = performance.now()
    if (
      !this.alive ||
      this.reloading ||
      this.weapon.isBusy() ||
      this.grenadeCount <= 0 ||
      now - this.lastGrenade < this.config.grenade.cooldown * 1000
    )
      return
    this.lastGrenade = now
    this.grenadeCount--
    this.aiming = false
    const direction = new THREE.Vector3()
    this.camera.getWorldDirection(direction)
    this.combat.throwGrenade(
      this.camera.position.clone().addScaledVector(direction, 0.5),
      direction,
      this.grenadeData,
      this.team,
      this
    )
    this.hud.updateAmmo()
  }

  useItem() {
    if (!this.alive || this.itemUses <= 0) return
    if (this.itemData.kind === 'heal') {
      if (this.health >= this.maxHealth) return
      this.health = Math.min(this.maxHealth, this.health + this.itemData.amount)
      this.hud.showActionMessage('已使用急救包')
    } else {
      if (this.reserveAmmo >= this.weaponData.reserveAmmo) return
      this.reserveAmmo = this.weaponData.reserveAmmo
      this.hud.showActionMessage('已补充携行弹药')
    }
    this.itemUses--
    this.hud.updateHealth()
    this.hud.updateAmmo()
  }

  isNearStation(stations) {
    return stations.some(
      station => this.position.distanceTo(station.position) <= this.config.supply.interactRadius
    )
  }

  useMedicalStation() {
    if (!this.isNearStation(this.state.medicalStations)) return false
    const now = performance.now()
    if (now < this.nextSupplyAt) {
      this.hud.showActionMessage(`补给冷却中 ${Math.ceil((this.nextSupplyAt - now) / 1000)} 秒`)
      return true
    }
    if (this.health >= this.maxHealth) {
      this.hud.showActionMessage('生命值已满')
      return true
    }
    this.health = this.maxHealth
    this.nextSupplyAt = now + this.config.supply.cooldown * 1000
    this.hud.updateHealth()
    this.hud.showActionMessage('医疗补给完成')
    return true
  }

  useAmmoStation() {
    if (!this.isNearStation(this.state.ammoStations)) return false
    const now = performance.now()
    if (now < this.nextSupplyAt) {
      this.hud.showActionMessage(`补给冷却中 ${Math.ceil((this.nextSupplyAt - now) / 1000)} 秒`)
      return true
    }
    const maxGrenades = this.grenadeData.count
    const maxItemUses = this.itemData.uses || 0
    const needsResupply =
      this.reserveAmmo < this.weaponData.reserveAmmo ||
      this.grenadeCount < maxGrenades ||
      this.itemUses < maxItemUses
    if (!needsResupply) {
      this.hud.showActionMessage('补给已满')
      return true
    }
    this.reserveAmmo = this.weaponData.reserveAmmo
    this.grenadeCount = maxGrenades
    this.itemUses = maxItemUses
    this.nextSupplyAt = now + this.config.supply.cooldown * 1000
    this.hud.updateAmmo()
    this.hud.showActionMessage('弹药、投掷物和道具补给完成')
    return true
  }

  melee() {
    if (!this.alive || this.reloading || this.weapon.isBusy()) return
    const now = performance.now()
    if (now - this.lastMelee < this.meleeDelay * 1000) return
    this.lastMelee = now
    this.aiming = false
    this.weapon.triggerMelee()
    this.audio.stabSwing()
    this.viewRecoilPitch -= 0.008
    this.viewRecoilYaw *= 0.5
    this.viewRecoilRoll *= 0.4
    this.addShake(0.1)
    const duration = this.weapon.meleeDuration * 1000
    setTimeout(
      () => {
        if (!this.alive || this.deploy.phase !== 'none') return
        this.viewRecoilPitch += 0.03
        this.viewRecoilRoll *= 0.3
        this.addShake(0.22)
      },
      Math.round(duration * 0.22)
    )
    setTimeout(() => this.resolveMelee(), Math.round(duration * 0.36))
  }

  resolveMelee() {
    if (!this.alive || this.deploy.phase !== 'none') return
    const origin = this.camera.position.clone()
    const direction = new THREE.Vector3()
    this.camera.getWorldDirection(direction)
    let hitBot = null
    let hitDistance = this.meleeRange
    for (const bot of this.state.actors) {
      if (!bot.alive || bot.team === this.team) continue
      for (const hitbox of bot.getHitboxes()) {
        const t = rayHitObstacle(origin, direction, hitbox, hitDistance)
        if (t == null || t < 0.15) continue
        hitDistance = t
        hitBot = bot
      }
    }
    if (hitBot) {
      const hitPosition = hitBot.position.clone().setY(1.2)
      hitBot.takeDamage(this.meleeDamage, this, false, 'melee')
      this.audio.stabHitFlesh(hitPosition)
      this.effects.spawnBlood(hitPosition)
      this.hud.showHitMarker()
      this.viewRecoilPitch += 0.032
      this.weapon.kickZ += 0.036
      this.weapon.kickPitch += 0.022
      return
    }

    for (const obstacle of this.state.obstacles) {
      if (obstacle.type === 'ground' || obstacle.type === 'crater') continue
      const t = rayHitObstacle(origin, direction, obstacle, this.meleeRange)
      if (t == null || t < 0.25) continue
      const hitPoint = origin.clone().add(direction.clone().multiplyScalar(t))
      this.audio.stabHitMetal(hitPoint)
      this.viewRecoilPitch += 0.02
      this.weapon.kickZ += 0.045
      this.weapon.kickPitch += 0.018
      break
    }
  }

  update(dt) {
    const playerConfig = this.config.player
    const weaponConfig = this.config.weapon
    if (this.deploy.phase === 'death') {
      this.deploy.deathTimer -= dt
      this.deathCamTime += dt
      const progress = Math.min(1, this.deathCamTime / playerConfig.deathCameraDuration)
      this.camera.position.y = this.deathCamStart.y - progress * playerConfig.deathCameraDrop
      this.camera.rotation.z = progress * playerConfig.deathCameraRoll
      this.camera.rotation.x = progress * playerConfig.deathCameraPitch
      if (this.deploy.deathTimer <= 0) {
        this.hud.hideDeathScreen()
        this.deployment.showScreen()
      }
      return
    }
    if (this.deploy.phase === 'to_deploy') {
      this.deployment.updateToScreen(dt)
      return
    }
    if (this.deploy.phase === 'deploy_screen') {
      this.deployment.updateScreenCamera()
      return
    }
    if (this.deploy.phase === 'deploying') {
      this.deployment.update(dt)
      return
    }
    if (!this.alive) return

    this.viewRecoilPitch *= Math.pow(0.0001, dt)
    this.viewRecoilYaw *= Math.pow(0.0001, dt)
    this.viewRecoilRoll *= Math.pow(0.0002, dt)
    this.shakeTime += dt
    this.shakeTrauma = Math.max(
      0,
      this.shakeTrauma - dt * playerConfig.shakeRecovery
    )
    const lookDelta = this.input.consumeLookDelta()
    if (this.input.consumePressed('KeyC')) this.crouching = !this.crouching
    if (this.input.consumePressed('KeyR')) this.reload()
    if (this.input.consumePressed('KeyF')) this.melee()
    if (this.input.consumePressed('KeyG')) this.throwGrenade()
    if (this.input.consumePressed('KeyH')) this.useItem()
    if (this.input.consumePressed('KeyE')) {
      if (!this.useMedicalStation()) this.useAmmoStation()
    }

    const aiming = this.input.isMouseDown('right') && !this.weapon.isBusy()
    const sprintHeld =
      this.input.isKeyDown('ShiftLeft') ||
      this.input.isKeyDown('ShiftRight') ||
      !!this.input.isStickSprint?.()
    if (sprintHeld && this.crouching && !aiming) this.crouching = false
    this.aiming = aiming
    this.sprinting = sprintHeld && !this.crouching && !this.aiming
    const firePressed = this.input.consumePressed('MouseLeft')
    if (this.weaponData.automatic ? this.input.isMouseDown('left') : firePressed) this.fire()

    const lookSensitivity =
      playerConfig.lookSensitivity *
      this.state.settings.mouseSensitivity *
      (this.aiming ? playerConfig.aimingLookMultiplier : 1)
    this.yaw -= lookDelta.x * lookSensitivity
    this.yaw = Math.atan2(Math.sin(this.yaw), Math.cos(this.yaw))
    this.pitch -= lookDelta.y * lookSensitivity
    this.pitch = Math.max(
      -Math.PI / 2 + playerConfig.pitchLimit,
      Math.min(Math.PI / 2 - playerConfig.pitchLimit, this.pitch)
    )

    const targetHeight = this.crouching ? this.crouchHeight : this.standHeight
    this.currentHeight = THREE.MathUtils.lerp(
      this.currentHeight,
      targetHeight,
      dt * playerConfig.crouchTransitionSpeed
    )
    let speed = playerConfig.walkSpeed
    if (this.crouching) speed = playerConfig.crouchSpeed
    else if (this.sprinting) speed = playerConfig.sprintSpeed
    const moveAxis = this.input.getMoveAxis()
    const direction = this._moveDirection.set(moveAxis.x, 0, moveAxis.z)
    if (direction.lengthSq() > 0) {
      if (direction.lengthSq() > 1) direction.normalize()
      direction.applyEuler(this._moveRotation.set(0, this.yaw, 0))
      this.velocity.x = direction.x * speed
      this.velocity.z = direction.z * speed
    } else {
      this.velocity.x *= playerConfig.movementDamping
      this.velocity.z *= playerConfig.movementDamping
    }
    if (this.input.consumePressed('Space') && this.onGround) {
      this.velocity.y = playerConfig.jumpVelocity
      this.onGround = false
    }
    this.velocity.y -= playerConfig.gravity * dt
    this.position.x += this.velocity.x * dt
    this.position.z += this.velocity.z * dt
    const groundHeight = this.state.groundHeightAt(this.position.x, this.position.z)
    const standingY = groundHeight + this.currentHeight
    if (this.onGround) {
      this.position.y = standingY
    } else {
      this.position.y += this.velocity.y * dt
      if (this.position.y < standingY) {
        this.position.y = standingY
        this.velocity.y = 0
        this.onGround = true
      }
    }
    this.handleCollisions()
    const half = this.config.match.mapSize / 2 - 2
    this.position.x = Math.max(-half, Math.min(half, this.position.x))
    this.position.z = Math.max(-half, Math.min(half, this.position.z))

    const moving = direction.lengthSq() > 0 && this.onGround
    const animAxis = this._moveAxis
    animAxis.x = moveAxis.x
    animAxis.z = moveAxis.z
    let headBobY = 0
    let bobPitch = 0
    let bobRoll = 0
    if (moving) {
      let bobRate = 7.8
      let amplitude = 0.011
      let bobPitchScale = 0.0032
      let bobRollScale = 0.0045
      if (this.sprinting) {
        bobRate = 12.5
        amplitude = 0.018
        bobPitchScale = 0.0055
        bobRollScale = 0.008
      } else if (this.crouching) {
        bobRate = 5.2
        amplitude = 0.006
      }
      const previousPhase = this._bobPhase || 0
      this._bobPhase = previousPhase + dt * bobRate
      const previousSin = Math.sin(previousPhase)
      const currentSin = Math.sin(this._bobPhase)
      headBobY = currentSin * amplitude
      bobPitch = Math.cos(this._bobPhase * 2) * bobPitchScale
      bobRoll = Math.sin(this._bobPhase) * bobRollScale
      if ((previousSin <= 0 && currentSin > 0) || (previousSin >= 0 && currentSin < 0))
        this.audio.step()
    } else {
      this._bobPhase *= Math.exp(-8 * dt)
      headBobY = Math.sin(this._bobPhase || 0) * 0.002
    }

    const aimMultiplier = this.aiming ? 0.35 : 1
    const targetLookPitch = THREE.MathUtils.clamp(
      lookDelta.y * 0.00009 * aimMultiplier,
      -0.012,
      0.012
    )
    const targetLookYaw = THREE.MathUtils.clamp(
      lookDelta.x * 0.00008 * aimMultiplier,
      -0.01,
      0.01
    )
    const targetLookRoll = THREE.MathUtils.clamp(
      -lookDelta.x * 0.00014 * aimMultiplier,
      -0.02,
      0.02
    )
    const lookEase = 1 - Math.exp(-10 * dt)
    this.lookSwayPitch += (targetLookPitch - this.lookSwayPitch) * lookEase
    this.lookSwayYaw += (targetLookYaw - this.lookSwayYaw) * lookEase
    this.lookSwayRoll += (targetLookRoll - this.lookSwayRoll) * lookEase
    const targetLean = THREE.MathUtils.clamp(
      animAxis.x * (this.sprinting ? 0.02 : 0.014) * aimMultiplier,
      -0.025,
      0.025
    )
    this.moveLean += (targetLean - this.moveLean) * (1 - Math.exp(-7 * dt))

    this.camera.up.set(0, 1, 0)
    this.camera.position.set(this.position.x, this.position.y + headBobY, this.position.z)
    this.camera.rotation.order = 'YXZ'
    let rotationX = this.pitch + this.viewRecoilPitch + bobPitch + this.lookSwayPitch
    let rotationY = this.yaw + this.viewRecoilYaw + this.lookSwayYaw
    let rotationZ = this.viewRecoilRoll + bobRoll + this.lookSwayRoll + this.moveLean
    if (this.shakeTrauma > 0.001) {
      const strength = this.shakeTrauma * this.shakeTrauma
      const time = this.shakeTime
      this.camera.position.x +=
        (Math.sin(time * 41.3) * 0.55 + Math.sin(time * 73.1) * 0.45) * strength * 0.07
      this.camera.position.y +=
        (Math.cos(time * 37.7) * 0.55 + Math.sin(time * 67.9) * 0.45) * strength * 0.065
      this.camera.position.z += Math.sin(time * 29.5) * strength * 0.03
      rotationX += (Math.sin(time * 47.2) * 0.6 + Math.cos(time * 61.8) * 0.4) * strength * 0.014
      rotationY += (Math.cos(time * 39.6) * 0.6 + Math.sin(time * 55.4) * 0.4) * strength * 0.012
      rotationZ += Math.sin(time * 51) * strength * 0.018
    }
    this.camera.rotation.set(rotationX, rotationY, rotationZ)
    let targetFov = this.baseFov
    if (this.aiming) targetFov = playerConfig.aimingFov
    else if (this.sprinting && moving) targetFov = playerConfig.sprintingFov
    this.currentFov += (targetFov - this.currentFov) * (1 - Math.exp(-7 * dt))
    if (Math.abs(this.camera.fov - this.currentFov) > 0.15) {
      this.camera.fov = this.currentFov
      this.camera.updateProjectionMatrix()
    }
    this.sun.target.position.set(this.position.x, 0, this.position.z)
    this.sun.position.set(this.position.x + 90, 95, this.position.z + 55)
    this.sun.target.updateMatrixWorld()
    this.weapon.update(
      dt,
      direction.lengthSq() > 0,
      this.sprinting,
      this.aiming,
      lookDelta,
      this._bobPhase || 0,
      animAxis
    )
    this.spreadBloom = Math.max(
      0,
      this.spreadBloom - dt * weaponConfig.spreadBloomRecovery
    )
    this.currentSpread = this.getSpread()
    if (this.mode?.id !== 'zombie' && this.health < this.maxHealth)
      this.health = Math.min(this.maxHealth, this.health + dt * playerConfig.healthRegen)
    this.hud.updateHealth()
    this.hud.updateCrosshair()
  }

  handleCollisions() {
    for (const obstacle of this.state.obstacles) {
      if (obstacle.type === 'ground' || obstacle.type === 'crater') continue
      resolveObstacleCollision(
        this.position,
        this.radius,
        obstacle,
        this.position.y - this.currentHeight
      )
    }
  }
}
