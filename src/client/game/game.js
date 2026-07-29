import * as THREE from 'three'
import {
  applyMapDefinition,
  calculateWeaponSpread,
  createActionEngine,
  createPlayerWeaponActions,
  INPUT_ACTION,
  stepPlayerMotion,
} from '#simulation'
import { CFG } from './config.js'
import { ACTOR_FRAME } from '#shared/protocol'
import { AUDIO_FILES, AudioSystem } from '../presentation/audio.js'
import { createEffectsSystem } from '../presentation/effects.js'
import { applyRemoteActorSnapshot, createRemoteActorView, interpolateRemoteActor } from '../presentation/actors.js'
import { WeaponView } from '../presentation/weapon.js'
import { createInputSystem } from './input.js'
import { createSceneRuntime } from '../presentation/scene.js'
import { saveSettings } from './state.js'
import { createDeploymentSystem } from '../ui/deployment.js'
import { createZombieMap } from '../world/zombie.js'
import { createClassicMap } from '../world/classic.js'

const MULTI_KILL_TITLES = ['', '', '双杀', '三杀', '四杀', '五杀', '势不可挡', '无人能挡']

function getKillNotice(streak, headshot) {
  let kind = headshot ? 'head' : 'normal'
  let title = headshot ? '爆头' : '击倒敌人'
  if (streak >= 2) {
    title = MULTI_KILL_TITLES[Math.min(streak, MULTI_KILL_TITLES.length - 1)] || `${streak} 连杀`
    kind = 'multi'
    if (headshot) title = `爆头 · ${title}`
  }
  return { kind, title }
}

