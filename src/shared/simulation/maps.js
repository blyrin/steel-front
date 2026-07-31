function createRandom(seed) {
  let value = seed >>> 0
  return () => {
    value = (value + 0x6d2b79f5) | 0
    let result = Math.imul(value ^ (value >>> 15), 1 | value)
    result ^= result + Math.imul(result ^ (result >>> 7), 61 | result)
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296
  }
}

function box(type, x, z, width, depth, height, rotation = 0, minY = 0) {
  const cos = Math.cos(rotation)
  const sin = Math.sin(rotation)
  return {
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
    r: Math.hypot(width, depth) * 0.5,
  }
}

function feature(type, values, random) {
  return { type, ...values, seed: Math.floor(random() * 0x100000000) }
}

const CLASSIC_SPAWNS = {
  allies: [
    { x: 0, z: 100, name: '南侧主阵地', id: 'A' },
    { x: -55, z: 90, name: '西南农场', id: 'B' },
    { x: 55, z: 95, name: '东南路口', id: 'C' },
    { x: -95, z: 70, name: '西南林地', id: 'D' },
    { x: 95, z: 70, name: '东南废墟', id: 'E' },
  ],
  axis: [
    { x: 0, z: -100, name: '北侧据点', id: 'F' },
    { x: -55, z: -90, name: '西北树林', id: 'G' },
    { x: 55, z: -95, name: '东北废墟', id: 'H' },
    { x: -95, z: -70, name: '西北高地', id: 'I' },
    { x: 95, z: -70, name: '东北公路', id: 'J' },
  ],
}

const CLASSIC_BUILDINGS = [
  [-40, -30], [-55, 10], [-70, -55], [-25, -70], [35, -45], [60, -20],
  [75, 15], [45, 50], [20, 65], [-20, 55], [-50, 40], [-80, 0], [0, -50],
  [10, 20], [-15, -15], [55, -70], [-60, 70], [80, -50], [-90, -30],
  [30, -90], [-35, 90], [70, 60], [0, 40], [0, -80],
]

const CLASSIC_SANDBAGS = [
  [0, -25], [8, -25], [-8, -25], [0, 25], [8, 25], [-8, 25], [-35, 0],
  [35, 0], [-50, -20], [50, 20], [0, 0], [-20, 40], [20, -40], [-70, 30],
  [70, -30],
]

