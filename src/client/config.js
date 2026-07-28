export { CFG } from '#simulation'

export const LOAD_STEPS = [
  '正在装配武器...',
  '生成战场地形...',
  '构筑防御工事...',
  '部署作战单位...',
  '初始化权威模拟...',
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
