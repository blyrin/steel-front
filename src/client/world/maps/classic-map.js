import { createWorldSystem } from '../world.js'

export function createClassicMap(services) {
  const world = createWorldSystem({ ...services, map: services.definition })

  return {
    definition: services.definition,
    buildMap() {
      world.buildClassicMap()
    },
  }
}
