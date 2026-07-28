const MULTI_TITLES = ['', '', '双杀', '三杀', '四杀', '五杀', '势不可挡', '无人能挡']

export function createHud({ ui, state, audio, config, getMode }) {
  const hudConfig = config.hud

  function formatRatio(kills, deaths) {
    return (kills / Math.max(1, deaths)).toFixed(2)
  }

  function formatWinRate(records) {
    return records.matches ? `${Math.round((records.wins / records.matches) * 100)}%` : '0%'
  }

  function formatPlayTime(seconds) {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor(seconds / 60) % 60
    return hours > 0 ? `${hours} 小时 ${minutes} 分` : `${minutes} 分钟`
  }

  function getRecords(modeId = state.match.modeId || 'classic') {
    return state.records[modeId]
  }

  function renderRecords(modeId = state.match.modeId || 'classic') {
    const records = getRecords(modeId)
    ui.setRecords([
      ['总场次', records.matches],
      ['胜率', formatWinRate(records)],
      ['总击杀', records.kills],
      ['K/D', formatRatio(records.kills, records.deaths)],
      ['爆头数', records.headshots],
      ['近战击杀', records.meleeKills],
      ['投掷物击杀', records.grenadeKills],
      ['最高连杀', records.bestKillStreak],
      ['战斗时长', formatPlayTime(records.totalSeconds)],
    ])
  }

  function showKillNotify(victimName, headshot) {
    const player = state.player
    if (!player) return
    const now = performance.now()
    player.killStreak = now - (player.lastKillAt || 0) < hudConfig.killStreakWindow
      ? (player.killStreak || 0) + 1
      : 1
    player.lastKillAt = now
    const streak = player.killStreak
    let kind = headshot ? 'head' : 'normal'
    let title = headshot ? '爆头' : '击倒敌人'
    if (streak >= 2) {
      title = MULTI_TITLES[Math.min(streak, MULTI_TITLES.length - 1)] || `${streak} 连杀`
      kind = 'multi'
      if (headshot) title = `爆头 · ${title}`
    }
    ui.showKillNotice(title, `已击杀 ${victimName || '敌人'}`, hudConfig.killNotifyCleanupDelay)
    audio.killConfirm(kind)
  }

  function showDeathScreen(attacker) {
    ui.showDeath(attacker ? `被 ${attacker.name || '敌方士兵'} 击杀` : '阵亡')
    ui.setScoreboardVisible(false)
  }

  function showEndScreen(result) {
    const outcome = typeof result === 'boolean' ? { playerWon: result } : result
    const modeState = getMode()?.getHudState()
    if (document.pointerLockElement) document.exitPointerLock()
    const records = getRecords()
    renderRecords()
    ui.showEnd({
      won: outcome.playerWon,
      title: outcome.title || (outcome.playerWon ? '胜利' : '战败'),
      stats: [
        `${modeState?.alliesLabel || '我方'}: ${modeState?.alliesScore ?? state.match.score.allies}    ${modeState?.axisLabel || '敌方'}: ${modeState?.axisScore ?? state.match.score.axis}`,
        ...(outcome.reason ? [`结算: ${outcome.reason}`] : []),
        ...(outcome.details || []),
        `个人击杀: ${state.player.kills}    阵亡: ${state.player.deaths}`,
        `本局 K/D: ${formatRatio(state.player.kills, state.player.deaths)}    爆头: ${state.player.headshots}`,
        `近战击杀: ${state.player.meleeKills}    投掷物击杀: ${state.player.grenadeKills}`,
        `累计 K/D: ${formatRatio(records.kills, records.deaths)}    胜率: ${formatWinRate(records)}`,
        `战斗时长: ${Math.floor((state.simulationTimeMs - state.match.startTime) / 1000)} 秒`,
      ],
    })
  }

  renderRecords()

  return {
    updateHealth: () => ui.invalidate(),
    updateAmmo: () => ui.invalidate(),
    updateCrosshair: () => ui.invalidate(),
    updateScores: () => ui.invalidate(),
    showHitMarker: () => ui.showHitMarker(),
    showKillNotify,
    showDamageVignette: () => ui.showDamage(),
    showDirDamage: source => ui.showDirectionDamage(source),
    showCenterMessage: (message, duration = hudConfig.centerMessageDuration, big = '') =>
      ui.showCenter(message, duration, big),
    showActionMessage: message => ui.showAction(message, hudConfig.actionMessageDuration),
    showDeathScreen,
    hideDeathScreen: () => ui.hideDeath(),
    addKillFeed: (type, killerName, victimName, victimTeam) =>
      ui.addFeed({ type, killer: killerName, victim: victimName, victimTeam }, hudConfig.killFeedItemDuration),
    showEndScreen,
    renderRecords,
    setScoreboardVisible: visible => ui.setScoreboardVisible(visible),
  }
}