export function createGame({ session, ui, state, deploy, getPlayerId }) {
  let runtime = null
  let audio = null
  let effects = null
  let input = null
  let deployment = null
  let latest = null
  let player = null
  let mode = null
  let active = false
  let latency = 0
  let inputSeq = 0
  let lastFrameAt = performance.now()
  let frameAccumulator = 0
  let activeSlot = 1
  let crouching = false
  let predictionInput = {
    moveX: 0, moveZ: 0, yaw: 0, pitch: 0, jump: false,
    crouch: false, sprint: false, aim: false,
  }
  let bobPhase = 0
  let lookDelta = { x: 0, y: 0 }
  let deathCameraStart = null
  let deathCameraTime = 0
  const particles = []
  const views = new Map()
  const actorDefinitions = new Map()
  const frameStep = 1 / CFG.match.tickRate
  const projectiles = new Map()
  const actions = createActionEngine()
  const actionDefs = createPlayerWeaponActions(CFG.weapon)
  const vector = value => new THREE.Vector3(value.x, value.y, value.z)

  function modeHud() {
    if (!latest) return null
    if (latest.modeId === 'zombie') {
      const data = latest.modeState
      const phase = data.phase === 'assault' ? `${data.waveDefeated} / ${data.waveTotal}` : data.phase === 'intermission'
        ? `下一波 ${Math.max(0, Math.ceil((data.nextWaveAt - latest.timeMs) / 1000))} 秒` : '等待部署'
      return {
        kind: 'zombie', alliesLabel: '守军击杀', axisLabel: '堡垒', alliesScore: latest.score.allies,
        axisScore: Math.ceil(data.fortressHealth), targetText: `第 ${data.wave} 波 · ${phase}`,
      }
    }
    return {
      kind: 'classic', alliesLabel: '盟军', axisLabel: '轴心', alliesScore: latest.score.allies,
      axisScore: latest.score.axis, targetText: `达到 ${CFG.modes.classic.killTarget} 杀`,
    }
  }

  function createPlayerView(actor) {
    const value = {
      id: actor.id, name: actor.name, team: actor.team, actorKind: 'player', position: new THREE.Vector3(),
      velocity: new THREE.Vector3(), health: 0, maxHealth: CFG.player.maxHealth, alive: false,
      networkPosition: new THREE.Vector3(), networkVelocity: new THREE.Vector3(),
      networkUpdatedAt: 0, networkReady: false, currentHeight: CFG.player.standHeight, grounded: true,
      kills: 0, deaths: 0, headshots: 0, meleeKills: 0, grenadeKills: 0,
      yaw: 0, pitch: 0, aiming: false, sprinting: false, crouching: false, activeSlot: 1,
      currentSpread: 0, getSpread: () => 0,
      viewRecoilPitch: 0, viewRecoilYaw: 0, viewRecoilRoll: 0, shakeTrauma: 0, shakeTime: 0,
      lookSwayPitch: 0, lookSwayYaw: 0, lookSwayRoll: 0, moveLean: 0,
      spreadBloom: 0, reloading: false,
      currentFov: runtime.camera.fov,
      addShake(amount) { value.shakeTrauma = Math.min(CFG.player.shakeTraumaMax, value.shakeTrauma + amount) },
      applyLoadout(loadout) {
        value.weaponId = loadout.weapon
        value.secondaryId = loadout.secondary
        value.weaponData = CFG.weapons[loadout.weapon]
        value.secondaryData = CFG.secondaries[loadout.secondary]
        value.grenadeData = CFG.grenades[loadout.grenade]
        value.itemData = CFG.items[loadout.item]
        if (value.activeSlot === 2) {
          value.weapon.configureSecondary(value.secondaryData, { rpgLoaded: value.rpgLoaded })
        } else {
          value.weapon.configure(value.weaponData)
        }
      },
    }
    value.weapon = new WeaponView({ config: CFG.weapon, camera: runtime.camera, matLib: runtime.matLib, audio })
    value.applyLoadout(state.settings.loadout)
    return value
  }

  function ensureWorld(mapDefinition, ownActor) {
    if (runtime) return
    runtime = createSceneRuntime(CFG)
    runtime.camera.position.y = CFG.match.initialCameraHeight
    ui.setCamera(runtime.camera)
    audio = new AudioSystem(AUDIO_FILES, CFG)
    audio.setCamera(runtime.camera)
    audio.setMasterVolume(state.settings.masterVolume)
    audio.init().then(() => audio.setAmbience(mapDefinition.id === 'zombie' ? 'zombie_ambience' : 'ambience'))
    effects = createEffectsSystem({ scene: runtime.scene, state, particles, audio, config: CFG })
    applyMapDefinition(state, mapDefinition)
    const mapServices = {
      scene: runtime.scene, matLib: runtime.matLib, state, particles,
      definition: mapDefinition,
    }
    if (mapDefinition.id === 'zombie') {
      createZombieMap(mapServices).buildMap()
    } else {
      createClassicMap({ ...mapServices, map: mapDefinition }).buildMap()
    }
    player = createPlayerView(ownActor)
    state.player = player
    mode = { getHudState: modeHud, getSpawnPoints: team => state.mapDefinition.spawnPoints[team] }
    ui.bindRuntime(() => mode)
    input = createInputSystem({ state, deploy, onPause: togglePause, ui, config: CFG })
    deployment = createDeploymentSystem({
      ui, state, deploy, getSpawnPoints: team => mode.getSpawnPoints(team), camera: runtime.camera,
      renderer: runtime.renderer, audio, input, config: CFG,
      onDeploy(spawnId, loadout) { session.send({ type: 'deploy', spawnId, loadout: { ...loadout } }) },
    })
    runtime.renderer.canvas.addEventListener('click', () => {
      if (active && !state.paused && deploy.phase === 'none' && !input.isTouchMode()) runtime.renderer.canvas.requestPointerLock().catch(console.error)
    })
    window.addEventListener('resize', () => {
      runtime.resize()
      ui.resize()
      input.syncUi()
    })
  }

  function boot(mapDefinition, snapshot) {
    const ownActor = snapshot.player
    ensureWorld(mapDefinition, ownActor)
    active = true
    state.running = true
    state.loading = false
    state.match.modeId = snapshot.modeId
    state.match.score = snapshot.score
    ui.showGame()
    applySnapshot(snapshot)
    if (!ownActor.alive) deployment.showScreen()
    input.syncUi()
  }

  function syncPlayer(actor) {
    const wasAlive = player.alive
    const firstSnapshot = !player.networkReady
    const previousSlot = player.activeSlot
    const previousWeapon = player.weaponId
    const previousSecondary = player.secondaryId
    player.networkPosition.set(actor.x, actor.y, actor.z)
    player.networkVelocity.set(actor.vx, actor.vy, actor.vz)
    player.networkUpdatedAt = performance.now()
    const deployed = !wasAlive && actor.alive
    if (!player.networkReady || deployed ||
      player.position.distanceToSquared(player.networkPosition) > 64) {
      player.position.copy(player.networkPosition)
    }
    player.networkReady = true
    if (firstSnapshot || deployed) {
      player.velocity.copy(player.networkVelocity)
      player.currentHeight = actor.currentHeight
      player.grounded = actor.grounded
      player.crouching = actor.crouching
      player.sprinting = actor.sprinting
    }
    if (firstSnapshot || deployed) {
      player.aiming = actor.aiming
      crouching = actor.crouching
      activeSlot = actor.activeSlot
    }
    player.health = actor.health
    player.maxHealth = actor.maxHealth
    player.alive = actor.alive
    player.kills = actor.kills
    player.deaths = actor.deaths
    player.headshots = actor.headshots
    player.meleeKills = actor.meleeKills
    player.grenadeKills = actor.grenadeKills
    player.killStreak = actor.killStreak
    player.bestKillStreak = actor.bestKillStreak
    if (firstSnapshot) {
      player.yaw = actor.yaw
      player.pitch = actor.pitch
    }
    player.ammo = actor.ammo
    player.reserveAmmo = actor.reserveAmmo
    player.secondaryCount = actor.secondaryCount
    player.grenadeCount = actor.grenadeCount
    player.itemUses = actor.itemUses
    player.rpgLoaded = actor.rpgLoaded
    player.spreadBloom = actor.spreadBloom
    player.reloading = actor.reloading
    player.activeSlot = actor.activeSlot
    player.weaponData = CFG.weapons[actor.weapon]
    player.secondaryData = CFG.secondaries[actor.secondary]
    player.weaponId = actor.weapon
    player.secondaryId = actor.secondary
    player.grenadeData = CFG.grenades[actor.grenade]
    player.itemData = CFG.items[actor.item]
    if (previousSlot !== actor.activeSlot || previousWeapon !== actor.weapon || previousSecondary !== actor.secondary) {
      if (actor.activeSlot === 2) {
        player.weapon.configureSecondary(player.secondaryData, { rpgLoaded: actor.rpgLoaded })
      } else {
        player.weapon.configure(player.weaponData)
      }
    }
    if (actor.activeSlot === 2 && player.secondaryData.kind === 'rpg') {
      player.weapon.setRpgRocketVisible(actor.rpgLoaded)
    }
  }

  function decodeActor(frame) {
    const definition = actorDefinitions.get(frame[ACTOR_FRAME.ID])
    return {
      ...definition,
      x: frame[ACTOR_FRAME.X], y: frame[ACTOR_FRAME.Y], z: frame[ACTOR_FRAME.Z],
      vx: frame[ACTOR_FRAME.VX], vy: frame[ACTOR_FRAME.VY], vz: frame[ACTOR_FRAME.VZ],
      yaw: frame[ACTOR_FRAME.YAW], pitch: frame[ACTOR_FRAME.PITCH],
      alive: frame[ACTOR_FRAME.ALIVE], health: frame[ACTOR_FRAME.HEALTH],
      kills: frame[ACTOR_FRAME.KILLS], deaths: frame[ACTOR_FRAME.DEATHS],
      stateName: frame[ACTOR_FRAME.STATE], targetVisible: frame[ACTOR_FRAME.TARGET_VISIBLE],
      reloading: frame[ACTOR_FRAME.RELOADING], currentHeight: frame[ACTOR_FRAME.CURRENT_HEIGHT],
      deployed: frame[ACTOR_FRAME.DEPLOYED], weapon: frame[ACTOR_FRAME.WEAPON],
    }
  }

  function applySnapshot(snapshot) {
    for (const definition of snapshot.definitions || []) actorDefinitions.set(definition.id, definition)
    const ownId = getPlayerId()
    const actors = snapshot.actors.map(decodeActor).filter(actor => actor.id !== ownId)
    latest = { ...snapshot, actors }
    state.simulationTimeMs = snapshot.timeMs
    state.match.score = snapshot.score
    const ids = new Set(actors.map(actor => actor.id))
    for (const [id, view] of views) {
      if (ids.has(id)) continue
      view.destroy()
      views.delete(id)
    }
    syncPlayer(snapshot.player)
    for (const actor of actors) {
      let view = views.get(actor.id)
      if (!view) {
        view = createRemoteActorView(actor, { scene: runtime.scene, camera: runtime.camera, matLib: runtime.matLib, config: CFG })
        views.set(actor.id, view)
      }
      applyRemoteActorSnapshot(view, actor)
    }
    state.actors = [...views.values()]
    ui.invalidate()
    input.updateTouchUi()
  }

  function snapshotActor(id) {
    return latest?.player?.id === id ? latest.player : latest?.actors.find(actor => actor.id === id)
  }

  function actorName(id) { return snapshotActor(id)?.name || '未知' }

  function handleEvents(events) {
    for (const event of events) {
      if (event.type === 'actor_added') {
        actorDefinitions.set(event.actor.id, event.actor)
        continue
      }
      if (event.type === 'actor_removed') {
        actorDefinitions.delete(event.actorId)
        const view = views.get(event.actorId)
        if (view) {
          view.destroy()
          views.delete(event.actorId)
        }
        continue
      }
      if (event.type === 'shot') {
        const direction = vector(event.direction)
        const end = vector(event.end)
        let origin
        if (event.actorId === player.id) {
          origin = player.weapon.muzzlePos.getWorldPosition(new THREE.Vector3())
        } else {
          const view = views.get(event.actorId)
          origin = view?.rifleMuzzle?.getWorldPosition(new THREE.Vector3()) ?? vector(event.origin)
        }
        effects.addTracer(origin.addScaledVector(direction, CFG.combat.tracerOriginOffset), end)
        if (event.hit === 'actor') {
          effects.spawnBlood(end)
        } else if (event.hit === 'obstacle') {
          effects.spawnSpark(end, direction)
          audio.ricochet(end)
        }
        if (event.actorId !== player.id && event.hit !== 'actor' && player.alive) {
          const shotOrigin = vector(event.origin)
          const distance = shotOrigin.distanceTo(player.position)
          if (distance < CFG.combat.bulletWhizDistance) {
            const alignment = player.position.clone().sub(shotOrigin).normalize().dot(direction)
            if (alignment > CFG.combat.bulletWhizAlignmentMin && alignment < CFG.combat.bulletWhizAlignmentMax) {
              audio.bulletWhiz(shotOrigin.addScaledVector(direction, distance))
            }
          }
        }
      } else if (event.type === 'weapon_fired') {
        const direction = vector(event.direction)
        if (event.actorId === player.id) {
          actions.play(actionDefs.bolt, { locksOpen: event.empty, pumpPlayed: false, kickPlayed: false, emptyEjectPlayed: false })
          const muzzle = player.weapon.muzzlePos.getWorldPosition(new THREE.Vector3())
          effects.spawnMuzzleFlash(muzzle, direction, true)
          effects.spawnSmokePuff(muzzle)
          const eject = player.weapon.group.localToWorld(new THREE.Vector3(0.06, 0.02, -0.08))
          const right = new THREE.Vector3(1, 0, 0).applyQuaternion(runtime.camera.quaternion)
          const up = new THREE.Vector3(0, 1, 0).applyQuaternion(runtime.camera.quaternion)
          effects.spawnShell(eject, right, up)
          if (event.weaponId === 'shotgun') {
            audio.shotgunShot()
          } else if (event.weaponId === 'thompson') {
            audio.thompsonShot()
          } else if (event.weaponId === 'bar') {
            audio.barShot()
          } else {
            audio.garandShot()
          }
          player.viewRecoilPitch += event.recoil.pitch
          player.viewRecoilYaw += event.recoil.yaw
          player.viewRecoilRoll += event.recoil.roll
          player.weapon.applyRecoil(player.aiming, event.recoil)
          player.addShake((player.aiming ? CFG.weapon.aimingFireShake : CFG.weapon.hipFireShake) * player.weaponData.recoilMultiplier)
        } else {
          const actor = snapshotActor(event.actorId)
          const view = views.get(event.actorId)
          const muzzle = view?.rifleMuzzle?.getWorldPosition(new THREE.Vector3()) ?? (actor ? vector(actor) : null)
          if (muzzle) {
            effects.spawnMuzzleFlash(muzzle, direction)
            audio.botShot(muzzle, event.weaponId)
          }
        }
      } else if (event.type === 'reload_started' && event.actorId === player.id) {
        actions.play(actionDefs.reload, {
          empty: event.empty,
          reloadDuration: player.weaponData.reloadDuration,
          emptyReloadDuration: player.weaponData.emptyReloadDuration,
        })
      } else if (event.type === 'rpg_reload_started' && event.actorId === player.id) {
        actions.play(actionDefs.rpgReload)
      } else if (event.type === 'weapon_switch' && event.actorId === player.id) {
        const action = actions.get('weaponSwitch')
        if (!action || action.params.toSlot !== event.slot) {
          actions.play(actionDefs.weaponSwitch, { fromSlot: player.activeSlot, toSlot: event.slot })
        }
      } else if (event.type === 'melee' && event.actorId === player.id) {
        actions.play(actionDefs.melee)
        audio.stabSwing()
        player.viewRecoilPitch -= 0.008
        player.viewRecoilYaw *= 0.5
        player.viewRecoilRoll *= 0.4
        player.addShake(0.1)
      } else if (event.type === 'melee_hit' && event.actorId === player.id) {
        const point = vector(event.point)
        if (event.hit === 'actor') {
          audio.stabHitFlesh(point)
          effects.spawnBlood(point)
          player.viewRecoilPitch += 0.032
          player.weapon.kickZ += 0.036
          player.weapon.kickPitch += 0.022
        } else if (event.hit === 'obstacle') {
          audio.stabHitMetal(point)
          player.viewRecoilPitch += 0.02
          player.weapon.kickZ += 0.045
          player.weapon.kickPitch += 0.018
        }
      } else if (event.type === 'projectile_added') {
        const projectile = event.projectile
        const origin = vector(projectile)
        const velocity = new THREE.Vector3(projectile.vx, projectile.vy, projectile.vz)
        if (projectile.rocket) {
          const own = projectile.ownerId === player.id
          const muzzle = own ? player.weapon.muzzlePos.getWorldPosition(new THREE.Vector3()) : null
          projectiles.set(projectile.id, effects.spawnRocket(origin, velocity, CFG.secondaries[projectile.kind], muzzle))
          if (own) {
            audio.rpgShot()
            player.viewRecoilPitch += 0.05
            player.viewRecoilYaw += (Math.random() - 0.5) * 0.02
            player.viewRecoilRoll += (Math.random() - 0.5) * 0.03
            player.weapon.kickZ += 0.08
            player.weapon.kickY += 0.02
            player.weapon.setRpgRocketVisible(false)
            player.addShake(0.28)
            effects.spawnMuzzleFlash(muzzle, velocity.clone().normalize(), true)
            effects.spawnSmokePuff(muzzle)
          }
        } else if (projectile.sticky) {
          const charge = effects.spawnThrownC4(origin, velocity, CFG.secondaries[projectile.kind])
          projectiles.set(projectile.id, charge)
          if (projectile.ownerId === player.id) {
            player.viewRecoilPitch += 0.01
            player.weapon.kickZ += 0.03
          }
        } else {
          projectiles.set(projectile.id, effects.spawnThrownGrenade(origin, velocity, CFG.grenades[projectile.kind]))
        }
      } else if (event.type === 'projectile_removed') {
        const projectile = projectiles.get(event.projectileId)
        if (projectile) {
          effects.removeProjectile(projectile)
          projectiles.delete(event.projectileId)
        }
      } else if (event.type === 'explosion') {
        const projectile = projectiles.get(event.projectileId)
        if (projectile) {
          effects.removeProjectile(projectile)
          projectiles.delete(event.projectileId)
        }
        const position = new THREE.Vector3(event.x, event.y, event.z)
        effects.spawnExplosion(position, event.radius)
        audio.grenadeExplosion(position)
      } else if (event.type === 'smoke') {
        const projectile = projectiles.get(event.projectileId)
        if (projectile) {
          effects.removeProjectile(projectile)
          projectiles.delete(event.projectileId)
        }
        effects.spawnSmokeCloud(new THREE.Vector3(event.x, event.y, event.z), event.radius, event.duration)
        audio.smokeGrenade(new THREE.Vector3(event.x, event.y, event.z))
      } else if (event.type === 'damage') {
        if (event.attackerId === player.id) ui.showHitMarker()
        if (event.targetId === player.id) {
          audio.hitFlesh()
          ui.showDamage()
          player.viewRecoilPitch += CFG.player.damageRecoilPitchBase + event.amount * CFG.player.damageRecoilPitchScale
          player.viewRecoilYaw += (Math.random() - 0.5) * CFG.player.damageRecoilYaw
          player.viewRecoilRoll += (Math.random() - 0.5) * CFG.player.damageRecoilRoll
          const source = snapshotActor(event.attackerId)
          if (source) ui.showDirectionDamage({ x: source.x, y: source.y, z: source.z })
        }
      } else if (event.type === 'elimination') {
        const mine = event.attackerId === player.id
        if (event.attackerId) {
          ui.addFeed({
            type: mine ? 'player' : 'enemy',
            killer: actorName(event.attackerId),
            victim: actorName(event.victimId),
          }, CFG.hud.killFeedItemDuration)
        }
        if (mine) {
          const notice = getKillNotice(event.killStreak, event.headshot)
          ui.showKillNotice(notice.title, `已击杀 ${actorName(event.victimId)}`, CFG.hud.killNotifyCleanupDelay)
          audio.killConfirm(notice.kind)
        }
        if (event.victimId === player.id) {
          ui.showDeath(event.attackerId ? `被 ${actorName(event.attackerId)} 击杀` : '重新部署')
        }
        if (event.victimId === player.id) {
          player.alive = false
          player.health = 0
          player.killStreak = 0
          player.aiming = false
          player.sprinting = false
          player.crouching = false
          crouching = false
          activeSlot = 1
          actions.cancelAll()
          input.reset()
          player.weapon.resetActions()
          player.weapon.setVisible(false)
          player.addShake(CFG.player.deathShake)
          audio.pain(CFG.player.deathPainChance)
          audio.bodyFall()
          deploy.phase = 'death'
          deploy.deathTimer = CFG.player.deathTimer
          deathCameraStart = runtime.camera.position.clone()
          deathCameraTime = 0
        } else {
          const victim = snapshotActor(event.victimId)
          if (victim) {
            const position = vector(victim)
            if (victim.kind === 'zombie') {
              audio.zombieDeath(position)
            } else {
              audio.bodyFall(position)
            }
          }
        }
      } else if (event.type === 'deploy_available' && event.actorId === player.id) {
        ui.hideDeath()
        deployment.showScreen()
      } else if (event.type === 'item_used' && event.actorId === player.id) {
        ui.showAction(CFG.items[event.itemId].kind === 'heal' ? '已使用急救包' : '已补充携行弹药', CFG.hud.actionMessageDuration)
      } else if (event.type === 'resupplied' && event.actorId === player.id) {
        ui.showAction('补给完成', CFG.hud.actionMessageDuration)
      } else if (event.type === 'supply_result' && event.actorId === player.id) {
        const text = event.result === 'cooldown' ? `补给冷却中 ${event.remaining} 秒` : event.result === 'health_full' ? '生命值已满' : '补给已满'
        ui.showAction(text, CFG.hud.actionMessageDuration)
      } else if (event.type === 'zombie_attack') {
        const source = snapshotActor(event.actorId)
        const target = snapshotActor(event.targetId)
        if (source && target) audio.zombieAttack(vector(source), vector(target))
      } else if (event.type === 'zombie_groan') {
        audio.zombieGroan(vector(event.position))
      } else if (event.type === 'center_message') {
        ui.showCenter(event.text, event.duration ?? CFG.hud.centerMessageDuration, event.big)
      } else if (event.type === 'wave_started') {
        audio.zombieWave()
      } else if (event.type === 'fortress_hit') audio.fortressHit(state.objectives?.fortress?.position)
    }
  }

  function togglePause() {
    if (!active || deploy.phase !== 'none' || !session.canPause()) return
    state.paused = !state.paused
    if (state.paused) {
      predictionInput = {
        moveX: 0, moveZ: 0, yaw: player.yaw, pitch: player.pitch, jump: false,
        crouch: false, sprint: false, aim: false, fire: false, slot: player.activeSlot, actions: 0,
      }
      session.sendInput({ seq: ++inputSeq, ...predictionInput })
    }
    session.setPaused(state.paused)
    ui.setPaused(state.paused)
    audio.setAmbienceMuted(state.paused)
    if (state.paused) {
      input.reset()
      ui.setScoreboardVisible(false)
      if (document.pointerLockElement) document.exitPointerLock()
    } else if (!input.isTouchMode()) runtime.renderer.canvas.requestPointerLock().catch(console.error)
    input.updateTouchUi()
  }

  function sendInput() {
    if (!latest || !state.running || state.paused || deploy.phase !== 'none') return
    const look = input.consumeLookDelta()
    lookDelta.x += look.x
    lookDelta.y += look.y
    if (input.consumePressed('KeyC')) crouching = !crouching
    let requestedSlot = activeSlot
    if (input.consumePressed('Digit1')) requestedSlot = 1
    if (input.consumePressed('Digit2')) requestedSlot = 2
    if (input.consumePressed('WeaponNext') || input.consumePressed('WeaponPrev')) requestedSlot = activeSlot === 1 ? 2 : 1
    if (requestedSlot !== activeSlot && !actions.isActive('weaponSwitch')) {
      player.aiming = false
      actions.cancelAll()
      player.weapon.resetActions()
      actions.play(actionDefs.weaponSwitch, { fromSlot: player.activeSlot, toSlot: requestedSlot })
      activeSlot = requestedSlot
    }
    const move = input.getMoveAxis()
    const sprint = input.isKeyDown('ShiftLeft') || input.isKeyDown('ShiftRight') || input.isStickSprint()
    const aimHeld = input.isMouseDown('right')
    const canAim = player.activeSlot === 1 || player.secondaryData.kind === 'rpg'
    player.aiming = canAim && aimHeld && !actions.isBusy('hands')
    if (sprint && crouching && !player.aiming) crouching = false
    player.sprinting = sprint && !crouching && !player.aiming
    const sensitivity = CFG.player.lookSensitivity * state.settings.mouseSensitivity *
      (player.aiming ? CFG.player.aimingLookMultiplier : 1)
    player.yaw -= look.x * sensitivity
    player.yaw = Math.atan2(Math.sin(player.yaw), Math.cos(player.yaw))
    player.pitch = THREE.MathUtils.clamp(
      player.pitch - look.y * sensitivity,
      -Math.PI / 2 + CFG.player.pitchLimit,
      Math.PI / 2 - CFG.player.pitchLimit,
    )
    const jump = input.consumePressed('Space')
    const firePressed = input.consumePressed('MouseLeft')
    const actionsMask =
      (jump ? INPUT_ACTION.JUMP : 0) |
      (input.consumePressed('KeyR') ? INPUT_ACTION.RELOAD : 0) |
      (input.consumePressed('KeyF') ? INPUT_ACTION.MELEE : 0) |
      (input.consumePressed('KeyG') ? INPUT_ACTION.GRENADE : 0) |
      (input.consumePressed('KeyH') ? INPUT_ACTION.ITEM : 0) |
      (input.consumePressed('KeyE') ? INPUT_ACTION.SUPPLY : 0) |
      (input.consumePressed('MouseRight') ? INPUT_ACTION.SECONDARY : 0)
    predictionInput = {
      moveX: move.x, moveZ: move.z, yaw: player.yaw, pitch: player.pitch,
      jump, crouch: crouching, sprint: player.sprinting, aim: player.aiming,
      fire: input.isMouseDown('left') || firePressed, slot: activeSlot, actions: actionsMask,
    }
    session.sendInput({ seq: ++inputSeq, ...predictionInput })
  }

  function updateGameplay(updateDt, now) {
    ui.setScoreboardVisible(input.isKeyDown('Tab'))
    if (player.alive && player.networkReady) {
      const motion = stepPlayerMotion({
        x: player.position.x, y: player.position.y, z: player.position.z,
        vx: player.velocity.x, vy: player.velocity.y, vz: player.velocity.z,
        currentHeight: player.currentHeight, grounded: player.grounded, radius: CFG.player.radius,
      }, predictionInput, updateDt, CFG.player, {
        obstacles: state.obstacles, mapSize: state.mapSize,
        groundHeightAt: (x, z) => state.groundHeightAt(x, z),
      })
      player.position.set(motion.x, motion.y, motion.z)
      player.velocity.set(motion.vx, motion.vy, motion.vz)
      player.currentHeight = motion.currentHeight
      player.grounded = motion.grounded
      player.crouching = motion.crouching
      player.sprinting = motion.sprinting
      const snapshotAge = Math.min(0.15, (now - player.networkUpdatedAt + latency * 0.5) / 1000)
      const targetX = player.networkPosition.x + player.networkVelocity.x * snapshotAge
      const targetY = player.networkPosition.y + player.networkVelocity.y * snapshotAge
      const targetZ = player.networkPosition.z + player.networkVelocity.z * snapshotAge
      const errorSq = (targetX - player.position.x) ** 2 +
        (targetY - player.position.y) ** 2 + (targetZ - player.position.z) ** 2
      if (errorSq > 0.04) {
        const alpha = 1 - Math.exp(-6 * updateDt)
        player.position.x += (targetX - player.position.x) * alpha
        player.position.y += (targetY - player.position.y) * alpha
        player.position.z += (targetZ - player.position.z) * alpha
      }
    }
    if (deploy.phase === 'death') {
      deathCameraTime += updateDt
      const progress = Math.min(1, deathCameraTime / CFG.player.deathCameraDuration)
      runtime.camera.position.copy(deathCameraStart)
      runtime.camera.position.y -= progress * CFG.player.deathCameraDrop
      runtime.camera.rotation.z = progress * CFG.player.deathCameraRoll
      runtime.camera.rotation.x = progress * CFG.player.deathCameraPitch
    } else if (deploy.phase === 'to_deploy') {
      deployment.updateToScreen(updateDt)
    } else if (deploy.phase === 'deploy_screen') {
      deployment.updateScreenCamera()
    } else if (deploy.phase === 'deploying') {
      deployment.update(updateDt)
    } else if (player.alive) {
      const moveAxis = input.getMoveAxis()
      const moving = Math.hypot(moveAxis.x, moveAxis.z) > 0 && player.grounded
      let headBobY
      let bobPitch = 0
      let bobRoll = 0
      if (moving) {
        const previousPhase = bobPhase
        const rate = player.sprinting ? 12.5 : player.crouching ? 5.2 : 7.8
        const amplitude = player.sprinting ? 0.018 : player.crouching ? 0.006 : 0.011
        bobPhase += updateDt * rate
        headBobY = Math.sin(bobPhase) * amplitude
        bobPitch = Math.cos(bobPhase * 2) * (player.sprinting ? 0.0055 : 0.0032)
        bobRoll = Math.sin(bobPhase) * (player.sprinting ? 0.008 : 0.0045)
        if (Math.sign(Math.sin(previousPhase)) !== Math.sign(Math.sin(bobPhase))) audio.step()
      } else {
        bobPhase *= Math.exp(-8 * updateDt)
        headBobY = Math.sin(bobPhase) * 0.002
      }
      player.viewRecoilPitch *= Math.pow(CFG.weapon.viewRecoilPitchDecay, updateDt)
      player.viewRecoilYaw *= Math.pow(CFG.weapon.viewRecoilYawDecay, updateDt)
      player.viewRecoilRoll *= Math.pow(CFG.weapon.viewRecoilRollDecay, updateDt)
      const aimMultiplier = player.aiming ? 0.35 : 1
      const lookEase = 1 - Math.exp(-10 * updateDt)
      player.lookSwayPitch += (THREE.MathUtils.clamp(lookDelta.y * 0.00009 * aimMultiplier, -0.012, 0.012) - player.lookSwayPitch) * lookEase
      player.lookSwayYaw += (THREE.MathUtils.clamp(lookDelta.x * 0.00008 * aimMultiplier, -0.01, 0.01) - player.lookSwayYaw) * lookEase
      player.lookSwayRoll += (THREE.MathUtils.clamp(-lookDelta.x * 0.00014 * aimMultiplier, -0.02, 0.02) - player.lookSwayRoll) * lookEase
      const targetLean = THREE.MathUtils.clamp(moveAxis.x * (player.sprinting ? 0.02 : 0.014) * aimMultiplier, -0.025, 0.025)
      player.moveLean += (targetLean - player.moveLean) * (1 - Math.exp(-7 * updateDt))
      player.shakeTime += updateDt
      player.shakeTrauma = Math.max(0, player.shakeTrauma - updateDt * CFG.player.shakeRecovery)
      runtime.camera.position.copy(player.position)
      runtime.camera.position.y += headBobY
      runtime.camera.rotation.order = 'YXZ'
      let rotationX = player.pitch + player.viewRecoilPitch + bobPitch + player.lookSwayPitch
      let rotationY = player.yaw + player.viewRecoilYaw + player.lookSwayYaw
      let rotationZ = player.viewRecoilRoll + bobRoll + player.lookSwayRoll + player.moveLean
      if (player.shakeTrauma > 0.001) {
        const strength = player.shakeTrauma * player.shakeTrauma
        const time = player.shakeTime
        runtime.camera.position.x += (Math.sin(time * 41.3) * 0.55 + Math.sin(time * 73.1) * 0.45) * strength * 0.07
        runtime.camera.position.y += (Math.cos(time * 37.7) * 0.55 + Math.sin(time * 67.9) * 0.45) * strength * 0.065
        runtime.camera.position.z += Math.sin(time * 29.5) * strength * 0.03
        rotationX += (Math.sin(time * 47.2) * 0.6 + Math.cos(time * 61.8) * 0.4) * strength * 0.014
        rotationY += (Math.cos(time * 39.6) * 0.6 + Math.sin(time * 55.4) * 0.4) * strength * 0.012
        rotationZ += Math.sin(time * 51) * strength * 0.018
      }
      runtime.camera.rotation.set(rotationX, rotationY, rotationZ)
      const targetFov = player.aiming ? CFG.player.aimingFov : player.sprinting && moving ? CFG.player.sprintingFov : CFG.player.baseFov
      player.currentFov += (targetFov - player.currentFov) * (1 - Math.exp(-7 * updateDt))
      if (Math.abs(runtime.camera.fov - player.currentFov) > 0.15) {
        runtime.camera.fov = player.currentFov
        runtime.camera.updateProjectionMatrix()
      }
      runtime.sun.target.position.set(player.position.x, 0, player.position.z)
      runtime.sun.position.set(player.position.x + 90, 95, player.position.z + 55)
      runtime.sun.target.updateMatrixWorld()
    }
    for (const view of views.values()) {
      interpolateRemoteActor(view, updateDt, now)
      view.updateModelAnimation(updateDt)
    }
    const speed = Math.hypot(player.velocity.x, player.velocity.z)
    player.currentSpread = calculateWeaponSpread({
      baseSpread: player.weaponData.baseSpread, speed, aiming: player.aiming,
      crouching: player.crouching, sprinting: player.sprinting, grounded: player.grounded,
      reloading: player.reloading, bloom: player.spreadBloom,
    }, CFG.weapon)
    player.getSpread = () => player.currentSpread
    player.weapon.setVisible(player.alive && deploy.phase === 'none')
    for (const event of actions.update(updateDt)) {
      if (event.type !== 'marker') continue
      if (event.action === 'melee' && event.name === 'prep') {
        player.viewRecoilPitch += 0.03
        player.viewRecoilRoll *= 0.3
        player.addShake(0.22)
      } else if (event.action === 'rpgReload' && event.name === 'insert') {
        audio.reloadStage('insert')
        player.weapon.setRpgRocketVisible(true)
      }
    }
    const moveAxis = input.getMoveAxis()
    player.weapon.update(updateDt, Math.hypot(moveAxis.x, moveAxis.z) > 0, player.sprinting, player.aiming, lookDelta, bobPhase, moveAxis, {
      bolt: actions.get('bolt'), reload: actions.get('reload'), melee: actions.get('melee'),
      weaponSwitch: actions.get('weaponSwitch'), rpgReload: actions.get('rpgReload'),
    })
    actions.flush()
    effects.update(updateDt)
    lookDelta.x = 0
    lookDelta.y = 0
  }

  function frame(now) {
    frameAccumulator += Math.min(CFG.match.maxFrameDelta, (now - lastFrameAt) / 1000)
    lastFrameAt = now
    if (frameAccumulator < frameStep) return
    while (frameAccumulator >= frameStep) {
      if (runtime && active) {
        sendInput()
        if (state.running && !state.paused) updateGameplay(frameStep, now)
      }
      frameAccumulator -= frameStep
    }
    if (runtime) {
      audio.updateListener()
      runtime.renderer.render(runtime.scene, runtime.camera)
    }
    ui.render(now)
  }

  function animate() {
    const loop = now => {
      requestAnimationFrame(loop)
      frame(now)
    }
    requestAnimationFrame(loop)
  }

  function selectLoadout(kind, id) {
    if (deploy.phase !== 'deploy_screen') return
    state.settings.loadout[kind] = id
    player.applyLoadout(state.settings.loadout)
    saveSettings(state.settings)
    deployment.updateScreenCamera()
  }

  function applySetting(setting, value) {
    if (setting === 'volume') {
      state.settings.masterVolume = value / 100
      audio.setMasterVolume(state.settings.masterVolume)
    } else {
      state.settings.mouseSensitivity = value / 100
    }
    saveSettings(state.settings)
    ui.invalidate()
  }

  function redeploy() {
    if (!state.paused || deploy.phase !== 'none' || !player.alive) return
    state.paused = false
    session.setPaused(false)
    ui.setPaused(false)
    audio.setAmbienceMuted(false)
    input.reset()
    ui.setScoreboardVisible(false)
    if (document.pointerLockElement) document.exitPointerLock()
    session.send({ type: 'redeploy' })
  }

  function end(snapshot) {
    applySnapshot(snapshot)
    state.running = false
    const won = snapshot.outcome?.winner === player.team
    if (document.pointerLockElement) document.exitPointerLock()
    const hud = modeHud()
    const stats = [
      `${hud.alliesLabel}: ${hud.alliesScore}    ${hud.axisLabel}: ${hud.axisScore}`,
      `结算: ${snapshot.outcome?.reason || '战斗结束'}`,
      ...(snapshot.outcome?.details || []),
      `个人击杀: ${player.kills}    阵亡: ${player.deaths}`,
      `本局 K/D: ${(player.kills / Math.max(1, player.deaths)).toFixed(2)}    爆头: ${player.headshots}`,
      `近战击杀: ${player.meleeKills}    投掷物击杀: ${player.grenadeKills}`,
      `战斗时长: ${Math.floor(snapshot.timeMs / 1000)} 秒`,
    ]
    stats.push(...session.resultStats({ modeId: snapshot.modeId }))
    ui.showEnd({ won, title: snapshot.outcome?.title || (won ? '胜利' : '战败'), stats })
  }

  function leave() {
    session.send({ type: 'leave_room' })
    location.reload()
  }

  async function preparePresentation() {
    if (!input?.isTouchMode()) return
    await input.enableGyro()
    const root = document.documentElement
    if (!document.fullscreenElement && root.requestFullscreen) {
      await root.requestFullscreen({ navigationUI: 'hide' })
    }
    if (screen.orientation?.lock) await screen.orientation.lock('landscape')
  }

  return {
    get active() { return active }, boot, snapshot: applySnapshot, events: handleEvents, animate, end,
    setLatency(value) { latency = value }, togglePause, leave, selectLoadout, applySetting, redeploy,
    preparePresentation,
    deploy(index) { deployment.startAnimation(index) },
  }
}
