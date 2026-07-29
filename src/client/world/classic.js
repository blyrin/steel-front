import * as THREE from 'three'

export function createClassicMap({ scene, matLib, particles, map }) {
  const sharedGeometry = {
    sandbag: new THREE.CapsuleGeometry(0.28, 0.35, 4, 8),
    sandbagPlank: new THREE.BoxGeometry(3.1, 0.08, 0.35),
    box: new THREE.BoxGeometry(1, 1, 1),
    root: new THREE.BoxGeometry(0.15, 0.12, 0.7),
    wirePost: new THREE.CylinderGeometry(0.07, 0.1, 1.55, 6),
    wire: new THREE.CylinderGeometry(0.015, 0.015, 3.2, 5),
    coil: new THREE.TorusGeometry(0.22, 0.025, 5, 12),
    craterMound: new THREE.SphereGeometry(1, 6, 4),
    dirtPatch: new THREE.CircleGeometry(1, 10),
    crater: new THREE.CircleGeometry(1, 20),
    craterRim: new THREE.TorusGeometry(0.85, 0.1, 6, 16),
    trunk: new THREE.CylinderGeometry(1, 1, 1, 7),
    branch: new THREE.CylinderGeometry(1, 1, 1, 5),
    foliage: new THREE.IcosahedronGeometry(1, 0),
    hill: new THREE.ConeGeometry(1, 1, 7),
  }
  const instanceTransform = new THREE.Object3D()

  function addInstanceTransform(
    matrices,
    x,
    y,
    z,
    rx,
    ry,
    rz,
    sx,
    sy,
    sz,
  ) {
    instanceTransform.position.set(x, y, z)
    instanceTransform.rotation.set(rx, ry, rz)
    instanceTransform.scale.set(sx, sy, sz)
    instanceTransform.updateMatrix()
    matrices.push(instanceTransform.matrix.clone())
  }

  function addNestedInstance(matrices, parentMatrix, ...transform) {
    addInstanceTransform(matrices, ...transform)
    matrices[matrices.length - 1].premultiply(parentMatrix)
  }

  function addInstances(geometry, material, matrices, receiveShadow = true) {
    if (!matrices.length) return
    const mesh = new THREE.InstancedMesh(geometry, material, matrices.length)
    matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix))
    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage)
    mesh.instanceMatrix.needsUpdate = true
    mesh.receiveShadow = receiveShadow
    mesh.computeBoundingSphere()
    scene.add(mesh)
  }

  function enableShadow(mesh, cast = true, receive = true) {
    mesh.castShadow = cast
    mesh.receiveShadow = receive
    return mesh
  }

  function buildMap() {
    const mapSize = map.size
    const half = mapSize / 2
    const groundGeo = new THREE.PlaneGeometry(
      mapSize * 2,
      mapSize * 2,
      map.terrainSegments,
      map.terrainSegments,
    )
    const positions = groundGeo.attributes.position
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i)
      const y = positions.getY(i)
      if (
        Math.abs(x) < half + map.terrainEdgeMargin &&
        Math.abs(y) < half + map.terrainEdgeMargin
      ) {
        const undulation =
          Math.sin(x * 0.045) * Math.cos(y * 0.038) * 0.55 +
          Math.sin(x * 0.11 + y * 0.07) * 0.22 +
          Math.cos(x * 0.19 - y * 0.13) * 0.12
        let roadDip = 0
        if (Math.abs(x) < 6 || Math.abs(y) < 5) {
          roadDip = -0.08
        } else if (Math.abs(x) < 12 || Math.abs(y) < 10) roadDip = -0.03
        positions.setZ(i, undulation + roadDip + (Math.random() - 0.5) * 0.08)
      } else {
        positions.setZ(i, -1.5 + Math.random() * 0.4)
      }
    }
    groundGeo.computeVertexNormals()
    const ground = enableShadow(new THREE.Mesh(groundGeo, matLib.grass), false, true)
    ground.rotation.x = -Math.PI / 2
    scene.add(ground)

    const dirtPatchInstances = []
    for (const patch of map.features.filter(item => item.type === 'dirt-patch')) {
      addInstanceTransform(
        dirtPatchInstances,
        patch.x,
        patch.y,
        patch.z,
        -Math.PI / 2,
        0,
        patch.rotation,
        patch.radius,
        patch.radius,
        1,
      )
    }
    addInstances(sharedGeometry.dirtPatch, matLib.dirt, dirtPatchInstances)

    const roadNS = enableShadow(
      new THREE.Mesh(new THREE.PlaneGeometry(11, mapSize), matLib.road),
      false,
      true,
    )
    roadNS.rotation.x = -Math.PI / 2
    roadNS.position.y = 0.03
    scene.add(roadNS)

    const roadEW = enableShadow(
      new THREE.Mesh(new THREE.PlaneGeometry(mapSize * 0.72, 9), matLib.road),
      false,
      true,
    )
    roadEW.rotation.x = -Math.PI / 2
    roadEW.position.y = 0.035
    scene.add(roadEW)

    // 路肩碎石
    for (const side of [-1, 1]) {
      const shoulder = enableShadow(
        new THREE.Mesh(new THREE.PlaneGeometry(2.2, mapSize * 0.95), matLib.dirt),
        false,
        true,
      )
      shoulder.rotation.x = -Math.PI / 2
      shoulder.position.set(side * 6.4, 0.025, 0)
      scene.add(shoulder)
    }

    const craterInstances = { discs: [], rims: [], mounds: [] }
    for (const crater of map.features.filter(item => item.type === 'crater')) {
      createCrater(crater, craterInstances)
    }
    addInstances(sharedGeometry.crater, matLib.crater, craterInstances.discs)
    addInstances(sharedGeometry.craterRim, matLib.dirt, craterInstances.rims)
    addInstances(sharedGeometry.craterMound, matLib.dirt, craterInstances.mounds)

    for (const building of map.features.filter(item => item.type === 'building')) {
      createBuilding(building)
    }

    const sandbagInstances = { bags: [], planks: [] }
    for (const sandbag of map.features.filter(item => item.type === 'sandbag')) {
      createSandbags(sandbag, sandbagInstances)
    }
    addInstances(sharedGeometry.sandbag, matLib.sandbag, sandbagInstances.bags)
    addInstances(sharedGeometry.sandbagPlank, matLib.wood, sandbagInstances.planks)

    const crateInstances = { wood: [], metal: [] }
    for (const crate of map.features.filter(item => item.type === 'crate')) {
      createCrate(crate, crateInstances)
    }
    addInstances(sharedGeometry.box, matLib.wood, crateInstances.wood)
    addInstances(sharedGeometry.box, matLib.metalDark, crateInstances.metal)

    for (const tank of map.features.filter(item => item.type === 'tank')) {
      createWreckTank(tank.x, tank.z, tank.rotation)
    }
    for (const wire of map.features.filter(item => item.type === 'wire')) {
      createBarbedWire(wire.x, wire.z, wire.rotation)
    }
    const treeInstances = { trunks: [], branches: [], foliage: [], roots: [] }
    for (const tree of map.features.filter(item => item.type === 'tree')) {
      createTree(tree, treeInstances)
    }
    addInstances(sharedGeometry.trunk, matLib.treeTrunk, treeInstances.trunks)
    addInstances(sharedGeometry.branch, matLib.treeBranch, treeInstances.branches)
    addInstances(sharedGeometry.foliage, matLib.treeFoliage, treeInstances.foliage)
    addInstances(sharedGeometry.root, matLib.dirt, treeInstances.roots)
    for (const debris of map.features.filter(item => item.type === 'debris')) {
      createDebris(debris)
    }
    for (const station of map.features.filter(item => item.type === 'ammo-station')) {
      createAmmoStation(station.x, station.z, station.rotation)
    }
    createSky()
    createDistantHills()
    createSmokeColumns()
  }

  function createAmmoStation(x, z, rotation) {
    const group = new THREE.Group()
    group.position.set(x, 0, z)
    group.rotation.y = rotation

    for (const side of [-1, 1]) {
      const crate = enableShadow(
        new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.72, 1.05), matLib.wood),
        true,
        true,
      )
      crate.position.set(side * 0.54, 0.36, 0)
      group.add(crate)
      const band = new THREE.Mesh(
        new THREE.BoxGeometry(1.08, 0.08, 1.08),
        matLib.metalDark,
      )
      band.position.set(side * 0.54, 0.48, 0)
      group.add(band)
    }

    const sign = new THREE.Group()
    sign.position.set(0, 1.65, 0)
    const diamond = new THREE.Mesh(
      new THREE.BoxGeometry(0.48, 0.48, 0.08),
      matLib.allyAccent,
    )
    diamond.rotation.z = Math.PI / 4
    diamond.userData.noCollision = true
    sign.add(diamond)
    for (const offset of [-0.11, 0, 0.11]) {
      const round = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.035, 0.28, 6),
        matLib.brass,
      )
      round.rotation.x = Math.PI / 2
      round.position.set(offset, 0, -0.08)
      round.userData.noCollision = true
      sign.add(round)
    }
    group.add(sign)
    scene.add(group)
    matLib.addOutline(group, 1.03)
  }

  function createSky() {
    const skyMat = new THREE.ShaderMaterial({
      uniforms: {
        ...THREE.UniformsLib.fog,
        topColor: { value: new THREE.Color(0x337fbf) },
        midColor: { value: new THREE.Color(0x68bddc) },
        horizonColor: { value: new THREE.Color(0xeeb58f) },
      },
      vertexShader: `
        varying vec3 vWorldPos;
        #include <fog_pars_vertex>
        void main() {
          vec4 world = modelMatrix * vec4(position, 1.0);
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vWorldPos = world.xyz;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }
      `,
      fragmentShader: `
        uniform vec3 topColor, midColor, horizonColor;
        varying vec3 vWorldPos;
        #include <fog_pars_fragment>
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
          #include <fog_fragment>
        }
      `,
      side: THREE.BackSide,
      fog: true,
      depthWrite: false,
    })
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(440, 24, 12), skyMat))

    const cloudGeometry = new THREE.DodecahedronGeometry(1, 0)
    const cloudMat = new THREE.MeshBasicMaterial({ color: 0xe8f1e6 })
    const cloudShadeMat = new THREE.MeshBasicMaterial({ color: 0x82adbd })
    const cloudInstances = []
    const cloudShadeInstances = []
    for (let i = 0; i < 15; i++) {
      const baseAngle = Math.random() * Math.PI * 2
      const baseRadius = 155 + Math.random() * 160
      const baseY = 54 + Math.random() * 55
      const baseX = Math.cos(baseAngle) * baseRadius
      const baseZ = Math.sin(baseAngle) * baseRadius
      for (let j = 0; j < 5; j++) {
        const scale = 11 + Math.random() * 15
        const x = (j - 2) * 11 + (Math.random() - 0.5) * 8
        const y = (Math.random() - 0.5) * 7
        const z = (Math.random() - 0.5) * 14
        addInstanceTransform(
          cloudShadeInstances,
          baseX + x,
          baseY + y - 2.6,
          baseZ + z + 0.8,
          0,
          0,
          0,
          scale * 1.35,
          scale * 0.42,
          scale,
        )
        addInstanceTransform(
          cloudInstances,
          baseX + x,
          baseY + y,
          baseZ + z,
          0,
          0,
          0,
          scale * 1.35,
          scale * 0.42,
          scale,
        )
      }
    }
    addInstances(cloudGeometry, cloudShadeMat, cloudShadeInstances, false)
    addInstances(cloudGeometry, cloudMat, cloudInstances, false)
  }

  function createDistantHills() {
    const hillMat = matLib.hill
    const matrices = []
    for (const hill of map.features.filter(item => item.type === 'hill')) {
      addInstanceTransform(
        matrices,
        hill.x,
        2,
        hill.z,
        0,
        hill.rotation,
        0,
        hill.width,
        hill.height,
        hill.width,
      )
    }
    addInstances(sharedGeometry.hill, hillMat, matrices)
  }

  function createCrater({ x, z, radius }, instances) {
    addInstanceTransform(
      instances.discs,
      x,
      0.04,
      z,
      -Math.PI / 2,
      0,
      0,
      radius,
      radius,
      1,
    )
    addInstanceTransform(
      instances.rims,
      x,
      0.08,
      z,
      -Math.PI / 2,
      0,
      0,
      radius,
      radius,
      0.45,
    )

    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2 + Math.random() * 0.3
      const dist = radius * 0.9 + Math.random() * 0.8
      const moundRadius = 0.35 + Math.random() * 0.35
      addInstanceTransform(
        instances.mounds,
        x + Math.cos(angle) * dist,
        0.12,
        z + Math.sin(angle) * dist,
        0,
        Math.random() * Math.PI,
        0,
        moundRadius * 1.2,
        moundRadius * 0.45,
        moundRadius,
      )
    }
  }

  function createBuilding({ x, z, rotation, width, depth, height, ruined, plaster }) {
    const group = new THREE.Group()
    group.position.set(x, 0, z)
    group.rotation.y = rotation
    const wallThickness = 0.32
    const wallMat = plaster ? matLib.plaster : matLib.brick
    const accentMat = plaster ? matLib.brick : matLib.concrete

    const floor = enableShadow(
      new THREE.Mesh(new THREE.BoxGeometry(width - 0.2, 0.18, depth - 0.2), matLib.concrete),
      false,
      true,
    )
    floor.position.y = 0.09
    group.add(floor)

    const backWall = enableShadow(
      new THREE.Mesh(new THREE.BoxGeometry(width, height, wallThickness), wallMat),
      true,
      true,
    )
    backWall.position.set(0, height / 2, -depth / 2)
    group.add(backWall)

    for (const side of [-1, 1]) {
      const wallH = ruined && Math.random() > 0.45 ? height * (0.55 + Math.random() * 0.35) : height
      const wall = enableShadow(
        new THREE.Mesh(new THREE.BoxGeometry(wallThickness, wallH, depth), wallMat),
        true,
        true,
      )
      wall.position.set((side * width) / 2, wallH / 2, 0)
      group.add(wall)
    }

    // 残破前墙
    const lowerFront = enableShadow(
      new THREE.Mesh(new THREE.BoxGeometry(width, height * 0.38, wallThickness), wallMat),
      true,
      true,
    )
    lowerFront.position.set(0, height * 0.19, depth / 2)
    group.add(lowerFront)
    for (const side of [-1, 1]) {
      const segmentH = height * (0.45 + Math.random() * 0.3)
      const segment = enableShadow(
        new THREE.Mesh(new THREE.BoxGeometry(width * 0.28, segmentH, wallThickness), wallMat),
        true,
        true,
      )
      segment.position.set(side * width * 0.34, height * 0.38 + segmentH / 2, depth / 2)
      group.add(segment)
    }
    const upperFront = enableShadow(
      new THREE.Mesh(new THREE.BoxGeometry(width, height * 0.16, wallThickness), wallMat),
      true,
      true,
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
        true,
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
      true,
    )
    door.position.set(width * 0.15, 1.05, depth / 2 - wallThickness * 0.2)
    door.rotation.y = 0.35 + Math.random() * 0.5
    group.add(door)

    // 墙基脚
    const plinth = enableShadow(
      new THREE.Mesh(new THREE.BoxGeometry(width + 0.2, 0.35, depth + 0.2), accentMat),
      true,
      true,
    )
    plinth.position.y = 0.18
    group.add(plinth)

    if (Math.random() > 0.25) {
      if (Math.random() > 0.5) {
        const roof = enableShadow(
          new THREE.Mesh(new THREE.BoxGeometry(width + 0.5, 0.18, depth + 0.5), matLib.roof),
          true,
          true,
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
              matLib.roof,
            ),
            true,
            true,
          )
          slope.position.set(0, height + 0.7, side * depth * 0.22)
          slope.rotation.x = side * 0.55
          group.add(slope)
        }
        const beam = enableShadow(
          new THREE.Mesh(new THREE.BoxGeometry(width * 0.9, 0.12, 0.12), matLib.wood),
          true,
          true,
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
            matLib.wood,
          ),
          true,
          true,
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
          Math.random() > 0.5 ? matLib.brick : matLib.concrete,
        ),
        true,
        true,
      )
      rubble.position.set(
        (Math.random() - 0.5) * (width - 0.8),
        0.15,
        (Math.random() - 0.5) * (depth - 0.6),
      )
      rubble.rotation.y = Math.random() * Math.PI
      group.add(rubble)
    }

    scene.add(group)
    matLib.addOutline(group, 1.018)
  }

  function createSandbags({ x, z, rotation }, instances) {
    const parentMatrix = new THREE.Matrix4().makeRotationY(rotation)
    parentMatrix.setPosition(x, 0, z)
    for (let row = 0; row < 3; row++) {
      for (let i = -2; i <= 2; i++) {
        addNestedInstance(
          instances.bags,
          parentMatrix,
          i * 0.58 + (row % 2) * 0.12,
          0.28 + row * 0.32,
          (row % 2) * 0.12,
          0,
          (Math.random() - 0.5) * 0.15,
          Math.PI / 2,
          1,
          0.85 + Math.random() * 0.15,
          1.05,
        )
      }
    }
    addNestedInstance(
      instances.planks,
      parentMatrix,
      0,
      0.95,
      -0.2,
      0,
      0,
      0,
      1,
      1,
      1,
    )
  }

  function createCrate({ x, z, rotation, size, open }, instances) {
    const parentMatrix = new THREE.Matrix4().makeRotationY(rotation)
    parentMatrix.setPosition(x, 0, z)
    addNestedInstance(
      instances.wood,
      parentMatrix,
      0,
      size / 2,
      0,
      0,
      0,
      0,
      size,
      size,
      size,
    )
    for (const side of [-1, 1]) {
      addNestedInstance(
        instances.metal,
        parentMatrix,
        0,
        size * (0.3 + side * 0.15),
        size / 2 + 0.01,
        0,
        0,
        0,
        size + 0.02,
        0.05,
        0.05,
      )
    }
    addNestedInstance(
      instances.metal,
      parentMatrix,
      0,
      size + 0.01,
      0,
      0,
      0,
      0,
      0.05,
      0.05,
      size + 0.02,
    )

    if (open) {
      addNestedInstance(
        instances.wood,
        parentMatrix,
        size * 0.35,
        size * 0.7,
        0,
        0,
        0,
        -0.9,
        size * 0.95,
        0.06,
        size * 0.95,
      )
    }

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
      true,
    )
    glacis.position.set(0, 1.15, -2.0)
    glacis.rotation.x = -0.45
    group.add(glacis)

    const turret = enableShadow(
      new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.15, 0.75, 10), matLib.rust),
      true,
      true,
    )
    turret.position.set(0.1, 1.75, -0.35)
    turret.rotation.y = 0.35
    group.add(turret)

    const turretTop = enableShadow(
      new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 0.25, 8), matLib.metalDark),
      true,
      true,
    )
    turretTop.position.set(0.1, 2.2, -0.35)
    group.add(turretTop)

    const barrel = enableShadow(
      new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 2.4, 8), matLib.rust),
      true,
      true,
    )
    barrel.rotation.x = Math.PI / 2
    barrel.position.set(0.1, 1.78, -2.1)
    group.add(barrel)

    const muzzle = enableShadow(
      new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.16, 0.25, 8), matLib.metalDark),
      true,
      true,
    )
    muzzle.rotation.x = Math.PI / 2
    muzzle.position.set(0.1, 1.78, -3.25)
    group.add(muzzle)

    for (const side of [-1, 1]) {
      const track = enableShadow(
        new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 5.1), matLib.metalDark),
        true,
        true,
      )
      track.position.set(side * 1.35, 0.4, 0)
      group.add(track)
      for (let i = -2; i <= 2; i++) {
        const wheel = enableShadow(
          new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.2, 10), matLib.metalDark),
          true,
          true,
        )
        wheel.rotation.z = Math.PI / 2
        wheel.position.set(side * 1.55, 0.32, i)
        group.add(wheel)
      }
      const skirt = enableShadow(
        new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.55, 4.6), matLib.rust),
        true,
        true,
      )
      skirt.position.set(side * 1.65, 0.85, 0)
      group.add(skirt)
    }

    // 烧焦痕迹与烟道
    const scorch = enableShadow(
      new THREE.Mesh(
        new THREE.CircleGeometry(2.4, 12),
        matLib.scorch,
      ),
      false,
      true,
    )
    scorch.userData.noCollision = true
    scorch.rotation.x = -Math.PI / 2
    scorch.position.set(0, 0.02, 0)
    group.add(scorch)

    if (Math.random() > 0.4) {
      const hatch = enableShadow(
        new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.08, 8), matLib.metalDark),
        true,
        true,
      )
      hatch.position.set(-0.3, 2.15, -0.1)
      hatch.rotation.x = 1.1
      group.add(hatch)
    }

    scene.add(group)
    matLib.addOutline(group, 1.028)
  }

  function createBarbedWire(x, z, rotation) {
    const group = new THREE.Group()
    group.position.set(x, 0, z)
    group.rotation.y = rotation
    for (let i = -1.5; i <= 1.5; i += 1.5) {
      const post = enableShadow(
        new THREE.Mesh(sharedGeometry.wirePost, matLib.wood),
        false,
        true,
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
  }

  function createTree({ x, z, dead, trunkHeight: trunkH, trunkRadius }, instances) {
    addInstanceTransform(
      instances.trunks,
      x,
      trunkH / 2,
      z,
      (Math.random() - 0.5) * 0.08,
      0,
      (Math.random() - 0.5) * 0.12,
      trunkRadius,
      trunkH,
      trunkRadius,
    )

    if (dead) {
      for (let i = 0; i < 3; i++) {
        const branchLength = 1.2 + Math.random()
        addInstanceTransform(
          instances.branches,
          x + (Math.random() - 0.5) * 0.4,
          trunkH * (0.55 + Math.random() * 0.3),
          z + (Math.random() - 0.5) * 0.4,
          (Math.random() - 0.5) * 1.2,
          0,
          (Math.random() - 0.5) * 1.4,
          0.08,
          branchLength,
          0.08,
        )
      }
    } else {
      for (let i = 0; i < 5; i++) {
        const foliageRadius = 1.2 + Math.random() * 0.7
        addInstanceTransform(
          instances.foliage,
          x + (Math.random() - 0.5) * 1.4,
          trunkH * 0.75 + Math.random() * 1.4,
          z + (Math.random() - 0.5) * 1.4,
          0,
          Math.random() * Math.PI,
          0,
          foliageRadius * (1 + Math.random() * 0.3),
          foliageRadius * (0.75 + Math.random() * 0.3),
          foliageRadius * (1 + Math.random() * 0.3),
        )
      }
    }

    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2
      addInstanceTransform(
        instances.roots,
        x + Math.cos(a) * 0.35,
        0.05,
        z + Math.sin(a) * 0.35,
        0,
        a,
        0,
        1,
        1,
        1,
      )
    }

  }

  function createDebris({ x, z, kind }) {
    const group = new THREE.Group()
    group.position.set(x, 0, z)
    if (kind === 0) {
      const beam = enableShadow(
        new THREE.Mesh(
          new THREE.BoxGeometry(0.2, 0.2, 1.2 + Math.random() * 1.5),
          matLib.wood,
        ),
        true,
        true,
      )
      beam.position.y = 0.12
      beam.rotation.y = Math.random() * Math.PI
      beam.rotation.z = (Math.random() - 0.5) * 0.4
      group.add(beam)
    } else if (kind === 1) {
      for (let i = 0; i < 3; i++) {
        const rock = enableShadow(
          new THREE.Mesh(
            new THREE.DodecahedronGeometry(0.15 + Math.random() * 0.25, 0),
            matLib.concrete,
          ),
          true,
          true,
        )
        rock.position.set((Math.random() - 0.5) * 0.8, 0.12, (Math.random() - 0.5) * 0.8)
        rock.rotation.set(Math.random(), Math.random(), Math.random())
        group.add(rock)
      }
    } else {
      const drum = enableShadow(
        new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.7, 10), matLib.rust),
        true,
        true,
      )
      drum.position.y = 0.35
      drum.rotation.z = (Math.random() - 0.5) * 1.2
      drum.rotation.x = (Math.random() - 0.5) * 0.5
      group.add(drum)
    }
    scene.add(group)
  }

  function createSmokeColumns() {
    for (const smoke of map.features.filter(item => item.type === 'smoke-column')) {
      createSmokeColumn(smoke.x, smoke.z)
    }
  }

  function createSmokeColumn(x, z) {
    const smokeColors = [0x555269, 0x68627a, 0x7d7488]
    for (let i = 0; i < map.smokePuffsPerColumn; i++) {
      const shade = smokeColors[Math.floor(Math.random() * smokeColors.length)]
      const puff = new THREE.Mesh(
        new THREE.SphereGeometry(1.8 + i * 0.55, 8, 6),
        new THREE.MeshBasicMaterial({
          color: shade,
          transparent: true,
          opacity: 0.42 - i * 0.035,
          depthWrite: false,
        }),
      )
      puff.position.set(
        x + (Math.random() - 0.5) * 2.5,
        4 + i * 2.2,
        z + (Math.random() - 0.5) * 2.5,
      )
      puff.scale.set(1.3 + Math.random() * 0.4, 0.7 + Math.random() * 0.3, 1.3 + Math.random() * 0.4)
      const baseY = puff.position.y
      const baseX = puff.position.x
      const timeOffset = Math.random() * 12
      const drift = 0.4 + Math.random() * 0.5
      scene.add(puff)
      particles.push({
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

  return { buildMap }
}
