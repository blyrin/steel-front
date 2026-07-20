import * as THREE from 'three'

function createCanvasTexture(size, paint, options = {}) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  paint(ctx, size)
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.anisotropy = options.anisotropy ?? 4
  texture.colorSpace = THREE.SRGBColorSpace
  if (Array.isArray(options.repeat)) texture.repeat.set(...options.repeat)
  else if (options.repeat) texture.repeat.set(options.repeat, options.repeat)
  return texture
}

function createToonGradient() {
  const colors = new Uint8Array([
    62, 68, 86, 255,
    126, 134, 154, 255,
    204, 210, 220, 255,
    255, 255, 255, 255,
  ])
  const texture = new THREE.DataTexture(colors, 4, 1, THREE.RGBAFormat)
  texture.minFilter = THREE.NearestFilter
  texture.magFilter = THREE.NearestFilter
  texture.generateMipmaps = false
  texture.needsUpdate = true
  return texture
}

function paintGrass(ctx, size) {
  ctx.fillStyle = '#7fba62'
  ctx.fillRect(0, 0, size, size)
  ctx.lineCap = 'round'
  for (let i = 0; i < 260; i++) {
    const x = Math.random() * size
    const y = Math.random() * size
    ctx.strokeStyle = i % 3 === 0 ? '#4f8d57' : i % 3 === 1 ? '#a6d36d' : '#68a95d'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(x, y + 5)
    ctx.quadraticCurveTo(x + 3, y, x + (Math.random() - 0.5) * 8, y - 7)
    ctx.stroke()
  }
  for (let i = 0; i < 24; i++) {
    ctx.fillStyle = i % 2 ? '#f5d766' : '#f2f0d8'
    ctx.beginPath()
    ctx.arc(Math.random() * size, Math.random() * size, 1.8, 0, Math.PI * 2)
    ctx.fill()
  }
}

function paintDirt(ctx, size) {
  ctx.fillStyle = '#c97852'
  ctx.fillRect(0, 0, size, size)
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = i % 2 ? '#a95e49' : '#e39a66'
    ctx.beginPath()
    ctx.ellipse(
      Math.random() * size,
      Math.random() * size,
      2 + Math.random() * 6,
      1 + Math.random() * 3,
      Math.random() * Math.PI,
      0,
      Math.PI * 2
    )
    ctx.fill()
  }
}

function paintBrick(ctx, size) {
  ctx.fillStyle = '#f2c6a0'
  ctx.fillRect(0, 0, size, size)
  const brickWidth = 42
  const brickHeight = 22
  ctx.lineWidth = 4
  ctx.strokeStyle = '#613e4b'
  for (let row = 0, y = -2; y < size; row++, y += brickHeight) {
    const offset = row % 2 ? -brickWidth / 2 : 0
    for (let x = offset; x < size; x += brickWidth) {
      ctx.fillStyle = (row + Math.round(x / brickWidth)) % 3 === 0 ? '#d96f64' : '#e8846f'
      ctx.fillRect(x + 2, y + 2, brickWidth - 4, brickHeight - 4)
      ctx.strokeRect(x, y, brickWidth, brickHeight)
    }
  }
}

function paintWood(ctx, size) {
  ctx.fillStyle = '#d7924d'
  ctx.fillRect(0, 0, size, size)
  ctx.lineCap = 'round'
  for (let x = 8; x < size; x += 18) {
    ctx.strokeStyle = x % 36 ? '#8e4f45' : '#f1b95e'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(x, 0)
    for (let y = 0; y <= size; y += 24) ctx.lineTo(x + Math.sin(y * 0.08 + x) * 4, y)
    ctx.stroke()
  }
  for (let i = 0; i < 8; i++) {
    ctx.strokeStyle = '#774044'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.ellipse(Math.random() * size, Math.random() * size, 8, 3, 0, 0, Math.PI * 2)
    ctx.stroke()
  }
}

function paintMetal(ctx, size) {
  ctx.fillStyle = '#91a9ba'
  ctx.fillRect(0, 0, size, size)
  ctx.fillStyle = '#c7d9df'
  ctx.fillRect(0, 10, size, 18)
  ctx.fillStyle = '#60778d'
  ctx.fillRect(0, size - 26, size, 16)
  ctx.strokeStyle = '#31445b'
  ctx.lineWidth = 3
  for (let x = 12; x < size; x += 32) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x - 10, size)
    ctx.stroke()
  }
}

