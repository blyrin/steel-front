import { SPAWN_POINTS } from '../../config.js'
import { createWorldSystem } from '../world.js'

export function createClassicMap(services) {
  const world = createWorldSystem(services)

  return {
    spawnPoints: SPAWN_POINTS,
    buildMap() {
      world.buildClassicMap()
      services.state.mapId = 'classic'
      services.state.groundHeightAt = () => 0
      services.state.groundRegions = []
    },
  }
}
