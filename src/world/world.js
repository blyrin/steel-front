import * as THREE from 'three'

export function createWorldSystem({ scene, matLib, state, config }) {
  function pushBoxObstacle({ mesh, type, x, z, w, d, h, rot }) {
    const cos = Math.cos(rot)
    const sin = Math.sin(rot)
    state.obstacles.push({
      mesh,
      type,
      shape: 'box',
      x,
      z,
      w,
      d,
      h,
      rot,
      cos,
      sin,
      hw: w * 0.5,
      hd: d * 0.5,
      r: Math.sqrt(w * w + d * d) * 0.5,
    })
  }

  function buildWorld() {
    const half = config.mapSize / 2
    const groundGeo = new THREE.PlaneGeometry(config.mapSize * 2, config.mapSize * 2, 96, 96)
    const positions = groundGeo.attributes.position
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i)
      const y = positions.getY(i)
      if (Math.abs(x) < half && Math.abs(y) < half) {
        positions.setZ(i, (Math.sin(x * 0.12) + Math.cos(y * 0.15)) * 0.25 + Math.random() * 0.12)
      }
    }
    groundGeo.computeVertexNormals()
    const ground = new THREE.Mesh(groundGeo, matLib.grass)
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    scene.add(ground)

    const roadMat = new THREE.MeshStandardMaterial({ color: 0x5a4a35, roughness: 1 })
    const roadNS = new THREE.Mesh(new THREE.PlaneGeometry(10, config.mapSize), roadMat)
    roadNS.rotation.x = -Math.PI / 2
    roadNS.position.y = 0.02
    roadNS.receiveShadow = true
    scene.add(roadNS)
    const roadEW = new THREE.Mesh(new THREE.PlaneGeometry(config.mapSize * 0.7, 8), roadMat)
    roadEW.rotation.x = -Math.PI / 2
    roadEW.position.y = 0.025
    roadEW.receiveShadow = true
    scene.add(roadEW)

    for (let i = 0; i < 28; i++) {
      const angle = Math.random() * Math.PI * 2
      const radius = 20 + Math.random() * (half - 30)
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
    sandbags.forEach(({ x, z }) => createSandbags(x, z))

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
    for (let i = 0; i < 80; i++) {
      const angle = Math.random() * Math.PI * 2
      const radius = half * 0.55 + Math.random() * half * 0.4
      createTree(Math.cos(angle) * radius, Math.sin(angle) * radius)
    }
    createSky()
    createSmokeColumns()
  }

  function createSky() {
    const skyMat = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: new THREE.Color(0x7a8fa8) },
        midColor: { value: new THREE.Color(0xb8a888) },
        botColor: { value: new THREE.Color(0x6e6048) },
      },
      vertexShader:
        'varying vec3 vWorldPos; void main(){ vWorldPos=(modelMatrix*vec4(position,1.0)).xyz; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader:
        'uniform vec3 topColor,midColor,botColor; varying vec3 vWorldPos; void main(){ float h=normalize(vWorldPos).y; vec3 col; if(h>0.0) col=mix(midColor,topColor,smoothstep(0.0,0.72,h)); else col=mix(midColor,botColor,smoothstep(0.0,-0.35,h)); gl_FragColor=vec4(col,1.0); }',
      side: THREE.BackSide,
      depthWrite: false,
    })
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(700, 24, 12), skyMat))
  }

  function createCrater(x, z) {
    const crater = new THREE.Mesh(
      new THREE.CircleGeometry(2 + Math.random() * 1.5, 16),
      new THREE.MeshStandardMaterial({ color: 0x2a1f15, roughness: 1 })
    )
    crater.rotation.x = -Math.PI / 2
    crater.position.set(x, 0.03, z)
    crater.receiveShadow = true
    scene.add(crater)
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2
      const radius = 2.5 + Math.random() * 0.5
      const mound = new THREE.Mesh(
        new THREE.SphereGeometry(0.4 + Math.random() * 0.3, 6, 4),
        matLib.dirt
      )
      mound.position.set(x + Math.cos(angle) * radius, 0.1, z + Math.sin(angle) * radius)
      mound.scale.y = 0.5
      mound.castShadow = true
      mound.receiveShadow = true
      scene.add(mound)
    }
    state.coverPoints.push({ x, z, r: 2.5, type: 'crater' })
  }

  function createBuilding(x, z, rotation) {
    const group = new THREE.Group()
    group.position.set(x, 0, z)
    group.rotation.y = rotation
    const width = 6 + Math.random() * 3
    const depth = 5 + Math.random() * 3
    const height = 4 + Math.random() * 2
    const wallThickness = 0.3
    const backWall = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, wallThickness),
      matLib.brick
    )
    backWall.position.set(0, height / 2, -depth / 2)
    backWall.castShadow = true
    backWall.receiveShadow = true
    group.add(backWall)
    for (const side of [-1, 1]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(wallThickness, height, depth), matLib.brick)
      wall.position.set((side * width) / 2, height / 2, 0)
      wall.castShadow = true
      wall.receiveShadow = true
      if (Math.random() > 0.5) {
        wall.scale.y = 0.6 + Math.random() * 0.3
        wall.position.y = (wall.scale.y * height) / 2
      }
      group.add(wall)
    }
    const lowerFront = new THREE.Mesh(
      new THREE.BoxGeometry(width, height * 0.4, wallThickness),
      matLib.brick
    )
    lowerFront.position.set(0, height * 0.2, depth / 2)
    lowerFront.castShadow = true
    lowerFront.receiveShadow = true
    group.add(lowerFront)
    for (const side of [-1, 1]) {
      const segment = new THREE.Mesh(
        new THREE.BoxGeometry(width * 0.3, height * 0.6, wallThickness),
        matLib.brick
      )
      segment.position.set(side * width * 0.35, height * 0.7, depth / 2)
      segment.castShadow = true
      group.add(segment)
    }
    const upperFront = new THREE.Mesh(
      new THREE.BoxGeometry(width, height * 0.2, wallThickness),
      matLib.brick
    )
    upperFront.position.set(0, height * 0.9, depth / 2)
    upperFront.castShadow = true
    group.add(upperFront)
    if (Math.random() > 0.3) {
      const roof = new THREE.Mesh(
        new THREE.BoxGeometry(width + 0.4, 0.2, depth + 0.4),
        new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.95 })
      )
      roof.position.set(0, height + 0.1, 0)
      roof.castShadow = true
      group.add(roof)
    }
    scene.add(group)
    pushBoxObstacle({
      mesh: group,
      type: 'building',
      x,
      z,
      w: width,
      d: depth,
      h: height + 0.3,
      rot: rotation,
    })
    const radius = Math.sqrt(width * width + depth * depth) / 2
    state.coverPoints.push({ x, z, r: radius + 1, type: 'building' })
  }

  function createSandbags(x, z) {
    const group = new THREE.Group()
    group.position.set(x, 0, z)
    for (let row = 0; row < 3; row++) {
      for (let i = -2; i <= 2; i++) {
        const bag = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), matLib.sandbag)
        bag.position.set(i * 0.6, 0.3 + row * 0.3, (row % 2) * 0.15)
        bag.scale.set(1.4, 0.7, 1)
        bag.castShadow = true
        bag.receiveShadow = true
        group.add(bag)
      }
    }
    scene.add(group)
    pushBoxObstacle({
      mesh: group,
      type: 'sandbag',
      x,
      z,
      w: 2.8,
      d: 0.9,
      h: 1.15,
      rot: 0,
    })
    state.coverPoints.push({ x, z, r: 1.5, type: 'sandbag' })
  }

  function createCrate(x, z, rotation) {
    const size = 0.8 + Math.random() * 0.4
    const crate = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), matLib.wood)
    crate.position.set(x, size / 2, z)
    crate.rotation.y = rotation
    crate.castShadow = true
    crate.receiveShadow = true
    scene.add(crate)
    pushBoxObstacle({
      mesh: crate,
      type: 'crate',
      x,
      z,
      w: size,
      d: size,
      h: size,
      rot: rotation,
    })
  }

  function createWreckTank(x, z, rotation) {
    const group = new THREE.Group()
    group.position.set(x, 0, z)
    group.rotation.y = rotation
    const body = new THREE.Mesh(new THREE.BoxGeometry(3, 1.2, 5), matLib.rust)
    body.position.y = 0.8
    body.castShadow = true
    body.receiveShadow = true
    group.add(body)
    const turret = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.1, 0.8, 8), matLib.rust)
    turret.position.set(0, 1.7, -0.5)
    turret.castShadow = true
    group.add(turret)
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 2, 8), matLib.rust)
    barrel.rotation.x = Math.PI / 2
    barrel.position.set(0, 1.7, -2)
    group.add(barrel)
    for (const side of [-1, 1]) {
      const track = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 5.2), matLib.metalDark)
      track.position.set(side * 1.4, 0.4, 0)
      track.castShadow = true
      group.add(track)
    }
    scene.add(group)
    pushBoxObstacle({
      mesh: group,
      type: 'tank',
      x,
      z,
      w: 3.4,
      d: 5.2,
      h: 2.2,
      rot: rotation,
    })
    state.coverPoints.push({ x, z, r: 3.1, type: 'tank' })
  }

  function createBarbedWire(x, z, rotation) {
    const group = new THREE.Group()
    group.position.set(x, 0, z)
    group.rotation.y = rotation
    for (let i = -1.5; i <= 1.5; i += 1.5) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.5, 6), matLib.wood)
      post.position.set(i, 0.75, 0)
      post.castShadow = true
      group.add(post)
    }
    for (let i = 0; i < 3; i++) {
      const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 3, 4), matLib.metalDark)
      wire.rotation.z = Math.PI / 2
      wire.position.set(0, 0.5 + i * 0.4, 0)
      group.add(wire)
    }
    scene.add(group)
    pushBoxObstacle({
      mesh: group,
      type: 'wire',
      x,
      z,
      w: 3.2,
      d: 0.3,
      h: 1.5,
      rot: rotation,
    })
  }

  function createTree(x, z) {
    const group = new THREE.Group()
    group.position.set(x, 0, z)
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.4, 5, 8),
      new THREE.MeshStandardMaterial({ color: 0x3a2515, roughness: 0.95 })
    )
    trunk.position.y = 2.5
    trunk.castShadow = true
    group.add(trunk)
    for (let i = 0; i < 4; i++) {
      const foliage = new THREE.Mesh(
        new THREE.IcosahedronGeometry(1.5 + Math.random() * 0.5, 0),
        new THREE.MeshStandardMaterial({
          color: 0x5a4a25 + Math.random() * 0x101010,
          roughness: 1,
          flatShading: true,
        })
      )
      foliage.position.set(
        (Math.random() - 0.5) * 1.5,
        5 + Math.random() * 1.5,
        (Math.random() - 0.5) * 1.5
      )
      foliage.castShadow = true
      group.add(foliage)
    }
    scene.add(group)
    state.obstacles.push({
      mesh: group,
      type: 'tree',
      shape: 'circle',
      x,
      z,
      r: 0.4,
      h: 5.2,
    })
  }

  function createSmokeColumns() {
    for (let i = 0; i < 10; i++) {
      const x = (Math.random() - 0.5) * config.mapSize * 0.9
      const z = (Math.random() - 0.5) * config.mapSize * 0.9
      if (Math.abs(x) < 40 && Math.abs(z) < 40) continue
      createSmokeColumn(x, z)
    }
  }

  function createSmokeColumn(x, z) {
    for (let i = 0; i < 6; i++) {
      const puff = new THREE.Mesh(
        new THREE.SphereGeometry(2 + i * 0.5, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0x2a2520, transparent: true, opacity: 0.3 - i * 0.04 })
      )
      puff.position.set(x + Math.random() * 2, 5 + i * 2, z + Math.random() * 2)
      const baseY = 5 + i * 2
      const timeOffset = Math.random() * 10
      scene.add(puff)
      state.particles.push({
        mesh: puff,
        type: 'smoke',
        life: Infinity,
        maxLife: Infinity,
        update: (dt, time) => {
          puff.position.y = baseY + Math.sin(time + timeOffset) * 0.3
          puff.rotation.y += dt * 0.1
        },
      })
    }
  }

  return { buildWorld }
}