function createClassicMap(seed, options = {}) {
  const random = createRandom(seed)
  const size = 240
  const half = size * 0.5
  const features = []
  const obstacles = []
  const coverPoints = []
  const ammoStations = []

  for (let i = 0; i < 36; i++) {
    features.push(feature('dirt-patch', {
      x: (random() - 0.5) * size * 0.85,
      z: (random() - 0.5) * size * 0.85,
      y: 0.015 + random() * 0.01,
      radius: 3 + random() * 6,
      rotation: random() * Math.PI,
    }, random))
  }
  for (let i = 0; i < 32; i++) {
    const angle = random() * Math.PI * 2
    const distance = 18 + random() * (half - 28)
    const crater = feature('crater', {
      x: Math.cos(angle) * distance,
      z: Math.sin(angle) * distance,
      radius: 2 + random() * 1.8,
    }, random)
    features.push(crater)
    coverPoints.push({ x: crater.x, z: crater.z, r: crater.radius + 0.5, type: 'crater' })
  }
  for (const [x, z] of CLASSIC_BUILDINGS) {
    const building = feature('building', {
      x,
      z,
      rotation: (random() - 0.5) * 1.2,
      width: 6 + random() * 3.5,
      depth: 5 + random() * 3.2,
      height: 4.2 + random() * 2.4,
      ruined: random() > 0.45,
      plaster: random() > 0.4,
    }, random)
    const obstacle = box('building', x, z, building.width, building.depth, building.height, building.rotation)
    features.push(building)
    obstacles.push(obstacle)
    coverPoints.push({ x, z, r: obstacle.r + 1, type: 'building' })
  }
  for (const [x, z] of CLASSIC_SANDBAGS) {
    const sandbag = feature('sandbag', { x, z, rotation: random() * Math.PI }, random)
    const obstacle = box('sandbag', x, z, 3.1, 0.75, 1, sandbag.rotation)
    features.push(sandbag)
    obstacles.push(obstacle)
    coverPoints.push({ x, z, r: obstacle.r + 0.15, type: 'sandbag' })
  }
  for (let i = 0; i < 55; i++) {
    const x = (random() - 0.5) * size * 0.9
    const z = (random() - 0.5) * size * 0.9
    if (Math.abs(x) < 8 && Math.abs(z) < 8) continue
    const crate = feature('crate', {
      x,
      z,
      rotation: random() * Math.PI * 2,
      size: 0.75 + random() * 0.45,
      open: random() > 0.7,
    }, random)
    features.push(crate)
    obstacles.push(box('crate', x, z, crate.size, crate.size, crate.size, crate.rotation))
  }
  for (const [x, z, rotation] of [
    [-40, -20, 0.6], [45, 28, -0.8], [-15, 60, 1.2], [70, -55, -0.3],
    [25, -75, 0.4],
  ]) {
    features.push(feature('tank', { x, z, rotation }, random))
    const obstacle = box('tank', x, z, 3.3, 5.1, 2.3, rotation)
    obstacles.push(obstacle)
    coverPoints.push({ x, z, r: obstacle.r, type: 'tank' })
  }
  for (let i = 0; i < 14; i++) {
    const angle = (i / 14) * Math.PI * 2
    const distance = 55 + (i % 3) * 18
    const wire = feature('wire', {
      x: Math.cos(angle) * distance,
      z: Math.sin(angle) * distance,
      rotation: angle + Math.PI / 2,
    }, random)
    features.push(wire)
    obstacles.push(box('wire', wire.x, wire.z, 3.2, 0.5, 1.55, wire.rotation))
  }
  for (let i = 0; i < 90; i++) {
    const angle = random() * Math.PI * 2
    const distance = half * 0.52 + random() * half * 0.42
    const dead = random() > 0.55
    const tree = feature('tree', {
      x: Math.cos(angle) * distance,
      z: Math.sin(angle) * distance,
      dead,
      trunkHeight: dead ? 3.5 + random() * 2.5 : 4.5 + random() * 2,
      trunkRadius: 0.32 + random() * 0.15,
    }, random)
    features.push(tree)
    obstacles.push({
      type: 'tree', shape: 'circle', x: tree.x, z: tree.z, r: tree.trunkRadius,
      minY: 0, maxY: tree.trunkHeight,
    })
  }
  for (let i = 0; i < 40; i++) {
    const x = (random() - 0.5) * size * 0.85
    const z = (random() - 0.5) * size * 0.85
    if (Math.abs(x) < 10 && Math.abs(z) < 10) continue
    features.push(feature('debris', { x, z, kind: Math.floor(random() * 3) }, random))
    obstacles.push({ type: 'debris', shape: 'circle', x, z, r: 1.4, minY: 0, maxY: 1.6 })
  }
  for (const [x, z, rotation] of [
    [4, -29, 0], [-4, 29, Math.PI], [-39, -4, Math.PI / 2], [39, 4, -Math.PI / 2],
  ]) {
    if (options.mapSupplies === false) continue
    features.push(feature('ammo-station', { x, z, rotation }, random))
    obstacles.push(box('ammo-station', x, z, 2.2, 1.05, 0.72, rotation))
    coverPoints.push({ x, z, r: 1.7, type: 'ammo-station' })
    ammoStations.push({ position: { x, y: 0, z } })
  }
  for (let i = 0; i < 16; i++) {
    const angle = (i / 16) * Math.PI * 2 + random() * 0.2
    features.push(feature('hill', {
      x: Math.cos(angle) * (half + 40 + random() * 50),
      z: Math.sin(angle) * (half + 40 + random() * 50),
      rotation: random() * Math.PI,
      width: 28 + random() * 30,
      height: 12 + random() * 18,
    }, random))
  }
  for (let i = 0; i < 6; i++) {
    const x = (random() - 0.5) * size * 0.9
    const z = (random() - 0.5) * size * 0.9
    if (Math.abs(x) < 35 && Math.abs(z) < 35) continue
    features.push(feature('smoke-column', { x, z }, random))
  }

  return {
    id: 'classic', seed, size, terrainSegments: 64, terrainEdgeMargin: 8,
    spawnPoints: CLASSIC_SPAWNS, features, obstacles, coverPoints,
    ammoStations, medicalStations: [], groundRegions: [], objectives: {},
  }
}

