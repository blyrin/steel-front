import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

const _object = new THREE.Object3D()

/** 将同材质零件烘焙为单个 Mesh。def: { geometry, position?, rotation?, scale? } */
function createMergedMesh(defs, material) {
  const geometries = []
  for (const def of defs) {
    _object.position.set(0, 0, 0)
    _object.rotation.set(0, 0, 0)
    _object.scale.set(1, 1, 1)
    if (def.position) _object.position.fromArray(def.position)
    if (def.rotation) _object.rotation.set(def.rotation[0], def.rotation[1], def.rotation[2])
    if (def.scale) {
      if (Array.isArray(def.scale)) {
        _object.scale.fromArray(def.scale)
      } else {
        _object.scale.setScalar(def.scale)
      }
    }
    _object.updateMatrix()
    const geometry = def.geometry.clone()
    geometry.applyMatrix4(_object.matrix)
    geometries.push(geometry)
  }
  const merged = mergeGeometries(geometries, false)
  for (const geometry of geometries) geometry.dispose()
  const mesh = new THREE.Mesh(merged, material)
  mesh.castShadow = false
  mesh.receiveShadow = false
  return mesh
}

const ANIM_MID_DIST_SQ = 28 * 28
const ANIM_FAR_DIST_SQ = 48 * 48

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
  bayonetMount: new THREE.BoxGeometry(0.07, 0.05, 0.08),
  bayonetBlade: new THREE.BoxGeometry(0.025, 0.014, 0.34),
  bayonetTip: new THREE.ConeGeometry(0.016, 0.07, 4),
  bayonetGuard: new THREE.BoxGeometry(0.09, 0.016, 0.018),
  c4Body: new THREE.BoxGeometry(0.2, 0.1, 0.14),
  c4Band: new THREE.BoxGeometry(0.21, 0.018, 0.05),
  rpgTube: new THREE.CylinderGeometry(0.082, 0.088, 0.72, 10),
  rpgNozzle: new THREE.CylinderGeometry(0.11, 0.078, 0.14, 10),
  rpgGrip: new THREE.BoxGeometry(0.07, 0.16, 0.08),
  rpgRocketMotor: new THREE.CylinderGeometry(0.052, 0.056, 0.2, 8),
  rpgRocketBody: new THREE.CylinderGeometry(0.063, 0.07, 0.16, 8),
  rpgRocketHead: new THREE.ConeGeometry(0.07, 0.14, 8),
  grenadeBody: new THREE.SphereGeometry(0.09, 8, 6),
  grenadeCap: new THREE.CylinderGeometry(0.045, 0.045, 0.026, 8),
  grenadePin: new THREE.TorusGeometry(0.018, 0.004, 5, 8, Math.PI * 1.5),
  pouchBody: new THREE.BoxGeometry(0.17, 0.14, 0.11),
  pouchFlap: new THREE.BoxGeometry(0.18, 0.035, 0.12),
  medkitBody: new THREE.BoxGeometry(0.2, 0.14, 0.14),
  medkitCross: new THREE.BoxGeometry(0.035, 0.01, 0.09),
  medkitCrossBar: new THREE.BoxGeometry(0.09, 0.01, 0.035),
}

class Bot {
  constructor(team, spawnPosition, services) {
    Object.assign(this, services)
    this.team = team
    this.position = spawnPosition.clone()
    this.velocity = new THREE.Vector3()
    this.yaw = 0
    this.alive = true
    this.health = 0
    this.maxHealth = this.config.bot.maxHealth
    this.stateName = 'patrol'
    this.targetVisible = false
    this.reloading = false
    this.weaponData = services.weaponData
    this.secondaryData = services.secondaryData
    this.grenadeData = services.grenadeData
    this.itemData = services.itemData
    this.kills = 0
    this.deaths = 0
    this.actionName = null
    this.actionTime = 0
    this.actionDuration = 0
    this.buildModel()
    this.scene.add(this.group)
  }

