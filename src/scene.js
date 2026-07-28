import * as THREE from 'three'

function createCanvasTexture(size, paint, options = {}) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = false
  paint(ctx, size)
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestMipmapLinearFilter
  texture.anisotropy = options.anisotropy ?? 4
  texture.colorSpace = THREE.SRGBColorSpace
  if (Array.isArray(options.repeat)) texture.repeat.set(...options.repeat)
  else if (options.repeat) texture.repeat.set(options.repeat, options.repeat)
  return texture
}

function createPixelRng(seed) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function scatterPixels(ctx, size, seed, colors, count, maxSize = 2) {
  const random = createPixelRng(seed)
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = colors[i % colors.length]
    const width = 1 + Math.floor(random() * maxSize)
    const height = 1 + Math.floor(random() * maxSize)
    ctx.fillRect(Math.floor(random() * size), Math.floor(random() * size), width, height)
  }
}

function paintGrass(ctx, size) {
  ctx.fillStyle = '#72875b'
  ctx.fillRect(0, 0, size, size)
  scatterPixels(ctx, size, 11, ['#536c49', '#91a96b', '#677c50'], 84)
  const random = createPixelRng(12)
  for (let i = 0; i < 16; i++) {
    const x = Math.floor(random() * size)
    const y = Math.floor(random() * size)
    ctx.fillStyle = '#465e40'
    ctx.fillRect(x, y, 1, 3)
    ctx.fillStyle = '#a7bb74'
    ctx.fillRect(x + 1, y, 1, 2)
  }
  scatterPixels(ctx, size, 13, ['#d4bd68', '#d8d6aa'], 7, 1)
}

function paintDirt(ctx, size) {
  ctx.fillStyle = '#8c674f'
  ctx.fillRect(0, 0, size, size)
  scatterPixels(ctx, size, 21, ['#6c5042', '#a97c5a', '#795746'], 70)
  scatterPixels(ctx, size, 22, ['#bea078', '#59463b'], 14, 1)
}

function paintBrick(ctx, size) {
  ctx.fillStyle = '#67564b'
  ctx.fillRect(0, 0, size, size)
  const colors = ['#9b6253', '#ad705c', '#8d574d']
  for (let row = 0; row < 8; row++) {
    const y = row * 4
    const offset = row % 2 ? -4 : 0
    for (let x = offset; x < size; x += 8) {
      ctx.fillStyle = colors[(row + Math.floor(x / 8) + 3) % colors.length]
      ctx.fillRect(x + 1, y + 1, 7, 2)
      ctx.fillStyle = '#c18469'
      ctx.fillRect(x + 1, y + 1, 6, 1)
    }
  }
}

function paintWood(ctx, size) {
  ctx.fillStyle = '#8f6847'
  ctx.fillRect(0, 0, size, size)
  for (let x = 0; x < size; x += 8) {
    ctx.fillStyle = '#604936'
    ctx.fillRect(x, 0, 1, size)
    ctx.fillStyle = '#b18357'
    ctx.fillRect(x + 1, 0, 1, size)
  }
  scatterPixels(ctx, size, 31, ['#6f5039', '#c09362'], 42)
  ctx.fillStyle = '#4f3d31'
  for (const [x, y] of [[5, 7], [19, 13], [12, 25], [27, 4]]) ctx.fillRect(x, y, 3, 1)
}

function paintMetal(ctx, size) {
  ctx.fillStyle = '#829096'
  ctx.fillRect(0, 0, size, size)
  for (let x = 0; x < size; x += 8) {
    ctx.fillStyle = '#aab5b7'
    ctx.fillRect(x, 0, 1, size)
    ctx.fillStyle = '#5b696e'
    ctx.fillRect(x + 7, 0, 1, size)
  }
  ctx.fillStyle = '#4b565a'
  ctx.fillRect(0, 15, size, 1)
  ctx.fillStyle = '#c1c8c6'
  for (let y = 3; y < size; y += 8) {
    for (let x = 3; x < size; x += 8) ctx.fillRect(x, y, 1, 1)
  }
  scatterPixels(ctx, size, 41, ['#68777a', '#a0694d'], 22, 1)
}

function paintSandbag(ctx, size) {
  ctx.fillStyle = '#aa9b70'
  ctx.fillRect(0, 0, size, size)
  for (let y = 0; y < size; y += 4) {
    ctx.fillStyle = '#7d7358'
    ctx.fillRect(0, y, size, 1)
    for (let x = (y / 4) % 2 ? 2 : 0; x < size; x += 4) ctx.fillRect(x, y + 2, 1, 1)
  }
  scatterPixels(ctx, size, 51, ['#c2b482', '#8d805e'], 38, 1)
}

function paintRoof(ctx, size) {
  ctx.fillStyle = '#53686b'
  ctx.fillRect(0, 0, size, size)
  for (let y = 0; y < size; y += 6) {
    ctx.fillStyle = '#344c52'
    ctx.fillRect(0, y, size, 1)
    ctx.fillStyle = '#718487'
    ctx.fillRect(0, y + 1, size, 1)
  }
  scatterPixels(ctx, size, 61, ['#845b49', '#40565b'], 22, 1)
}

