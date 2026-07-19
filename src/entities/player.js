import * as THREE from 'three'
import { rayHitObstacle, resolveObstacleCollision } from '../combat/collision.js'
import { WeaponView } from './weapon-view.js'

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
    deployment,
  }) {
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
    this.deployment = deployment
    this.team = 'allies'
    this.maxHealth = 100
    this.health = 100
    this.position = new THREE.Vector3(0, 1.7, 100)
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
    this.baseFov = 75
    this.currentFov = 75
    this.weapon = new WeaponView({
      camera,
      matLib,
      audio,
      reloadDuration: config.reloadDuration,
      emptyReloadDuration: config.emptyReloadDuration,
    })
    this.ammo = 8
    this.reserveAmmo = 96
    this.magSize = 8
    this.fireDelay = 0.15
    this.lastFire = 0
    this.reloading = false
    this.lastMelee = 0
    this.meleeDelay = 0.72
    this.meleeRange = 2.55
    this.meleeDamage = 100
    this.baseSpread = 0.004
    this.spreadBloom = 0
    this.currentSpread = 0.004
    this.kills = 0
    this.deaths = 0
    this.alive = true
    this.killStreak = 0
    this.lastKillAt = 0
    this._pendingHeadshot = false
    this.radius = 0.4
    this.standHeight = 1.7
    this.crouchHeight = 1.1
    this.currentHeight = 1.7
    this._moveDirection = new THREE.Vector3()
    this._moveRotation = new THREE.Euler()
    this._moveAxis = { x: 0, z: 0 }
    camera.position.copy(this.position)
    camera.rotation.order = 'YXZ'
  }

  addShake(amount) {
    this.shakeTrauma = Math.min(1, this.shakeTrauma + amount)
  }

  takeDamage(amount, fromPos, attacker) {
    if (!this.alive) return
    this.health -= amount
    this.audio.hitFlesh()
    this.hud.showDamageVignette()
    this.addShake(Math.min(0.55, 0.18 + amount * 0.004))
    this.viewRecoilPitch += 0.008 + amount * 0.00008
    this.viewRecoilYaw += (Math.random() - 0.5) * 0.012
    this.viewRecoilRoll += (Math.random() - 0.5) * 0.01
    if (fromPos) {
      const direction = new THREE.Vector3().subVectors(fromPos, this.position).setY(0).normalize()
      this.hud.showDirDamage(Math.atan2(direction.x, -direction.z) + this.yaw)
    }
    if (this.health <= 0) this.die(attacker)
  }

  die(attacker) {
    if (!this.alive) return
    this.alive = false
    this.deaths++
    this.killStreak = 0
    this.crouching = false
    this.sprinting = false
    this.aiming = false
    this.reloading = false
    this.weapon.resetActions()
    this.input.reset()
    this.input.updateTouchUi?.()
    this.weapon.setVisible(false)
    this.audio.pain(0.45)
    this.audio.bodyFall()
    this.addShake(0.4)
    this.deploy.phase = 'death'
    this.deploy.deathTimer = 3
    this.hud.showDeathScreen(attacker)
    this.deathCamStart = this.camera.position.clone()
    this.deathCamTime = 0
  }

  getSpread() {
    let spread = this.baseSpread
    const moving = Math.hypot(this.velocity.x, this.velocity.z) > 0.4
    if (this.aiming) spread *= 0.28
    else if (this.crouching) spread *= 0.65
    if (this.sprinting && moving) spread *= 2.6
    else if (moving) spread *= 1.55
    if (!this.onGround) spread *= 1.8
    if (this.reloading) spread *= 1.35
    spread += this.spreadBloom
    return Math.min(spread, 0.045)
  }

  fire() {
    if (!this.alive || this.reloading || this.weapon.meleeTime >= 0 || this.ammo <= 0) return
    const now = performance.now()
    if (now - this.lastFire < this.fireDelay * 1000) return
    this.lastFire = now
    this.ammo--
    this.weapon.triggerFire(this.aiming, this.ammo === 0)
    this.audio.rifleShot()
    const aiming = this.aiming
    this.viewRecoilPitch += (aiming ? 0.007 : 0.013) + Math.random() * 0.003
    this.viewRecoilYaw += (Math.random() - 0.5) * (aiming ? 0.0035 : 0.007)
    this.viewRecoilRoll += (Math.random() - 0.5) * (aiming ? 0.006 : 0.014)
    this.addShake(aiming ? 0.08 : 0.14)
    const spread = this.getSpread()
    this.spreadBloom = Math.min(0.02, this.spreadBloom + (aiming ? 0.0025 : 0.0045))
    const direction = new THREE.Vector3()
    this.camera.getWorldDirection(direction)
    direction.x += (Math.random() - 0.5) * spread * 2
    direction.y += (Math.random() - 0.5) * spread * 2
    direction.z += (Math.random() - 0.5) * spread * 2
    direction.normalize()
    const muzzle = this.weapon.muzzlePos.getWorldPosition(new THREE.Vector3())
    this.combat.fireBullet(this.camera.position.clone(), direction, 'allies', this, muzzle)
    const eject = this.weapon.group.localToWorld(new THREE.Vector3(0.06, 0.02, -0.08))
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion)
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion)
    this.effects.spawnShell(eject, right, up)
    this.effects.spawnMuzzleFlash(muzzle, direction, true)
    this.effects.spawnSmokePuff(muzzle)
    if (this.ammo === 0) {
      setTimeout(() => {
        if (this.alive && this.ammo === 0) this.reload()
      }, 420)
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
        if (!this.alive) return
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
    for (const bot of this.state.bots) {
      if (!bot.alive || bot.team === this.team) continue
      const chest = bot.position.clone()
      chest.y = 1.15
      const toTarget = chest.clone().sub(origin)
      const projection = toTarget.dot(direction)
      if (projection < 0.15 || projection > this.meleeRange) continue
      const closest = origin.clone().add(direction.clone().multiplyScalar(projection))
      if (closest.distanceTo(chest) < 0.75 && projection < hitDistance) {
        hitDistance = projection
        hitBot = bot
      }
    }
    if (hitBot) {
      const hitPosition = hitBot.position.clone().setY(1.2)
      this._pendingHeadshot = false
      hitBot.takeDamage(this.meleeDamage, this)
      this.audio.stabHitFlesh(hitPosition)
      this.effects.spawnBlood(hitPosition)
      this.hud.showHitMarker()
      this.viewRecoilPitch += 0.032
      this.addShake(0.5)
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
      this.addShake(0.36)
      this.weapon.kickZ += 0.045
      this.weapon.kickPitch += 0.018
      break
    }
  }

  update(dt) {
    if (this.deploy.phase === 'death') {
      this.deploy.deathTimer -= dt
      this.deathCamTime += dt
      const progress = Math.min(1, this.deathCamTime / 1)
      this.camera.position.y = this.deathCamStart.y - progress * 0.8
      this.camera.rotation.z = progress * 0.3
      this.camera.rotation.x = progress * 0.2
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
    this.shakeTrauma = Math.max(0, this.shakeTrauma - dt * 1.75)
    const lookDelta = this.input.consumeLookDelta()
    if (this.input.consumePressed('KeyC')) this.crouching = !this.crouching
    if (this.input.consumePressed('KeyR')) this.reload()
    if (this.input.consumePressed('KeyF')) this.melee()

    const aiming = this.input.isMouseDown('right') && !this.weapon.isBusy()
    const sprintHeld =
      this.input.isKeyDown('ShiftLeft') ||
      this.input.isKeyDown('ShiftRight') ||
      !!this.input.isStickSprint?.()
    if (sprintHeld && this.crouching && !aiming) this.crouching = false
    this.aiming = aiming
    this.sprinting = sprintHeld && !this.crouching && !this.aiming
    if (this.input.consumePressed('MouseLeft')) this.fire()

    const lookSensitivity =
      0.0011 * this.state.settings.mouseSensitivity * (this.aiming ? 0.5 : 1)
    this.yaw -= lookDelta.x * lookSensitivity
    this.yaw = Math.atan2(Math.sin(this.yaw), Math.cos(this.yaw))
    this.pitch -= lookDelta.y * lookSensitivity
    this.pitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, this.pitch))

    const targetHeight = this.crouching ? this.crouchHeight : this.standHeight
    this.currentHeight = THREE.MathUtils.lerp(this.currentHeight, targetHeight, dt * 10)
    const speed = this.crouching ? 2.2 : this.sprinting ? 9.5 : 5.2
    const moveAxis = this.input.getMoveAxis()
    const direction = this._moveDirection.set(moveAxis.x, 0, moveAxis.z)
    if (direction.lengthSq() > 0) {
      if (direction.lengthSq() > 1) direction.normalize()
      direction.applyEuler(this._moveRotation.set(0, this.yaw, 0))
      this.velocity.x = direction.x * speed
      this.velocity.z = direction.z * speed
    } else {
      this.velocity.x *= 0.8
      this.velocity.z *= 0.8
    }
    if (this.input.consumePressed('Space') && this.onGround) {
      this.velocity.y = 6
      this.onGround = false
    }
    this.velocity.y -= 18 * dt
    this.position.x += this.velocity.x * dt
    this.position.z += this.velocity.z * dt
    if (this.onGround) {
      this.position.y = this.currentHeight
    } else {
      this.position.y += this.velocity.y * dt
      if (this.position.y < this.currentHeight) {
        this.position.y = this.currentHeight
        this.velocity.y = 0
        this.onGround = true
      }
    }
    this.handleCollisions()
    const half = this.config.mapSize / 2 - 2
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
      const bobRate = this.sprinting ? 12.5 : this.crouching ? 5.2 : 7.8
      const previousPhase = this._bobPhase || 0
      this._bobPhase = previousPhase + dt * bobRate
      const previousSin = Math.sin(previousPhase)
      const currentSin = Math.sin(this._bobPhase)
      const amplitude = this.sprinting ? 0.018 : this.crouching ? 0.006 : 0.011
      headBobY = currentSin * amplitude
      bobPitch = Math.cos(this._bobPhase * 2) * (this.sprinting ? 0.0055 : 0.0032)
      bobRoll = Math.sin(this._bobPhase) * (this.sprinting ? 0.008 : 0.0045)
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
    if (this.aiming) targetFov = 55
    else if (this.sprinting && moving) targetFov = 86
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
    this.spreadBloom = Math.max(0, this.spreadBloom - dt * 0.035)
    this.currentSpread = this.getSpread()
    if (this.health < this.maxHealth) this.health = Math.min(this.maxHealth, this.health + dt * 4)
    this.hud.updateHealth()
    this.hud.updateCrosshair()
  }

  handleCollisions() {
    for (const obstacle of this.state.obstacles) {
      if (obstacle.type === 'ground' || obstacle.type === 'crater') continue
      resolveObstacleCollision(this.position, this.radius, obstacle)
    }
  }
}
