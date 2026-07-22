import * as THREE from 'three'
import { Bot } from '../entities/bot.js'
import { Player } from '../entities/player.js'

export function createClassicMode({ state, deploy, config, spawnPoints, services }) {
  const modeConfig = config.modes.classic
  let outcome = null

  function getRandomSpawn(team) {
    const points = spawnPoints[team]
    const spawn = points[Math.floor(Math.random() * points.length)]
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
    const half = config.match.mapSize * config.bot.patrolAreaRatio
    return new THREE.Vector3(
      (Math.random() - 0.5) * half * 2,
      0,
      (Math.random() - 0.5) * half * 2
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
    state.match.modeId = 'classic'
    state.match.score.allies = 0
    state.match.score.axis = 0
    state.modeState = {
      kind: 'classic',
      phase: 'active',
    }
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
    for (let i = 0; i < modeConfig.teamSize - 1; i++) {
      state.actors.push(new Bot('allies', getRandomSpawn('allies'), botServices))
    }
    for (let i = 0; i < modeConfig.teamSize; i++) {
      state.actors.push(new Bot('axis', getRandomSpawn('axis'), botServices))
    }
  }

  function onElimination({ victim, attacker }) {
    let scoringTeam
    if (attacker) scoringTeam = attacker.team
    else if (victim.team === 'allies') scoringTeam = 'axis'
    else scoringTeam = 'allies'
    state.match.score[scoringTeam]++
    if (state.match.score.allies >= modeConfig.killTarget) {
      outcome = { playerWon: true, reason: '盟军达到击杀目标' }
    } else if (state.match.score.axis >= modeConfig.killTarget) {
      outcome = { playerWon: false, reason: '轴心达到击杀目标' }
    }
  }

  function canRespawn() {
    return !outcome && state.match.score.allies < modeConfig.killTarget && state.match.score.axis < modeConfig.killTarget
  }

  const mode = {
    id: 'classic',
    name: '经典对战',
    buildMap() {
      services.map.buildMap()
    },
    setupMatch,
    update() {},
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
    getBotRespawnDelay() {
      return modeConfig.respawnTime
    },
    canRespawn,
    getHudState() {
      return {
        kind: 'classic',
        alliesLabel: '盟军',
        axisLabel: '轴心',
        alliesScore: state.match.score.allies,
        axisScore: state.match.score.axis,
        targetText: `达到 ${modeConfig.killTarget} 杀`,
      }
    },
    getScoreboardData() {
      return {
        kind: 'classic',
        alliesLabel: '盟军',
        axisLabel: '轴心',
      }
    },
  }

  return mode
}
