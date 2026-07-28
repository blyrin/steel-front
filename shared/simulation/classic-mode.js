export function createClassicMode({ state, config, spawnPoints }) {
  const modeConfig = config.modes.classic
  let outcome = null

  function getRandomSpawn(team) {
    const points = spawnPoints[team]
    const spawn = points[Math.floor(Math.random() * points.length)]
    return {
      x: spawn.x + (Math.random() - 0.5) * modeConfig.spawnScatter,
      y: 0,
      z: spawn.z + (Math.random() - 0.5) * modeConfig.spawnScatter,
    }
  }

  function getHostileActors(team) {
    const targets = state.actors.filter(actor => actor.alive && actor.team !== team)
    if (state.player?.alive && state.player.team !== team) targets.push(state.player)
    return targets
  }

  function setupMatch() {
    state.match.modeId = 'classic'
    state.match.score.allies = 0
    state.match.score.axis = 0
    state.modeState = {
      kind: 'classic',
      phase: 'active',
    }
    state.spawnQueue.push({ kind: 'player' })
    for (let i = 0; i < modeConfig.teamSize - 1; i++)
      state.spawnQueue.push({ kind: 'soldier', team: 'allies', position: getRandomSpawn('allies') })
    for (let i = 0; i < modeConfig.teamSize; i++)
      state.spawnQueue.push({ kind: 'soldier', team: 'axis', position: getRandomSpawn('axis') })
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