function createZombieMap(seed, config) {
  const random = createRandom(seed)
  const features = []
  const obstacles = []
  const coverPoints = []
  const fortress = { kind: 'fortress', position: { x: 0, y: 0, z: 0 }, ...config.modes.zombie.fortress }
  fortress.health = fortress.maxHealth

  const addBoxFeature = (type, x, z, rotation, width, depth, height, extra = {}) => {
    features.push(feature(type, { x, z, rotation, width, depth, height, ...extra }, random))
    const obstacle = box(type, x, z, width, depth, height, rotation)
    obstacles.push(obstacle)
    return obstacle
  }
  for (const [x, z, rotation] of [[-42, -36, 0.2], [42, -36, -0.2], [-42, 40, Math.PI + 0.2], [42, 40, Math.PI - 0.2]])
    features.push(feature('street-lamp', { x, z, rotation }, random))
  for (const [x, z, rotation, scale] of [[-48, -45, -0.2, 1.25], [44, -42, 0.18, 0.95], [-74, 42, 0.4, 0.85], [74, 35, -0.5, 1.1]]) {
    const width = 8 * scale
    const depth = 6 * scale
    addBoxFeature('ruined-house', x, z, rotation, width, depth, 4.6 * scale, { scale })
    coverPoints.push({ x, z, r: Math.max(width, depth) * 0.7, type: 'ruined-house' })
  }
  for (const [x, z, width] of [[-26, 18, 9], [28, -4, 8], [-46, 70, 7]]) {
    const rotation = Math.atan2(z, x)
    addBoxFeature('barricade', x, z, rotation, width, 0.32, 1.9)
    coverPoints.push({ x, z, r: width * 0.5, type: 'barricade' })
  }
  for (const [x, z, rotation] of [[-30, -12, 0.8], [34, 48, -0.6]])
    addBoxFeature('wreck', x, z, rotation, 2.8, 4.8, 1.4)
  for (const [x, z, scale] of [[-21, -28, 1.2], [24, 27, 1.1], [-41, 25, 1.35], [42, -20, 0.95]])
    features.push(feature('rubble', { x, z, scale }, random))
  for (const [x, z, length] of [[-18, -74, 28], [62, -8, 24]])
    addBoxFeature('fence', x, z, Math.atan2(z, x), length * 0.84, 0.12, 1.5, { length })
  for (let i = 0; i < 18; i++) {
    const grave = feature('grave', {
      x: -78 + (i % 6) * 8 + (random() - 0.5) * 2,
      z: -12 + Math.floor(i / 6) * 9 + (random() - 0.5) * 2,
      rotation: (random() - 0.5) * 0.25,
    }, random)
    features.push(grave)
    coverPoints.push({ x: grave.x, z: grave.z, r: 1.2, type: 'grave' })
  }
  features.push(feature('burial-gate', { x: -58, y: 2.6, z: -8, rotation: 0.2 }, random))
  features.push(feature('fortress', fortress, random))

  obstacles.push({
    type: 'fortress-frustum', shape: 'frustum', x: 0, z: 0,
    h: fortress.deckHeight, minY: 0, maxY: fortress.deckHeight,
    bottomRadius: fortress.bottomRadius, topRadius: fortress.topRadius,
  })
  coverPoints.push({ x: 0, z: 0, r: fortress.radius, type: 'fortress' })
  const stations = [
    { kind: 'medical', position: { x: -3.2, y: fortress.deckHeight, z: 0 } },
    { kind: 'ammo', position: { x: 3.2, y: fortress.deckHeight, z: 0 } },
  ]
  for (const station of stations)
    obstacles.push(box(`${station.kind}-station`, station.position.x, station.position.z, 2.2, 1.35, 1.35, 0, fortress.deckHeight))

  return {
    id: 'zombie', seed, size: 240,
    spawnPoints: { allies: [{ x: 0, z: 0, name: '堡垒上层', id: 'A' }] },
    features, obstacles, coverPoints,
    ammoStations: stations.filter(item => item.kind === 'ammo'),
    medicalStations: stations.filter(item => item.kind === 'medical'),
    groundRegions: [{
      x: 0, z: 0, bottomRadius: fortress.bottomRadius,
      topRadius: fortress.topRadius, height: fortress.deckHeight,
    }],
    objectives: { fortress },
  }
}

export function createMapDefinition(id, config, seed = Math.floor(Math.random() * 0x100000000), options = {}) {
  return id === 'classic' ? createClassicMap(seed, options) : createZombieMap(seed, config)
}

export function groundHeightAt(definition, x, z) {
  let height = 0
  for (const region of definition.groundRegions) {
    const distance = Math.hypot(x - region.x, z - region.z)
    if (distance > region.bottomRadius) continue
    const surface = distance <= region.topRadius
      ? region.height
      : ((region.bottomRadius - distance) / (region.bottomRadius - region.topRadius)) * region.height
    height = Math.max(height, surface)
  }
  return height
}

export function applyMapDefinition(state, definition) {
  state.mapId = definition.id
  state.mapDefinition = definition
  state.mapSize = definition.size
  state.obstacles = definition.obstacles
  state.coverPoints = definition.coverPoints
  state.ammoStations = definition.ammoStations
  state.medicalStations = definition.medicalStations
  state.groundRegions = definition.groundRegions
  state.objectives = definition.objectives
  state.groundHeightAt = (x, z) => groundHeightAt(definition, x, z)
}