function paintSandbag(ctx, size) {
  ctx.fillStyle = '#e5c873'
  ctx.fillRect(0, 0, size, size)
  ctx.strokeStyle = '#8f6f51'
  ctx.lineWidth = 3
  for (let y = 10; y < size; y += 22) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(size, y + 5)
    ctx.stroke()
  }
  ctx.fillStyle = '#b99b5d'
  for (let i = 0; i < 35; i++) ctx.fillRect(Math.random() * size, Math.random() * size, 3, 3)
}

function paintRoof(ctx, size) {
  ctx.fillStyle = '#32566b'
  ctx.fillRect(0, 0, size, size)
  for (let y = 0; y < size; y += 18) {
    ctx.fillStyle = y % 36 ? '#3f7280' : '#29465e'
    ctx.fillRect(0, y, size, 14)
    ctx.fillStyle = '#87a9a6'
    ctx.fillRect(0, y, size, 3)
  }
}

function paintRoad(ctx, size) {
  ctx.fillStyle = '#9d8ea4'
  ctx.fillRect(0, 0, size, size)
  ctx.strokeStyle = '#746d88'
  ctx.lineWidth = 5
  for (let x = 20; x < size; x += 52) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.bezierCurveTo(x - 12, size * 0.3, x + 14, size * 0.7, x - 4, size)
    ctx.stroke()
  }
  ctx.fillStyle = '#c2b3b6'
  for (let i = 0; i < 45; i++) {
    ctx.beginPath()
    ctx.arc(Math.random() * size, Math.random() * size, 2 + Math.random() * 3, 0, Math.PI * 2)
    ctx.fill()
  }
}