  buildModel() {
    this.group = new THREE.Group()
    this.group.position.copy(this.position)
    const isAlly = this.team === 'allies'
    const uniform = isAlly ? this.matLib.allyUniform : this.matLib.axisUniform
    const helmetMat = isAlly ? this.matLib.helmetAlly : this.matLib.helmetAxis

    this.body = new THREE.Group()
    this.body.position.y = 0.78
    this.group.add(this.body)

    const createLeg = side => {
      const leg = new THREE.Group()
      leg.position.set(side * 0.12, 0.78, 0)
      leg.add(
        createMergedMesh(
          [
            { geometry: BOT_GEOMETRY.leg, position: [0, -0.36, 0] },
            { geometry: BOT_GEOMETRY.boot, position: [0, -0.7, -0.08] },
          ],
          uniform,
        ),
      )
      this.group.add(leg)
      return leg
    }
    this.leftLeg = createLeg(-1)
    this.rightLeg = createLeg(1)

    const bodyMesh = createMergedMesh(
      [
        { geometry: BOT_GEOMETRY.torso, position: [0, 0.38, 0] },
        { geometry: BOT_GEOMETRY.belt, position: [0, 0.08, 0] },
        { geometry: BOT_GEOMETRY.pack, position: [0, 0.44, 0.2] },
      ],
      uniform,
    )
    bodyMesh.castShadow = true
    bodyMesh.receiveShadow = true
    this.body.add(bodyMesh)

    this.head = new THREE.Group()
    this.head.position.set(0, 0.74, 0)
    this.body.add(this.head)
    this.head.add(
      createMergedMesh(
        [
          { geometry: BOT_GEOMETRY.neck },
          { geometry: BOT_GEOMETRY.head, position: [0, 0.14, 0] },
        ],
        this.matLib.skin,
      ),
    )
    if (isAlly) {
      this.head.add(
        createMergedMesh(
          [
            {
              geometry: BOT_GEOMETRY.allyHelmet,
              position: [0, 0.26, 0],
              scale: [1.08, 0.88, 1.12],
            },
            { geometry: BOT_GEOMETRY.allyBrim, position: [0, 0.2, 0] },
          ],
          helmetMat,
        ),
      )
    } else {
      this.head.add(
        createMergedMesh(
          [
            {
              geometry: BOT_GEOMETRY.axisHelmet,
              position: [0, 0.28, 0],
              scale: [1.08, 0.92, 1.18],
            },
          ],
          helmetMat,
        ),
      )
    }

    const createArm = side => {
      const arm = new THREE.Group()
      arm.position.set(side * 0.31, 0.62, 0)
      arm.add(
        createMergedMesh(
          [
            { geometry: BOT_GEOMETRY.arm, position: [0, -0.29, 0] },
            { geometry: BOT_GEOMETRY.hand, position: [0, -0.59, 0.02] },
          ],
          uniform,
        ),
      )
      this.body.add(arm)
      return arm
    }
    this.leftArm = createArm(-1)
    this.rightArm = createArm(1)

    this.rifle = new THREE.Group()
    this.rifleCore = null
    this.rifleMag = new THREE.Mesh(BOT_GEOMETRY.rifleMag, this.matLib.metalDark)
    this.rifle.add(this.rifleMag)
    this.rifleClip = new THREE.Mesh(BOT_GEOMETRY.rifleMag, this.matLib.brass)
    this.rifle.add(this.rifleClip)
    this.rifleMuzzle = new THREE.Object3D()
    this.rifle.add(this.rifleMuzzle)
    this.rifle.position.set(0.22, 0.46, -0.38)
    this.bayonet = new THREE.Group()
    this.bayonet.add(new THREE.Mesh(BOT_GEOMETRY.bayonetMount, this.matLib.metalDark))
    const bayonetBlade = new THREE.Mesh(BOT_GEOMETRY.bayonetBlade, this.matLib.blade)
    bayonetBlade.position.set(0, -0.012, -0.19)
    this.bayonet.add(bayonetBlade)
    const bayonetTip = new THREE.Mesh(BOT_GEOMETRY.bayonetTip, this.matLib.blade)
    bayonetTip.rotation.x = -Math.PI / 2
    bayonetTip.position.set(0, -0.012, -0.4)
    this.bayonet.add(bayonetTip)
    const bayonetGuard = new THREE.Mesh(BOT_GEOMETRY.bayonetGuard, this.matLib.metalDark)
    bayonetGuard.position.set(0, -0.01, -0.035)
    this.bayonet.add(bayonetGuard)
    this.rifle.add(this.bayonet)
    this.configureRifleModel()
    this.body.add(this.rifle)

    this.heldEquipment = new THREE.Group()
    this.body.add(this.heldEquipment)
    this.createEquipmentModels()

    this.matLib.addOutline(this.group, 1.045)
    this.legPhase = Math.random() * Math.PI * 2
    this.animationTime = Math.random() * Math.PI * 2
    this.moveBlend = 0
    this.aimPose = 0
    this.reloadPose = 0
    this.deathTime = -1
    this._animSkip = 0
    this._animCulled = false
    this._rifleTarget = new THREE.Vector3()
  }

