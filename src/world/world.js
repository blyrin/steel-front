import * as THREE from 'three'

export function createWorldSystem({ scene, matLib, state, config }) {
  const sharedGeometry = {
    sandbag: new THREE.CapsuleGeometry(0.28, 0.35, 4, 8),
    root: new THREE.BoxGeometry(0.15, 0.12, 0.7),
    wirePost: new THREE.CylinderGeometry(0.07, 0.1, 1.55, 6),
    wire: new THREE.CylinderGeometry(0.015, 0.015, 3.2, 5),
    coil: new THREE.TorusGeometry(0.22, 0.025, 5, 12),
    craterMound: new THREE.SphereGeometry(1, 6, 4),
    trunk: new THREE.CylinderGeometry(1, 1, 1, 7),
    branch: new THREE.CylinderGeometry(1, 1, 1, 5),
    foliage: new THREE.IcosahedronGeometry(1, 0),
  }

  function pushBoxObstacle({ type, x, z, w, d, h, rot, minY = 0 }) {
    const cos = Math.cos(rot)
    const sin = Math.sin(rot)
    const obstacle = {
      type,
      shape: 'box',
      x,
      z,
      w,
      d,
      h,
      minY,
      maxY: minY + h,
      rot,
      cos,
      sin,
      hw: w * 0.5,
      hd: d * 0.5,
      r: Math.sqrt(w * w + d * d) * 0.5,
    }
    state.obstacles.push(obstacle)
    return obstacle
  }

  function pushModelObstacle({ type, model }) {
    // 用模型实际变换后的几何范围生成碰撞盒，避免随机尺寸再次漂移
    model.updateMatrixWorld(true)
    const modelMatrix = model.matrixWorld
    const worldToModel = modelMatrix.clone().invert()
    const localBounds = new THREE.Box3()
    const worldBounds = new THREE.Box3()
    const corner = new THREE.Vector3()

    model.traverse(object => {
      if (!object.isMesh || object.name === 'ink-outline' || object.userData.noCollision) return
      if (!object.geometry.boundingBox) object.geometry.computeBoundingBox()
      const { min, max } = object.geometry.boundingBox
      for (let i = 0; i < 8; i++) {
        corner.set(
          i & 1 ? max.x : min.x,
          i & 2 ? max.y : min.y,
          i & 4 ? max.z : min.z
        )
        corner.applyMatrix4(object.matrixWorld)
        worldBounds.expandByPoint(corner)
        corner.applyMatrix4(worldToModel)
        localBounds.expandByPoint(corner)
      }
    })

    const localCenter = localBounds.getCenter(new THREE.Vector3())
    const worldCenter = localCenter.applyMatrix4(modelMatrix)
    const worldXAxis = new THREE.Vector3(1, 0, 0).transformDirection(modelMatrix)
    worldXAxis.y = 0
    worldXAxis.normalize()
    const rotation = Math.atan2(-worldXAxis.z, worldXAxis.x)
    return pushBoxObstacle({
      type,
      x: worldCenter.x,
      z: worldCenter.z,
      w: localBounds.max.x - localBounds.min.x,
      d: localBounds.max.z - localBounds.min.z,
      h: worldBounds.max.y - worldBounds.min.y,
      minY: worldBounds.min.y,
      rot: rotation,
    })
  }

  function enableShadow(mesh, cast = true, receive = true) {
    mesh.castShadow = cast
    mesh.receiveShadow = receive
    return mesh
  }

  function buildWorld() {
    const half = config.mapSize / 2
    const groundGeo = new THREE.PlaneGeometry(config.mapSize * 2, config.mapSize * 2, 64, 64)
    const positions = groundGeo.attributes.position
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i)
      const y = positions.getY(i)
      if (Math.abs(x) < half + 8 && Math.abs(y) < half + 8) {
        const undulation =
          Math.sin(x * 0.045) * Math.cos(y * 0.038) * 0.55 +
          Math.sin(x * 0.11 + y * 0.07) * 0.22 +
          Math.cos(x * 0.19 - y * 0.13) * 0.12
        const roadDip =
          Math.abs(x) < 6 || Math.abs(y) < 5 ? -0.08 : Math.abs(x) < 12 || Math.abs(y) < 10 ? -0.03 : 0
        positions.setZ(i, undulation + roadDip + (Math.random() - 0.5) * 0.08)
      } else {
        positions.setZ(i, -1.5 + Math.random() * 0.4)
      }
    }
    groundGeo.computeVertexNormals()
    const ground = enableShadow(new THREE.Mesh(groundGeo, matLib.grass), false, true)
    ground.rotation.x = -Math.PI / 2
    scene.add(ground)

    // 泥地斑块
    for (let i = 0; i < 36; i++) {
      const patch = enableShadow(
        new THREE.Mesh(
          new THREE.CircleGeometry(3 + Math.random() * 6, 10),
          matLib.dirt
        ),
        false,
        true
      )
      patch.rotation.x = -Math.PI / 2
      patch.position.set(
        (Math.random() - 0.5) * config.mapSize * 0.85,
        0.015 + Math.random() * 0.01,
        (Math.random() - 0.5) * config.mapSize * 0.85
      )
      patch.rotation.z = Math.random() * Math.PI
      scene.add(patch)
    }

    const roadNS = enableShadow(
      new THREE.Mesh(new THREE.PlaneGeometry(11, config.mapSize), matLib.road),
      false,
      true
    )
    roadNS.rotation.x = -Math.PI / 2
    roadNS.position.y = 0.03
    scene.add(roadNS)

    const roadEW = enableShadow(
      new THREE.Mesh(new THREE.PlaneGeometry(config.mapSize * 0.72, 9), matLib.road),
      false,
      true
    )
    roadEW.rotation.x = -Math.PI / 2
    roadEW.position.y = 0.035
    scene.add(roadEW)

    // 路肩碎石
    for (const side of [-1, 1]) {
      const shoulder = enableShadow(
        new THREE.Mesh(new THREE.PlaneGeometry(2.2, config.mapSize * 0.95), matLib.dirt),
        false,
        true
      )
      shoulder.rotation.x = -Math.PI / 2
      shoulder.position.set(side * 6.4, 0.025, 0)
      scene.add(shoulder)
    }

    for (let i = 0; i < 32; i++) {
      const angle = Math.random() * Math.PI * 2
      const radius = 18 + Math.random() * (half - 28)
      createCrater(Math.cos(angle) * radius, Math.sin(angle) * radius)
    }

    const buildings = [
      { x: -40, z: -30 },
      { x: -55, z: 10 },
      { x: -70, z: -55 },
      { x: -25, z: -70 },
      { x: 35, z: -45 },
      { x: 60, z: -20 },
      { x: 75, z: 15 },
      { x: 45, z: 50 },
      { x: 20, z: 65 },
      { x: -20, z: 55 },
      { x: -50, z: 40 },
      { x: -80, z: 0 },
      { x: 0, z: -50 },
      { x: 10, z: 20 },
      { x: -15, z: -15 },
      { x: 55, z: -70 },
      { x: -60, z: 70 },
      { x: 80, z: -50 },
      { x: -90, z: -30 },
      { x: 30, z: -90 },
      { x: -35, z: 90 },
      { x: 70, z: 60 },
      { x: 0, z: 40 },
      { x: 0, z: -80 },
    ]
    buildings.forEach(({ x, z }) => createBuilding(x, z, (Math.random() - 0.5) * 1.2))

    const sandbags = [
      { x: 0, z: -25 },
      { x: 8, z: -25 },
      { x: -8, z: -25 },
      { x: 0, z: 25 },
      { x: 8, z: 25 },
      { x: -8, z: 25 },
      { x: -35, z: 0 },
      { x: 35, z: 0 },
      { x: -50, z: -20 },
      { x: 50, z: 20 },
      { x: 0, z: 0 },
      { x: -20, z: 40 },
      { x: 20, z: -40 },
      { x: -70, z: 30 },
      { x: 70, z: -30 },
    ]
    sandbags.forEach(({ x, z }) => createSandbags(x, z, Math.random() * Math.PI))

    for (let i = 0; i < 55; i++) {
      const x = (Math.random() - 0.5) * config.mapSize * 0.9
      const z = (Math.random() - 0.5) * config.mapSize * 0.9
      if (Math.abs(x) < 8 && Math.abs(z) < 8) continue
      createCrate(x, z, Math.random() * Math.PI * 2)
    }

    createWreckTank(-40, -20, 0.6)
    createWreckTank(45, 28, -0.8)
    createWreckTank(-15, 60, 1.2)
    createWreckTank(70, -55, -0.3)
    createWreckTank(25, -75, 0.4)

    for (let i = 0; i < 14; i++) {
      const angle = (i / 14) * Math.PI * 2
      const radius = 55 + (i % 3) * 18
      createBarbedWire(Math.cos(angle) * radius, Math.sin(angle) * radius, angle + Math.PI / 2)
    }
    for (let i = 0; i < 90; i++) {
      const angle = Math.random() * Math.PI * 2
      const radius = half * 0.52 + Math.random() * half * 0.42
      createTree(Math.cos(angle) * radius, Math.sin(angle) * radius)
    }
    for (let i = 0; i < 40; i++) {
      createDebris(
        (Math.random() - 0.5) * config.mapSize * 0.85,
        (Math.random() - 0.5) * config.mapSize * 0.85
      )
    }
    createSky()
    createDistantHills(half)
    createSmokeColumns()
  }

  function createSky() {
    const skyMat = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: new THREE.Color(0x337fbf) },
        midColor: { value: new THREE.Color(0x68bddc) },
        horizonColor: { value: new THREE.Color(0xeeb58f) },
      },
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vec4 world = modelMatrix * vec4(position, 1.0);
          vWorldPos = world.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor, midColor, horizonColor;
        varying vec3 vWorldPos;
        void main() {
          vec3 dir = normalize(vWorldPos);
          float h = dir.y;
          float skyBand = floor(clamp(h * 4.0, 0.0, 3.0)) / 3.0;
          vec3 col = mix(midColor, topColor, skyBand);
          col = mix(horizonColor, col, step(0.07, abs(h)));
          vec3 sunDir = normalize(vec3(0.55, 0.28, 0.35));
          float sunDisk = step(0.991, dot(dir, sunDir));
          float sunRing = step(0.986, dot(dir, sunDir)) - sunDisk;
          col = mix(col, vec3(1.0, 0.86, 0.28), sunDisk);
          col = mix(col, vec3(1.0, 0.55, 0.38), sunRing * 0.7);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
    })
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), skyMat))

    const cloudGeometry = new THREE.DodecahedronGeometry(1, 0)
    const cloudMat = new THREE.MeshBasicMaterial({ color: 0xe8f1e6 })
    const cloudShadeMat = new THREE.MeshBasicMaterial({ color: 0x82adbd })
    for (let i = 0; i < 15; i++) {
      const cloud = new THREE.Group()
      const baseAngle = Math.random() * Math.PI * 2
      const baseRadius = 170 + Math.random() * 300
      const baseY = 54 + Math.random() * 55
      for (let j = 0; j < 5; j++) {
        const scale = 11 + Math.random() * 15
        const x = (j - 2) * 11 + (Math.random() - 0.5) * 8
        const y = (Math.random() - 0.5) * 7
        const z = (Math.random() - 0.5) * 14
        const shade = new THREE.Mesh(cloudGeometry, cloudShadeMat)
        shade.position.set(x, y - 2.6, z + 0.8)
        shade.scale.set(scale * 1.35, scale * 0.42, scale)
        cloud.add(shade)
        const puff = new THREE.Mesh(cloudGeometry, cloudMat)
        puff.position.set(x, y, z)
        puff.scale.set(scale * 1.35, scale * 0.42, scale)
        cloud.add(puff)
      }
      cloud.position.set(Math.cos(baseAngle) * baseRadius, baseY, Math.sin(baseAngle) * baseRadius)
      scene.add(cloud)
    }
  }

  function createDistantHills(half) {
    const hillMat = matLib.hill
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2 + Math.random() * 0.2
      const radius = half + 40 + Math.random() * 50
      const hill = enableShadow(
        new THREE.Mesh(
          new THREE.ConeGeometry(28 + Math.random() * 30, 12 + Math.random() * 18, 7),
          hillMat
        ),
        false,
        true
      )
      hill.position.set(Math.cos(angle) * radius, 2, Math.sin(angle) * radius)
      hill.rotation.y = Math.random() * Math.PI
      scene.add(hill)
    }
  }

  function createCrater(x, z) {
    const radius = 2 + Math.random() * 1.8
    const crater = enableShadow(
      new THREE.Mesh(
        new THREE.CircleGeometry(radius, 20),
        matLib.crater
      ),
      false,
      true
    )
    crater.rotation.x = -Math.PI / 2
    crater.position.set(x, 0.04, z)
    scene.add(crater)

    const rim = enableShadow(
      new THREE.Mesh(
        new THREE.TorusGeometry(radius * 0.85, 0.28, 6, 16),
        matLib.dirt
      ),
      true,
      true
    )
    rim.rotation.x = -Math.PI / 2
    rim.position.set(x, 0.08, z)
    rim.scale.z = 0.45
    scene.add(rim)

    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2 + Math.random() * 0.3
      const dist = radius * 0.9 + Math.random() * 0.8
      const moundRadius = 0.35 + Math.random() * 0.35
      const mound = enableShadow(
        new THREE.Mesh(sharedGeometry.craterMound, matLib.dirt),
        false,
        true
      )
      mound.position.set(x + Math.cos(angle) * dist, 0.12, z + Math.sin(angle) * dist)
      mound.scale.set(moundRadius * 1.2, moundRadius * 0.45, moundRadius)
      scene.add(mound)
    }
    state.coverPoints.push({ x, z, r: radius + 0.5, type: 'crater' })
  }

  function createBuilding(x, z, rotation) {
    const group = new THREE.Group()
    group.position.set(x, 0, z)
    group.rotation.y = rotation
    const width = 6 + Math.random() * 3.5
    const depth = 5 + Math.random() * 3.2
    const height = 4.2 + Math.random() * 2.4
    const wallThickness = 0.32
    const ruined = Math.random() > 0.45
    const usePlaster = Math.random() > 0.4
    const wallMat = usePlaster ? matLib.plaster : matLib.brick
    const accentMat = usePlaster ? matLib.brick : matLib.concrete

    const floor = enableShadow(
      new THREE.Mesh(new THREE.BoxGeometry(width - 0.2, 0.18, depth - 0.2), matLib.concrete),
      false,
      true
    )
    floor.position.y = 0.09
    group.add(floor)

    const backWall = enableShadow(
      new THREE.Mesh(new THREE.BoxGeometry(width, height, wallThickness), wallMat),
      true,
      true
    )
    backWall.position.set(0, height / 2, -depth / 2)
    group.add(backWall)

    for (const side of [-1, 1]) {
      const wallH = ruined && Math.random() > 0.45 ? height * (0.55 + Math.random() * 0.35) : height
      const wall = enableShadow(
        new THREE.Mesh(new THREE.BoxGeometry(wallThickness, wallH, depth), wallMat),
        true,
        true
      )
      wall.position.set((side * width) / 2, wallH / 2, 0)
      group.add(wall)
    }

    // 残破前墙
    const lowerFront = enableShadow(
      new THREE.Mesh(new THREE.BoxGeometry(width, height * 0.38, wallThickness), wallMat),
      true,
      true
    )
    lowerFront.position.set(0, height * 0.19, depth / 2)
    group.add(lowerFront)
    for (const side of [-1, 1]) {
      const segmentH = height * (0.45 + Math.random() * 0.3)
      const segment = enableShadow(
        new THREE.Mesh(new THREE.BoxGeometry(width * 0.28, segmentH, wallThickness), wallMat),
        true,
        true
      )
      segment.position.set(side * width * 0.34, height * 0.38 + segmentH / 2, depth / 2)
      group.add(segment)
    }
    const upperFront = enableShadow(
      new THREE.Mesh(new THREE.BoxGeometry(width, height * 0.16, wallThickness), wallMat),
      true,
      true
    )
    upperFront.position.set(0, height * 0.9, depth / 2)
    group.add(upperFront)

    // 窗洞与玻璃残片
    for (let i = 0; i < 2; i++) {
      const wx = (i - 0.5) * width * 0.4
      const wy = height * (0.45 + Math.random() * 0.15)
      const frame = enableShadow(
        new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 0.12), matLib.wood),
        true,
        true
      )
      frame.position.set(wx, wy, -depth / 2 + wallThickness * 0.6)
      group.add(frame)
      if (Math.random() > 0.35) {
        const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.85), matLib.glass)
        glass.position.set(wx, wy, -depth / 2 + wallThickness * 0.9)
        group.add(glass)
      }
    }

    // 门洞
    const door = enableShadow(
      new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.1, 0.1), matLib.wood),
      true,
      true
    )
    door.position.set(width * 0.15, 1.05, depth / 2 - wallThickness * 0.2)
    door.rotation.y = 0.35 + Math.random() * 0.5
    group.add(door)

    // 墙基脚
    const plinth = enableShadow(
      new THREE.Mesh(new THREE.BoxGeometry(width + 0.2, 0.35, depth + 0.2), accentMat),
      true,
      true
    )
    plinth.position.y = 0.18
    group.add(plinth)

    if (Math.random() > 0.25) {
      if (Math.random() > 0.5) {
        const roof = enableShadow(
          new THREE.Mesh(new THREE.BoxGeometry(width + 0.5, 0.18, depth + 0.5), matLib.roof),
          true,
          true
        )
        roof.position.set(0, height + 0.12, 0)
        roof.rotation.z = (Math.random() - 0.5) * 0.08
        group.add(roof)
      } else {
        // 人字屋顶残骸
        for (const side of [-1, 1]) {
          const slope = enableShadow(
            new THREE.Mesh(
              new THREE.BoxGeometry(width + 0.4, 0.14, depth * 0.62),
              matLib.roof
            ),
            true,
            true
          )
          slope.position.set(0, height + 0.7, side * depth * 0.22)
          slope.rotation.x = side * 0.55
          group.add(slope)
        }
        const beam = enableShadow(
          new THREE.Mesh(new THREE.BoxGeometry(width * 0.9, 0.12, 0.12), matLib.wood),
          true,
          true
        )
        beam.position.set(0, height + 1.15, 0)
        group.add(beam)
      }
    } else {
      // 完全坍塌的梁柱
      for (let i = 0; i < 3; i++) {
        const beam = enableShadow(
          new THREE.Mesh(
            new THREE.BoxGeometry(0.18, 0.18, 1.5 + Math.random() * 2),
            matLib.wood
          ),
          true,
          true
        )
        beam.position.set((Math.random() - 0.5) * width * 0.5, 0.4 + Math.random() * 1.2, (Math.random() - 0.5) * depth * 0.4)
        beam.rotation.set(Math.random() * 0.5, Math.random() * Math.PI, Math.random() * 0.4)
        group.add(beam)
      }
    }

    // 碎石堆（限制在碰撞箱内）
    for (let i = 0; i < 5; i++) {
      const rubble = enableShadow(
        new THREE.Mesh(
          new THREE.BoxGeometry(0.4 + Math.random() * 0.5, 0.2 + Math.random() * 0.3, 0.3 + Math.random() * 0.4),
          Math.random() > 0.5 ? matLib.brick : matLib.concrete
        ),
        true,
        true
      )
      rubble.position.set(
        (Math.random() - 0.5) * (width - 0.8),
        0.15,
        (Math.random() - 0.5) * (depth - 0.6)
      )
      rubble.rotation.y = Math.random() * Math.PI
      group.add(rubble)
    }

    scene.add(group)
    const obstacle = pushModelObstacle({ type: 'building', model: group })
    matLib.addOutline(group, 1.018)
    state.coverPoints.push({ x, z, r: obstacle.r + 1, type: 'building' })
  }

  function createSandbags(x, z, rotation = 0) {
    const group = new THREE.Group()
    group.position.set(x, 0, z)
    group.rotation.y = rotation
    for (let row = 0; row < 3; row++) {
      for (let i = -2; i <= 2; i++) {
        const bag = enableShadow(
          new THREE.Mesh(sharedGeometry.sandbag, matLib.sandbag),
          true,
          true
        )
        bag.rotation.z = Math.PI / 2
        bag.rotation.y = (Math.random() - 0.5) * 0.15
        bag.position.set(i * 0.58 + (row % 2) * 0.12, 0.28 + row * 0.32, (row % 2) * 0.12)
        bag.scale.set(1, 0.85 + Math.random() * 0.15, 1.05)
        group.add(bag)
      }
    }
    // 支撑木板
    const plank = enableShadow(
      new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.08, 0.35), matLib.wood),
      true,
      true
    )
    plank.position.set(0, 0.95, -0.2)
    group.add(plank)

    scene.add(group)
    const obstacle = pushModelObstacle({ type: 'sandbag', model: group })
    state.coverPoints.push({ x, z, r: obstacle.r + 0.15, type: 'sandbag' })
  }

  function createCrate(x, z, rotation) {
    const group = new THREE.Group()
    group.position.set(x, 0, z)
    group.rotation.y = rotation
    const size = 0.75 + Math.random() * 0.45
    const crate = enableShadow(new THREE.Mesh(new THREE.BoxGeometry(size, size, size), matLib.wood), true, true)
    crate.position.y = size / 2
    group.add(crate)
    // 加固条
    for (const side of [-1, 1]) {
      const band = enableShadow(
        new THREE.Mesh(new THREE.BoxGeometry(size + 0.02, 0.05, 0.05), matLib.metalDark),
        true,
        true
      )
      band.position.set(0, size * (0.3 + side * 0.15), size / 2 + 0.01)
      group.add(band)
    }
    const topBand = enableShadow(
      new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, size + 0.02), matLib.metalDark),
      true,
      true
    )
    topBand.position.set(0, size + 0.01, 0)
    group.add(topBand)

    let lidOpen = false
    if (Math.random() > 0.7) {
      lidOpen = true
      const lid = enableShadow(
        new THREE.Mesh(new THREE.BoxGeometry(size * 0.95, 0.06, size * 0.95), matLib.wood),
        true,
        true
      )
      lid.position.set(size * 0.35, size * 0.7, 0)
      lid.rotation.z = -0.9
      group.add(lid)
    }

    scene.add(group)
    pushModelObstacle({ type: 'crate', model: group })
  }

  function createWreckTank(x, z, rotation) {
    const group = new THREE.Group()
    group.position.set(x, 0, z)
    group.rotation.y = rotation
    group.rotation.z = (Math.random() - 0.5) * 0.08
    group.rotation.x = (Math.random() - 0.5) * 0.05

    const hull = enableShadow(new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.1, 4.8), matLib.rust), true, true)
    hull.position.y = 0.95
    group.add(hull)

    const glacis = enableShadow(
      new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.7, 1.4), matLib.rust),
      true,
      true
    )
    glacis.position.set(0, 1.15, -2.0)
    glacis.rotation.x = -0.45
    group.add(glacis)

    const turret = enableShadow(
      new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.15, 0.75, 10), matLib.rust),
      true,
      true
    )
    turret.position.set(0.1, 1.75, -0.35)
    turret.rotation.y = 0.35
    group.add(turret)

    const turretTop = enableShadow(
      new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 0.25, 8), matLib.metalDark),
      true,
      true
    )
    turretTop.position.set(0.1, 2.2, -0.35)
    group.add(turretTop)

    const barrel = enableShadow(
      new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 2.4, 8), matLib.rust),
      true,
      true
    )
    barrel.rotation.x = Math.PI / 2
    barrel.position.set(0.1, 1.78, -2.1)
    group.add(barrel)

    const muzzle = enableShadow(
      new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.16, 0.25, 8), matLib.metalDark),
      true,
      true
    )
    muzzle.rotation.x = Math.PI / 2
    muzzle.position.set(0.1, 1.78, -3.25)
    group.add(muzzle)

    for (const side of [-1, 1]) {
      const track = enableShadow(
        new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 5.1), matLib.metalDark),
        true,
        true
      )
      track.position.set(side * 1.35, 0.4, 0)
      group.add(track)
      for (let i = -2; i <= 2; i++) {
        const wheel = enableShadow(
          new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.2, 10), matLib.metalDark),
          true,
          true
        )
        wheel.rotation.z = Math.PI / 2
        wheel.position.set(side * 1.55, 0.32, i * 1.0)
        group.add(wheel)
      }
      const skirt = enableShadow(
        new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.55, 4.6), matLib.rust),
        true,
        true
      )
      skirt.position.set(side * 1.65, 0.85, 0)
      group.add(skirt)
    }

    // 烧焦痕迹与烟道
    const scorch = enableShadow(
      new THREE.Mesh(
        new THREE.CircleGeometry(2.4, 12),
        matLib.scorch
      ),
      false,
      true
    )
    scorch.userData.noCollision = true
    scorch.rotation.x = -Math.PI / 2
    scorch.position.set(0, 0.02, 0)
    group.add(scorch)

    if (Math.random() > 0.4) {
      const hatch = enableShadow(
        new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.08, 8), matLib.metalDark),
        true,
        true
      )
      hatch.position.set(-0.3, 2.15, -0.1)
      hatch.rotation.x = 1.1
      group.add(hatch)
    }

    scene.add(group)
    const obstacle = pushModelObstacle({ type: 'tank', model: group })
    matLib.addOutline(group, 1.028)
    state.coverPoints.push({ x, z, r: obstacle.r, type: 'tank' })
  }

  function createBarbedWire(x, z, rotation) {
    const group = new THREE.Group()
    group.position.set(x, 0, z)
    group.rotation.y = rotation
    for (let i = -1.5; i <= 1.5; i += 1.5) {
      const post = enableShadow(
        new THREE.Mesh(sharedGeometry.wirePost, matLib.wood),
        false,
        true
      )
      post.position.set(i, 0.78, 0)
      post.rotation.z = (Math.random() - 0.5) * 0.08
      group.add(post)
    }
    for (let i = 0; i < 4; i++) {
      const wire = new THREE.Mesh(sharedGeometry.wire, matLib.metalDark)
      wire.rotation.z = Math.PI / 2
      wire.position.set(0, 0.4 + i * 0.32, (Math.random() - 0.5) * 0.05)
      wire.rotation.x = (Math.random() - 0.5) * 0.1
      group.add(wire)
    }
    // 铁丝卷
    for (let i = -1; i <= 1; i++) {
      const coil = new THREE.Mesh(sharedGeometry.coil, matLib.metalDark)
      coil.position.set(i * 1.1, 0.35, 0.15)
      coil.rotation.y = Math.PI / 2
      group.add(coil)
    }
    scene.add(group)
    pushModelObstacle({ type: 'wire', model: group })
  }

  function createTree(x, z) {
    const group = new THREE.Group()
    group.position.set(x, 0, z)
    const dead = Math.random() > 0.55
    const trunkH = dead ? 3.5 + Math.random() * 2.5 : 4.5 + Math.random() * 2
    const trunkRadius = 0.32 + Math.random() * 0.15
    const trunk = enableShadow(
      new THREE.Mesh(sharedGeometry.trunk, matLib.treeTrunk),
      false,
      true
    )
    trunk.scale.set(trunkRadius, trunkH, trunkRadius)
    trunk.position.y = trunkH / 2
    trunk.rotation.z = (Math.random() - 0.5) * 0.12
    trunk.rotation.x = (Math.random() - 0.5) * 0.08
    group.add(trunk)

    if (dead) {
      for (let i = 0; i < 3; i++) {
        const branchLength = 1.2 + Math.random()
        const branch = enableShadow(
          new THREE.Mesh(sharedGeometry.branch, matLib.treeBranch),
          false,
          true
        )
        branch.scale.set(0.08, branchLength, 0.08)
        branch.position.set(
          (Math.random() - 0.5) * 0.4,
          trunkH * (0.55 + Math.random() * 0.3),
          (Math.random() - 0.5) * 0.4
        )
        branch.rotation.z = (Math.random() - 0.5) * 1.4
        branch.rotation.x = (Math.random() - 0.5) * 1.2
        group.add(branch)
      }
    } else {
      for (let i = 0; i < 5; i++) {
        const foliage = enableShadow(
          new THREE.Mesh(sharedGeometry.foliage, matLib.treeFoliage),
          false,
          true
        )
        foliage.position.set(
          (Math.random() - 0.5) * 1.4,
          trunkH * 0.75 + Math.random() * 1.4,
          (Math.random() - 0.5) * 1.4
        )
        const foliageRadius = 1.2 + Math.random() * 0.7
        foliage.scale.set(
          foliageRadius * (1 + Math.random() * 0.3),
          foliageRadius * (0.75 + Math.random() * 0.3),
          foliageRadius * (1 + Math.random() * 0.3)
        )
        group.add(foliage)
      }
    }

    // 树根
    for (let i = 0; i < 3; i++) {
      const root = enableShadow(
        new THREE.Mesh(sharedGeometry.root, matLib.dirt),
        false,
        true
      )
      const a = (i / 3) * Math.PI * 2
      root.position.set(Math.cos(a) * 0.35, 0.05, Math.sin(a) * 0.35)
      root.rotation.y = a
      group.add(root)
    }

    scene.add(group)
    state.obstacles.push({
      type: 'tree',
      shape: 'circle',
      x,
      z,
      r: trunkRadius,
      minY: 0,
      maxY: trunkH,
    })
  }

  function createDebris(x, z) {
    if (Math.abs(x) < 10 && Math.abs(z) < 10) return
    const group = new THREE.Group()
    group.position.set(x, 0, z)
    const kind = Math.random()
    if (kind < 0.4) {
      const beam = enableShadow(
        new THREE.Mesh(
          new THREE.BoxGeometry(0.2, 0.2, 1.2 + Math.random() * 1.5),
          matLib.wood
        ),
        true,
        true
      )
      beam.position.y = 0.12
      beam.rotation.y = Math.random() * Math.PI
      beam.rotation.z = (Math.random() - 0.5) * 0.4
      group.add(beam)
    } else if (kind < 0.75) {
      for (let i = 0; i < 3; i++) {
        const rock = enableShadow(
          new THREE.Mesh(
            new THREE.DodecahedronGeometry(0.15 + Math.random() * 0.25, 0),
            matLib.concrete
          ),
          true,
          true
        )
        rock.position.set((Math.random() - 0.5) * 0.8, 0.12, (Math.random() - 0.5) * 0.8)
        rock.rotation.set(Math.random(), Math.random(), Math.random())
        group.add(rock)
      }
    } else {
      const drum = enableShadow(
        new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.7, 10), matLib.rust),
        true,
        true
      )
      drum.position.y = 0.35
      drum.rotation.z = (Math.random() - 0.5) * 1.2
      drum.rotation.x = (Math.random() - 0.5) * 0.5
      group.add(drum)
    }
    scene.add(group)
    pushModelObstacle({ type: 'debris', model: group })
  }

  function createSmokeColumns() {
    for (let i = 0; i < 12; i++) {
      const x = (Math.random() - 0.5) * config.mapSize * 0.9
      const z = (Math.random() - 0.5) * config.mapSize * 0.9
      if (Math.abs(x) < 35 && Math.abs(z) < 35) continue
      createSmokeColumn(x, z)
    }
  }

  function createSmokeColumn(x, z) {
    for (let i = 0; i < 7; i++) {
      const smokeColors = [0x555269, 0x68627a, 0x7d7488]
      const shade = smokeColors[Math.floor(Math.random() * smokeColors.length)]
      const puff = new THREE.Mesh(
        new THREE.SphereGeometry(1.8 + i * 0.55, 8, 6),
        new THREE.MeshBasicMaterial({
          color: shade,
          transparent: true,
          opacity: 0.42 - i * 0.035,
          depthWrite: false,
        })
      )
      puff.position.set(
        x + (Math.random() - 0.5) * 2.5,
        4 + i * 2.2,
        z + (Math.random() - 0.5) * 2.5
      )
      puff.scale.set(1.3 + Math.random() * 0.4, 0.7 + Math.random() * 0.3, 1.3 + Math.random() * 0.4)
      const baseY = puff.position.y
      const baseX = puff.position.x
      const timeOffset = Math.random() * 12
      const drift = 0.4 + Math.random() * 0.5
      scene.add(puff)
      state.particles.push({
        mesh: puff,
        type: 'smoke',
        life: Infinity,
        maxLife: Infinity,
        update: (dt, time) => {
          puff.position.y = baseY + Math.sin(time * 0.4 + timeOffset) * 0.45
          puff.position.x = baseX + Math.sin(time * 0.15 + timeOffset) * drift
          puff.rotation.y += dt * 0.08
        },
      })
    }
  }

  return { buildWorld }
}
