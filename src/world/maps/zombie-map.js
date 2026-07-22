import * as THREE from 'three'
import { ZOMBIE_SPAWN_POINTS } from '../../config.js'

const ZOMBIE_COLORS = {
  ground: 0x334b3d,
  mud: 0x4c3f38,
  asphalt: 0x242b2d,
  concrete: 0x72706a,
  concreteDark: 0x454843,
  brick: 0x6f4d45,
  rust: 0x7b4039,
  wood: 0x5b4435,
  warning: 0xd19a38,
  fog: 0x242c2a,
}

export function createZombieMap({ scene, matLib, state, config, objectives }) {
  const mapSize = config.match.mapSize
  const groundRegions = []

  function addMesh(mesh, { castShadow = true, receiveShadow = true } = {}) {
    mesh.traverse(object => {
      if (!object.isMesh) return
      object.castShadow = castShadow
      object.receiveShadow = receiveShadow
    })
    scene.add(mesh)
    return mesh
  }

  function addBoxObstacle({ type, x, z, width, depth, height, rotation = 0, minY = 0 }) {
    const cos = Math.cos(rotation)
    const sin = Math.sin(rotation)
    const obstacle = {
      type,
      shape: 'box',
      x,
      z,
      w: width,
      d: depth,
      h: height,
      minY,
      maxY: minY + height,
      rot: rotation,
      cos,
      sin,
      hw: width * 0.5,
      hd: depth * 0.5,
      r: Math.sqrt(width * width + depth * depth) * 0.5,
    }
    state.obstacles.push(obstacle)
  }

  function addFrustumRegion({ x, z, bottomRadius, topRadius, height }) {
    groundRegions.push({ x, z, bottomRadius, topRadius, height })
  }

  function groundHeightAt(x, z) {
    let height = 0
    for (const region of groundRegions) {
      const distance = Math.hypot(x - region.x, z - region.z)
      if (distance > region.bottomRadius) continue
      let surfaceHeight = region.height
      if (distance > region.topRadius) {
        const slopeSpan = region.bottomRadius - region.topRadius
        surfaceHeight = ((region.bottomRadius - distance) / slopeSpan) * region.height
      }
      height = Math.max(height, surfaceHeight)
    }
    return height
  }

  function createGround() {
    const geometry = new THREE.PlaneGeometry(mapSize * 2, mapSize * 2, 48, 48)
    const positions = geometry.attributes.position
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i)
      const z = positions.getY(i)
      const roughness = Math.sin(x * 0.08) * Math.cos(z * 0.06) * 0.18
      const debrisDip = Math.sin(x * 0.21 + z * 0.13) * 0.08
      positions.setZ(i, roughness + debrisDip + (Math.random() - 0.5) * 0.05)
    }
    geometry.computeVertexNormals()
    const ground = new THREE.Mesh(geometry, matLib.grass.clone())
    ground.material.color.set(ZOMBIE_COLORS.ground)
    ground.rotation.x = -Math.PI / 2
    addMesh(ground, { castShadow: false })

    const mud = new THREE.Mesh(
      new THREE.PlaneGeometry(mapSize * 0.82, mapSize * 0.22),
      matLib.dirt.clone()
    )
    mud.material.color.set(ZOMBIE_COLORS.mud)
    mud.rotation.x = -Math.PI / 2
    mud.rotation.z = -0.12
    mud.position.set(0, 0.025, -18)
    addMesh(mud, { castShadow: false })

    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(12, mapSize * 1.7),
      matLib.road.clone()
    )
    road.material.color.set(ZOMBIE_COLORS.asphalt)
    road.rotation.x = -Math.PI / 2
    road.position.y = 0.04
    addMesh(road, { castShadow: false })

    for (let i = 0; i < 32; i++) {
      const patch = new THREE.Mesh(
        new THREE.CircleGeometry(1.2 + Math.random() * 3.5, 8),
        matLib.dirt.clone()
      )
      patch.material.color.set(Math.random() > 0.5 ? ZOMBIE_COLORS.mud : ZOMBIE_COLORS.concreteDark)
      patch.rotation.x = -Math.PI / 2
      patch.rotation.z = Math.random() * Math.PI
      patch.position.set(
        (Math.random() - 0.5) * mapSize * 0.82,
        0.06,
        (Math.random() - 0.5) * mapSize * 0.82
      )
      addMesh(patch, { castShadow: false })
    }
  }

  function createCentralPlaza() {
    const concrete = new THREE.Mesh(
      new THREE.CircleGeometry(29, 48),
      matLib.concrete.clone()
    )
    concrete.material.color.set(ZOMBIE_COLORS.concreteDark)
    concrete.rotation.x = -Math.PI / 2
    concrete.position.y = 0.028
    addMesh(concrete, { castShadow: false })

    const roadRing = new THREE.Mesh(
      new THREE.RingGeometry(19, 26, 48),
      matLib.road.clone()
    )
    roadRing.material.color.set(ZOMBIE_COLORS.asphalt)
    roadRing.rotation.x = -Math.PI / 2
    roadRing.position.y = 0.052
    addMesh(roadRing, { castShadow: false })

    const centerSlab = new THREE.Mesh(
      new THREE.CircleGeometry(18.5, 32),
      matLib.concrete.clone()
    )
    centerSlab.material.color.set(0x565b58)
    centerSlab.rotation.x = -Math.PI / 2
    centerSlab.position.y = 0.048
    addMesh(centerSlab, { castShadow: false })

    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2
      const crack = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.035, 7 + Math.random() * 5),
        matLib.metalDark
      )
      crack.position.set(Math.cos(angle) * 22, 0.075, Math.sin(angle) * 22)
      crack.rotation.y = angle + (Math.random() - 0.5) * 0.4
      addMesh(crack, { castShadow: false })
    }
  }

  function createRubblePile(x, z, scale = 1) {
    const group = new THREE.Group()
    group.position.set(x, 0, z)
    for (let i = 0; i < 11; i++) {
      const width = (0.35 + Math.random() * 1.15) * scale
      const height = (0.25 + Math.random() * 0.9) * scale
      const depth = (0.3 + Math.random() * 1.1) * scale
      const material = [matLib.rust, matLib.concrete, matLib.brick][i % 3]
      const piece = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material)
      piece.position.set(
        (Math.random() - 0.5) * 3.8 * scale,
        height * 0.5,
        (Math.random() - 0.5) * 3.8 * scale
      )
      piece.rotation.set(
        (Math.random() - 0.5) * 0.5,
        Math.random() * Math.PI,
        (Math.random() - 0.5) * 0.5
      )
      group.add(piece)
    }
    addMesh(group)
  }

  function createRuinedHouse(x, z, rotation, scale = 1) {
    const group = new THREE.Group()
    group.position.set(x, 0, z)
    group.rotation.y = rotation
    const width = 8 * scale
    const depth = 6 * scale
    const height = 4.6 * scale
    const wall = matLib.brick.clone()
    wall.color.set(ZOMBIE_COLORS.brick)
    const concrete = matLib.concrete.clone()
    concrete.color.set(ZOMBIE_COLORS.concrete)

    const base = new THREE.Mesh(new THREE.BoxGeometry(width, 0.35, depth), concrete)
    base.position.y = 0.18
    group.add(base)
    const back = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.32), wall)
    back.position.set(0, height * 0.5, -depth * 0.5)
    group.add(back)
    const windowMaterial = matLib.metalDark
    for (const windowX of [-width * 0.27, width * 0.27]) {
      const window = new THREE.Mesh(
        new THREE.BoxGeometry(width * 0.18, height * 0.2, 0.06),
        windowMaterial
      )
      window.position.set(windowX, height * 0.58, -depth * 0.68)
      group.add(window)
      for (const barX of [-0.18, 0.18]) {
        const bar = new THREE.Mesh(
          new THREE.BoxGeometry(0.045, height * 0.22, 0.08),
          matLib.rust
        )
        bar.position.set(windowX + barX * scale, height * 0.58, -depth * 0.72)
        group.add(bar)
      }
    }
    const doorway = new THREE.Mesh(
      new THREE.BoxGeometry(width * 0.18, height * 0.45, 0.08),
      matLib.metalDark
    )
    doorway.position.set(width * 0.05, height * 0.28, -depth * 0.7)
    group.add(doorway)
    for (const side of [-1, 1]) {
      const brokenWall = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, height * (0.42 + Math.random() * 0.25), depth * 0.54),
        wall
      )
      brokenWall.position.set(side * width * 0.48, height * 0.34, depth * 0.02)
      brokenWall.rotation.z = side * (0.08 + Math.random() * 0.12)
      group.add(brokenWall)
    }
    addBoxObstacle({ type: 'ruined-house', x, z, width, depth, height, rotation })

    const collapsedBeam = new THREE.Mesh(new THREE.BoxGeometry(width * 0.9, 0.28, 0.32), matLib.wood)
    collapsedBeam.position.set(0, height * 0.62, depth * 0.25)
    collapsedBeam.rotation.z = -0.18
    group.add(collapsedBeam)
    const roof = new THREE.Mesh(new THREE.BoxGeometry(width + 0.6, 0.24, depth + 0.6), matLib.concrete)
    roof.position.set(0, height + 0.12, 0)
    roof.rotation.z = 0.08
    group.add(roof)
    for (const roofX of [-width * 0.34, width * 0.34]) {
      const beam = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.22, depth + 0.8),
        matLib.wood
      )
      beam.position.set(roofX, height + 0.34, 0)
      beam.rotation.z = roof.rotation.z
      group.add(beam)
    }
    const chimney = new THREE.Mesh(
      new THREE.BoxGeometry(0.7 * scale, 1.25 * scale, 0.7 * scale),
      wall
    )
    chimney.position.set(-width * 0.26, height + 0.55 * scale, depth * 0.16)
    chimney.rotation.z = -0.08
    group.add(chimney)
    addMesh(group)

    state.coverPoints.push({ x, z, r: Math.max(width, depth) * 0.7, type: 'ruined-house' })
  }

  function createBarricade(x, z, rotation, width = 7) {
    const group = new THREE.Group()
    group.position.set(x, 0, z)
    group.rotation.y = rotation
    for (let i = -2; i <= 2; i++) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.1, 0.18), matLib.wood)
      post.position.set(i * width * 0.2, 1.05, 0)
      post.rotation.z = (Math.random() - 0.5) * 0.16
      group.add(post)
    }
    for (let row = 0; row < 3; row++) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(width, 0.22, 0.2), matLib.wood)
      plank.position.set(0, 0.5 + row * 0.58, 0)
      plank.rotation.z = (Math.random() - 0.5) * 0.04
      group.add(plank)
    }
    const signPole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 2.6, 6), matLib.metalDark)
    signPole.position.set(0, 2.25, 0)
    group.add(signPole)
    const warning = new THREE.Mesh(
      new THREE.ConeGeometry(0.62, 0.72, 3),
      matLib.allyAccent.clone()
    )
    warning.material.color.set(ZOMBIE_COLORS.warning)
    warning.position.set(0, 3.35, -0.04)
    warning.rotation.z = Math.PI
    group.add(warning)
    const warningSlash = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.72, 0.06),
      matLib.rust
    )
    warningSlash.position.set(0, 3.35, -0.11)
    warningSlash.rotation.z = -0.7
    group.add(warningSlash)
    addMesh(group)
    addBoxObstacle({ type: 'barricade', x, z, width, depth: 0.32, height: 1.9, rotation })
    state.coverPoints.push({ x, z, r: width * 0.5, type: 'barricade' })
  }

  function createWreck(x, z, rotation) {
    const group = new THREE.Group()
    group.position.set(x, 0, z)
    group.rotation.y = rotation
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.95, 4.5), matLib.rust)
    body.position.y = 0.65
    body.rotation.z = 0.08
    group.add(body)
    const hood = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.5, 1.4), matLib.rust)
    hood.position.set(0, 1.05, -1.55)
    group.add(hood)
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(1.9, 0.58, 1.8),
      matLib.metalDark
    )
    cabin.position.set(0, 1.3, 0.35)
    cabin.rotation.x = -0.08
    group.add(cabin)
    const windshield = new THREE.Mesh(
      new THREE.BoxGeometry(1.62, 0.42, 0.06),
      matLib.glass
    )
    windshield.position.set(0, 1.38, -0.58)
    windshield.rotation.x = -0.18
    group.add(windshield)
    for (const side of [-1, 1]) {
      const door = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.5, 1.35),
        matLib.rust
      )
      door.position.set(side * 1.16, 0.92, 0.38)
      group.add(door)
      const bumper = new THREE.Mesh(
        new THREE.BoxGeometry(2.45, 0.16, 0.18),
        matLib.metalDark
      )
      bumper.position.set(0, 0.42, side > 0 ? 2.15 : -2.15)
      group.add(bumper)
    }
    for (const side of [-1, 1]) {
      for (let i = -1; i <= 1; i++) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.18, 8), matLib.metalDark)
        wheel.rotation.z = Math.PI / 2
        wheel.position.set(side * 1.16, 0.42, i * 1.25)
        group.add(wheel)
      }
    }
    addMesh(group)
    addBoxObstacle({ type: 'wreck', x, z, width: 2.8, depth: 4.8, height: 1.4, rotation })
  }

  function createFenceLine(x, z, length, rotation) {
    const group = new THREE.Group()
    group.position.set(x, 0, z)
    group.rotation.y = rotation
    for (let i = -Math.floor(length / 6); i <= Math.floor(length / 6); i++) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.8, 0.16), matLib.rust)
      post.position.set(i * 6, 0.9, 0)
      group.add(post)
    }
    const fence = new THREE.Mesh(new THREE.BoxGeometry(length * 0.84, 1.15, 0.08), matLib.metalDark)
    fence.position.y = 1.05
    group.add(fence)
    for (const direction of [-1, 1]) {
      const wire = new THREE.Mesh(
        new THREE.BoxGeometry(length * 0.86, 0.045, 0.045),
        matLib.rust
      )
      wire.position.y = 1.45 + direction * 0.22
      wire.rotation.z = direction * 0.08
      group.add(wire)
    }
    addMesh(group, { castShadow: false })
    addBoxObstacle({
      type: 'fence',
      x,
      z,
      width: length * 0.84,
      depth: 0.12,
      height: 1.5,
      rotation,
    })
  }

  function createStreetLamp(x, z, rotation) {
    const group = new THREE.Group()
    group.position.set(x, 0, z)
    group.rotation.y = rotation
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.18, 4.8, 8),
      matLib.metalDark
    )
    pole.position.y = 2.4
    group.add(pole)
    const arm = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.12, 0.12),
      matLib.rust
    )
    arm.position.set(0.45, 4.55, 0)
    group.add(arm)
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 8, 6),
      matLib.allyAccent.clone()
    )
    lamp.material.color.set(0xffb86b)
    lamp.material.emissive.set(0xff7a3d)
    lamp.material.emissiveIntensity = 3.2
    lamp.position.set(0.95, 4.42, 0)
    group.add(lamp)
    const light = new THREE.PointLight(0xffb86b, 6, 26, 1.5)
    light.position.set(0.95, 4.32, 0)
    group.add(light)
    addMesh(group)
  }

  function createBurialGround() {
    for (let i = 0; i < 18; i++) {
      const x = -78 + (i % 6) * 8 + (Math.random() - 0.5) * 2
      const z = -12 + Math.floor(i / 6) * 9 + (Math.random() - 0.5) * 2
      const mound = new THREE.Mesh(
        new THREE.SphereGeometry(1.25, 10, 5, 0, Math.PI * 2, 0, Math.PI * 0.5),
        matLib.dirt
      )
      mound.position.set(x, 0.08, z)
      mound.scale.z = 0.62
      addMesh(mound, { castShadow: false })
      const stone = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.1, 0.22), matLib.concrete)
      stone.position.set(x, 0.55, z)
      stone.rotation.y = (Math.random() - 0.5) * 0.25
      addMesh(stone)
      const crossBar = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.16, 0.18), matLib.wood)
      crossBar.position.set(x, 0.83, z - 0.14)
      crossBar.rotation.y = stone.rotation.y
      addMesh(crossBar)
      state.coverPoints.push({ x, z, r: 1.2, type: 'grave' })
    }
    const gate = new THREE.Mesh(new THREE.BoxGeometry(15, 0.14, 0.14), matLib.rust)
    gate.position.set(-58, 2.6, -8)
    gate.rotation.z = 0.2
    addMesh(gate)
  }

  function createLightingAndSky() {
    scene.traverse(object => {
      if (object.isAmbientLight) {
        object.color.set(0x344247)
        object.intensity = 0.32
      } else if (object.isHemisphereLight) {
        object.color.set(0x9aaeb2)
        object.groundColor.set(0x1d2524)
        object.intensity = 0.78
      } else if (object.isDirectionalLight) {
        object.color.set(object.castShadow ? 0xb8c8c1 : 0x6b8588)
        object.intensity = object.castShadow ? 1.35 : 0.3
      }
    })
    scene.background = new THREE.Color(ZOMBIE_COLORS.fog)
    if (scene.fog) {
      scene.fog.color.set(ZOMBIE_COLORS.fog)
      scene.fog.density = 0.014
    }
    const moon = new THREE.Mesh(
      new THREE.SphereGeometry(12, 16, 10),
      new THREE.MeshBasicMaterial({ color: 0xd9e1c4 })
    )
    moon.position.set(-120, 100, -180)
    addMesh(moon, { castShadow: false, receiveShadow: false })
  }

  const map = {
    spawnPoints: ZOMBIE_SPAWN_POINTS,
    buildMap,
    addFrustumRegion,
  }

  function buildMap() {
    state.mapId = 'zombie'
    state.groundHeightAt = groundHeightAt
    createGround()
    createCentralPlaza()
    createStreetLamp(-23, -18, 0.2)
    createStreetLamp(23, -18, -0.2)
    createStreetLamp(-23, 20, Math.PI + 0.2)
    createStreetLamp(23, 20, Math.PI - 0.2)
    createRuinedHouse(-48, -45, -0.2, 1.25)
    createRuinedHouse(44, -42, 0.18, 0.95)
    createRuinedHouse(-74, 42, 0.4, 0.85)
    createRuinedHouse(74, 35, -0.5, 1.1)
    createBarricade(-26, 18, Math.atan2(18, -26), 9)
    createBarricade(28, -4, Math.atan2(-4, 28), 8)
    createBarricade(-46, 70, Math.atan2(70, -46), 7)
    createWreck(-30, -12, 0.8)
    createWreck(34, 48, -0.6)
    createRubblePile(-21, -28, 1.2)
    createRubblePile(24, 27, 1.1)
    createRubblePile(-41, 25, 1.35)
    createRubblePile(42, -20, 0.95)
    createFenceLine(-18, -74, 28, Math.atan2(-74, -18))
    createFenceLine(62, -8, 24, Math.atan2(-8, 62))
    createBurialGround()
    createLightingAndSky()
    objectives.createFortress({
      ...config.modes.zombie.fortress,
      map,
    })
  }

  return map
}
