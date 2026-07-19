import * as THREE from 'three'

export class WeaponView {
  constructor({ camera, matLib, audio }) {
    this.camera = camera
    this.matLib = matLib
    this.audio = audio
    this.group = new THREE.Group()
    this.bobTime = 0
    this.boltTime = -1
    this.reloadTime = -1
    this.meleeTime = -1
    this.meleeDuration = 0.58
    this.reloadDuration = 2.2
    this.boltDuration = 0.36
    this.aiming = false
    this.swayX = 0
    this.swayY = 0
    this.swayTilt = 0
    this.swayPitch = 0
    this.strafeLean = 0
    this.sprintDip = 0
    this.kickZ = 0
    this.kickY = 0
    this.kickX = 0
    this.kickPitch = 0
    this.kickYaw = 0
    this.kickRoll = 0
    this.kickVelZ = 0
    this.kickVelY = 0
    this.kickVelPitch = 0
    this.smoothPos = new THREE.Vector3()
    this.build()
    camera.add(this.group)
  }

  build() {
    const wood = this.matLib.wood
    const metal = this.matLib.metal
    const dark = this.matLib.metalDark
    const slingMat = new THREE.MeshStandardMaterial({
      color: 0x3a2515,
      roughness: 0.95,
      metalness: 0.05,
    })
    const brass = new THREE.MeshStandardMaterial({
      color: 0xb08a3a,
      roughness: 0.45,
      metalness: 0.7,
    })
    const add = (mesh, parent = this.group) => {
      mesh.castShadow = false
      mesh.receiveShadow = false
      parent.add(mesh)
      return mesh
    }

    const buttPad = add(new THREE.Mesh(new THREE.BoxGeometry(0.064, 0.09, 0.016), dark))
    buttPad.position.set(0, -0.04, 0.3)
    const butt = add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.086, 0.2), wood))
    butt.position.set(0, -0.04, 0.2)
    const comb = add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.14), wood))
    comb.position.set(0, 0.012, 0.16)
    const wrist = add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.058, 0.12), wood))
    wrist.position.set(0, -0.03, 0.06)
    const gripWood = add(new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.05, 0.16), wood))
    gripWood.position.set(0, -0.03, -0.04)
    const forend = add(new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.042, 0.42), wood))
    forend.position.set(0, -0.014, -0.3)
    const handguard = add(new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.022, 0.34), wood))
    handguard.position.set(0, 0.022, -0.36)
    for (const side of [-1, 1]) {
      const sideWood = add(new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.03, 0.34), wood))
      sideWood.position.set(side * 0.028, 0.004, -0.36)
    }

    const receiver = add(new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.04, 0.22), metal))
    receiver.position.set(0, 0.01, -0.08)
    for (const side of [-1, 1]) {
      const plate = add(new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.038, 0.2), dark))
      plate.position.set(side * 0.026, 0.01, -0.08)
    }
    const topFront = add(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.01, 0.06), dark))
    topFront.position.set(0, 0.034, -0.16)
    const topRear = add(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.01, 0.05), dark))
    topRear.position.set(0, 0.034, 0)
    const magWell = add(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, 0.06), dark))
    magWell.position.set(0, -0.012, -0.1)
    const chamber = add(new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.015, 0.04, 10), metal))
    chamber.rotation.x = Math.PI / 2
    chamber.position.set(0, 0.014, -0.2)

    const barrel = add(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.72, 10), metal))
    barrel.rotation.x = Math.PI / 2
    barrel.position.set(0, 0.016, -0.58)
    const gasTube = add(new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.009, 0.48, 8), dark))
    gasTube.rotation.x = Math.PI / 2
    gasTube.position.set(0, -0.004, -0.52)
    const gasLock = add(new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.045, 10), dark))
    gasLock.rotation.x = Math.PI / 2
    gasLock.position.set(0, 0.004, -0.78)
    const band = add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.028), dark))
    band.position.set(0, 0.006, -0.56)
    const muzzle = add(new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, 0.04, 10), dark))
    muzzle.rotation.x = Math.PI / 2
    muzzle.position.set(0, 0.016, -0.96)
    this.muzzlePos = new THREE.Object3D()
    this.muzzlePos.position.set(0, 0.016, -1.02)
    this.group.add(this.muzzlePos)

    this.bayonet = new THREE.Group()
    const bladeMat = new THREE.MeshStandardMaterial({
      color: 0xc8c4b8,
      roughness: 0.28,
      metalness: 0.9,
    })
    const mount = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.016, 0.04), dark)
    mount.position.set(0, -0.014, 0)
    this.bayonet.add(mount)
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.006, 0.24), bladeMat)
    blade.position.set(0, -0.016, -0.14)
    this.bayonet.add(blade)
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.006, 0.04, 4), bladeMat)
    tip.rotation.x = -Math.PI / 2
    tip.position.set(0, -0.016, -0.28)
    this.bayonet.add(tip)
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.01, 0.008), dark)
    guard.position.set(0, -0.014, -0.02)
    this.bayonet.add(guard)
    this.bayonet.position.set(0, -0.004, -0.98)
    this.group.add(this.bayonet)

    const frontSightBase = add(new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.008, 0.026), dark))
    frontSightBase.position.set(0, 0.03, -0.9)
    const frontSightPost = add(new THREE.Mesh(new THREE.BoxGeometry(0.0035, 0.022, 0.005), dark))
    frontSightPost.position.set(0, 0.044, -0.9)
    for (const side of [-1, 1]) {
      const wing = add(new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.018, 0.018), dark))
      wing.position.set(side * 0.012, 0.04, -0.9)
    }

    const rearSightBase = add(new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.01, 0.022), dark))
    rearSightBase.position.set(0, 0.04, -0.04)
    const rearSightLeft = add(new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.02, 0.014), dark))
    rearSightLeft.position.set(-0.012, 0.055, -0.04)
    const rearSightRight = add(new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.02, 0.014), dark))
    rearSightRight.position.set(0.012, 0.055, -0.04)
    const rearSightFloor = add(new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.004, 0.014), dark))
    rearSightFloor.position.set(0, 0.046, -0.04)
    this.sightCenter = new THREE.Vector3(0, 0.055, -0.04)

    const triggerGuard = add(
      new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.0035, 6, 12, Math.PI), dark)
    )
    triggerGuard.rotation.x = Math.PI / 2
    triggerGuard.rotation.z = Math.PI
    triggerGuard.position.set(0, -0.052, -0.02)
    const trigger = add(new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.024, 0.01), dark))
    trigger.position.set(0, -0.048, -0.015)
    trigger.rotation.x = 0.25

    this.mag = add(new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.032, 0.044), brass))
    this.magBase = new THREE.Vector3(0, -0.002, -0.1)
    this.mag.position.copy(this.magBase)
    const clipLip = add(new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.006, 0.046), metal), this.mag)
    clipLip.position.set(0, 0.016, 0)
    this.reloadFlags = { open: false, insert: false, seat: false, close: false }

    this.bolt = new THREE.Group()
    const opRod = new THREE.Mesh(new THREE.BoxGeometry(0.009, 0.012, 0.09), metal)
    this.bolt.add(opRod)
    const opHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.009, 0.028, 8), metal)
    opHandle.rotation.z = Math.PI / 2
    opHandle.position.set(0.022, 0, 0.02)
    this.bolt.add(opHandle)
    const opKnob = new THREE.Mesh(new THREE.SphereGeometry(0.01, 8, 6), dark)
    opKnob.position.set(0.038, 0, 0.02)
    this.bolt.add(opKnob)
    this.bolt.position.set(0.032, 0.014, -0.12)
    this.group.add(this.bolt)
    this.boltBase = new THREE.Vector3(0.032, 0.014, -0.12)

    const sling = add(new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.003, 0.42), slingMat))
    sling.position.set(-0.028, -0.044, -0.06)
    sling.rotation.z = 0.12
    sling.rotation.x = 0.05
    const slingFront = add(new THREE.Mesh(new THREE.TorusGeometry(0.01, 0.0022, 4, 8), dark))
    slingFront.position.set(0, -0.04, -0.44)
    slingFront.rotation.y = Math.PI / 2
    const slingRear = add(new THREE.Mesh(new THREE.TorusGeometry(0.01, 0.0022, 4, 8), dark))
    slingRear.position.set(0, -0.048, 0.22)
    slingRear.rotation.y = Math.PI / 2

    this.basePosition = new THREE.Vector3(0.18, -0.18, -0.28)
    this.aimPosition = new THREE.Vector3(-this.sightCenter.x, -this.sightCenter.y, -0.48)
    this.aimPitch = 0
    this.smoothPos.copy(this.basePosition)
    this.group.position.copy(this.basePosition)
    this.group.rotation.y = 0.03
  }

  setVisible(visible) {
    this.group.visible = visible
  }

  resetActions() {
    this.boltTime = -1
    this.reloadTime = -1
    this.meleeTime = -1
    this.reloadFlags = { open: false, insert: false, seat: false, close: false }
    this.mag.visible = true
    this.mag.position.copy(this.magBase)
    this.mag.rotation.set(0, 0, 0)
    this.mag.scale.setScalar(1)
    this.bolt.position.copy(this.boltBase)
    this.bolt.rotation.set(0, 0, 0)
    this.bayonet.position.z = -0.98
    this.bayonet.rotation.x = 0
  }

  update(dt, moving, sprinting, aiming, lookDelta, bobPhase = 0, moveAxis = { x: 0, z: 0 }) {
    if (!this.group.visible) return
    this.aiming = aiming
    const aimMultiplier = aiming ? 0.08 : 1
    const bobAmplitude = (sprinting ? 0.0075 : moving ? 0.0042 : 0.0008) * aimMultiplier
    const bobX = Math.sin(bobPhase) * bobAmplitude
    const bobY = (1 - Math.cos(bobPhase * 2)) * bobAmplitude * 0.55
    const bobZ = Math.sin(bobPhase * 2) * bobAmplitude * 0.35
    const bobRoll =
      Math.sin(bobPhase) * (sprinting ? 0.028 : moving ? 0.016 : 0.004) * aimMultiplier
    const bobPitch =
      Math.cos(bobPhase * 2) * (sprinting ? 0.012 : moving ? 0.007 : 0.002) * aimMultiplier
    this.bobTime += dt
    const breathY = aiming
      ? Math.sin(this.bobTime * 1.1) * 0.00008
      : Math.sin(this.bobTime * 1.3) * 0.00045
    const breathX = aiming ? 0 : Math.cos(this.bobTime * 0.9) * 0.0002
    const targetSwayX = THREE.MathUtils.clamp(lookDelta.x * 0.00045 * aimMultiplier, -0.02, 0.02)
    const targetSwayY = THREE.MathUtils.clamp(lookDelta.y * 0.00038 * aimMultiplier, -0.016, 0.016)
    const targetTilt = THREE.MathUtils.clamp(-lookDelta.x * 0.00055 * aimMultiplier, -0.025, 0.025)
    const targetPitch = THREE.MathUtils.clamp(lookDelta.y * 0.00028 * aimMultiplier, -0.015, 0.015)
    const swayEase = 1 - Math.exp(-(aiming ? 16 : 9) * dt)
    this.swayX += (targetSwayX - this.swayX) * swayEase
    this.swayY += (targetSwayY - this.swayY) * swayEase
    this.swayTilt += (targetTilt - this.swayTilt) * swayEase
    this.swayPitch += (targetPitch - this.swayPitch) * swayEase
    const targetLean = THREE.MathUtils.clamp(moveAxis.x * 0.03 * aimMultiplier, -0.02, 0.02)
    const targetDip =
      (moveAxis.z < 0 ? (sprinting ? 0.012 : 0.006) : moveAxis.z > 0 ? -0.004 : 0) * aimMultiplier
    this.strafeLean += (targetLean - this.strafeLean) * (1 - Math.exp(-8 * dt))
    this.sprintDip += (targetDip - this.sprintDip) * (1 - Math.exp(-7 * dt))

    const targetPosition = aiming ? this.aimPosition : this.basePosition
    this.smoothPos.lerp(targetPosition, 1 - Math.exp(-(aiming ? 20 : 12) * dt))
    const damping = Math.exp(-14 * dt)
    const spring = 1 - Math.exp(-22 * dt)
    this.kickVelZ *= damping
    this.kickVelY *= damping
    this.kickVelPitch *= damping
    this.kickZ += this.kickVelZ * dt
    this.kickY += this.kickVelY * dt
    this.kickPitch += this.kickVelPitch * dt
    this.kickZ += -this.kickZ * spring
    this.kickY += -this.kickY * spring
    this.kickX += -this.kickX * spring
    this.kickPitch += -this.kickPitch * spring
    this.kickYaw += -this.kickYaw * spring
    this.kickRoll += -this.kickRoll * spring
    if (aiming) {
      this.kickZ = Math.min(this.kickZ, 0.014)
      this.kickY = THREE.MathUtils.clamp(this.kickY, -0.006, 0.008)
      this.kickX = THREE.MathUtils.clamp(this.kickX, -0.004, 0.004)
      this.kickPitch = THREE.MathUtils.clamp(this.kickPitch, -0.03, 0.01)
      this.kickYaw = THREE.MathUtils.clamp(this.kickYaw, -0.01, 0.01)
      this.kickRoll = THREE.MathUtils.clamp(this.kickRoll, -0.012, 0.012)
    }

    this.group.position.set(
      this.smoothPos.x + bobX + breathX - this.swayX + this.strafeLean * 0.35 + this.kickX,
      this.smoothPos.y + bobY + breathY - this.swayY - this.sprintDip + this.kickY,
      this.smoothPos.z + bobZ + Math.abs(this.swayX) * 0.15 + this.kickZ
    )
    let rotationX = bobPitch + this.swayPitch + this.kickPitch + (aiming ? this.aimPitch : 0)
    let rotationY = (aiming ? 0 : 0.03) - this.swayX * 1.2 + this.kickYaw
    let rotationZ = bobRoll + this.swayTilt + this.strafeLean + this.kickRoll

    if (this.boltTime >= 0) {
      this.boltTime += dt
      const progress = this.boltTime / this.boltDuration
      const { x, y, z } = this.boltBase
      if (progress >= 1) {
        this.boltTime = -1
        this.bolt.position.set(x, y, z)
        this.bolt.rotation.set(0, 0, 0)
        this.kickZ += 0.004
        this.kickPitch += 0.004
      } else {
        let phase
        let roll
        if (progress < 0.28) {
          const time = progress / 0.28
          const eased = 1 - Math.pow(1 - time, 3)
          phase = eased
          roll = eased * 0.35
        } else if (progress < 0.48) {
          phase = 1
          roll = 0.35
        } else {
          const time = (progress - 0.48) / 0.52
          const eased = 1 - Math.pow(1 - time, 2.4)
          phase = 1 - eased
          roll = 0.35 * (1 - eased)
        }
        this.bolt.position.set(x, y, z + phase * 0.1)
        this.bolt.rotation.set(0, 0, roll)
        if (progress > 0.12 && progress < 0.55) {
          rotationZ += Math.sin(progress * 40) * 0.004 * (1 - Math.abs(progress - 0.3) * 3)
          this.group.position.x += Math.sin(progress * 28) * 0.0012
        }
      }
    }

    if (this.reloadTime >= 0) {
      this.reloadTime += dt
      const progress = Math.min(1, this.reloadTime / this.reloadDuration)
      const { x, y, z } = this.boltBase
      let reloadRotationX = 0
      let reloadRotationY = 0
      let reloadRotationZ = 0
      let reloadPositionY = 0
      let reloadPositionZ = 0
      let boltPull = 0
      if (progress < 0.16) {
        const time = progress / 0.16
        const eased = time * time * (3 - 2 * time)
        reloadRotationX = 0.22 * eased
        reloadRotationY = -0.04 * eased
        reloadRotationZ = 0.05 * eased
        reloadPositionY = -0.02 * eased
        reloadPositionZ = 0.02 * eased
        boltPull = 0.15 * eased
        if (time > 0.55 && !this.reloadFlags.open) {
          this.reloadFlags.open = true
          this.audio.reloadStage('open')
        }
      } else if (progress < 0.32) {
        const time = (progress - 0.16) / 0.16
        reloadRotationX = 0.22 + 0.06 * time
        reloadRotationY = -0.04 - 0.03 * time
        reloadRotationZ = 0.05
        reloadPositionY = -0.02 - 0.015 * time
        reloadPositionZ = 0.02
        boltPull = 0.15 + 0.85 * time
        this.mag.visible = true
        this.mag.position.set(
          this.magBase.x + 0.01 * time,
          this.magBase.y + 0.02 + 0.08 * time,
          this.magBase.z - 0.01 * time
        )
        this.mag.rotation.set(-0.4 * time, 0.2 * time, 0.5 * time)
        this.mag.scale.setScalar(1 - 0.15 * time)
        if (time > 0.85) this.mag.visible = false
      } else if (progress < 0.58) {
        const time = (progress - 0.32) / 0.26
        const eased = time * time * (3 - 2 * time)
        reloadRotationX = 0.28 - 0.04 * eased
        reloadRotationY = -0.07
        reloadRotationZ = 0.05 - 0.02 * eased
        reloadPositionY = -0.035
        reloadPositionZ = 0.02
        boltPull = 1
        this.mag.visible = true
        this.mag.scale.setScalar(1)
        this.mag.position.set(this.magBase.x, this.magBase.y + 0.09 * (1 - eased), this.magBase.z)
        this.mag.rotation.set(0.25 * (1 - eased), 0, 0)
        if (time > 0.25 && !this.reloadFlags.insert) {
          this.reloadFlags.insert = true
          this.audio.reloadStage('insert')
        }
      } else if (progress < 0.72) {
        const time = (progress - 0.58) / 0.14
        reloadRotationX = 0.24 - 0.02 * time
        reloadRotationY = -0.07 + 0.02 * time
        reloadRotationZ = 0.03
        reloadPositionY = -0.035 + 0.01 * time
        reloadPositionZ = 0.02
        boltPull = 1
        this.mag.visible = true
        this.mag.position.copy(this.magBase)
        this.mag.rotation.set(0, 0, 0)
        this.group.position.y += Math.sin(time * Math.PI * 3) * 0.0015
        if (time > 0.4 && !this.reloadFlags.seat) {
          this.reloadFlags.seat = true
          this.audio.reloadStage('seat')
        }
      } else if (progress < 0.88) {
        const time = (progress - 0.72) / 0.16
        const eased = 1 - Math.pow(1 - time, 2)
        reloadRotationX = 0.22 * (1 - eased)
        reloadRotationY = -0.05 * (1 - eased)
        reloadRotationZ = 0.03 * (1 - eased)
        reloadPositionY = -0.025 * (1 - eased)
        reloadPositionZ = 0.02 * (1 - eased)
        boltPull = 1 - eased
        this.mag.visible = true
        this.mag.position.copy(this.magBase)
        this.mag.rotation.set(0, 0, 0)
        if (time > 0.2 && !this.reloadFlags.close) {
          this.reloadFlags.close = true
          this.audio.reloadStage('close')
        }
      } else {
        const time = (progress - 0.88) / 0.12
        const eased = 1 - Math.pow(1 - time, 3)
        reloadRotationX = 0.04 * (1 - eased)
        reloadRotationY = -0.01 * (1 - eased)
        reloadPositionY = -0.005 * (1 - eased)
        this.mag.visible = true
        this.mag.position.copy(this.magBase)
        this.mag.rotation.set(0, 0, 0)
        this.mag.scale.setScalar(1)
      }
      rotationX += reloadRotationX
      rotationY += reloadRotationY
      rotationZ += reloadRotationZ
      this.group.position.y += reloadPositionY
      this.group.position.z += reloadPositionZ
      if (this.boltTime < 0) this.bolt.position.set(x, y, z + boltPull * 0.1)
      if (progress >= 1) {
        this.reloadTime = -1
        this.mag.visible = true
        this.mag.position.copy(this.magBase)
        this.mag.rotation.set(0, 0, 0)
        this.mag.scale.setScalar(1)
        this.bolt.position.set(x, y, z)
        this.reloadFlags = { open: false, insert: false, seat: false, close: false }
      }
    }

    if (this.meleeTime >= 0) {
      this.meleeTime += dt
      const progress = Math.min(1, this.meleeTime / this.meleeDuration)
      const centerX = -0.06
      const centerY = 0.055
      const centerZ = -0.11
      const centerRotationY = -0.014
      let positionX = 0
      let positionY = 0
      let positionZ = 0
      let meleeRotationX = 0
      let meleeRotationY = 0
      if (progress < 0.18) {
        const time = progress / 0.18
        const eased = time * time * (3 - 2 * time)
        positionX = centerX * 0.2 * eased
        positionY = (-0.01 + centerY * 0.15) * eased
        positionZ = 0.034 * eased
        meleeRotationX = -0.016 * eased
        meleeRotationY = centerRotationY * 0.3 * eased
      } else if (progress < 0.36) {
        const time = (progress - 0.18) / 0.18
        const eased = 1 - Math.pow(1 - time, 3.2)
        positionX = centerX * 0.2 + centerX * 0.8 * eased
        positionY = -0.01 + centerY * 0.15 + (centerY * 0.85 + 0.01) * eased
        positionZ = 0.034 + (centerZ - 0.034) * eased
        meleeRotationX = -0.016 + 0.032 * eased
        meleeRotationY = centerRotationY * (0.3 + 0.7 * eased)
      } else if (progress < 0.5) {
        const time = (progress - 0.36) / 0.14
        const shake = Math.sin(time * Math.PI * 6) * (1 - time) * 0.003
        positionX = centerX
        positionY = centerY
        positionZ = centerZ + shake
        meleeRotationX = 0.016 + shake
        meleeRotationY = centerRotationY
      } else {
        const time = (progress - 0.5) / 0.5
        const eased = 1 - Math.pow(1 - time, 2.1)
        positionX = centerX * (1 - eased)
        positionY = centerY * (1 - eased)
        positionZ = centerZ * (1 - eased) + 0.012 * Math.sin(time * Math.PI) * (1 - eased)
        meleeRotationX = 0.016 * (1 - eased)
        meleeRotationY = centerRotationY * (1 - eased)
      }
      this.group.position.x += positionX
      this.group.position.y += positionY
      this.group.position.z += positionZ
      rotationX += meleeRotationX
      rotationY += meleeRotationY
      if (progress < 0.18) {
        const time = progress / 0.18
        this.bayonet.position.z = -0.98 + 0.008 * time
        this.bayonet.rotation.x = 0.01 * time
      } else if (progress < 0.5) {
        const time = Math.min(1, (progress - 0.18) / 0.18)
        this.bayonet.position.z = -0.972 - 0.03 * time
        this.bayonet.rotation.x = 0.01 - 0.02 * time
      } else {
        const time = (progress - 0.5) / 0.5
        this.bayonet.position.z = -1.002 + 0.022 * time
        this.bayonet.rotation.x = -0.01 * (1 - time)
      }
      if (progress >= 1) {
        this.meleeTime = -1
        this.bayonet.rotation.x = 0
        this.bayonet.position.z = -0.98
      }
    }
    this.group.rotation.set(rotationX, rotationY, rotationZ)
  }

  triggerFire(aiming = false) {
    const multiplier = aiming ? 0.48 : 1
    this.kickVelZ += (0.55 + Math.random() * 0.12) * multiplier
    this.kickVelY += (0.18 + Math.random() * 0.08) * multiplier
    this.kickVelPitch -= (1.8 + Math.random() * 0.5) * multiplier
    this.kickZ += 0.018 * multiplier
    this.kickY += 0.006 * multiplier
    this.kickX += (Math.random() - 0.5) * 0.008 * multiplier
    this.kickPitch -= (0.045 + Math.random() * 0.012) * multiplier
    this.kickYaw += (Math.random() - 0.5) * 0.018 * multiplier
    this.kickRoll += (Math.random() - 0.5) * 0.03 * multiplier
    this.boltTime = 0
  }

  triggerReload() {
    this.reloadTime = 0
    this.boltTime = -1
    this.reloadFlags = { open: false, insert: false, seat: false, close: false }
    this.mag.visible = true
    this.mag.position.copy(this.magBase)
    this.mag.rotation.set(0, 0, 0)
    this.mag.scale.setScalar(1)
    this.bolt.position.copy(this.boltBase)
  }

  triggerMelee() {
    this.meleeTime = 0
    this.bayonet.rotation.x = 0
    this.bayonet.position.z = -0.98
  }

  isBusy() {
    return this.reloadTime >= 0 || this.meleeTime >= 0
  }
}