  configureRifleModel() {
    const { modelId, modelScale } = this.weaponData
    this.rifle.scale.set(...modelScale)

    let barrel = { z: -0.35, scale: [1, 1, 1] }
    let body = { z: -0.05, scale: [1, 1, 1] }
    let stock = { z: 0.22, scale: [1, 1, 1] }
    let grip = null
    let mag = { visible: false, y: -0.1, z: -0.04, scale: [1, 1, 1] }
    let muzzleZ = -0.72

    if (modelId === 'shotgun') {
      barrel = { z: -0.35, scale: [1.45, 0.85, 1.45] }
      body = { z: -0.06, scale: [1.2, 1.1, 0.9] }
      stock = { z: 0.2, scale: [1, 1, 0.82] }
      muzzleZ = -0.68
    } else if (modelId === 'thompson') {
      barrel = { z: -0.2, scale: [1.3, 0.48, 1.3] }
      body = { z: -0.02, scale: [1.5, 1.45, 0.8] }
      stock = { z: 0.16, scale: [1, 1, 0.62] }
      grip = { position: [0, -0.11, -0.2], rotation: [-0.2, 0, 0] }
      mag = { visible: true, y: -0.13, z: -0.035, scale: [1, 1.3, 0.78] }
      muzzleZ = -0.42
    } else if (modelId === 'bar') {
      barrel = { z: -0.44, scale: [1.35, 1.25, 1.35] }
      body = { z: -0.08, scale: [1.3, 1.25, 1.35] }
      stock = { z: 0.25, scale: [1, 1, 1.15] }
      mag = { visible: true, y: -0.12, z: -0.08, scale: [1.15, 1.15, 1.05] }
      muzzleZ = -0.9
    }

    if (this.rifleCore) {
      this.rifle.remove(this.rifleCore)
      this.rifleCore.geometry.dispose()
    }
    const coreParts = [
      {
        geometry: BOT_GEOMETRY.rifleBarrel,
        position: [0, 0.02, barrel.z],
        rotation: [Math.PI / 2, 0, 0],
        scale: barrel.scale,
      },
      {
        geometry: BOT_GEOMETRY.rifleBody,
        position: [0, 0.01, body.z],
        scale: body.scale,
      },
      {
        geometry: BOT_GEOMETRY.rifleStock,
        position: [0, -0.01, stock.z],
        scale: stock.scale,
      },
    ]
    if (grip) {
      coreParts.push({
        geometry: BOT_GEOMETRY.rifleGrip,
        position: grip.position,
        rotation: grip.rotation,
      })
    }
    this.rifleCore = createMergedMesh(coreParts, this.matLib.metalDark)
    this.rifle.add(this.rifleCore)

    this.rifleMag.position.set(0, mag.y, mag.z)
    this.rifleMag.scale.set(...mag.scale)
    this.rifleMag.visible = mag.visible
    this.rifleClip.position.set(0, 0.065, -0.06)
    this.rifleClip.scale.set(0.8, 0.16, 0.72)
    this.rifleClip.visible = false
    this.rifleMuzzle.position.set(0, 0.02, muzzleZ)
    this.bayonetBaseZ = muzzleZ
    this.bayonet.position.set(0, 0.02, this.bayonetBaseZ)
    this.bayonet.visible = !!this.weaponData.bayonet
  }

