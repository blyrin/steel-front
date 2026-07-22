import { CFG } from './config.js'

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

function loadRecords() {
  const raw = localStorage.getItem(RECORDS_KEY)
  if (!raw) return createDefaultRecords()
  const data = JSON.parse(raw)
  if (!data || typeof data !== 'object' || Array.isArray(data))
    throw new TypeError('战绩数据格式无效')
  return {
    matches: recordValue(data.matches),
    wins: recordValue(data.wins),
    losses: recordValue(data.losses),
    kills: recordValue(data.kills),
    deaths: recordValue(data.deaths),
    headshots: recordValue(data.headshots),
    meleeKills: recordValue(data.meleeKills),
    grenadeKills: recordValue(data.grenadeKills),
    bestKillStreak: recordValue(data.bestKillStreak),
    totalSeconds: recordValue(data.totalSeconds),
  }
}

function createDefaultSettings() {
  return {
    masterVolume: CFG.settings.masterVolume,
    mouseSensitivity: CFG.settings.mouseSensitivity,
    loadout: {
      weapon: CFG.loadout.defaultWeapon,
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

export function recordMatchResult(records, playerWon, durationSeconds) {
  records.matches++
  if (playerWon) records.wins++
  else records.losses++
  records.totalSeconds += Math.floor(durationSeconds)
  saveRecords(records)
}

export function createGameState() {
  return {
    running: false,
    paused: false,
    loading: true,
    alliesScore: 0,
    axisScore: 0,
    player: null,
    bots: [],
    particles: [],
    obstacles: [],
    coverPoints: [],
    ammoStations: [],
    smokeClouds: [],
    startTime: 0,
    records: loadRecords(),
    settings: loadSettings(),
  }
}

export function createDeployState() {
  return {
    phase: 'none',
    deathTimer: 0,
    animTime: 0,
    spawnPoint: null,
  }
}
