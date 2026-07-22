import * as THREE from 'three'
import { Bot } from '../entities/bot.js'
import { Player } from '../entities/player.js'
import { Zombie } from '../entities/zombie.js'

export function createZombieMode({ state, deploy, config, spawnPoints, services }) {
  const modeConfig = config.modes.zombie
  let outcome = null
  let fortress = null
  let zombies = []
  let spawnTimer = 0
  let waveSpawnPoints = []

  function selectWaveSpawnPoints() {
    const shuffled = spawnPoints.axis.slice()
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const swap = shuffled[i]
      shuffled[i] = shuffled[j]
      shuffled[j] = swap
    }
    waveSpawnPoints = shuffled.slice(0, Math.ceil(shuffled.length / 3))
  }

  function getRandomSpawn(team) {
    const points = spawnPoints[team]
    const spawn = points[Math.floor(Math.random() * points.length)]
    return new THREE.Vector3(
      spawn.x + (Math.random() - 0.5) * modeConfig.spawnScatter,
      0,
      spawn.z + (Math.random() - 0.5) * modeConfig.spawnScatter
    )
  }

  function getRandomZombieSpawn() {
    const spawn = waveSpawnPoints[Math.floor(Math.random() * waveSpawnPoints.length)]
    return new THREE.Vector3(
      spawn.x + (Math.random() - 0.5) * modeConfig.spawnScatter,
      0,
      spawn.z + (Math.random() - 0.5) * modeConfig.spawnScatter
    )
  }

  function getHostileActors(team) {
    const targets = state.actors.filter(actor => actor.alive && actor.team !== team)
    if (state.player?.alive && state.player.team !== team) targets.push(state.player)
    return targets
  }

  function getPatrolPoint() {
    const angle = Math.random() * Math.PI * 2
    const radius = 8 + Math.random() * (modeConfig.guardRadius - 8)
    return new THREE.Vector3(
      fortress.position.x + Math.cos(angle) * radius,
      0,
      fortress.position.z + Math.sin(angle) * radius
    )
  }

  function createBotServices() {
    return {
      scene: services.scene,
      camera: services.camera,
      matLib: services.matLib,
      audio: services.audio,
      gameState: state,
      config,
      hud: services.hud,
      effects: services.effects,
      combat: services.combat,
      scoring: services.scoring,
      mode,
      getRandomSpawn,
    }
  }

  function setupMatch() {
    services.audio.setAmbience('zombie_ambience')
    state.match.modeId = 'zombie'
    state.match.score.allies = 0
    state.match.score.axis = 0
    state.modeState = {
      kind: 'zombie',
      phase: 'waiting_for_deploy',
      wave: 0,
      waveTotal: 0,
      waveSpawned: 0,
      waveDefeated: 0,
      nextWaveAt: 0,
    }
    fortress = state.objectives.fortress
    state.player = new Player({
      camera: services.camera,
      sun: services.sun,
      matLib: services.matLib,
      audio: services.audio,
      state,
      deploy,
      input: services.input,
      config,
      hud: services.hud,
      effects: services.effects,
      combat: services.combat,
      scoring: services.scoring,
      deployment: services.deployment,
      mode,
    })
    const botServices = createBotServices()
    for (let i = 0; i < modeConfig.alliedBotCount; i++)
      state.actors.push(new Bot('allies', getRandomSpawn('allies'), botServices))
  }

  function startIntermission(now) {
    state.modeState.phase = 'intermission'
    state.modeState.nextWaveAt = now + modeConfig.waveIntermission * 1000
    services.hud.showCenterMessage(`第 ${state.modeState.wave + 1} 波即将来袭`, 1800)
  }

  function startWave() {
    const data = state.modeState
    data.wave++
    data.waveTotal = modeConfig.waveStartCount + (data.wave - 1) * modeConfig.waveIncrement
    data.waveSpawned = 0
    data.waveDefeated = 0
    data.phase = 'assault'
    selectWaveSpawnPoints()
    services.audio.zombieWave()
    spawnTimer = modeConfig.waveSpawnInterval
    services.hud.showCenterMessage(`第 ${data.wave} 波`, 1400, '丧尸来袭')
  }

  function spawnZombie() {
    const zombie = new Zombie(getRandomZombieSpawn(), {
      scene: services.scene,
      camera: services.camera,
      matLib: services.matLib,
      audio: services.audio,
      gameState: state,
      config,
      effects: services.effects,
      scoring: services.scoring,
      mode,
      enemyConfig: modeConfig.enemy,
    })
    state.actors.push(zombie)
    zombies.push(zombie)
    services.audio.zombieGroan(zombie.position)
    state.modeState.waveSpawned++
  }

  function getActiveZombies() {
    return zombies.filter(zombie => zombie.alive).length
  }

  function cleanupZombies() {
    for (let i = zombies.length - 1; i >= 0; i--) {
      const zombie = zombies[i]
      if (zombie.alive || zombie.deathTime < 0.7) continue
      zombie.destroy()
      const actorIndex = state.actors.indexOf(zombie)
      if (actorIndex >= 0) state.actors.splice(actorIndex, 1)
      zombies.splice(i, 1)
    }
  }

  function damageFortress(amount) {
    if (outcome || fortress.health <= 0) return
    services.audio.fortressHit(fortress.position)
    fortress.health = Math.max(0, fortress.health - amount)
    if (fortress.health <= 0) {
      state.modeState.phase = 'defeat'
      outcome = {
        playerWon: false,
        reason: '堡垒已被摧毁',
        title: '防线失守',
        details: [`最高波次: ${state.modeState.wave}`, '堡垒被摧毁'],
      }
    }
  }

  function update(dt) {
    if (outcome) return
    cleanupZombies()
    const data = state.modeState
    const now = performance.now()
    if (data.phase === 'waiting_for_deploy') {
      if (deploy.phase !== 'none' || !state.player.alive) return
      startIntermission(now)
      return
    }
    if (data.phase === 'intermission') {
      if (now >= data.nextWaveAt) startWave()
      return
    }
    if (data.phase !== 'assault') return
    if (data.waveSpawned < data.waveTotal && getActiveZombies() < modeConfig.maxConcurrent) {
      spawnTimer += dt
      if (spawnTimer >= modeConfig.waveSpawnInterval) {
        spawnTimer = 0
        spawnZombie()
      }
    }
    if (data.waveSpawned >= data.waveTotal && getActiveZombies() === 0) startIntermission(now)
  }

  function onElimination({ victim, attacker }) {
    let scoringTeam
    if (attacker) scoringTeam = attacker.team
    else if (victim.team === 'allies') scoringTeam = 'axis'
    else scoringTeam = 'allies'
    state.match.score[scoringTeam]++
    if (victim.actorKind === 'zombie') state.modeState.waveDefeated++
  }

  const mode = {
    id: 'zombie',
    name: '丧尸模式',
    buildMap() {
      services.map.buildMap()
    },
    setupMatch,
    update,
    onElimination,
    getOutcome() {
      return outcome
    },
    getSpawnPoints(team) {
      return spawnPoints[team]
    },
    getRandomSpawn,
    getHostileActors,
    getPatrolPoint,
    getFortress() {
      return fortress
    },
    damageFortress,
    getBotRespawnDelay() {
      return modeConfig.alliedRespawnTime
    },
    canRespawn(actor) {
      return !outcome && actor.team === 'allies'
    },
    getHudState() {
      const data = state.modeState
      let phaseText = '等待部署'
      if (data.phase === 'intermission') {
        phaseText = `下一波 ${Math.max(0, Math.ceil((data.nextWaveAt - performance.now()) / 1000))} 秒`
      } else if (data.phase === 'assault') {
        phaseText = `${data.waveDefeated} / ${data.waveTotal}`
      }
      return {
        kind: 'zombie',
        alliesLabel: '守军击杀',
        axisLabel: '堡垒',
        alliesScore: state.match.score.allies,
        axisScore: Math.ceil(fortress.health),
        targetText: `第 ${data.wave} 波 · ${phaseText}`,
      }
    },
    getScoreboardData() {
      return {
        kind: 'zombie',
        alliesLabel: '守军',
        axisLabel: '防线',
        objectiveText: `堡垒 ${Math.ceil(fortress.health)} / ${fortress.maxHealth}`,
      }
    },
  }

  return mode
}