function paintRoad(ctx, size) {
  ctx.fillStyle = '#626568'
  ctx.fillRect(0, 0, size, size)
  scatterPixels(ctx, size, 71, ['#777a78', '#4c5053', '#929189'], 90, 1)
  ctx.fillStyle = '#3f4447'
  for (const [x, y] of [[4, 0], [5, 5], [4, 10], [7, 15], [7, 20], [10, 25]]) {
    ctx.fillRect(x, y, 1, 5)
    ctx.fillRect(x, y + 4, 3, 1)
  }
}

function paintPlaster(ctx, size) {
  ctx.fillStyle = '#c9bea4'
  ctx.fillRect(0, 0, size, size)
  scatterPixels(ctx, size, 81, ['#b1a68f', '#ded3b8'], 62)
  ctx.fillStyle = '#82766a'
  for (const [x, y] of [[5, 3], [20, 8], [11, 19], [27, 22]]) {
    ctx.fillRect(x, y, 1, 5)
    ctx.fillRect(x + 1, y + 4, 3, 1)
    ctx.fillRect(x + 3, y + 4, 1, 3)
  }
}

function paintRust(ctx, size) {
  paintMetal(ctx, size)
  const random = createPixelRng(91)
  for (let i = 0; i < 18; i++) {
    const x = Math.floor(random() * size)
    const y = Math.floor(random() * size)
    ctx.fillStyle = i % 2 ? '#8c4f3b' : '#a86343'
    ctx.fillRect(x, y, 2 + Math.floor(random() * 4), 1 + Math.floor(random() * 3))
    ctx.fillStyle = '#654437'
    ctx.fillRect(x, y, 1, 1)
  }
}

