export const INPUT_ACTION = Object.freeze({
  JUMP: 1,
  RELOAD: 2,
  MELEE: 4,
  GRENADE: 8,
  ITEM: 16,
  SUPPLY: 32,
  SECONDARY: 64,
})

export function hasInputAction(actions, action) {
  return (actions & action) !== 0
}

export const MODE_DEFINITIONS = [
  {
    id: 'classic',
    name: '经典对战',
    description: '盟军与轴心部队争夺击杀目标',
    mapId: 'classic',
  },
  {
    id: 'zombie',
    name: '丧尸模式',
    description: '守卫堡垒，迎击不断涌来的丧尸波次',
    mapId: 'zombie',
  },
]

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

export function recordActorElimination(victim, attacker, headshot, attackType, now, streakWindow) {
  victim.deaths++
  victim.killStreak = 0
  if (!attacker || attacker === victim) return
  attacker.kills++
  attacker.killStreak = now - (attacker.lastKillAt || 0) < streakWindow
    ? (attacker.killStreak || 0) + 1
    : 1
  attacker.lastKillAt = now
  attacker.bestKillStreak = Math.max(attacker.bestKillStreak, attacker.killStreak)
  if (headshot) attacker.headshots++
  if (attackType === 'melee') attacker.meleeKills++
  if (attackType === 'grenade') attacker.grenadeKills++
}
