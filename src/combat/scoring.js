export function createScoringSystem({ state, hud, checkVictory, saveRecords }) {
  function getActorName(actor) {
    return actor === state.player ? '你' : actor.name
  }

  function recordPlayerStats(victim, attacker, headshot, attackType) {
    const player = state.player
    if (victim !== player && attacker !== player) return
    const records = state.records
    if (victim === player) records.deaths++
    if (attacker === player) {
      records.kills++
      if (headshot) {
        player.headshots++
        records.headshots++
      }
      if (attackType === 'melee') {
        player.meleeKills++
        records.meleeKills++
      }
      if (attackType === 'grenade') {
        player.grenadeKills++
        records.grenadeKills++
      }
      player.bestKillStreak = Math.max(player.bestKillStreak, player.killStreak)
      records.bestKillStreak = Math.max(records.bestKillStreak, player.bestKillStreak)
    }
    saveRecords(records)
  }

  function recordElimination(victim, attacker, headshot = false, attackType = 'weapon') {
    victim.deaths++

    const scoringTeam = attacker
      ? attacker.team
      : victim.team === 'allies'
        ? 'axis'
        : 'allies'

    if (attacker) {
      attacker.kills++
      const type =
        attacker === state.player ? 'player' : attacker.team === 'allies' ? 'ally' : 'enemy'
      hud.addKillFeed(type, getActorName(attacker), getActorName(victim), victim.team)
      if (attacker === state.player) hud.showKillNotify(getActorName(victim), headshot)
    }

    recordPlayerStats(victim, attacker, headshot, attackType)

    if (scoringTeam === 'allies') state.alliesScore++
    else state.axisScore++

    hud.updateScores()
    checkVictory()
  }

  return { recordElimination }
}
