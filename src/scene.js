import * as THREE from 'three'

export function createSceneRuntime() {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x7a8478)
  scene.fog = new THREE.FogExp2(0x8a9080, 0.0038)

  const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.04, 1000)
  scene.add(camera)

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
    stencil: false,
  })
  renderer.setSize(innerWidth, innerHeight)
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.18
  renderer.outputColorSpace = THREE.SRGBColorSpace
  document.body.appendChild(renderer.domElement)

  scene.add(new THREE.AmbientLight(0x6e7468, 0.28))
  const hemi = new THREE.HemisphereLight(0xc8d6e8, 0x4a3a22, 0.55)
  scene.add(hemi)

  const sun = new THREE.DirectionalLight(0xffe2b8, 1.45)
  sun.position.set(70, 110, 45)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.camera.left = -140
  sun.shadow.camera.right = 140
  sun.shadow.camera.top = 140
  sun.shadow.camera.bottom = -140
  sun.shadow.camera.near = 10
  sun.shadow.camera.far = 320
  sun.shadow.bias = -0.00025
  sun.shadow.normalBias = 0.035
  sun.shadow.radius = 2.5
  scene.add(sun)
  scene.add(sun.target)

  const fill = new THREE.DirectionalLight(0xa8c0d8, 0.28)
  fill.position.set(-50, 40, -30)
  scene.add(fill)

  const matLib = {
    metal: new THREE.MeshStandardMaterial({ color: 0x3a3c3e, roughness: 0.38, metalness: 0.88 }),
    metalDark: new THREE.MeshStandardMaterial({
      color: 0x1c1e20,
      roughness: 0.48,
      metalness: 0.82,
    }),
    wood: new THREE.MeshStandardMaterial({ color: 0x5a3a1e, roughness: 0.82, metalness: 0.04 }),
    brick: new THREE.MeshStandardMaterial({ color: 0x6e5a48, roughness: 0.92, metalness: 0.02 }),
    sandbag: new THREE.MeshStandardMaterial({ color: 0x7e6c42, roughness: 0.98, metalness: 0 }),
    dirt: new THREE.MeshStandardMaterial({ color: 0x52422a, roughness: 1, metalness: 0 }),
    grass: new THREE.MeshStandardMaterial({ color: 0x4e5e38, roughness: 0.96, metalness: 0 }),
    rust: new THREE.MeshStandardMaterial({ color: 0x6a4024, roughness: 0.86, metalness: 0.45 }),
    allyUniform: new THREE.MeshStandardMaterial({
      color: 0x3f6b34,
      roughness: 0.92,
      metalness: 0.04,
    }),
    axisUniform: new THREE.MeshStandardMaterial({
      color: 0x5a5850,
      roughness: 0.92,
      metalness: 0.06,
    }),
    allyAccent: new THREE.MeshStandardMaterial({
      color: 0x2a4a7a,
      roughness: 0.7,
      metalness: 0.15,
    }),
    axisAccent: new THREE.MeshStandardMaterial({
      color: 0x7a1c1c,
      roughness: 0.75,
      metalness: 0.12,
    }),
    skin: new THREE.MeshStandardMaterial({ color: 0xc8a888, roughness: 0.78, metalness: 0 }),
    helmetAlly: new THREE.MeshStandardMaterial({
      color: 0x35552a,
      roughness: 0.58,
      metalness: 0.4,
    }),
    helmetAxis: new THREE.MeshStandardMaterial({
      color: 0x2e3028,
      roughness: 0.55,
      metalness: 0.45,
    }),
  }

  function resize() {
    camera.aspect = innerWidth / innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(innerWidth, innerHeight)
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75))
  }

  return { scene, camera, renderer, sun, hemi, fill, matLib, resize }
}
