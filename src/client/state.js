import { CFG } from './config.js'
import { createSimulationState } from '#simulation'

const SETTINGS_KEY = 'steel-front-settings'
const RECORDS_KEY = 'steel-front-records'

function createDefaultRecords() {
  return {
    matches: 0,
    wins: 0,
    losses: 0,
    kills: 0,
    deaths: 0,
    headshots: 0,
    meleeKills: 0,
    grenadeKills: 0,
    bestKillStreak: 0,
    totalSeconds: 0,
  }
}

function recordValue(value) {
  return Number.isInteger(value) && value >= 0 ? value : 0
}

function loadRecordBucket(data) {
  const source = data && typeof data === 'object' && !Array.isArray(data) ? data : {}
  return {
    matches: recordValue(source.matches),
    wins: recordValue(source.wins),
    losses: recordValue(source.losses),
    kills: recordValue(source.kills),
    deaths: recordValue(source.deaths),
    headshots: recordValue(source.headshots),
    meleeKills: recordValue(source.meleeKills),
    grenadeKills: recordValue(source.grenadeKills),
    bestKillStreak: recordValue(source.bestKillStreak),
    totalSeconds: recordValue(source.totalSeconds),
  }
}

function loadRecords() {
  const raw = localStorage.getItem(RECORDS_KEY)
  if (!raw) return { classic: createDefaultRecords(), zombie: createDefaultRecords() }
  const data = JSON.parse(raw)
  if (!data || typeof data !== 'object' || Array.isArray(data))
    throw new TypeError('战绩数据格式无效')
  if (Object.hasOwn(data, 'classic') || Object.hasOwn(data, 'zombie')) {
    return {
      classic: loadRecordBucket(data.classic),
      zombie: loadRecordBucket(data.zombie),
    }
  }
  return {
    classic: loadRecordBucket(data),
    zombie: createDefaultRecords(),
  }
}

function createDefaultSettings() {
  return {
    masterVolume: CFG.settings.masterVolume,
    mouseSensitivity: CFG.settings.mouseSensitivity,
    loadout: {
      weapon: CFG.loadout.defaultWeapon,
      secondary: CFG.loadout.defaultSecondary,
      grenade: CFG.loadout.defaultGrenade,
      item: CFG.loadout.defaultItem,
    },
  }
}

function loadSettings() {
  const defaults = createDefaultSettings()
  const raw = localStorage.getItem(SETTINGS_KEY)
  if (!raw) return defaults

  const data = JSON.parse(raw)
  const loadout = data.loadout || defaults.loadout
  return {
    masterVolume: data.masterVolume ?? defaults.masterVolume,
    mouseSensitivity: data.mouseSensitivity ?? defaults.mouseSensitivity,
    loadout: {
      weapon: Object.hasOwn(CFG.weapons, loadout.weapon)
        ? loadout.weapon
        : defaults.loadout.weapon,
      secondary: Object.hasOwn(CFG.secondaries, loadout.secondary)
        ? loadout.secondary
        : defaults.loadout.secondary,
      grenade: Object.hasOwn(CFG.grenades, loadout.grenade)
        ? loadout.grenade
        : defaults.loadout.grenade,
      item: Object.hasOwn(CFG.items, loadout.item) ? loadout.item : defaults.loadout.item,
    },
  }
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

export function saveRecords(records) {
  localStorage.setItem(RECORDS_KEY, JSON.stringify(records))
}

export function recordMatchResult(records, modeId, playerWon, durationSeconds) {
  const modeRecords = records[modeId]
  modeRecords.matches++
  if (playerWon) modeRecords.wins++
  else modeRecords.losses++
  modeRecords.totalSeconds += Math.floor(durationSeconds)
  saveRecords(records)
}

export function createGameState() {
  return createSimulationState({ records: loadRecords(), settings: loadSettings() })
}

export function createDeployState() {
  return {
    phase: 'none',
    deathTimer: 0,
    animTime: 0,
    spawnPoint: null,
  }
}