  createEquipmentModels() {
    const prop = (geometry, material, parent) => {
      const mesh = new THREE.Mesh(geometry, material)
      parent.add(mesh)
      return mesh
    }
    const dark = this.matLib.metalDark
    const brass = this.matLib.brass

    const c4 = new THREE.Group()
    prop(BOT_GEOMETRY.c4Body, dark, c4)
    const c4Band = prop(BOT_GEOMETRY.c4Band, brass, c4)
    c4Band.position.y = 0.055
    const c4Light = prop(
      new THREE.SphereGeometry(0.014, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xff3b30 }),
      c4,
    )
    c4Light.position.set(0.06, 0.062, -0.04)
    this.secondaryModels = { c4 }

    const rpg = new THREE.Group()
    const rpgTube = prop(BOT_GEOMETRY.rpgTube, this.matLib.blued, rpg)
    rpgTube.rotation.x = Math.PI / 2
    rpgTube.position.set(0, 0, -0.12)
    const rpgNozzle = prop(BOT_GEOMETRY.rpgNozzle, dark, rpg)
    rpgNozzle.rotation.x = Math.PI / 2
    rpgNozzle.position.z = 0.3
    const rpgGrip = prop(BOT_GEOMETRY.rpgGrip, this.matLib.wood, rpg)
    rpgGrip.position.set(0, -0.13, 0.02)
    rpgGrip.rotation.x = 0.22
    const rpgRocket = new THREE.Group()
    const rpgMotor = prop(BOT_GEOMETRY.rpgRocketMotor, dark, rpgRocket)
    rpgMotor.rotation.x = Math.PI / 2
    rpgMotor.position.z = 0.1
    const rpgBody = prop(BOT_GEOMETRY.rpgRocketBody, this.matLib.blued, rpgRocket)
    rpgBody.rotation.x = Math.PI / 2
    rpgBody.position.z = -0.04
    const rpgHead = prop(BOT_GEOMETRY.rpgRocketHead, dark, rpgRocket)
    rpgHead.rotation.x = -Math.PI / 2
    rpgHead.position.z = -0.17
    rpgRocket.position.set(0, 0, -0.52)
    rpg.add(rpgRocket)
    this.rpgRocket = rpgRocket
    this.secondaryModels.rpg = rpg

    const grenade = new THREE.Group()
    this.grenadeMaterial = new THREE.MeshLambertMaterial({ color: this.grenadeData.color })
    this.grenadeBody = prop(BOT_GEOMETRY.grenadeBody, this.grenadeMaterial, grenade)
    const grenadeCap = prop(BOT_GEOMETRY.grenadeCap, dark, grenade)
    grenadeCap.position.y = 0.098
    const grenadePin = prop(BOT_GEOMETRY.grenadePin, brass, grenade)
    grenadePin.rotation.x = Math.PI / 2
    grenadePin.position.set(0.045, 0.105, 0)
    this.grenadeModel = grenade

