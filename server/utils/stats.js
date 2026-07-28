import { ensureDatabase } from './database.js'

export async function recordMatch(matchId, room, actor, won, abandoned = false) {
  if (!actor.userId || !actor.deployed) return
  const db = await ensureDatabase()
  const scope = room.visibility === 'private' ? 'all' : 'ranked'
  const duration = Math.max(0, Math.floor((room.simulation.timeMs - room.startedAt) / 1000))
  const highestWave = room.simulation.createSnapshot().modeState.wave ?? 0
  await db.exec('BEGIN IMMEDIATE')
  try {
    const inserted = await db.sql`INSERT OR IGNORE INTO match_results(
      match_id, user_id, mode, scope, won, abandoned, kills, deaths, headshots,
      melee_kills, grenade_kills, best_kill_streak, duration_seconds, highest_wave, created_at
    ) VALUES (${matchId}, ${actor.userId}, ${room.modeId}, ${scope}, ${won ? 1 : 0},
      ${abandoned ? 1 : 0}, ${actor.kills}, ${actor.deaths}, ${actor.headshots},
      ${actor.meleeKills}, ${actor.grenadeKills}, ${actor.bestKillStreak}, ${duration}, ${highestWave}, ${Date.now()})`
    if (inserted.changes === 0) {
      await db.exec('COMMIT')
      return
    }
    for (const bucket of scope === 'ranked' ? ['all', 'ranked'] : ['all']) {
      await db.sql`INSERT INTO mode_stats(user_id, mode, scope, matches, wins, losses, kills, deaths,
        headshots, melee_kills, grenade_kills, best_kill_streak, total_seconds, highest_wave)
        VALUES (${actor.userId}, ${room.modeId}, ${bucket}, 1, ${won ? 1 : 0}, ${won ? 0 : 1},
          ${actor.kills}, ${actor.deaths}, ${actor.headshots}, ${actor.meleeKills}, ${actor.grenadeKills},
          ${actor.bestKillStreak}, ${duration}, ${highestWave})
        ON CONFLICT(user_id, mode, scope) DO UPDATE SET
          matches = matches + 1, wins = wins + excluded.wins, losses = losses + excluded.losses,
          kills = kills + excluded.kills, deaths = deaths + excluded.deaths,
          headshots = headshots + excluded.headshots, melee_kills = melee_kills + excluded.melee_kills,
          grenade_kills = grenade_kills + excluded.grenade_kills,
          best_kill_streak = MAX(best_kill_streak, excluded.best_kill_streak),
          total_seconds = total_seconds + excluded.total_seconds,
          highest_wave = MAX(highest_wave, excluded.highest_wave)`
    }
    await db.exec('COMMIT')
  } catch (error) {
    await db.exec('ROLLBACK')
    throw error
  }
}

export async function profileStats(userId) {
  const db = await ensureDatabase()
  const result = await db.sql`SELECT * FROM mode_stats WHERE user_id = ${userId}`
  return result.rows ?? []
}

export async function leaderboard(mode) {
  const db = await ensureDatabase()
  const order = mode === 'classic'
    ? 'stats.wins DESC, stats.kills DESC, stats.deaths ASC'
    : 'stats.highest_wave DESC, stats.kills DESC, stats.deaths ASC'
  const result = await db.prepare(`SELECT users.display_name, stats.matches, stats.wins, stats.losses,
    stats.kills, stats.deaths, stats.headshots, stats.best_kill_streak, stats.highest_wave
    FROM mode_stats stats JOIN users ON users.id = stats.user_id
    WHERE stats.mode = '${mode}' AND stats.scope = 'ranked'
    ORDER BY ${order} LIMIT 50`).all()
  return result
}
