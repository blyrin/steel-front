import { createClassicMap } from './classic-map.js'
import { createZombieMap } from './zombie-map.js'

const MAP_BUILDERS = {
  classic: createClassicMap,
  zombie: createZombieMap,
}

export function createMap(id, services) {
  return MAP_BUILDERS[id](services)
}
