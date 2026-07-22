import * as THREE from 'three'

function createReloadFlags() {
  return { eject: false, open: false, insert: false, seat: false, close: false }
}

export class WeaponView {
  constructor({ config, camera, matLib, audio, reloadDuration, emptyReloadDuration }) {
    this.camera = camera
    this.matLib = matLib
    this.audio = audio
    this.group = new THREE.Group()
    this.bobTime = 0
    this.boltTime = -1
    this.reloadTime = -1
    this.meleeTime = -1
    this.meleeDuration = config.meleeAnimationDuration
    this.reloadDuration = reloadDuration
    this.emptyReloadDuration = emptyReloadDuration
    this.emptyReload = false
    this.boltLocksOpen = false
    this.emptyEjectPlayed = false
    this.boltDuration = config.boltAnimationDuration
    this.aimingViewModelRecoilMultiplier = config.aimingViewModelRecoilMultiplier
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
    this.pendingRecoilPitch = 0
    this.pendingRecoilYaw = 0
    this.pendingRecoilRoll = 0
    this.recoilMultiplier = 1
    this.smoothPos = new THREE.Vector3()
    this.build()
    camera.add(this.group)
  }

  build() {
    const wood = this.matLib.wood
    const metal = this.matLib.metal
    const dark = this.matLib.metalDark
    const brass = this.matLib.brass
    const blued = this.matLib.blued
    const add = (mesh, parent = this.group) => {
      mesh.castShadow = false
      mesh.receiveShadow = true
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
    const receiver = add(new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.04, 0.22), blued))
    receiver.position.set(0, 0.01, -0.08)
    for (const side of [-1, 1]) {
      const plate = add(new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.038, 0.2), dark))
      plate.position.set(side * 0.026, 0.01, -0.08)
    }
    const magWell = add(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, 0.06), dark))
    magWell.position.set(0, -0.012, -0.1)

    const barrel = add(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.72, 12), blued))
    barrel.rotation.x = Math.PI / 2
    barrel.position.set(0, 0.016, -0.58)
    const muzzle = add(new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, 0.04, 10), dark))
    muzzle.rotation.x = Math.PI / 2
    muzzle.position.set(0, 0.016, -0.96)
    this.muzzlePos = new THREE.Object3D()
    this.muzzlePos.position.set(0, 0.016, -1.02)
    this.group.add(this.muzzlePos)

    this.bayonet = new THREE.Group()
    const bladeMat = this.matLib.blade
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
    const frontSightWings = []
    for (const side of [-1, 1]) {
      const wing = add(new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.018, 0.018), dark))
      wing.position.set(side * 0.012, 0.04, -0.9)
      frontSightWings.push(wing)
    }

    const rearSightBase = add(new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.01, 0.022), dark))
    rearSightBase.position.set(0, 0.033, -0.04)
    const rearSightLeft = add(new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.02, 0.014), dark))
    rearSightLeft.position.set(-0.012, 0.048, -0.04)
    const rearSightRight = add(new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.02, 0.014), dark))
    rearSightRight.position.set(0.012, 0.048, -0.04)
    const rearSightFloor = add(new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.004, 0.014), dark))
    rearSightFloor.position.set(0, 0.039, -0.04)
    this.sightCenter = new THREE.Vector3(0, 0.048, -0.04)

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
    this.magBaseScale = new THREE.Vector3(1, 1, 1)
    this.mag.position.copy(this.magBase)
    const clipLip = add(new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.006, 0.046), metal), this.mag)
    clipLip.position.set(0, 0.016, 0)
    this.reloadFlags = createReloadFlags()

    this.bolt = new THREE.Group()
    const opRod = new THREE.Mesh(new THREE.BoxGeometry(0.009, 0.012, 0.36), metal)
    opRod.position.z = -0.03
    this.bolt.add(opRod)
    const opKnob = new THREE.Mesh(new THREE.SphereGeometry(0.01, 8, 6), dark)
    opKnob.position.set(0.038, 0, 0.14)
    this.bolt.add(opKnob)
    this.bolt.position.set(0, 0.014, -0.19)
    this.group.add(this.bolt)
    this.boltBase = new THREE.Vector3(0, 0.014, -0.19)

    const thompsonParts = new THREE.Group()
    const thompsonGrip = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.15, 0.07), wood)
    thompsonGrip.position.set(0, -0.085, -0.28)
    thompsonGrip.rotation.x = -0.2
    thompsonParts.add(thompsonGrip)
    const thompsonPistolGrip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.065), wood)
    thompsonPistolGrip.position.set(0, -0.085, -0.005)
    thompsonPistolGrip.rotation.x = 0.25
    thompsonParts.add(thompsonPistolGrip)
    this.group.add(thompsonParts)

    const barParts = new THREE.Group()
    const bipodMount = add(
      new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.022, 0.078), dark),
      barParts
    )
    bipodMount.position.set(0, -0.012, -0.92)
    const bipodPivot = add(
      new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.07, 8), metal),
      barParts
    )
    bipodPivot.rotation.z = Math.PI / 2
    bipodPivot.position.set(0, -0.025, -0.94)
    const bipodFootGeometry = new THREE.BoxGeometry(0.044, 0.014, 0.06)
    const bipodTop = new THREE.Vector3()
    const bipodBottom = new THREE.Vector3()
    for (const side of [-1, 1]) {
      bipodTop.set(side * 0.022, -0.026, -0.94)
      bipodBottom.set(side * 0.092, -0.26, -1.17)
      const direction = bipodBottom.clone().sub(bipodTop)
      const leg = add(
        new THREE.Mesh(new THREE.BoxGeometry(0.01, direction.length(), 0.01), metal),
        barParts
      )
      leg.position.copy(bipodTop).add(bipodBottom).multiplyScalar(0.5)
      leg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize())
      const foot = add(new THREE.Mesh(bipodFootGeometry, dark), barParts)
      foot.position.copy(bipodBottom)
      foot.rotation.y = side * 0.18
    }
    this.group.add(barParts)

    this.modelParts = {
      buttPad,
      butt,
      comb,
      wrist,
      gripWood,
      forend,
      handguard,
      receiver,
      magWell,
      barrel,
      muzzle,
      frontSightBase,
      frontSightPost,
      frontSightWings,
      thompsonParts,
      barParts,
      brass,
      dark,
    }

    this.basePosition = new THREE.Vector3(0.18, -0.18, -0.28)
    this.aimPosition = new THREE.Vector3(-this.sightCenter.x, -this.sightCenter.y - 0.006, -0.3)
    this.aimPitch = 0
    this.smoothPos.copy(this.basePosition)
    this.group.position.copy(this.basePosition)
    this.group.rotation.y = 0.03
    this.matLib.addOutline(this.group, 1.025)
  }

  setMagazineScale(multiplier = 1) {
    this.mag.scale.copy(this.magBaseScale).multiplyScalar(multiplier)
  }

  configure(weapon) {
    this.reloadDuration = weapon.reloadDuration
    this.emptyReloadDuration = weapon.emptyReloadDuration
    this.weaponModelId = weapon.modelId
    this.recoilMultiplier = weapon.recoilMultiplier
    this.group.scale.set(...weapon.modelScale)

    const parts = this.modelParts
    parts.buttPad.position.set(0, -0.04, 0.3)
    parts.buttPad.scale.set(1, 1, 1)
    parts.butt.position.set(0, -0.04, 0.2)
    parts.butt.scale.set(1, 1, 1)
    parts.comb.position.set(0, 0.012, 0.16)
    parts.comb.scale.set(1, 1, 1)
    parts.comb.visible = true
    parts.wrist.position.set(0, -0.03, 0.06)
    parts.wrist.scale.set(1, 1, 1)
    parts.gripWood.visible = true
    parts.forend.position.set(0, -0.014, -0.3)
    parts.forend.scale.set(1, 1, 1)
    parts.forend.visible = true
    parts.handguard.position.set(0, 0.022, -0.36)
    parts.handguard.scale.set(1, 1, 1)
    parts.handguard.visible = true
    parts.receiver.position.set(0, 0.01, -0.08)
    parts.receiver.scale.set(1, 1, 1)
    parts.magWell.position.set(0, -0.012, -0.1)
    parts.magWell.scale.set(1, 1, 1)
    parts.magWell.visible = true
    parts.barrel.position.set(0, 0.016, -0.58)
    parts.barrel.scale.set(1, 1, 1)
    parts.muzzle.position.set(0, 0.016, -0.96)
    parts.muzzle.scale.set(1, 1, 1)
    this.muzzlePos.position.set(0, 0.016, -1.02)
    parts.frontSightBase.position.z = -0.9
    parts.frontSightPost.position.z = -0.9
    for (const wing of parts.frontSightWings) wing.position.z = -0.9
    parts.thompsonParts.visible = false
    parts.barParts.visible = false
    this.boltBase.set(0, 0.014, -0.19)
    this.magBase.set(0, -0.002, -0.1)
    this.magBaseScale.set(1, 1, 1)
    this.mag.material = parts.brass
    this.mag.visible = true
    this.bayonetBaseZ = -0.98

    if (weapon.modelId === 'shotgun') {
      parts.buttPad.position.z = 0.27
      parts.butt.position.z = 0.19
      parts.butt.scale.z = 0.82
      parts.comb.position.z = 0.14
      parts.comb.scale.z = 0.8
      parts.forend.position.z = -0.27
      parts.forend.scale.z = 0.8
      parts.handguard.position.z = -0.31
      parts.handguard.scale.z = 0.72
      parts.receiver.scale.set(1.15, 1.1, 0.86)
      this.boltBase.z = -0.22
      parts.barrel.position.z = -0.5
      parts.barrel.scale.set(1.5, 0.85, 1.5)
      parts.muzzle.position.z = -0.78
      parts.muzzle.scale.set(1.55, 1.1, 1.55)
      this.muzzlePos.position.z = -0.86
      this.bayonetBaseZ = -0.82
      parts.frontSightBase.position.z = -0.74
      parts.frontSightPost.position.z = -0.74
      for (const wing of parts.frontSightWings) wing.position.z = -0.74
      parts.magWell.visible = false
      this.mag.visible = false
      this.magBase.set(0, -0.025, -0.09)
      this.magBaseScale.set(1.35, 2.3, 1.2)
      this.mag.material = parts.dark
    } else if (weapon.modelId === 'thompson') {
      parts.buttPad.position.z = 0.24
      parts.butt.position.z = 0.15
      parts.butt.scale.z = 0.58
      parts.comb.visible = false
      parts.wrist.position.z = 0.025
      parts.gripWood.visible = false
      parts.forend.visible = false
      parts.handguard.visible = false
      parts.receiver.position.z = -0.045
      parts.receiver.scale.set(1.45, 1.5, 0.82)
      parts.magWell.position.y = -0.025
      parts.magWell.scale.set(1.5, 1.4, 1.2)
      parts.barrel.position.z = -0.27
      parts.barrel.scale.set(1.3, 0.38, 1.3)
      parts.muzzle.position.z = -0.43
      parts.muzzle.scale.set(1.35, 1, 1.35)
      this.muzzlePos.position.z = -0.48
      this.bayonetBaseZ = -0.42
      parts.frontSightBase.position.z = -0.39
      parts.frontSightPost.position.z = -0.39
      for (const wing of parts.frontSightWings) wing.position.z = -0.39
      parts.thompsonParts.visible = true
      this.magBase.set(0, -0.075, -0.085)
      this.magBaseScale.set(1.8, 4.8, 1.35)
      this.mag.material = parts.dark
    } else if (weapon.modelId === 'bar') {
      parts.buttPad.position.z = 0.34
      parts.butt.position.z = 0.23
      parts.butt.scale.z = 1.15
      parts.comb.position.z = 0.19
      parts.comb.scale.z = 1.15
      parts.forend.position.z = -0.36
      parts.forend.scale.set(1.15, 1.12, 1.28)
      parts.handguard.position.z = -0.43
      parts.handguard.scale.z = 1.25
      parts.receiver.position.z = -0.1
      parts.receiver.scale.set(1.25, 1.25, 1.35)
      parts.magWell.position.y = -0.02
      parts.magWell.scale.set(1.45, 1.35, 1.35)
      parts.barrel.position.z = -0.67
      parts.barrel.scale.set(1.35, 1.2, 1.35)
      parts.muzzle.position.z = -1.12
      parts.muzzle.scale.set(1.4, 1.2, 1.4)
      this.muzzlePos.position.z = -1.19
      parts.frontSightBase.position.z = -1.06
      parts.frontSightPost.position.z = -1.06
      for (const wing of parts.frontSightWings) wing.position.z = -1.06
      parts.barParts.visible = true
      this.magBase.set(0, -0.065, -0.12)
      this.magBaseScale.set(1.8, 3.8, 1.8)
      this.mag.material = parts.dark
      this.bayonetBaseZ = -1.14
    }

    this.bayonet.visible = weapon.bayonet
    this.bayonet.position.z = this.bayonetBaseZ
    this.mag.position.copy(this.magBase)
    this.setMagazineScale()
  }

  setVisible(visible) {
    this.group.visible = visible
  }

  resetActions() {
    this.boltTime = -1
    this.reloadTime = -1
    this.meleeTime = -1
    this.emptyReload = false
    this.boltLocksOpen = false
    this.emptyEjectPlayed = false
    this.pendingRecoilPitch = 0
    this.pendingRecoilYaw = 0
    this.pendingRecoilRoll = 0
    this.kickZ = 0
    this.kickY = 0
    this.kickX = 0
    this.kickPitch = 0
    this.kickYaw = 0
    this.kickRoll = 0
    this.kickVelZ = 0
    this.kickVelY = 0
    this.reloadFlags = createReloadFlags()
    this.mag.visible = true
    this.mag.position.copy(this.magBase)
    this.mag.rotation.set(0, 0, 0)
    this.setMagazineScale()
    this.bolt.position.copy(this.boltBase)
    this.bolt.rotation.set(0, 0, 0)
    this.bayonet.position.z = this.bayonetBaseZ
    this.bayonet.rotation.x = 0
  }

  update(dt, moving, sprinting, aiming, lookDelta, bobPhase = 0, moveAxis = { x: 0, z: 0 }) {
    if (!this.group.visible) return
    this.aiming = aiming
    const aimMultiplier = aiming ? 0.08 : 1
    let bobAmplitude = 0.0008
    let bobRollScale = 0.004
    let bobPitchScale = 0.002
    if (sprinting) {
      bobAmplitude = 0.0075
      bobRollScale = 0.028
      bobPitchScale = 0.012
    } else if (moving) {
      bobAmplitude = 0.0042
      bobRollScale = 0.016
      bobPitchScale = 0.007
    }
    bobAmplitude *= aimMultiplier
    const bobX = Math.sin(bobPhase) * bobAmplitude
    const bobY = (1 - Math.cos(bobPhase * 2)) * bobAmplitude * 0.55
    const bobZ = Math.sin(bobPhase * 2) * bobAmplitude * 0.35
    const bobRoll = Math.sin(bobPhase) * bobRollScale * aimMultiplier
    const bobPitch = Math.cos(bobPhase * 2) * bobPitchScale * aimMultiplier
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
    let targetDip = 0
    if (moveAxis.z < 0) targetDip = sprinting ? 0.012 : 0.006
    else if (moveAxis.z > 0) targetDip = -0.004
    targetDip *= aimMultiplier
    this.strafeLean += (targetLean - this.strafeLean) * (1 - Math.exp(-8 * dt))
    this.sprintDip += (targetDip - this.sprintDip) * (1 - Math.exp(-7 * dt))

    const targetPosition = aiming ? this.aimPosition : this.basePosition
    this.smoothPos.lerp(targetPosition, 1 - Math.exp(-(aiming ? 20 : 12) * dt))
    const damping = Math.exp(-14 * dt)
    const positionSpring = 1 - Math.exp(-22 * dt)
    this.kickVelZ *= damping
    this.kickVelY *= damping
    this.kickZ += this.kickVelZ * dt
    this.kickY += this.kickVelY * dt
    this.kickZ += -this.kickZ * positionSpring
    this.kickY += -this.kickY * positionSpring
    this.kickX += -this.kickX * positionSpring
    const pitchYawSpring = 1 - Math.pow(0.0001, dt)
    const rollSpring = 1 - Math.pow(0.0002, dt)
    this.kickPitch += -this.kickPitch * pitchYawSpring + this.pendingRecoilPitch
    this.kickYaw += -this.kickYaw * pitchYawSpring + this.pendingRecoilYaw
    this.kickRoll += -this.kickRoll * rollSpring + this.pendingRecoilRoll
    this.pendingRecoilPitch = 0
    this.pendingRecoilYaw = 0
    this.pendingRecoilRoll = 0
    if (aiming) {
      this.kickZ = Math.min(this.kickZ, 0.014)
      this.kickY = THREE.MathUtils.clamp(this.kickY, -0.006, 0.008)
      this.kickX = THREE.MathUtils.clamp(this.kickX, -0.004, 0.004)
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
        this.bolt.position.set(x, y, z + (this.boltLocksOpen ? 0.06 : 0))
        this.bolt.rotation.set(0, 0, 0)
        if (this.weaponModelId === 'shotgun') this.audio.shotgunPump()
        if (!this.boltLocksOpen) {
          const boltKick = this.aiming ? this.aimingViewModelRecoilMultiplier : 1
          this.kickZ += 0.004 * boltKick
          this.kickPitch += 0.004 * boltKick
        }
      } else {
        let phase
        if (progress < 0.28) {
          const time = progress / 0.28
          phase = 1 - Math.pow(1 - time, 3)
        } else if (this.boltLocksOpen || progress < 0.48) {
          phase = 1
        } else {
          const time = (progress - 0.48) / 0.52
          phase = Math.pow(1 - time, 2.4)
        }
        this.bolt.position.set(x, y, z + phase * 0.06)
        if (this.weaponModelId === 'garand' && this.boltLocksOpen && progress >= 0.28) {
          if (!this.emptyEjectPlayed) {
            this.emptyEjectPlayed = true
            this.audio.ping()
          }
          const eject = Math.min(1, (progress - 0.28) / 0.16)
          const eased = 1 - Math.pow(1 - eject, 3)
          this.mag.position.set(
            this.magBase.x + 0.04 * eased,
            this.magBase.y + 0.22 * eased,
            this.magBase.z + 0.035 * eased
          )
          this.mag.rotation.set(-0.9 * eased, 0.35 * eased, 1.1 * eased)
          this.setMagazineScale(1 - 0.22 * eased)
          if (eject >= 1) this.mag.visible = false
        }
        if (progress > 0.12 && progress < 0.55) {
          rotationZ += Math.sin(progress * 40) * 0.004 * (1 - Math.abs(progress - 0.3) * 3)
          this.group.position.x += Math.sin(progress * 28) * 0.0012
        }
      }
    }

    if (this.reloadTime >= 0) {
      this.reloadTime += dt
      const progress = Math.min(1, this.reloadTime / this.getReloadDuration())
      const smooth = value => value * value * (3 - 2 * value)
      const easeOut = value => 1 - Math.pow(1 - value, 3)
      const modelId = this.weaponModelId
      const detachable = modelId !== 'garand'
      let poseInEnd = this.emptyReload ? 0.1 : 0.14
      let insertStart = this.emptyReload ? 0.16 : 0.34
      let insertEnd = this.emptyReload ? 0.52 : 0.57
      let seatEnd = this.emptyReload ? 0.68 : 0.7
      let releaseStart = this.emptyReload ? 0.68 : 0.7
      let releaseEnd = this.emptyReload ? 0.77 : 0.79
      if (detachable) {
        poseInEnd = 0.12
        insertStart = 0.44
        insertEnd = 0.69
        seatEnd = 0.76
        releaseStart = 0.78
        releaseEnd = 0.88
      }
      let pose
      if (progress < poseInEnd) pose = smooth(progress / poseInEnd)
      else if (progress < 0.8) pose = 1
      else pose = 1 - smooth((progress - 0.8) / 0.2)
      const { x, y, z } = this.boltBase
      let reloadRotationX = 0.28 * pose
      let reloadRotationY = -0.1 * pose
      let reloadRotationZ = 0.075 * pose
      let reloadPositionX = -0.06 * pose
      let reloadPositionY = -0.05 * pose
      let reloadPositionZ = 0.05 * pose
      const handlingArc = Math.sin(
        Math.PI * THREE.MathUtils.clamp((progress - 0.08) / 0.76, 0, 1)
      )
      if (modelId === 'shotgun') {
        reloadRotationX = 0.2 * pose
        reloadRotationY = 0.18 * pose + 0.06 * handlingArc
        reloadRotationZ = -0.2 * pose
        reloadPositionX = 0.02 * pose + 0.02 * handlingArc
        reloadPositionY = 0.06 * pose
        reloadPositionZ = 0.1 * pose
      } else if (modelId === 'thompson') {
        reloadRotationX = 0.34 * pose
        reloadRotationY = 0.28 * pose
        reloadRotationZ = -0.42 * pose - 0.16 * handlingArc
        reloadPositionX = 0.14 * pose
        reloadPositionY = 0.11 * pose + 0.025 * handlingArc
        reloadPositionZ = 0.09 * pose
      } else if (modelId === 'bar') {
        reloadRotationX = 0.28 * pose
        reloadRotationY = -0.24 * pose
        reloadRotationZ = 0.18 * pose
        reloadPositionX = 0.11 * pose
        reloadPositionY = -0.04 * pose
        reloadPositionZ = 0.07 * pose
      }
      let boltPull = this.emptyReload ? 1 : 0
      const cyclesBolt = !detachable || this.emptyReload

      if ((detachable || !this.emptyReload) && progress >= 0.12 && !this.reloadFlags.open) {
        this.reloadFlags.open = true
        this.audio.reloadStage('open')
      }
      if ((detachable || !this.emptyReload) && progress >= 0.19 && !this.reloadFlags.eject) {
        this.reloadFlags.eject = true
        if (detachable) this.audio.reloadStage('seat')
        else this.audio.ping()
      }
      if (progress >= insertStart + 0.08 && !this.reloadFlags.insert) {
        this.reloadFlags.insert = true
        this.audio.reloadStage('insert')
      }
      if (progress >= insertEnd && !this.reloadFlags.seat) {
        this.reloadFlags.seat = true
        this.audio.reloadStage('seat')
      }
      if (progress >= releaseStart && !this.reloadFlags.close && cyclesBolt) {
        this.reloadFlags.close = true
        this.audio.reloadStage('close')
      }

      if (!detachable && !this.emptyReload) {
        if (progress < 0.1) boltPull = 0
        else if (progress < 0.18) boltPull = easeOut((progress - 0.1) / 0.08)
        else if (progress < releaseStart) boltPull = 1
      }
      if (cyclesBolt && progress >= releaseStart && progress < releaseEnd)
        boltPull = 1 - easeOut((progress - releaseStart) / (releaseEnd - releaseStart))
      else if (cyclesBolt && progress >= releaseEnd) boltPull = 0

      if (detachable) {
        const removeStart = 0.1
        let removeEnd = 0.34
        let drop = 0.12
        if (modelId === 'thompson') {
          removeEnd = 0.38
          drop = 0.17
        } else if (modelId === 'bar') {
          removeEnd = 0.4
          drop = 0.15
        }
        if (progress < removeStart) {
          this.mag.visible = true
          this.mag.position.copy(this.magBase)
          this.mag.rotation.set(0, 0, 0)
          this.setMagazineScale()
        } else if (progress < removeEnd) {
          const time = smooth((progress - removeStart) / (removeEnd - removeStart))
          this.mag.visible = time < 0.97
          this.mag.position.set(
            this.magBase.x + 0.04 * time,
            this.magBase.y - drop * time,
            this.magBase.z + 0.03 * time
          )
          this.mag.rotation.set(0.18 * time, -0.1 * time, 0.24 * time)
          this.setMagazineScale(1 - 0.08 * time)
        } else if (progress < insertStart) {
          this.mag.visible = false
        } else if (progress < insertEnd) {
          const time = smooth((progress - insertStart) / (insertEnd - insertStart))
          const remaining = 1 - time
          this.mag.visible = true
          if (modelId === 'shotgun') {
            this.mag.visible = false
          } else {
            this.mag.position.set(
              this.magBase.x - 0.045 * remaining,
              this.magBase.y - drop * remaining,
              this.magBase.z + 0.035 * remaining
            )
            this.mag.rotation.set(0.22 * remaining, 0.12 * remaining, -0.2 * remaining)
          }
          this.setMagazineScale(0.92 + 0.08 * time)
        } else {
          this.mag.visible = true
          this.mag.position.copy(this.magBase)
          this.mag.rotation.set(0, 0, 0)
          this.setMagazineScale()
        }
      } else if (!this.emptyReload && progress < 0.19) {
        this.mag.visible = true
        this.mag.position.copy(this.magBase)
        this.mag.rotation.set(0, 0, 0)
        this.setMagazineScale()
      } else if (!this.emptyReload && progress < 0.25) {
        const time = easeOut((progress - 0.19) / 0.06)
        this.mag.visible = time < 0.9
        this.mag.position.set(
          this.magBase.x + 0.04 * time,
          this.magBase.y + 0.22 * time,
          this.magBase.z + 0.035 * time
        )
        this.mag.rotation.set(-0.9 * time, 0.35 * time, 1.1 * time)
        this.setMagazineScale(1 - 0.22 * time)
      } else if (progress < insertStart) {
        this.mag.visible = false
      } else if (progress < insertEnd) {
        const time = smooth((progress - insertStart) / (insertEnd - insertStart))
        this.mag.visible = true
        this.mag.position.set(
          this.magBase.x - 0.04 * (1 - time),
          this.magBase.y + 0.16 * (1 - time),
          this.magBase.z + 0.03 * (1 - time)
        )
        this.mag.rotation.set(-0.5 * (1 - time), -0.28 * (1 - time), -0.4 * (1 - time))
        this.setMagazineScale(0.86 + 0.14 * time)
      } else {
        this.mag.visible = true
        this.mag.position.copy(this.magBase)
        this.mag.rotation.set(0, 0, 0)
        this.setMagazineScale()
      }

      if (progress > insertEnd - 0.06 && progress < seatEnd) {
        const impact = Math.sin(((progress - (insertEnd - 0.06)) / (seatEnd - insertEnd + 0.06)) * Math.PI)
        reloadRotationX += 0.032 * impact
        reloadPositionY -= 0.016 * impact
        reloadPositionZ += 0.01 * impact
      }
      if (progress > releaseStart && progress < releaseEnd) {
        const impact = Math.sin(((progress - releaseStart) / (releaseEnd - releaseStart)) * Math.PI)
        reloadRotationZ -= 0.03 * impact
        reloadPositionZ -= 0.016 * impact
      }
      if (progress > releaseEnd) {
        const time = (progress - releaseEnd) / (1 - releaseEnd)
        const settle = Math.sin(time * Math.PI * 2) * (1 - time)
        reloadRotationX += 0.012 * settle
        reloadPositionY += 0.006 * settle
      }

      rotationX += reloadRotationX
      rotationY += reloadRotationY
      rotationZ += reloadRotationZ
      this.group.position.x += reloadPositionX
      this.group.position.y += reloadPositionY
      this.group.position.z += reloadPositionZ
      this.bolt.position.set(x, y, z + boltPull * 0.06)
      if (progress >= 1) {
        this.reloadTime = -1
        this.emptyReload = false
        this.boltLocksOpen = false
        this.mag.visible = true
        this.mag.position.copy(this.magBase)
        this.mag.rotation.set(0, 0, 0)
        this.setMagazineScale()
        this.bolt.position.set(x, y, z)
        this.bolt.rotation.set(0, 0, 0)
        this.reloadFlags = createReloadFlags()
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
        this.bayonet.position.z = this.bayonetBaseZ + 0.008 * time
        this.bayonet.rotation.x = 0.01 * time
      } else if (progress < 0.5) {
        const time = Math.min(1, (progress - 0.18) / 0.18)
        this.bayonet.position.z = this.bayonetBaseZ + 0.008 - 0.03 * time
        this.bayonet.rotation.x = 0.01 - 0.02 * time
      } else {
        const time = (progress - 0.5) / 0.5
        this.bayonet.position.z = this.bayonetBaseZ - 0.022 + 0.022 * time
        this.bayonet.rotation.x = -0.01 * (1 - time)
      }
      if (progress >= 1) {
        this.meleeTime = -1
        this.bayonet.rotation.x = 0
        this.bayonet.position.z = this.bayonetBaseZ
      }
    }
    if (this.weaponModelId === 'shotgun') this.mag.visible = false
    this.group.rotation.set(rotationX, rotationY, rotationZ)
  }

  triggerFire(aiming = false, locksOpen = false, recoilImpulse) {
    const viewModelMultiplier = aiming ? this.aimingViewModelRecoilMultiplier : 1
    const positionMultiplier = viewModelMultiplier * this.recoilMultiplier
    this.kickVelZ += (0.55 + Math.random() * 0.12) * positionMultiplier
    this.kickVelY += (0.18 + Math.random() * 0.08) * positionMultiplier
    this.kickZ += 0.018 * positionMultiplier
    this.kickY += 0.006 * positionMultiplier
    this.kickX += (Math.random() - 0.5) * 0.008 * positionMultiplier
    this.pendingRecoilPitch += recoilImpulse.pitch * viewModelMultiplier
    this.pendingRecoilYaw += recoilImpulse.yaw * viewModelMultiplier
    this.pendingRecoilRoll += recoilImpulse.roll * viewModelMultiplier
    this.boltLocksOpen = locksOpen
    this.emptyEjectPlayed = false
    this.boltTime = 0
  }

  triggerReload(empty = false) {
    this.emptyReload = empty
    this.reloadTime = 0
    this.boltTime = -1
    this.reloadFlags = createReloadFlags()
    this.mag.visible = this.weaponModelId !== 'shotgun' && (this.weaponModelId !== 'garand' || !empty)
    this.mag.position.copy(this.magBase)
    this.mag.rotation.set(0, 0, 0)
    this.setMagazineScale()
    this.bolt.position.set(
      this.boltBase.x,
      this.boltBase.y,
      this.boltBase.z + (empty ? 0.06 : 0)
    )
  }

  getReloadDuration() {
    return this.emptyReload ? this.emptyReloadDuration : this.reloadDuration
  }

  triggerMelee() {
    this.meleeTime = 0
    this.bayonet.rotation.x = 0
    this.bayonet.position.z = this.bayonetBaseZ
  }

  isBusy() {
    return this.reloadTime >= 0 || this.meleeTime >= 0
  }
}
