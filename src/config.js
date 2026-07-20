export const CFG = {
  mapSize: 240,
  killTarget: 100,
  teamSize: 20,
  respawnTime: 5,
  reloadDuration: 1.75,
  emptyReloadDuration: 1.55,
  maxBotViewDist: 50,
  botReactionTime: 0.35,
  masterVolume: 0.65,
  mouseSensitivity: 1,
}

export const SPAWN_POINTS = {
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

export const LOAD_STEPS = [
  '正在装配武器...',
  '生成战场地形...',
  '构筑防御工事...',
  '部署作战单位...',
  '初始化AI系统...',
  '加载战斗音效...',
  '准备就绪...',
]

const audioModules = import.meta.glob('./audio/*.ogg', {
  eager: true,
  query: '?url',
  import: 'default',
})

export const AUDIO_FILES = Object.fromEntries(
  Object.entries(audioModules).map(([path, url]) => [
    path.split('/').pop().replace('.ogg', ''),
    url,
  ])
)
