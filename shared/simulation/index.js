export { hasInputAction, INPUT_ACTION } from './input.js'
export { createAuthoritativeSimulation } from './authoritative-simulation.js'
export { CFG } from './config.js'
export { MODE_DEFINITIONS } from './modes.js'
export { classicOutcome, scoringTeam, zombiePackSize, zombieWaveTotal } from './mode-rules.js'
export { recordActorElimination } from './scoring.js'
export { createSimulationState } from './state.js'
export { applyMapDefinition, createMapDefinition, groundHeightAt } from './maps.js'
export { actionDuration, actionMarker, createActionEngine, createPlayerWeaponActions } from './action-engine.js'
export {
  addWeaponBloom,
  applyWeaponSpread,
  calculateWeaponSpread,
  createActorHitboxes,
  createWeaponRecoil,
  directionFromAngles,
  explosionDamage,
  reloadMagazine,
  resupplyInventory,
  stepPlayerMotion,
  stepThrownProjectile,
  traceHitscan,
  updateActorHitboxes,
  useCarriedItem,
} from './actor-rules.js'
export {
  createBoxHitbox,
  createCircleHitbox,
  getObstacleNormal,
  rayHitObstacle,
  resolveObstacleCollision,
  sweepSphereObstacle,
} from './collision.js'