    const item = new THREE.Group()
    const medkit = new THREE.Group()
    prop(BOT_GEOMETRY.medkitBody, dark, medkit)
    const medkitCross = prop(BOT_GEOMETRY.medkitCross, this.matLib.allyAccent, medkit)
    medkitCross.position.set(0, 0.076, -0.001)
    const medkitCrossBar = prop(BOT_GEOMETRY.medkitCrossBar, this.matLib.allyAccent, medkit)
    medkitCrossBar.position.set(0, 0.076, -0.001)
    medkit.add(medkitCrossBar)
    const pouch = new THREE.Group()
    const pouchBody = prop(BOT_GEOMETRY.pouchBody, this.matLib.axisUniform, pouch)
    pouchBody.position.y = -0.01
    const pouchFlap = prop(BOT_GEOMETRY.pouchFlap, brass, pouch)
    pouchFlap.position.y = 0.077
    item.add(medkit, pouch)
    this.itemModels = { medkit, ammo: pouch }
    this.heldEquipment.add(c4, rpg, grenade, item)
    this.itemModel = item
    this.configureEquipmentModels()
  }

  configureEquipmentModels() {
    this.secondaryModels.c4.visible = this.secondaryData.kind === 'c4'
    this.secondaryModels.rpg.visible = this.secondaryData.kind === 'rpg'
    this.grenadeMaterial.color.setHex(this.grenadeData.color)
    this.itemModels.medkit.visible = this.itemData.kind === 'heal'
    this.itemModels.ammo.visible = this.itemData.kind === 'ammo'
    this.heldEquipment.visible = false
  }

  playAction(name, data = {}) {
    if (this.actionName === 'melee' && this.actionTime < this.actionDuration && name !== 'melee') return
    const defaultDuration = name === 'melee'
      ? this.config.weapon.meleeAnimationDuration
      : name === 'reload'
        ? (data.empty ? this.weaponData.emptyReloadDuration : this.weaponData.reloadDuration)
        : name === 'rpgReload'
          ? this.config.weapon.rpgReloadDuration
          : name === 'secondary'
            ? (data.kind === 'rpg' ? 0.9 : 0.72)
            : name === 'grenade' ? 0.78 : name === 'item' ? 0.9 : name === 'detonate' ? 0.38 : 0.18
    this.actionName = name
    this.actionTime = 0
    this.actionDuration = data.duration ?? defaultDuration
    if (name === 'reload') this.reloading = true
    if (name === 'secondary' || name === 'grenade' || name === 'item' || name === 'rpgReload' || name === 'detonate') {
      this.heldEquipment.visible = true
    }
  }

  resetActions() {
    this.actionName = null
    this.actionTime = 0
    this.actionDuration = 0
    this.reloading = false
    this.rifle.visible = true
    this.rifle.position.set(0.22, 0.46, -0.38)
    this.rifle.rotation.set(0, 0, 0)
    this.heldEquipment.visible = false
    this.heldEquipment.position.set(0, 0, 0)
    this.heldEquipment.rotation.set(0, 0, 0)
    this.bayonet.position.z = this.bayonetBaseZ
    this.bayonet.rotation.set(0, 0, 0)
    this.rpgRocket.visible = true
  }

  applyLoadout(definition) {
    const weapon = this.config.weapons[definition.weapon]
    const weaponChanged = this.weaponData !== weapon
    const equipmentChanged = this.secondaryData !== this.config.secondaries[definition.secondary] ||
      this.grenadeData !== this.config.grenades[definition.grenade] ||
      this.itemData !== this.config.items[definition.item]
    this.weaponData = weapon
    this.secondaryData = this.config.secondaries[definition.secondary]
    this.grenadeData = this.config.grenades[definition.grenade]
    this.itemData = this.config.items[definition.item]
    if (weaponChanged) this.configureRifleModel()
    if (equipmentChanged) this.configureEquipmentModels()
  }

  updateModelAnimation(dt) {
    this.animationTime += dt
    if (!this.alive) {
      this.deathTime = Math.max(0, this.deathTime) + dt
      const progress = Math.min(1, this.deathTime / 0.55)
      const eased = 1 - Math.pow(1 - progress, 3)
      this.group.rotation.z = (Math.PI / 2) * eased
      this.group.position.y = this.position.y + 0.04 + (1 - eased) * 0.06
      return
    }

    if (this.actionName) this.actionTime = Math.min(this.actionDuration, this.actionTime + dt)

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
        this.leftArm.rotation.set(0, 0, 0)
        this.rightArm.rotation.set(0, 0, 0)
        this.body.position.y = 0.78
        this.body.rotation.x = 0
        this.body.rotation.z = 0
        this.rifle.visible = true
        this.heldEquipment.visible = false
        this.bayonet.position.z = this.bayonetBaseZ
        this.bayonet.rotation.set(0, 0, 0)
        this.rifle.position.set(0.22, 0.46, -0.38)
        this.rifle.rotation.set(0, 0, 0)
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
    const moveBlendTarget = THREE.MathUtils.clamp(speed / 1.5, 0, 1)
    this.moveBlend +=
      (moveBlendTarget - this.moveBlend) * (1 - Math.exp(-10 * dt))
    if (this.moveBlend > 0.01) {
      this.legPhase += dt * (7.5 + Math.min(speed, 6) * 0.65)
    }

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
      this.stateName === 'hold_cover'
    let aimTarget = 0
    if (combatState) aimTarget = this.targetVisible ? 1 : 0.58
    this.aimPose += (aimTarget - this.aimPose) * (1 - Math.exp(-7 * dt))
    const reloadTarget = this.reloading ? 1 : 0
    this.reloadPose += (reloadTarget - this.reloadPose) * (1 - Math.exp(-9 * dt))
    const actionName = this.actionName
    const actionProgress = actionName && this.actionDuration > 0
      ? this.actionTime / this.actionDuration : 0
    const firePose = actionName === 'fire' ? Math.sin(actionProgress * Math.PI) : 0
    const meleePose = actionName === 'melee'
      ? actionProgress < 0.3
        ? actionProgress / 0.3
        : actionProgress < 0.52 ? 1 : 1 - (actionProgress - 0.52) / 0.48
      : 0
    const equipmentAction = actionName === 'secondary' || actionName === 'grenade' ||
      actionName === 'item' || actionName === 'rpgReload' || actionName === 'detonate'
    const equipmentPose = equipmentAction
      ? actionProgress < 0.22
        ? actionProgress / 0.22
        : actionProgress < 0.68 ? 1 : 1 - (actionProgress - 0.68) / 0.32
      : 0
    this.rifle.visible = !equipmentAction
    this.heldEquipment.visible = equipmentAction
    this.secondaryModels.c4.visible = equipmentAction &&
      (actionName === 'secondary' || actionName === 'detonate') && this.secondaryData.kind === 'c4'
    this.secondaryModels.rpg.visible = equipmentAction &&
      (actionName === 'secondary' || actionName === 'rpgReload') && this.secondaryData.kind === 'rpg'
    this.grenadeModel.visible = equipmentAction && actionName === 'grenade'
    this.itemModel.visible = equipmentAction && actionName === 'item'
    if (this.secondaryModels.rpg.visible && actionName === 'secondary' && actionProgress > 0.36)
      this.rpgRocket.visible = false
    else if (this.secondaryModels.rpg.visible) this.rpgRocket.visible = true
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
    const holdPose = this.aimPose * (1 - this.reloadPose * 0.9)

    const breathing = Math.sin(this.animationTime * 1.65) * 0.008
    const stepLift = (1 - Math.cos(this.legPhase * 2)) * 0.005 * this.moveBlend
    const bodyYTarget = 0.78 + breathing + stepLift
    const bodyPitchTarget = THREE.MathUtils.clamp(
      -forwardSpeed * 0.004 - holdPose * 0.008,
      -0.04,
      0.025,
    )
    const bodyRollTarget =
      THREE.MathUtils.clamp(-sideSpeed * 0.004, -0.035, 0.035) +
      Math.sin(this.animationTime * 0.9) * 0.003
    const bodyEase = 1 - Math.exp(-8 * dt)
    this.body.position.y += (bodyYTarget - this.body.position.y) * bodyEase
    this.body.rotation.x += (bodyPitchTarget - this.body.rotation.x) * bodyEase
    this.body.rotation.z += (bodyRollTarget - this.body.rotation.z) * bodyEase

    const carryLeftX = -stride * 0.22 * (1 - holdPose)
    const carryRightX = 1.05 + stride * 0.08 * (1 - holdPose)
    let leftArmX = THREE.MathUtils.lerp(carryLeftX, 1.15, this.aimPose)
    let rightArmX = THREE.MathUtils.lerp(carryRightX, 1.15, this.aimPose)
    let leftArmZ = THREE.MathUtils.lerp(0, 0.5, this.aimPose)
    let rightArmZ = -0.16
    if (meleePose > 0) {
      leftArmX = THREE.MathUtils.lerp(leftArmX, 1.48, meleePose)
      rightArmX = THREE.MathUtils.lerp(rightArmX, 1.38, meleePose)
      leftArmZ = THREE.MathUtils.lerp(leftArmZ, 0.58, meleePose)
      rightArmZ = THREE.MathUtils.lerp(rightArmZ, -0.04, meleePose)
    } else if (equipmentPose > 0) {
      leftArmX = THREE.MathUtils.lerp(leftArmX, 1.42, equipmentPose)
      rightArmX = THREE.MathUtils.lerp(rightArmX, 1.38, equipmentPose)
      leftArmZ = THREE.MathUtils.lerp(leftArmZ, 0.34, equipmentPose)
      rightArmZ = THREE.MathUtils.lerp(rightArmZ, -0.22, equipmentPose)
    }
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

    const targetPitch = 0.02
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
        this.reloadPose,
      ) - meleePose * 0.12,
      THREE.MathUtils.lerp(
        THREE.MathUtils.lerp(carryRifleY, aimRifleY, this.aimPose),
        reloadRifleY,
        this.reloadPose,
      ) + meleePose * 0.06,
      THREE.MathUtils.lerp(
        THREE.MathUtils.lerp(carryRifleZ, aimRifleZ, this.aimPose),
        reloadRifleZ,
        this.reloadPose,
      ) - meleePose * 0.28 + firePose * 0.025,
    )
    const rifleEase = 1 - Math.exp(-13 * dt)
    this.rifle.position.lerp(this._rifleTarget, rifleEase)
    const riflePitchTarget =
      THREE.MathUtils.lerp(-0.18, targetPitch + 0.02, this.aimPose) +
      this.reloadPose * reloadPitchOffset +
      meleePose * 0.52 + firePose * 0.07
    const rifleYawTarget =
      THREE.MathUtils.lerp(0.08, 0.015, this.aimPose) +
      this.reloadPose * reloadYawOffset -
      meleePose * 0.08
    const rifleRollTarget =
      THREE.MathUtils.lerp(0.06, 0.015, this.aimPose) +
      this.reloadPose * reloadRollOffset -
      meleePose * 0.08 + firePose * 0.025
    this.rifle.rotation.x += (riflePitchTarget - this.rifle.rotation.x) * rifleEase
    this.rifle.rotation.y += (rifleYawTarget - this.rifle.rotation.y) * rifleEase
    this.rifle.rotation.z += (rifleRollTarget - this.rifle.rotation.z) * rifleEase

    if (meleePose > 0) {
      this.bayonet.position.z = this.bayonetBaseZ - meleePose * 0.035
      this.bayonet.rotation.x = -meleePose * 0.12
    } else {
      this.bayonet.position.z = this.bayonetBaseZ
      this.bayonet.rotation.set(0, 0, 0)
    }
    if (equipmentAction) {
      this.heldEquipment.position.set(
        -0.1 - equipmentPose * 0.05,
        0.2 + equipmentPose * 0.28,
        -0.16 - equipmentPose * 0.25,
      )
      this.heldEquipment.rotation.set(
        -0.28 + equipmentPose * 0.12,
        equipmentAction && actionName === 'grenade' ? 0.18 : 0,
        0.08,
      )
    } else {
      this.heldEquipment.position.set(0, 0, 0)
      this.heldEquipment.rotation.set(0, 0, 0)
    }
    if (this.actionName && this.actionTime >= this.actionDuration) {
      this.actionName = null
      this.actionTime = 0
      this.actionDuration = 0
      this.heldEquipment.visible = false
      this.rifle.visible = true
    }

    const headEase = 1 - Math.exp(-9 * dt)
    const headPitchTarget = targetPitch * this.aimPose * 0.3 - bodyPitchTarget * 0.35
    const headYawTarget = 0
    const headRollTarget = -bodyRollTarget * 0.45
    this.head.rotation.x += (headPitchTarget - this.head.rotation.x) * headEase
    this.head.rotation.y += (headYawTarget - this.head.rotation.y) * headEase
    this.head.rotation.z += (headRollTarget - this.head.rotation.z) * headEase

  }

  destroy() {
    this.scene.remove(this.group)
  }
}

