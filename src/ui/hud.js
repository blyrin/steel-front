const MULTI_TITLES = [
  '',
  '',
  '双杀',
  '三杀',
  '四杀',
  '五杀',
  '势不可挡',
  '无人能挡',
]

export function createHud({ dom, state, deploy, audio, config }) {
  const hudConfig = config.hud
  let healthWidth = ''
  let healthText = ''
  let healthLow = null
  let ammoCurrent = null
  let ammoReserve = null
  let lowAmmoVisible = null
  let crosshairAiming = null
  let crosshairGap = ''
  let crosshairSize = ''
  let crosshairLengthSet = false
  let scoreboardVisible = false
  let scoreboardAlliesScore = null
  let scoreboardAxisScore = null
  let scoreboardPlayerKills = null
  let scoreboardPlayerDeaths = null
  let scoreboardPlayerAlive = null
  const scoreboardBotStats = []

  function updateHealth() {
    const player = state.player
    const width = `${(player.health / player.maxHealth) * 100}%`
    const text = `${Math.ceil(player.health)} / ${player.maxHealth}`
    const low = player.health < hudConfig.lowHealthThreshold
    if (width !== healthWidth) {
      healthWidth = width
      dom.healthFill.style.width = width
    }
    if (text !== healthText) {
      healthText = text
      dom.healthText.textContent = text
    }
    if (low !== healthLow) {
      healthLow = low
      dom.healthFill.classList.toggle('low', low)
    }
  }

  function updateAmmo() {
    const player = state.player
    const lowAmmoVisibleNow = player.ammo <= hudConfig.lowAmmoThreshold && !player.reloading
    if (player.ammo !== ammoCurrent) {
      ammoCurrent = player.ammo
      dom.ammoCur.textContent = player.ammo
    }
    if (player.reserveAmmo !== ammoReserve) {
      ammoReserve = player.reserveAmmo
      dom.ammoRes.textContent = player.reserveAmmo
    }
    if (lowAmmoVisibleNow !== lowAmmoVisible) {
      lowAmmoVisible = lowAmmoVisibleNow
      dom.lowAmmo.classList.toggle('show', lowAmmoVisibleNow)
    }
  }

  function updateCrosshair() {
    if (!state.player || deploy.phase !== 'none') return
    const aiming = !!state.player.aiming
    if (aiming !== crosshairAiming) {
      crosshairAiming = aiming
      dom.crosshair.classList.toggle('aiming', aiming)
    }
    if (aiming) return
    const spread = state.player.currentSpread || state.player.getSpread()
    const gapValue = hudConfig.crosshairBaseGap + spread * hudConfig.crosshairSpreadScale
    const gap = `${gapValue.toFixed(1)}px`
    const size = `${(
      hudConfig.crosshairBaseSize + 2 * gapValue
    ).toFixed(1)}px`
    if (gap !== crosshairGap) {
      crosshairGap = gap
      dom.crosshair.style.setProperty('--ch-gap', gap)
    }
    if (size !== crosshairSize) {
      crosshairSize = size
      dom.crosshair.style.setProperty('--ch-size', size)
    }
    if (!crosshairLengthSet) {
      crosshairLengthSet = true
      dom.crosshair.style.setProperty('--ch-len', `${hudConfig.crosshairLength}px`)
    }
  }

  function updateScores() {
    dom.alliesScore.textContent = state.alliesScore
    dom.axisScore.textContent = state.axisScore
  }

  function addScreenShake(amount) {
    state.player?.addShake(amount)
  }

  function showHitMarker() {
    dom.hitMarker.classList.remove('show')
    void dom.hitMarker.offsetWidth
    dom.hitMarker.classList.add('show')
    addScreenShake(hudConfig.hitMarkerShake)
  }

  function showKillNotify(victimName, headshot) {
    const player = state.player
    if (!player) return
    const now = performance.now()
    if (now - (player.lastKillAt || 0) < hudConfig.killStreakWindow) player.killStreak = (player.killStreak || 0) + 1
    else player.killStreak = 1
    player.lastKillAt = now
    const streak = player.killStreak
    dom.killNotify.classList.remove('show', 'out', 'headshot', 'multi')
    void dom.killNotify.offsetWidth
    let kind = 'normal'
    let titleText = headshot ? '爆头' : '击倒敌人'
    if (streak >= 2) {
      titleText = MULTI_TITLES[Math.min(streak, MULTI_TITLES.length - 1)] || `${streak} 连杀`
      kind = 'multi'
      dom.killNotify.classList.add('multi')
    }
    if (headshot) {
      dom.killNotify.classList.add('headshot')
      if (streak < 2) kind = 'head'
      else titleText = `爆头 · ${titleText}`
    }
    dom.killTitle.textContent = titleText
    dom.killSub.textContent = `已击杀 ${victimName || '敌人'}`
    dom.killStreak.textContent = streak > 1 ? `${streak} 连杀` : ''
    dom.killNotify.classList.add('show')
    audio.killConfirm(kind)
    addScreenShake(
      headshot
        ? hudConfig.hitKillShake
        : streak >= 2
          ? hudConfig.multiKillShake
          : hudConfig.normalKillShake
    )
    clearTimeout(dom.killNotify._timer)
    clearTimeout(dom.killNotify._outTimer)
    dom.killNotify._outTimer = setTimeout(() => {
      dom.killNotify.classList.remove('show')
      dom.killNotify.classList.add('out')
    }, hudConfig.killNotifyOutDelay)
    dom.killNotify._timer = setTimeout(() => {
      dom.killNotify.classList.remove('out', 'headshot', 'multi')
    }, hudConfig.killNotifyCleanupDelay)
  }

  function showDamageVignette() {
    dom.damageVignette.classList.add('hit')
    setTimeout(
      () => dom.damageVignette.classList.remove('hit'),
      hudConfig.damageVignetteDuration
    )
  }

  function showDirDamage(angle) {
    dom.dirDamage.style.transform = `translate(-50%,-50%) rotate(${angle}rad)`
    dom.dirDamage.classList.add('show')
    setTimeout(
      () => dom.dirDamage.classList.remove('show'),
      hudConfig.directionDamageDuration
    )
  }

  function showCenterMessage(message, duration = hudConfig.centerMessageDuration, big = '') {
    dom.centerMsg.replaceChildren()
    if (big) {
      const bigText = document.createElement('span')
      bigText.className = 'big'
      bigText.textContent = big
      dom.centerMsg.appendChild(bigText)
    }
    dom.centerMsg.append(message)
    dom.centerMsg.classList.add('show')
    clearTimeout(dom.centerMsg._timer)
    dom.centerMsg._timer = setTimeout(() => dom.centerMsg.classList.remove('show'), duration)
  }

  function showDeathScreen(attacker) {
    dom.killerInfo.replaceChildren()
    if (attacker) {
      dom.killerInfo.append('被 ')
      const name = document.createElement('span')
      name.className = 'kname'
      name.textContent = attacker.name || '敌方士兵'
      dom.killerInfo.append(name, ' 击杀')
    } else {
      dom.killerInfo.textContent = '阵亡'
    }
    dom.deathScreen.classList.add('show')
    dom.crosshair.classList.add('hidden')
  }

  function hideDeathScreen() {
    dom.deathScreen.classList.remove('show')
  }

  function addKillFeed(type, killerName, victimName, victimTeam) {
    const item = document.createElement('div')
    item.className = `kill-msg${type === 'player' ? ' player' : ''}`
    const killer = document.createElement('span')
    killer.className = type === 'player' ? 'me' : type === 'ally' ? 'ally' : 'enemy'
    killer.textContent = killerName
    const weapon = document.createElement('span')
    weapon.style.color = '#6a5a40'
    weapon.style.margin = '0 4px'
    weapon.textContent = '⚔'
    const victim = document.createElement('span')
    victim.className = victimTeam === 'allies' ? 'ally' : 'enemy'
    victim.textContent = victimName
    item.append(killer, weapon, victim)
    dom.killFeed.insertBefore(item, dom.killFeed.firstChild)
    setTimeout(() => item.remove(), hudConfig.killFeedItemDuration)
    while (dom.killFeed.children.length > hudConfig.killFeedMaxItems)
      dom.killFeed.lastChild.remove()
  }

  function showEndScreen(playerWon) {
    state.running = false
    if (document.pointerLockElement) document.exitPointerLock()
    dom.deployScreen.classList.remove('show')
    dom.deathScreen.classList.remove('show')
    if (dom.touchControls) dom.touchControls.classList.remove('show')
    if (dom.rotateHint) dom.rotateHint.classList.remove('show')
    setScoreboardVisible(false)
    dom.endTitle.textContent = playerWon ? '胜利' : '战败'
    dom.endTitle.className = playerWon ? 'win' : 'lose'
    const stats = [
      `我方击杀: ${state.alliesScore}　敌方击杀: ${state.axisScore}`,
      `个人击杀: ${state.player.kills}　阵亡次数: ${state.player.deaths}`,
      `击杀/死亡比: ${(state.player.kills / Math.max(1, state.player.deaths)).toFixed(2)}`,
      `战斗时长: ${Math.floor((performance.now() - state.startTime) / 1000)} 秒`,
    ]
    dom.endStats.replaceChildren(
      ...stats.map(text => {
        const row = document.createElement('div')
        row.textContent = text
        return row
      })
    )
    dom.endScreen.classList.add('show')
  }

  function compareEntries(a, b) {
    if (b.kills !== a.kills) return b.kills - a.kills
    return a.deaths - b.deaths
  }

  function renderRows(container, entries) {
    container.replaceChildren(
      ...entries.map((entry, index) => {
        const row = document.createElement('div')
        row.className = `sb-row${entry.isPlayer ? ' me' : ''}${entry.alive ? '' : ' dead'}`
        const rank = document.createElement('span')
        rank.className = 'sb-rank'
        rank.textContent = String(index + 1)
        const name = document.createElement('span')
        name.className = 'sb-name'
        name.textContent = entry.name
        const kills = document.createElement('span')
        kills.className = 'sb-stat'
        kills.textContent = String(entry.kills)
        const deaths = document.createElement('span')
        deaths.className = 'sb-stat'
        deaths.textContent = String(entry.deaths)
        row.append(rank, name, kills, deaths)
        return row
      })
    )
  }

  function updateScoreboard() {
    if (!state.player) return
    let changed =
      state.alliesScore !== scoreboardAlliesScore ||
      state.axisScore !== scoreboardAxisScore ||
      state.player.kills !== scoreboardPlayerKills ||
      state.player.deaths !== scoreboardPlayerDeaths ||
      state.player.alive !== scoreboardPlayerAlive ||
      scoreboardBotStats.length !== state.bots.length * 3
    for (let i = 0; i < state.bots.length && !changed; i++) {
      const bot = state.bots[i]
      const offset = i * 3
      changed =
        bot.kills !== scoreboardBotStats[offset] ||
        bot.deaths !== scoreboardBotStats[offset + 1] ||
        bot.alive !== scoreboardBotStats[offset + 2]
    }
    if (!changed) return
    scoreboardAlliesScore = state.alliesScore
    scoreboardAxisScore = state.axisScore
    scoreboardPlayerKills = state.player.kills
    scoreboardPlayerDeaths = state.player.deaths
    scoreboardPlayerAlive = state.player.alive
    scoreboardBotStats.length = state.bots.length * 3
    for (let i = 0; i < state.bots.length; i++) {
      const bot = state.bots[i]
      const offset = i * 3
      scoreboardBotStats[offset] = bot.kills
      scoreboardBotStats[offset + 1] = bot.deaths
      scoreboardBotStats[offset + 2] = bot.alive
    }
    const allies = [
      {
        name: '你',
        kills: state.player.kills,
        deaths: state.player.deaths,
        alive: state.player.alive,
        isPlayer: true,
      },
    ]
    const axis = []
    for (const bot of state.bots) {
      const entry = {
        name: bot.name,
        kills: bot.kills,
        deaths: bot.deaths,
        alive: bot.alive,
        isPlayer: false,
      }
      if (bot.team === 'allies') allies.push(entry)
      else axis.push(entry)
    }
    allies.sort(compareEntries)
    axis.sort(compareEntries)
    dom.sbAlliesScore.textContent = state.alliesScore
    dom.sbAxisScore.textContent = state.axisScore
    renderRows(dom.sbAlliesRows, allies)
    renderRows(dom.sbAxisRows, axis)
  }

  function setScoreboardVisible(visible) {
    if (visible) updateScoreboard()
    if (visible === scoreboardVisible) return
    scoreboardVisible = visible
    dom.scoreboard.classList.toggle('show', visible)
  }

  return {
    updateHealth,
    updateAmmo,
    updateCrosshair,
    updateScores,
    addScreenShake,
    showHitMarker,
    showKillNotify,
    showDamageVignette,
    showDirDamage,
    showCenterMessage,
    showDeathScreen,
    hideDeathScreen,
    addKillFeed,
    showEndScreen,
    setScoreboardVisible,
  }
}
