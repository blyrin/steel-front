export function createScoringSystem({ state, hud, checkVictory }) {
  function getActorName(actor) {
    return actor === state.player ? '你' : actor.name
  }

  function recordElimination(victim, attacker, headshot = false) {
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

    if (scoringTeam === 'allies') state.alliesScore++
    else state.axisScore++

    hud.updateScores()
    checkVictory()
  }

  return { recordElimination }
}
