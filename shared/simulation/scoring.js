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