const ZOMBIE_ANIM_MID_DIST_SQ = 28 * 28
const ZOMBIE_ANIM_FAR_DIST_SQ = 48 * 48

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

class Zombie {
  constructor(spawnPosition, services) {
    Object.assign(this, services)
    this.team = 'axis'
    this.name = '丧尸'
    this.position = spawnPosition.clone()
    this.velocity = new THREE.Vector3()
    this.yaw = 0
    this.alive = true
    this.health = 0
    this.maxHealth = this.config.modes.zombie.enemy.maxHealth
    this.kills = 0
    this.deaths = 0
    this.deathTime = -1
    this.animationTime = Math.random() * Math.PI * 2
    this.legPhase = Math.random() * Math.PI * 2
    this.moveBlend = 0
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
    if (distSq > ZOMBIE_ANIM_FAR_DIST_SQ) {
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
    if (distSq > ZOMBIE_ANIM_MID_DIST_SQ) {
      this._animSkip ^= 1
      if (this._animSkip) return
      dt *= 2
    }

    const speed = Math.hypot(this.velocity.x, this.velocity.z)
    const blend = THREE.MathUtils.clamp(speed / this.config.modes.zombie.enemy.speed, 0, 1)
    this.moveBlend += (blend - this.moveBlend) * (1 - Math.exp(-9 * dt))
    if (this.moveBlend > 0.01) this.legPhase += dt * 8
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

export function createRemoteActorView(actor, services) {
  const y = actor.kind === 'player' && actor.deployed ? actor.y - actor.currentHeight : actor.y
  const common = {
    scene: services.scene, camera: services.camera, matLib: services.matLib, config: services.config,
  }
  const position = new THREE.Vector3(actor.x, y, actor.z)
  const view = actor.kind === 'zombie'
    ? new Zombie(position, common)
    : new Bot(actor.team, position, {
      ...common,
      weaponData: services.config.weapons[actor.weapon],
      secondaryData: services.config.secondaries[actor.secondary],
      grenadeData: services.config.grenades[actor.grenade],
      itemData: services.config.items[actor.item],
    })
  view.id = actor.id
  view.actorKind = actor.kind
  view.name = actor.name
  view.networkPosition = view.position.clone()
  view.networkYaw = actor.yaw
  view.networkUpdatedAt = performance.now()
  return view
}

export function applyRemoteActorSnapshot(view, actor) {
  const wasAlive = view.alive
  view.alive = actor.alive
  if (wasAlive && !actor.alive) {
    view.deathTime = 0
    view.stateName = 'dead'
  }
  view.health = actor.health
  view.maxHealth = actor.maxHealth
  if (actor.kind !== 'zombie') {
    if (!wasAlive && actor.alive) view.resetActions()
    view.applyLoadout(actor)
  }
  view.kills = actor.kills
  view.deaths = actor.deaths
  const y = actor.kind === 'player' && actor.deployed ? actor.y - actor.currentHeight : actor.y
  view.networkPosition.set(actor.x, y, actor.z)
  view.networkYaw = actor.yaw
  view.networkUpdatedAt = performance.now()
  view.velocity.set(actor.vx, actor.vy, actor.vz)
  view.yaw = actor.yaw
  view.stateName = actor.alive ? actor.stateName ?? view.stateName : 'dead'
  view.targetVisible = actor.targetVisible ?? actor.alive
  view.reloading = actor.reloading
  view.group.visible = actor.kind !== 'player' || actor.deployed
  if ((!wasAlive && actor.alive) || view.position.distanceToSquared(view.networkPosition) > 64) {
    view.position.copy(view.networkPosition)
    view.deathTime = -1
    view.group.rotation.set(0, actor.yaw, 0)
  }
}

export function interpolateRemoteActor(view, dt, now) {
  if (view.alive) {
    const elapsed = Math.min(0.1, (now - view.networkUpdatedAt) / 1000)
    const alpha = 1 - Math.exp(-20 * dt)
    view.position.x += (view.networkPosition.x + view.velocity.x * elapsed - view.position.x) * alpha
    view.position.y += (view.networkPosition.y + view.velocity.y * elapsed - view.position.y) * alpha
    view.position.z += (view.networkPosition.z + view.velocity.z * elapsed - view.position.z) * alpha
    const turn = Math.atan2(Math.sin(view.networkYaw - view.yaw), Math.cos(view.networkYaw - view.yaw))
    view.yaw += turn * alpha
  }
  view.group.position.copy(view.position)
  view.group.rotation.y = view.yaw
}
