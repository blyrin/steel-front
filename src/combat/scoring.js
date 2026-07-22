export function createScoringSystem({ state, hud, onElimination, saveRecords }) {
  function getActorName(actor) {
    return actor === state.player ? '你' : actor.name
  }

  function recordPlayerStats(victim, attacker, headshot, attackType) {
    const player = state.player
    if (victim !== player && attacker !== player) return
    const records = state.records[state.match.modeId]
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
    saveRecords(state.records)
  }

  function recordElimination(victim, attacker, headshot = false, attackType = 'weapon') {
    victim.deaths++

    if (attacker) {
      attacker.kills++
      let type = 'enemy'
      if (attacker === state.player) type = 'player'
      else if (attacker.team === 'allies') type = 'ally'
      hud.addKillFeed(type, getActorName(attacker), getActorName(victim), victim.team)
      if (attacker === state.player) hud.showKillNotify(getActorName(victim), headshot)
    }

    recordPlayerStats(victim, attacker, headshot, attackType)

    onElimination({ victim, attacker, headshot, attackType })
    hud.updateScores()
  }

  return { recordElimination }
}
