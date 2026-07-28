export function createSimulationState({ records, settings }) {
  return {
    running: false,
    paused: false,
    loading: true,
    simulationTimeMs: 0,
    match: {
      modeId: null,
      startTime: 0,
      score: {
        allies: 0,
        axis: 0,
      },
    },
    modeState: null,
    mapId: null,
    mapDefinition: null,
    mapSize: 0,
    groundHeightAt: () => 0,
    groundRegions: [],
    objectives: {
      fortress: null,
    },
    player: null,
    actors: [],
    events: [],
    spawnQueue: [],
    removeQueue: [],
    obstacles: [],
    coverPoints: [],
    ammoStations: [],
    medicalStations: [],
    smokeClouds: [],
    lastPlayerShot: null,
    records,
    settings,
  }
}
