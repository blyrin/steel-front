export function createZombieMode({ state, deploy, config, spawnPoints }) {
  const modeConfig = config.modes.zombie
  let outcome = null
  let fortress = null
  let spawnTimer = 0

  function emit(type, data = {}) {
    state.events.push({ type, ...data })
  }

  function getRandomSpawn(team) {
    const points = spawnPoints[team]
    const spawn = points[Math.floor(Math.random() * points.length)]
    return {
      x: spawn.x + (Math.random() - 0.5) * modeConfig.spawnScatter,
      y: 0,
      z: spawn.z + (Math.random() - 0.5) * modeConfig.spawnScatter,
    }
  }

  function getRandomZombieSpawnCenter() {
    const halfMap = state.mapSize / 2 - 2
    let x
    let z
    do {
      x = (Math.random() * 2 - 1) * halfMap
      z = (Math.random() * 2 - 1) * halfMap
    } while (Math.hypot(x, z) <= modeConfig.guardRadius)
    return { x, z, halfMap }
  }

  // 距离堡垒越远，单次刷新的群体越大；近处倾向单体，远处倾向一群。
  function getPackSize(distance, halfMap) {
    const span = halfMap - modeConfig.guardRadius
    const t = Math.min(1, Math.max(0, (distance - modeConfig.guardRadius) / span))
    const expected = 1 + t * t * (modeConfig.wavePackMax - 1)
    const roll = expected * (0.7 + Math.random() * 0.6)
    return Math.max(1, Math.min(modeConfig.wavePackMax, Math.round(roll)))
  }

  function getHostileActors(team) {
    const targets = state.actors.filter(actor => actor.alive && actor.team !== team)
    if (state.player?.alive && state.player.team !== team) targets.push(state.player)
    return targets
  }

  function setupMatch() {
    emit('set-ambience', { id: 'zombie_ambience' })
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
    state.spawnQueue.push({ kind: 'player' })
    for (let i = 0; i < modeConfig.alliedBotCount; i++)
      state.spawnQueue.push({ kind: 'soldier', team: 'allies', position: getRandomSpawn('allies') })
  }

  function startIntermission(now) {
    state.modeState.phase = 'intermission'
    state.modeState.nextWaveAt = now + modeConfig.waveIntermission * 1000
    emit('center-message', { text: `第 ${state.modeState.wave + 1} 波即将来袭`, duration: 1800 })
  }

  function startWave() {
    const data = state.modeState
    data.wave++
    data.waveTotal = modeConfig.waveStartCount + (data.wave - 1) * modeConfig.waveIncrement
    data.waveSpawned = 0
    data.waveDefeated = 0
    data.phase = 'assault'
    emit('zombie-wave')
    spawnTimer = modeConfig.waveSpawnInterval
    emit('center-message', { text: `第 ${data.wave} 波`, duration: 1400, big: '丧尸来袭' })
  }

  function spawnOneZombie(position) {
    state.spawnQueue.push({ kind: 'zombie', position })
    emit('zombie-groan', {
      position,
    })
    state.modeState.waveSpawned++
  }

  function spawnZombiePack() {
    const data = state.modeState
    const remaining = data.waveTotal - data.waveSpawned
    const room = modeConfig.maxConcurrent - getActiveZombies()
    if (remaining <= 0 || room <= 0) return

    const center = getRandomZombieSpawnCenter()
    const distance = Math.hypot(center.x, center.z)
    const packSize = Math.min(getPackSize(distance, center.halfMap), remaining, room)
    const scatter = modeConfig.wavePackScatter

    for (let i = 0; i < packSize; i++) {
      const angle = Math.random() * Math.PI * 2
      const radius = packSize === 1 ? 0 : Math.random() * scatter
      const position = {
        x: center.x + Math.cos(angle) * radius,
        y: 0,
        z: center.z + Math.sin(angle) * radius,
      }
      spawnOneZombie(position)
    }
  }

  function getActiveZombies() {
    return state.actors.filter(actor => actor.actorKind === 'zombie' && actor.alive).length
  }

  function cleanupZombies() {
    for (let i = state.actors.length - 1; i >= 0; i--) {
      const zombie = state.actors[i]
      if (zombie.actorKind !== 'zombie') continue
      if (zombie.alive || zombie.deathTime < 0.7) continue
      state.removeQueue.push(zombie.id)
      emit('remove-actor', { actorId: zombie.id })
      state.actors.splice(i, 1)
    }
  }

  function damageFortress(amount) {
    if (outcome || fortress.health <= 0) return
    emit('fortress-hit', { position: fortress.position })
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
    const now = state.simulationTimeMs
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
        spawnZombiePack()
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
        phaseText = `下一波 ${Math.max(0, Math.ceil((data.nextWaveAt - state.simulationTimeMs) / 1000))} 秒`
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
