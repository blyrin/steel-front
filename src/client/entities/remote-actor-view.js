import * as THREE from 'three'
import { Bot } from './bot.js'
import { Zombie } from './zombie.js'

const silentAudio = new Proxy({}, { get: () => () => {} })
const noop = () => {}

export function createRemoteActorView(actor, services) {
  let nextId = 0
  const common = {
    scene: services.scene, camera: services.camera, matLib: services.matLib, config: services.config,
    audio: silentAudio, effects: { spawnBlood: noop }, scoring: { recordElimination: noop },
    gameState: { groundHeightAt: () => 0, player: null },
    ai: { allocateActorId: () => `remote-${nextId++}`, reportDamage: noop, reportDeath: noop },
  }
  const view = actor.kind === 'zombie'
    ? new Zombie(new THREE.Vector3(actor.x, actor.y, actor.z), {
        ...common, enemyConfig: services.config.modes.zombie.enemy,
      })
    : new Bot(actor.team, new THREE.Vector3(actor.x, actor.y, actor.z), {
        ...common, combat: {}, mode: {}, getRandomSpawn: noop,
      })
  view.id = actor.id
  view.name = actor.name
  view.controller = actor.controller
  view.weaponData = services.config.weapons[actor.weapon]
  if (view.configureRifleModel) view.configureRifleModel()
  if (!view.destroy) view.destroy = () => services.scene.remove(view.group)
  view.networkPosition = view.position.clone()
  view.networkYaw = actor.yaw
  view.networkUpdatedAt = performance.now()
  return view
}

export function applyRemoteActorSnapshot(view, actor) {
  const wasAlive = view.alive
  view.alive = actor.alive
  view.health = actor.health
  view.maxHealth = actor.maxHealth
  view.kills = actor.kills
  view.deaths = actor.deaths
  view.controller = actor.controller
  const y = actor.kind === 'player' ? actor.y - view.config.player.standHeight : actor.y
  view.networkPosition.set(actor.x, y, actor.z)
  view.networkYaw = actor.yaw
  view.networkUpdatedAt = performance.now()
  view.velocity.set(actor.vx, actor.vy, actor.vz)
  view.yaw = actor.yaw
  view.pitch = actor.pitch
  view.targetVisible = actor.alive
  view.group.visible = true
  if ((!wasAlive && actor.alive) || view.position.distanceToSquared(view.networkPosition) > 64) {
    view.position.copy(view.networkPosition)
    view.deathTime = -1
    view.group.rotation.set(0, actor.yaw, 0)
  }
}

export function interpolateRemoteActor(view, dt, now) {
  if (view.alive) {
    const elapsed = Math.min(0.1, (now - view.networkUpdatedAt) / 1000)
    const alpha = 1 - Math.exp(-20 * dt)
    view.position.x += (view.networkPosition.x + view.velocity.x * elapsed - view.position.x) * alpha
    view.position.y += (view.networkPosition.y + view.velocity.y * elapsed - view.position.y) * alpha
    view.position.z += (view.networkPosition.z + view.velocity.z * elapsed - view.position.z) * alpha
    const turn = Math.atan2(Math.sin(view.networkYaw - view.yaw), Math.cos(view.networkYaw - view.yaw))
    view.yaw += turn * alpha
  }
  view.group.position.copy(view.position)
  view.group.rotation.y = view.yaw
}
