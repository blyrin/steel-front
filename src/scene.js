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
  texture.colorSpace = options.colorSpace ?? THREE.SRGBColorSpace
  if (options.repeat) texture.repeat.set(options.repeat, options.repeat)
  return texture
}

function noise(ctx, size, alpha = 0.12) {
  const image = ctx.getImageData(0, 0, size, size)
  const data = image.data
  for (let i = 0; i < data.length; i += 4) {
    const n = (Math.random() - 0.5) * 255 * alpha
    data[i] = Math.min(255, Math.max(0, data[i] + n))
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + n))
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + n))
  }
  ctx.putImageData(image, 0, 0)
}

function createMatLib(anisotropy) {
  const grassMap = createCanvasTexture(
    256,
    (ctx, size) => {
      ctx.fillStyle = '#4a5a32'
      ctx.fillRect(0, 0, size, size)
      for (let i = 0; i < 2200; i++) {
        const x = Math.random() * size
        const y = Math.random() * size
        const h = 4 + Math.random() * 10
        const shade = 55 + Math.floor(Math.random() * 50)
        ctx.strokeStyle = `rgb(${shade * 0.55},${shade},${shade * 0.35})`
        ctx.lineWidth = 1 + Math.random()
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.lineTo(x + (Math.random() - 0.5) * 3, y - h)
        ctx.stroke()
      }
      for (let i = 0; i < 180; i++) {
        ctx.fillStyle = `rgba(${70 + Math.random() * 40},${55 + Math.random() * 30},${30 + Math.random() * 20},0.55)`
        ctx.beginPath()
        ctx.ellipse(
          Math.random() * size,
          Math.random() * size,
          6 + Math.random() * 16,
          4 + Math.random() * 10,
          Math.random() * Math.PI,
          0,
          Math.PI * 2
        )
        ctx.fill()
      }
      noise(ctx, size, 0.1)
    },
    { anisotropy, repeat: 18 }
  )

  const dirtMap = createCanvasTexture(
    256,
    (ctx, size) => {
      const g = ctx.createLinearGradient(0, 0, size, size)
      g.addColorStop(0, '#5a4228')
      g.addColorStop(0.5, '#4a3620')
      g.addColorStop(1, '#3a2a18')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, size, size)
      for (let i = 0; i < 900; i++) {
        ctx.fillStyle = `rgba(${40 + Math.random() * 50},${28 + Math.random() * 30},${14 + Math.random() * 18},${0.15 + Math.random() * 0.35})`
        ctx.beginPath()
        ctx.arc(Math.random() * size, Math.random() * size, 1 + Math.random() * 5, 0, Math.PI * 2)
        ctx.fill()
      }
      noise(ctx, size, 0.16)
    },
    { anisotropy, repeat: 10 }
  )

  const brickMap = createCanvasTexture(
    256,
    (ctx, size) => {
      ctx.fillStyle = '#4a3a30'
      ctx.fillRect(0, 0, size, size)
      const bw = 28
      const bh = 14
      for (let y = 0, row = 0; y < size; y += bh + 2, row++) {
        const offset = row % 2 ? bw * 0.5 : 0
        for (let x = -bw; x < size; x += bw + 2) {
          const r = 95 + Math.floor(Math.random() * 45)
          const g = 62 + Math.floor(Math.random() * 28)
          const b = 48 + Math.floor(Math.random() * 22)
          ctx.fillStyle = `rgb(${r},${g},${b})`
          ctx.fillRect(x + offset, y, bw, bh)
          if (Math.random() > 0.82) {
            ctx.fillStyle = `rgba(30,20,15,${0.2 + Math.random() * 0.35})`
            ctx.fillRect(x + offset, y, bw, bh)
          }
        }
      }
      noise(ctx, size, 0.08)
    },
    { anisotropy, repeat: 3 }
  )

  const woodMap = createCanvasTexture(
    256,
    (ctx, size) => {
      ctx.fillStyle = '#5c3a1c'
      ctx.fillRect(0, 0, size, size)
      for (let x = 0; x < size; x += 3) {
        const shade = 70 + Math.floor(Math.sin(x * 0.08) * 18 + Math.random() * 22)
        ctx.fillStyle = `rgb(${shade},${shade * 0.62},${shade * 0.32})`
        ctx.fillRect(x, 0, 2 + Math.random() * 2, size)
      }
      for (let i = 0; i < 40; i++) {
        ctx.strokeStyle = `rgba(30,18,8,${0.15 + Math.random() * 0.25})`
        ctx.lineWidth = 1
        ctx.beginPath()
        const y = Math.random() * size
        ctx.moveTo(0, y)
        for (let x = 0; x < size; x += 16) {
          ctx.lineTo(x, y + Math.sin(x * 0.05 + i) * 3)
        }
        ctx.stroke()
      }
      noise(ctx, size, 0.08)
    },
    { anisotropy, repeat: 2 }
  )

  const metalMap = createCanvasTexture(
    128,
    (ctx, size) => {
      ctx.fillStyle = '#4a4c4e'
      ctx.fillRect(0, 0, size, size)
      for (let i = 0; i < 60; i++) {
        ctx.strokeStyle = `rgba(255,255,255,${0.03 + Math.random() * 0.06})`
        ctx.beginPath()
        ctx.moveTo(0, Math.random() * size)
        ctx.lineTo(size, Math.random() * size)
        ctx.stroke()
      }
      for (let i = 0; i < 80; i++) {
        ctx.fillStyle = `rgba(0,0,0,${0.05 + Math.random() * 0.12})`
        ctx.fillRect(Math.random() * size, Math.random() * size, 2 + Math.random() * 8, 1)
      }
      noise(ctx, size, 0.12)
    },
    { anisotropy, repeat: 2 }
  )

  const rustMap = createCanvasTexture(
    256,
    (ctx, size) => {
      ctx.fillStyle = '#3a342c'
      ctx.fillRect(0, 0, size, size)
      for (let i = 0; i < 500; i++) {
        const r = 90 + Math.random() * 70
        const g = 40 + Math.random() * 35
        const b = 20 + Math.random() * 20
        ctx.fillStyle = `rgba(${r},${g},${b},${0.2 + Math.random() * 0.5})`
        ctx.beginPath()
        ctx.arc(Math.random() * size, Math.random() * size, 2 + Math.random() * 14, 0, Math.PI * 2)
        ctx.fill()
      }
      for (let i = 0; i < 40; i++) {
        ctx.strokeStyle = 'rgba(20,16,12,0.35)'
        ctx.lineWidth = 1 + Math.random() * 2
        ctx.beginPath()
        ctx.moveTo(Math.random() * size, Math.random() * size)
        ctx.lineTo(Math.random() * size, Math.random() * size)
        ctx.stroke()
      }
      noise(ctx, size, 0.14)
    },
    { anisotropy, repeat: 3 }
  )

  const sandbagMap = createCanvasTexture(
    128,
    (ctx, size) => {
      ctx.fillStyle = '#7a6840'
      ctx.fillRect(0, 0, size, size)
      for (let i = 0; i < 300; i++) {
        ctx.fillStyle = `rgba(${90 + Math.random() * 40},${75 + Math.random() * 30},${40 + Math.random() * 20},0.35)`
        ctx.fillRect(Math.random() * size, Math.random() * size, 1 + Math.random() * 3, 1 + Math.random() * 3)
      }
      for (let y = 8; y < size; y += 18) {
        ctx.strokeStyle = 'rgba(50,40,22,0.35)'
        ctx.beginPath()
        ctx.moveTo(0, y + Math.sin(y) * 2)
        ctx.lineTo(size, y + Math.cos(y) * 2)
        ctx.stroke()
      }
      noise(ctx, size, 0.1)
    },
    { anisotropy, repeat: 2 }
  )

  const roofMap = createCanvasTexture(
    128,
    (ctx, size) => {
      ctx.fillStyle = '#2e2418'
      ctx.fillRect(0, 0, size, size)
      for (let y = 0; y < size; y += 8) {
        ctx.fillStyle = y % 16 === 0 ? '#3a2e20' : '#282018'
        ctx.fillRect(0, y, size, 6)
        ctx.strokeStyle = 'rgba(15,10,6,0.45)'
        ctx.beginPath()
        ctx.moveTo(0, y + 6)
        ctx.lineTo(size, y + 6)
        ctx.stroke()
      }
      noise(ctx, size, 0.1)
    },
    { anisotropy, repeat: 2 }
  )

  const roadMap = createCanvasTexture(
    256,
    (ctx, size) => {
      ctx.fillStyle = '#5a4a34'
      ctx.fillRect(0, 0, size, size)
      for (let i = 0; i < 700; i++) {
        ctx.fillStyle = `rgba(${50 + Math.random() * 40},${40 + Math.random() * 30},${25 + Math.random() * 15},${0.15 + Math.random() * 0.3})`
        ctx.beginPath()
        ctx.arc(Math.random() * size, Math.random() * size, 1 + Math.random() * 4, 0, Math.PI * 2)
        ctx.fill()
      }
      for (let i = 0; i < 20; i++) {
        ctx.strokeStyle = 'rgba(30,24,16,0.25)'
        ctx.lineWidth = 2 + Math.random() * 4
        ctx.beginPath()
        ctx.moveTo(Math.random() * size, 0)
        ctx.quadraticCurveTo(Math.random() * size, size * 0.5, Math.random() * size, size)
        ctx.stroke()
      }
      noise(ctx, size, 0.12)
    },
    { anisotropy, repeat: 8 }
  )

  const plasterMap = createCanvasTexture(
    128,
    (ctx, size) => {
      ctx.fillStyle = '#8a7a62'
      ctx.fillRect(0, 0, size, size)
      for (let i = 0; i < 200; i++) {
        ctx.fillStyle = `rgba(${100 + Math.random() * 40},${90 + Math.random() * 30},${70 + Math.random() * 20},0.25)`
        ctx.beginPath()
        ctx.arc(Math.random() * size, Math.random() * size, 2 + Math.random() * 10, 0, Math.PI * 2)
        ctx.fill()
      }
      for (let i = 0; i < 25; i++) {
        ctx.strokeStyle = 'rgba(40,30,20,0.28)'
        ctx.beginPath()
        const x = Math.random() * size
        const y = Math.random() * size
        ctx.moveTo(x, y)
        ctx.lineTo(x + (Math.random() - 0.5) * 40, y + 10 + Math.random() * 30)
        ctx.stroke()
      }
      noise(ctx, size, 0.1)
    },
    { anisotropy, repeat: 2 }
  )

  return {
    metal: new THREE.MeshStandardMaterial({
      color: 0x8a8e92,
      map: metalMap,
      roughness: 0.42,
      metalness: 0.86,
    }),
    metalDark: new THREE.MeshStandardMaterial({
      color: 0x3a3c40,
      map: metalMap,
      roughness: 0.55,
      metalness: 0.78,
    }),
    wood: new THREE.MeshStandardMaterial({
      color: 0xc4a06a,
      map: woodMap,
      roughness: 0.86,
      metalness: 0.02,
    }),
    brick: new THREE.MeshStandardMaterial({
      color: 0xc8b0a0,
      map: brickMap,
      roughness: 0.94,
      metalness: 0.02,
    }),
    plaster: new THREE.MeshStandardMaterial({
      color: 0xd8c8a8,
      map: plasterMap,
      roughness: 0.96,
      metalness: 0,
    }),
    sandbag: new THREE.MeshStandardMaterial({
      color: 0xc8b888,
      map: sandbagMap,
      roughness: 0.98,
      metalness: 0,
    }),
    dirt: new THREE.MeshStandardMaterial({
      color: 0xb89870,
      map: dirtMap,
      roughness: 1,
      metalness: 0,
    }),
    grass: new THREE.MeshStandardMaterial({
      color: 0x8c9a6c,
      map: grassMap,
      roughness: 0.97,
      metalness: 0,
    }),
    road: new THREE.MeshStandardMaterial({
      color: 0xb0a080,
      map: roadMap,
      roughness: 0.98,
      metalness: 0,
    }),
    roof: new THREE.MeshStandardMaterial({
      color: 0x9a8870,
      map: roofMap,
      roughness: 0.92,
      metalness: 0.05,
    }),
    rust: new THREE.MeshStandardMaterial({
      color: 0xb88860,
      map: rustMap,
      roughness: 0.82,
      metalness: 0.48,
    }),
    allyUniform: new THREE.MeshStandardMaterial({
      color: 0x4a6e3a,
      roughness: 0.9,
      metalness: 0.04,
    }),
    axisUniform: new THREE.MeshStandardMaterial({
      color: 0x5e5c52,
      roughness: 0.9,
      metalness: 0.05,
    }),
    allyAccent: new THREE.MeshStandardMaterial({
      color: 0x2f5080,
      roughness: 0.72,
      metalness: 0.12,
    }),
    axisAccent: new THREE.MeshStandardMaterial({
      color: 0x7a1e1e,
      roughness: 0.76,
      metalness: 0.1,
    }),
    skin: new THREE.MeshStandardMaterial({ color: 0xc8a888, roughness: 0.72, metalness: 0.02 }),
    helmetAlly: new THREE.MeshStandardMaterial({
      color: 0x3a5a2e,
      roughness: 0.52,
      metalness: 0.42,
    }),
    helmetAxis: new THREE.MeshStandardMaterial({
      color: 0x32342c,
      roughness: 0.48,
      metalness: 0.5,
    }),
    glass: new THREE.MeshStandardMaterial({
      color: 0x88a0a8,
      roughness: 0.12,
      metalness: 0.2,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
    }),
    concrete: new THREE.MeshStandardMaterial({
      color: 0x7a7468,
      map: plasterMap,
      roughness: 0.95,
      metalness: 0.02,
    }),
    treeTrunk: new THREE.MeshStandardMaterial({
      color: 0x3a2818,
      roughness: 0.95,
      metalness: 0,
    }),
    treeBranch: new THREE.MeshStandardMaterial({
      color: 0x2e2014,
      roughness: 0.95,
      metalness: 0,
    }),
    treeFoliage: new THREE.MeshStandardMaterial({
      color: 0x596044,
      roughness: 1,
      flatShading: true,
    }),
  }
}

export function createSceneRuntime() {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x9eb2c0)
  scene.fog = new THREE.FogExp2(0xc0c7c2, 0.0018)

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
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.08
  renderer.outputColorSpace = THREE.SRGBColorSpace
  document.body.appendChild(renderer.domElement)

  const maxAniso = renderer.capabilities.getMaxAnisotropy()
  const matLib = createMatLib(Math.min(2, maxAniso))

  scene.add(new THREE.AmbientLight(0x8a9088, 1.0))
  const hemi = new THREE.HemisphereLight(0xd8e4f0, 0x6a5840, 1.0)
  scene.add(hemi)

  const sun = new THREE.DirectionalLight(0xffe2b8, 3)
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
  sun.shadow.normalBias = 0.028
  sun.shadow.radius = 1
  scene.add(sun)
  scene.add(sun.target)

  const fill = new THREE.DirectionalLight(0xb0c8dc, 0.55)
  fill.position.set(-70, 45, -40)
  scene.add(fill)

  const rim = new THREE.DirectionalLight(0xffc090, 0.32)
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
