import { createWorldSystem } from '../world.js'

// 经典对战地图参数，距离单位为米。
const MAP = {
  size: 240,
  terrainSegments: 64,
  terrainEdgeMargin: 8,
  dirtPatchCount: 36,
  craterCount: 32,
  crateCount: 55,
  barbedWireCount: 14,
  treeCount: 90,
  debrisCount: 40,
  smokeColumnCount: 6,
  smokePuffsPerColumn: 5,
  // 木箱生成时避开地图中心的半径。
  centerExclusionRadius: 8,
  // 烟柱生成时避开地图中心的半径。
  smokeCenterExclusionRadius: 35,
}

// 两个阵营可选择的出生点坐标和界面名称。
const SPAWN_POINTS = {
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

export function createClassicMap(services) {
  const world = createWorldSystem({ ...services, map: MAP })

  return {
    spawnPoints: SPAWN_POINTS,
    buildMap() {
      world.buildClassicMap()
      services.state.mapId = 'classic'
      services.state.mapSize = MAP.size
      services.state.groundHeightAt = () => 0
      services.state.groundRegions = []
    },
  }
}