function createMatLib(anisotropy) {
  const texture = (paint, repeat) => createCanvasTexture(32, paint, { anisotropy, repeat })
  const textures = {
    grass: texture(paintGrass, 16),
    dirt: texture(paintDirt, 9),
    brick: texture(paintBrick, 3),
    wood: texture(paintWood, 2),
    metal: texture(paintMetal, 2),
    sandbag: texture(paintSandbag, 2),
    roof: texture(paintRoof, 2),
    road: texture(paintRoad, 8),
    plaster: texture(paintPlaster, 2),
    rust: texture(paintRust, 3),
  }
  const surface = (color, map = null, options = {}) =>
    new THREE.MeshLambertMaterial({
      color,
      map,
      ...options,
    })

  return {
    addOutline() {},
    metal: surface(0xffffff, textures.metal),
    metalDark: surface(0x778084, textures.metal),
    blued: surface(0x454d50),
    brass: surface(0xd0aa5d),
    blade: surface(0xe1e5df),
    wood: surface(0xffffff, textures.wood),
    brick: surface(0xffffff, textures.brick),
    plaster: surface(0xffffff, textures.plaster),
    sandbag: surface(0xffffff, textures.sandbag),
    dirt: surface(0xffffff, textures.dirt),
    grass: surface(0xffffff, textures.grass),
    road: surface(0xffffff, textures.road),
    roof: surface(0xffffff, textures.roof),
    rust: surface(0xffffff, textures.rust),
    allyUniform: surface(0x71876e),
    axisUniform: surface(0x868176),
    allyAccent: surface(0xe2ca6e),
    axisAccent: surface(0xc86459),
    skin: surface(0xc5a184),
    helmetAlly: surface(0x647960),
    helmetAxis: surface(0x6d6b60),
    glass: surface(0x9ee9f2, null, {
      transparent: true,
      opacity: 0.42,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
    concrete: surface(0xd8d8d0, textures.plaster),
    treeTrunk: surface(0x745e49),
    treeBranch: surface(0x5b5043),
    treeFoliage: surface(0x637b55, null, { flatShading: true }),
    hill: surface(0x6e8262, null, { flatShading: true }),
    crater: surface(0x806758),
    scorch: surface(0x484746),
  }
}

const POST_VERTEX = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

const POST_FRAGMENT = `
  precision mediump float;
  uniform sampler2D tScene;
  varying vec2 vUv;

  const mat4 BAYER = mat4(
     0.0,  8.0,  2.0, 10.0,
    12.0,  4.0, 14.0,  6.0,
     3.0, 11.0,  1.0,  9.0,
    15.0,  7.0, 13.0,  5.0
  );

  float dither4x4(vec2 position) {
    int x = int(mod(position.x, 4.0));
    int y = int(mod(position.y, 4.0));
    vec4 row = y == 0 ? BAYER[0] : y == 1 ? BAYER[1] : y == 2 ? BAYER[2] : BAYER[3];
    return (x == 0 ? row.x : x == 1 ? row.y : x == 2 ? row.z : row.w) / 16.0 - 0.5;
  }

  void main() {
    vec3 color = texture2D(tScene, vUv).rgb;
    float luminance = dot(color, vec3(0.299, 0.587, 0.114));
    color = mix(vec3(luminance), color, 0.98) * 1.28 + 0.035;
    color = (color - 0.5) * 1.02 + 0.5;
    color = floor((color + dither4x4(gl_FragCoord.xy) / 24.0) * 24.0 + 0.5) / 24.0;
    vec2 edge = vUv * (1.0 - vUv.yx);
    color *= 0.98 + 0.02 * pow(16.0 * edge.x * edge.y, 0.18);
    gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
  }
`

export function createSceneRuntime(config) {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0xabc1c9)
  scene.fog = new THREE.FogExp2(0xb9c3bd, config.render.fogDensity)

  const camera = new THREE.PerspectiveCamera(
    config.player.baseFov,
    innerWidth / innerHeight,
    config.render.cameraNear,
    config.render.cameraFar
  )
  scene.add(camera)

  const touchDevice =
    window.matchMedia('(pointer: coarse)').matches ||
    (navigator.maxTouchPoints > 0 && window.matchMedia('(hover: none)').matches)
  const rawRenderer = new THREE.WebGLRenderer({
    antialias: false,
    powerPreference: 'high-performance',
    stencil: false,
  })
  const sceneCanvas = rawRenderer.getContext().canvas
  rawRenderer.setPixelRatio(1)
  rawRenderer.autoClear = false
  rawRenderer.shadowMap.enabled = true
  rawRenderer.shadowMap.type = THREE.BasicShadowMap
  rawRenderer.shadowMap.autoUpdate = false
  rawRenderer.toneMapping = THREE.NoToneMapping
  rawRenderer.outputColorSpace = THREE.SRGBColorSpace
  sceneCanvas.style.display = 'block'
  document.body.appendChild(sceneCanvas)

  const maxAniso = rawRenderer.capabilities.getMaxAnisotropy()
  const matLib = createMatLib(Math.min(config.render.maxAnisotropy, maxAniso))

  const renderTarget = new THREE.WebGLRenderTarget(1, 1, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    depthBuffer: true,
    stencilBuffer: false,
  })
  const postScene = new THREE.Scene()
  const postCamera = new THREE.Camera()
  const postGeometry = new THREE.BufferGeometry()
  postGeometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3)
  )
  postGeometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2))
  postScene.add(
    new THREE.Mesh(
      postGeometry,
      new THREE.ShaderMaterial({
        uniforms: { tScene: { value: renderTarget.texture } },
        vertexShader: POST_VERTEX,
        fragmentShader: POST_FRAGMENT,
        depthTest: false,
        depthWrite: false,
      })
    )
  )

  let renderFrame = 0
  const renderer = {
    canvas: sceneCanvas,
    render(world, viewCamera) {
      rawRenderer.shadowMap.needsUpdate = renderFrame++ % 4 === 0
      rawRenderer.setRenderTarget(renderTarget)
      rawRenderer.clear(true, true, false)
      rawRenderer.render(world, viewCamera)
      rawRenderer.setRenderTarget(null)
      rawRenderer.clear(true, true, false)
      rawRenderer.render(postScene, postCamera)
    },
  }

  // 偏平、偏亮的动漫向打光：环境填充强，主光与辅光弱化
  scene.add(new THREE.AmbientLight(0xfff2d6, 0.78))
  const hemi = new THREE.HemisphereLight(0xd9edf0, 0x80765d, 1.15)
  scene.add(hemi)

  const sun = new THREE.DirectionalLight(0xffe8c4, 1.5)
  sun.position.set(90, 95, 55)
  sun.castShadow = true
  sun.shadow.mapSize.set(512, 512)
  sun.shadow.camera.left = -48
  sun.shadow.camera.right = 48
  sun.shadow.camera.top = 48
  sun.shadow.camera.bottom = -48
  sun.shadow.camera.near = 25
  sun.shadow.camera.far = 210
  sun.shadow.bias = -0.001
  sun.shadow.normalBias = 0.04
  scene.add(sun)
  scene.add(sun.target)

  const fill = new THREE.DirectionalLight(0xb6d0d7, 0.42)
  fill.position.set(-70, 45, -40)
  scene.add(fill)

  const rim = new THREE.DirectionalLight(0xb99b87, 0.12)
  rim.position.set(-30, 12, 80)
  scene.add(rim)

  function resize() {
    camera.aspect = innerWidth / innerHeight
    camera.updateProjectionMatrix()
    const height = touchDevice
      ? config.render.touchRenderHeight
      : config.render.desktopRenderHeight
    const width = Math.max(1, Math.round((height * innerWidth) / innerHeight))
    rawRenderer.setSize(width, height, false)
    renderTarget.setSize(width, height)
    // 用窗口像素写显示尺寸，避免 100% 在桌面端不触发合成
    sceneCanvas.style.width = `${innerWidth}px`
    sceneCanvas.style.height = `${innerHeight}px`
  }

  resize()

  return { scene, camera, renderer, sun, hemi, fill, rim, matLib, resize }
}
