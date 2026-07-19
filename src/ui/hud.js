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

export function createHud({ dom, state, deploy, audio }) {
  function updateHealth() {
    const player = state.player
    dom.healthFill.style.width = `${(player.health / player.maxHealth) * 100}%`
    dom.healthText.textContent = `${Math.ceil(player.health)} / ${player.maxHealth}`
    dom.healthFill.classList.toggle('low', player.health < 30)
  }

  function updateAmmo() {
    const player = state.player
    dom.ammoCur.textContent = player.ammo
    dom.ammoRes.textContent = player.reserveAmmo
    dom.lowAmmo.classList.toggle('show', player.ammo <= 2 && !player.reloading)
  }

  function updateCrosshair() {
    if (!state.player || deploy.phase !== 'none') return
    const aiming = !!state.player.aiming
    dom.crosshair.classList.toggle('aiming', aiming)
    if (aiming) return
    const spread = state.player.currentSpread || state.player.getSpread()
    const gap = 4 + spread * 520
    const size = 22 + gap * 2
    dom.crosshair.style.setProperty('--ch-gap', `${gap.toFixed(1)}px`)
    dom.crosshair.style.setProperty('--ch-size', `${size.toFixed(1)}px`)
    dom.crosshair.style.setProperty('--ch-len', '8px')
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
    addScreenShake(0.08)
  }

  function showKillNotify(victimName, headshot) {
    const player = state.player
    if (!player) return
    const now = performance.now()
    if (now - (player.lastKillAt || 0) < 3500) player.killStreak = (player.killStreak || 0) + 1
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
    addScreenShake(headshot || streak >= 2 ? 0.22 : 0.14)
    clearTimeout(dom.killNotify._timer)
    clearTimeout(dom.killNotify._outTimer)
    dom.killNotify._outTimer = setTimeout(() => {
      dom.killNotify.classList.remove('show')
      dom.killNotify.classList.add('out')
    }, 1500)
    dom.killNotify._timer = setTimeout(() => {
      dom.killNotify.classList.remove('out', 'headshot', 'multi')
    }, 1900)
  }

  function showDamageVignette() {
    dom.damageVignette.classList.add('hit')
    setTimeout(() => dom.damageVignette.classList.remove('hit'), 400)
  }

  function showDirDamage(angle) {
    dom.dirDamage.style.transform = `translate(-50%,-50%) rotate(${angle}rad)`
    dom.dirDamage.classList.add('show')
    setTimeout(() => dom.dirDamage.classList.remove('show'), 800)
  }

  function showCenterMessage(message, duration = 2000, big = '') {
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
    setTimeout(() => item.remove(), 5000)
    while (dom.killFeed.children.length > 6) dom.killFeed.lastChild.remove()
  }

  function showEndScreen(playerWon, config) {
    state.running = false
    if (document.pointerLockElement) document.exitPointerLock()
    dom.deployScreen.classList.remove('show')
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
  }
}
