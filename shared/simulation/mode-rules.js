export function scoringTeam(victim, attacker) {
  if (attacker) return attacker.team
  return victim.team === 'allies' ? 'axis' : 'allies'
}

export function classicOutcome(score, killTarget) {
  if (score.allies >= killTarget) return { winner: 'allies', reason: '盟军达到击杀目标' }
  if (score.axis >= killTarget) return { winner: 'axis', reason: '轴心达到击杀目标' }
  return null
}

export function zombieWaveTotal(wave, config) {
  return config.waveStartCount + (wave - 1) * config.waveIncrement
}

export function zombiePackSize(distance, halfMap, config, random = Math.random) {
  const span = halfMap - config.guardRadius
  const progress = Math.min(1, Math.max(0, (distance - config.guardRadius) / span))
  const expected = 1 + progress * progress * (config.wavePackMax - 1)
  return Math.max(1, Math.min(config.wavePackMax, Math.round(expected * (0.7 + random() * 0.6))))
}