function paintPlaster(ctx, size) {
  ctx.fillStyle = '#f4ddbd'
  ctx.fillRect(0, 0, size, size)
  ctx.fillStyle = '#e9a98b'
  for (let i = 0; i < 16; i++) {
    ctx.beginPath()
    ctx.arc(Math.random() * size, Math.random() * size, 5 + Math.random() * 12, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.strokeStyle = '#8d5a61'
  ctx.lineWidth = 3
  for (let i = 0; i < 8; i++) {
    const x = Math.random() * size
    const y = Math.random() * size
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + 8, y + 12)
    ctx.lineTo(x + 3, y + 22)
    ctx.stroke()
  }
}

function paintRust(ctx, size) {
  ctx.fillStyle = '#53666c'
  ctx.fillRect(0, 0, size, size)
  for (let i = 0; i < 55; i++) {
    ctx.fillStyle = i % 2 ? '#c25445' : '#e8814e'
    ctx.beginPath()
    ctx.arc(Math.random() * size, Math.random() * size, 4 + Math.random() * 13, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.strokeStyle = '#3d3c4f'
  ctx.lineWidth = 4
  for (let i = 0; i < 10; i++) {
    ctx.beginPath()
    ctx.moveTo(Math.random() * size, Math.random() * size)
    ctx.lineTo(Math.random() * size, Math.random() * size)
    ctx.stroke()
  }
}

function createMatLib(anisotropy) {
  const gradientMap = createToonGradient()
  const texture = (paint, repeat, size = 256) =>
    createCanvasTexture(size, paint, { anisotropy, repeat })
  const textures = {
    grass: texture(paintGrass, 16),
    dirt: texture(paintDirt, 9),
    brick: texture(paintBrick, 3),
    wood: texture(paintWood, 2),
    metal: texture(paintMetal, 2, 128),
    sandbag: texture(paintSandbag, 2, 128),
    roof: texture(paintRoof, 2, 128),
    road: texture(paintRoad, 8),
    plaster: texture(paintPlaster, 2, 128),
    rust: texture(paintRust, 3),
  }
  const toon = (color, map = null, options = {}) =>
    new THREE.MeshToonMaterial({ color, map, gradientMap, ...options })
  const outline = new THREE.MeshBasicMaterial({
    color: 0x20233a,
    side: THREE.BackSide,
    toneMapped: false,
  })

  function addOutline(root, scale = 1.035) {
    const meshes = []
    root.traverse(object => {
      if (!object.isMesh || !object.material?.isMeshToonMaterial) return
      if (!object.geometry.boundingSphere) object.geometry.computeBoundingSphere()
      if (object.geometry.boundingSphere.radius >= 0.075) meshes.push(object)
    })
    for (const mesh of meshes) {
      const ink = new THREE.Mesh(mesh.geometry, outline)
      ink.name = 'ink-outline'
      ink.scale.setScalar(scale)
      ink.castShadow = false
      ink.receiveShadow = false
      ink.raycast = () => {}
      mesh.add(ink)
    }
  }

  return {
    addOutline,
    outline,
    metal: toon(0xb9cbd4, textures.metal),
    metalDark: toon(0x34465d, textures.metal),
    blued: toon(0x273b55),
    brass: toon(0xe6ae35),
    blade: toon(0xdbecef),
    wood: toon(0xd99b4f, textures.wood),
    brick: toon(0xe48672, textures.brick),
    plaster: toon(0xe9c99f, textures.plaster),
    sandbag: toon(0xd6b552, textures.sandbag),
    dirt: toon(0xc87855, textures.dirt),
    grass: toon(0x72ad5a, textures.grass),
    road: toon(0x9e94aa, textures.road),
    roof: toon(0x347183, textures.roof),
    rust: toon(0xb95345, textures.rust),
    allyUniform: toon(0x2f8198),
    axisUniform: toon(0xa0445c),
    allyAccent: toon(0xffd447),
    axisAccent: toon(0xff7a67),
    skin: toon(0xeeb091),
    helmetAlly: toon(0x225d73),
    helmetAxis: toon(0x71364f),
    glass: toon(0x9ee9f2, null, {
      transparent: true,
      opacity: 0.42,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
    concrete: toon(0x8e91a1, textures.plaster),
    treeTrunk: toon(0x70444a),
    treeBranch: toon(0x4f3340),
    treeFoliage: toon(0x337d59, null, { flatShading: true }),
    hill: toon(0x477b63, null, { flatShading: true }),
    crater: toon(0x73495a),
    scorch: toon(0x343347),
  }
}

export function createSceneRuntime() {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x68b9dc)
  scene.fog = new THREE.Fog(0xaed9e2, 155, 470)

  const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.04, 1200)
  scene.add(camera)

  const touchDevice =
    window.matchMedia('(pointer: coarse)').matches ||
    (navigator.maxTouchPoints > 0 && window.matchMedia('(hover: none)').matches)
  const pixelRatio = () => Math.min(Math.max(devicePixelRatio, 1), touchDevice ? 2 : 1.25)
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
    stencil: false,
  })
  renderer.setSize(innerWidth, innerHeight)
  renderer.setPixelRatio(pixelRatio())
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap
  renderer.toneMapping = THREE.NoToneMapping
  renderer.outputColorSpace = THREE.SRGBColorSpace
  document.body.appendChild(renderer.domElement)

  const maxAniso = renderer.capabilities.getMaxAnisotropy()
  const matLib = createMatLib(Math.min(4, maxAniso))

  scene.add(new THREE.AmbientLight(0x7e8daf, 0.38))
  const hemi = new THREE.HemisphereLight(0xd7f0f4, 0x765a6d, 1.35)
  scene.add(hemi)

  const sun = new THREE.DirectionalLight(0xffe5a6, 2.55)
  sun.position.set(90, 95, 55)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.camera.left = -120
  sun.shadow.camera.right = 120
  sun.shadow.camera.top = 120
  sun.shadow.camera.bottom = -120
  sun.shadow.camera.near = 10
  sun.shadow.camera.far = 300
  sun.shadow.bias = -0.00018
  sun.shadow.normalBias = 0.035
  sun.shadow.radius = 1
  scene.add(sun)
  scene.add(sun.target)

  const fill = new THREE.DirectionalLight(0x68c7ed, 0.48)
  fill.position.set(-70, 45, -40)
  scene.add(fill)

  const rim = new THREE.DirectionalLight(0xff756f, 0.58)
  rim.position.set(-30, 12, 80)
  scene.add(rim)

  function resize() {
    camera.aspect = innerWidth / innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(innerWidth, innerHeight)
    renderer.setPixelRatio(pixelRatio())
  }

  return { scene, camera, renderer, sun, hemi, fill, rim, matLib, resize }
}
